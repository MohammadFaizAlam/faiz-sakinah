import type { ListeningSession, ReflectionBookmark } from '../types/quran';

/**
 * Returns local calendar date key in YYYY-MM-DD format for streak tracking.
 */
export function getLocalDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Computes day difference between two YYYY-MM-DD local date keys.
 */
export function diffCalendarDays(prevKey: string | null, nextKey: string): number {
  if (!prevKey) return Infinity;
  const [py, pm, pd] = prevKey.split('-').map(Number);
  const [ny, nm, nd] = nextKey.split('-').map(Number);
  if (!py || !pm || !pd || !ny || !nm || !nd) return Infinity;
  const prevUtc = Date.UTC(py, pm - 1, pd);
  const nextUtc = Date.UTC(ny, nm - 1, nd);
  return Math.round((nextUtc - prevUtc) / (24 * 60 * 60 * 1000));
}

/**
 * Updates daily listening streak cleanly when activity happens on a calendar day.
 */
export function computeUpdatedStreak(
  currentStreak: number,
  lastActiveDate: string | null,
  todayKey: string,
): { streakDays: number; lastActiveDate: string } {
  if (!lastActiveDate) {
    return { streakDays: 1, lastActiveDate: todayKey };
  }
  const delta = diffCalendarDays(lastActiveDate, todayKey);
  if (delta <= 0) {
    return { streakDays: Math.max(1, currentStreak), lastActiveDate };
  }
  if (delta === 1) {
    return { streakDays: Math.max(1, currentStreak) + 1, lastActiveDate: todayKey };
  }
  return { streakDays: 1, lastActiveDate: todayKey };
}

/**
 * Inserts or updates a reflection bookmark, keeping newest edits at the top.
 */
export function upsertReflectionBookmark(
  bookmarks: readonly ReflectionBookmark[],
  input: Omit<ReflectionBookmark, 'createdAt' | 'updatedAt'>,
  now = Date.now(),
): ReflectionBookmark[] {
  const existing = bookmarks.find((b) => b.verseKey === input.verseKey);
  const nextEntry: ReflectionBookmark = {
    ...input,
    note: input.note.trim(),
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };
  const rest = bookmarks.filter((b) => b.verseKey !== input.verseKey);
  return [nextEntry, ...rest];
}

/**
 * Removes a reflection bookmark by verseKey.
 */
export function removeReflectionBookmark(
  bookmarks: readonly ReflectionBookmark[],
  verseKey: string,
): ReflectionBookmark[] {
  return bookmarks.filter((b) => b.verseKey !== verseKey);
}

/**
 * Records or promotes a recent listening session per chapter (max 12 entries).
 */
export function upsertListeningSession(
  sessions: readonly ListeningSession[],
  session: ListeningSession,
  maxItems = 12,
): ListeningSession[] {
  const filtered = sessions.filter((s) => s.chapterId !== session.chapterId);
  return [session, ...filtered].slice(0, maxItems);
}

/**
 * Formats cumulative listening duration into calm editorial phrasing (e.g. "12m", "1h 24m").
 */
export function formatListeningDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  if (safe < 60) {
    return safe === 0 ? '0m' : `${safe}s`;
  }
  const totalMinutes = Math.floor(safe / 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins}m`;
}
