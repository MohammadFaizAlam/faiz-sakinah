import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeUpdatedStreak,
  formatListeningDuration,
  removeReflectionBookmark,
  upsertListeningSession,
  upsertReflectionBookmark,
} from './journeyUtils';
import type { ListeningSession, ReflectionBookmark } from '../types/quran';

test('computeUpdatedStreak handles first day, same day, consecutive day, and reset after gap', () => {
  assert.deepEqual(computeUpdatedStreak(0, null, '2026-11-20'), {
    streakDays: 1,
    lastActiveDate: '2026-11-20',
  });
  assert.deepEqual(computeUpdatedStreak(3, '2026-11-20', '2026-11-20'), {
    streakDays: 3,
    lastActiveDate: '2026-11-20',
  });
  assert.deepEqual(computeUpdatedStreak(3, '2026-11-20', '2026-11-21'), {
    streakDays: 4,
    lastActiveDate: '2026-11-21',
  });
  assert.deepEqual(computeUpdatedStreak(5, '2026-11-18', '2026-11-21'), {
    streakDays: 1,
    lastActiveDate: '2026-11-21',
  });
});

test('upsertReflectionBookmark and removeReflectionBookmark preserve createdAt and order newest first', () => {
  const initial: ReflectionBookmark[] = [];
  const first = upsertReflectionBookmark(
    initial,
    {
      verseKey: '1:1',
      chapterId: 1,
      verseNumber: 1,
      surahName: 'Al-Fatihah',
      surahArabic: 'الفاتحة',
      textUthmani: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
      translationText: 'In the name of God, the Lord of Mercy, the Giver of Mercy!',
      note: 'Begin with gratitude.',
    },
    1000,
  );
  assert.equal(first.length, 1);
  assert.equal(first[0].createdAt, 1000);

  const second = upsertReflectionBookmark(
    first,
    {
      verseKey: '2:255',
      chapterId: 2,
      verseNumber: 255,
      surahName: 'Al-Baqarah',
      surahArabic: 'البقرة',
      textUthmani: 'ٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ',
      translationText: 'God: there is no god but Him.',
      note: 'Peace before sleep.',
    },
    2000,
  );
  assert.equal(second[0].verseKey, '2:255');

  // Updating 1:1 promotes it to top while preserving original createdAt
  const updated = upsertReflectionBookmark(
    second,
    { ...first[0], note: '  Begin every task with mercy.  ' },
    3000,
  );
  assert.equal(updated[0].verseKey, '1:1');
  assert.equal(updated[0].note, 'Begin every task with mercy.');
  assert.equal(updated[0].createdAt, 1000);
  assert.equal(updated[0].updatedAt, 3000);

  const removed = removeReflectionBookmark(updated, '1:1');
  assert.equal(removed.length, 1);
  assert.equal(removed[0].verseKey, '2:255');
});

test('upsertListeningSession deduplicates by chapterId and caps length', () => {
  const makeSession = (chapterId: number, ts: number): ListeningSession => ({
    chapterId,
    surahName: `Surah ${chapterId}`,
    surahArabic: 'سورة',
    verseKey: `${chapterId}:1`,
    ayahIndex: 0,
    reciterId: 7,
    reciterName: 'Mishari',
    lastListenedAt: ts,
  });

  let sessions: ListeningSession[] = [];
  for (let i = 1; i <= 5; i += 1) {
    sessions = upsertListeningSession(sessions, makeSession(i, i * 100), 3);
  }
  assert.deepEqual(
    sessions.map((s) => s.chapterId),
    [5, 4, 3],
  );

  sessions = upsertListeningSession(sessions, makeSession(4, 999), 3);
  assert.deepEqual(
    sessions.map((s) => s.chapterId),
    [4, 5, 3],
  );
});

test('formatListeningDuration renders calm compact durations', () => {
  assert.equal(formatListeningDuration(0), '0m');
  assert.equal(formatListeningDuration(45), '45s');
  assert.equal(formatListeningDuration(180), '3m');
  assert.equal(formatListeningDuration(3600), '1h');
  assert.equal(formatListeningDuration(4520), '1h 15m');
});
