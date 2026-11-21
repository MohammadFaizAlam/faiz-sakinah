import type { AyahTiming, SurahChapter, WordSegment } from '../types/quran.js';

/**
 * Finds the active ayah index for a given playback position (in milliseconds)
 * using O(log n) binary search over a sorted timing array.
 *
 * Gap handling:
 * - Before the first ayah begins: keeps index 0 active.
 * - In silent gaps between ayah i (timestampTo) and ayah i+1 (timestampFrom):
 *   keeps ayah i active until ayah i+1 actually starts.
 * - After the final ayah: keeps the final ayah active.
 */
export function findActiveAyahIndex(
  timings: readonly AyahTiming[],
  currentTimeMs: number,
): number {
  const len = timings.length;
  if (len === 0) return 0;

  const safeMs = Number.isFinite(currentTimeMs) ? Math.max(0, currentTimeMs) : 0;

  if (safeMs < timings[0].timestampFrom) {
    return 0;
  }

  let low = 0;
  let high = len - 1;
  let result = 0;

  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (timings[mid].timestampFrom <= safeMs) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}

/**
 * Finds the currently recited 1-based word position inside an ayah using O(log n)
 * binary search over real word timing segments. Returns null if before the first
 * segment or well past the final segment (e.g. during pauses between verses).
 */
export function findActiveWordPosition(
  segments: readonly WordSegment[] | undefined,
  currentTimeMs: number,
): number | null {
  if (!segments || segments.length === 0) return null;
  if (!Number.isFinite(currentTimeMs) || currentTimeMs < 0) return null;

  const first = segments[0];
  const last = segments[segments.length - 1];
  if (currentTimeMs < first.timestampFrom - 40) return null;
  if (currentTimeMs > last.timestampTo + 350) return null;

  let low = 0;
  let high = segments.length - 1;
  let candidateIdx = 0;

  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (segments[mid].timestampFrom <= currentTimeMs) {
      candidateIdx = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const seg = segments[candidateIdx];
  // If we're inside the segment or inside a tiny natural micro-pause (< 320ms) before the next word, keep it lit smoothly
  if (currentTimeMs <= seg.timestampTo + 320) {
    return seg.wordPosition;
  }
  return null;
}

/**
 * Resolves the exact seek timestamp in seconds for a specific word inside an ayah.
 * Falls back to the ayah's start timestamp if segment timings are unavailable.
 */
export function findTimestampForWord(
  timing: AyahTiming | undefined,
  wordPosition: number,
): number | null {
  if (!timing) return null;
  const seg = timing.segments?.find((s) => s.wordPosition === wordPosition);
  if (seg) {
    return Math.max(0, seg.timestampFrom / 1000);
  }
  return Math.max(0, timing.timestampFrom / 1000);
}

/**
 * Resolves the exact seek position in seconds for a target verseKey (e.g. "2:255")
 * in a reciter's timing array so reciter switches preserve position by ayah, not raw seconds.
 */
export function findTimestampForVerse(
  timings: readonly AyahTiming[],
  verseKey: string | null | undefined,
  fallbackIndex = 0,
): number {
  if (timings.length === 0) return 0;

  if (verseKey) {
    const exact = timings.find((t) => t.verseKey === verseKey);
    if (exact) {
      return Math.max(0, exact.timestampFrom / 1000);
    }
  }

  const clamped = Math.max(0, Math.min(timings.length - 1, fallbackIndex));
  return Math.max(0, timings[clamped].timestampFrom / 1000);
}

/**
 * Normalizes latin text for resilient surah search (strips diacritics, hyphens, apostrophes).
 */
export function normalizeSearchText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`\-_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes common Arabic-to-English transliteration variants so queries like
 * "yaseen", "fatiha", "bakara", "ikhlaas", "rahman", or "al baqarah" match smoothly.
 */
export function normalizePhoneticTransliteration(input: string): string {
  return normalizeSearchText(input)
    .replace(/^(al|ar|as|ash|at|az|an|ad)\s*/i, '')
    .replace(/aa+/g, 'a')
    .replace(/ee+|iy/g, 'i')
    .replace(/oo+|uu+/g, 'u')
    .replace(/ph/g, 'f')
    .replace(/q/g, 'k')
    .replace(/dh/g, 'd')
    .replace(/ah$/g, 'a')
    .replace(/\s+/g, '');
}

/**
 * Computes Levenshtein edit distance between two short strings with early exit.
 */
function editDistance(a: string, b: string, maxDist = 3): number {
  if (a === b) return 0;
  const lenA = a.length;
  const lenB = b.length;
  if (Math.abs(lenA - lenB) > maxDist) return maxDist + 1;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  let prev = new Array<number>(lenB + 1);
  let curr = new Array<number>(lenB + 1);
  for (let j = 0; j <= lenB; j += 1) prev[j] = j;

  for (let i = 1; i <= lenA; i += 1) {
    curr[0] = i;
    let rowMin = i;
    const chA = a.charCodeAt(i - 1);
    for (let j = 1; j <= lenB; j += 1) {
      const cost = chA === b.charCodeAt(j - 1) ? 0 : 1;
      const val = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      curr[j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > maxDist) return maxDist + 1;
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  return prev[lenB];
}

/**
 * Scores a fuzzy subsequence match (every character of query appears in target in order),
 * rewarding consecutive characters, word-start alignment, and compactness.
 */
function subsequenceScore(query: string, target: string): number {
  if (!query || !target || query.length > target.length) return 0;

  let qIdx = 0;
  let score = 0;
  let consecutive = 0;
  let firstMatch = -1;
  let lastMatch = -1;

  for (let tIdx = 0; tIdx < target.length && qIdx < query.length; tIdx += 1) {
    if (target[tIdx] === query[qIdx]) {
      if (firstMatch === -1) firstMatch = tIdx;
      consecutive = lastMatch === tIdx - 1 ? consecutive + 1 : 1;
      lastMatch = tIdx;

      const isWordStart = tIdx === 0 || target[tIdx - 1] === ' ';
      score += 12 + consecutive * 6 + (isWordStart ? 10 : 0);
      qIdx += 1;
    }
  }

  if (qIdx < query.length) return 0;

  const span = lastMatch - firstMatch + 1;
  const density = query.length / Math.max(span, 1);
  const lengthRatio = query.length / target.length;
  return Math.round(score * (0.65 + 0.35 * density) + lengthRatio * 40);
}

/**
 * Computes a relevance score for a single chapter against a user's fuzzy search query.
 * Returns 0 if the chapter does not match.
 */
export function scoreSurahMatch(chapter: SurahChapter, rawQuery: string): number {
  const trimmed = rawQuery.trim();
  if (!trimmed) return 1;

  const normalized = normalizeSearchText(trimmed);
  const compactQuery = normalized.replace(/\s+/g, '');
  const phoneticQuery = normalizePhoneticTransliteration(trimmed);
  const numericOnly = /^\d+$/.test(trimmed);

  let bestScore = 0;

  // 1. Surah number matching (exact match ranks highest)
  const idStr = String(chapter.id);
  const paddedId = idStr.padStart(3, '0');
  if (numericOnly) {
    const numericVal = Number.parseInt(trimmed, 10);
    if (chapter.id === numericVal) return 1000;
    if (idStr.startsWith(trimmed) || paddedId.startsWith(trimmed)) {
      bestScore = Math.max(bestScore, 820 - chapter.id * 0.1);
    } else if (idStr.includes(trimmed)) {
      bestScore = Math.max(bestScore, 520 - chapter.id * 0.1);
    }
    return bestScore;
  }

  // 2. Arabic script direct match
  if (chapter.nameArabic.includes(trimmed)) {
    bestScore = Math.max(bestScore, 940);
  }

  // 3. Normalized English transliteration & translated meaning
  const simple = normalizeSearchText(chapter.nameSimple);
  const simpleNoPrefix = simple.replace(/^(al|ar|as|ash|at|az|an|ad)\s*/i, '');
  const complex = normalizeSearchText(chapter.nameComplex);
  const translated = normalizeSearchText(chapter.translatedName);

  const candidates = [
    { text: simple, weight: 1.0 },
    { text: simpleNoPrefix, weight: 1.0 },
    { text: complex, weight: 0.96 },
    { text: translated, weight: 0.88 },
  ];

  for (const { text, weight } of candidates) {
    if (!text) continue;
    const compactText = text.replace(/\s+/g, '');

    if (text === normalized || compactText === compactQuery) {
      bestScore = Math.max(bestScore, Math.round(960 * weight));
    } else if (text.startsWith(normalized) || compactText.startsWith(compactQuery)) {
      bestScore = Math.max(bestScore, Math.round(860 * weight));
    } else if (text.includes(normalized) || compactText.includes(compactQuery)) {
      bestScore = Math.max(bestScore, Math.round(740 * weight));
    } else if (compactQuery.length >= 2) {
      const sub = subsequenceScore(compactQuery, compactText);
      if (sub > 0) {
        bestScore = Math.max(bestScore, Math.round((320 + sub) * weight));
      }
    }
  }

  // 4. Phonetic transliteration matching (e.g. "yaseen" -> "Ya-Sin", "bakara" -> "Al-Baqarah", "fatiha" -> "Al-Fatihah")
  if (phoneticQuery.length >= 2) {
    const phoneticSimple = normalizePhoneticTransliteration(chapter.nameSimple);
    const phoneticComplex = normalizePhoneticTransliteration(chapter.nameComplex);

    for (const target of [phoneticSimple, phoneticComplex]) {
      if (!target) continue;
      if (target === phoneticQuery) {
        bestScore = Math.max(bestScore, 930);
      } else if (target.startsWith(phoneticQuery)) {
        bestScore = Math.max(bestScore, 830);
      } else if (target.includes(phoneticQuery)) {
        bestScore = Math.max(bestScore, 710);
      } else {
        const sub = subsequenceScore(phoneticQuery, target);
        if (sub > 0) {
          bestScore = Math.max(bestScore, 310 + sub);
        }

        // Typo tolerance via bounded Levenshtein distance (for queries >= 3 chars)
        if (phoneticQuery.length >= 3) {
          const maxAllowed = phoneticQuery.length >= 6 ? 2 : 1;
          const dist = editDistance(phoneticQuery, target, maxAllowed);
          if (dist <= maxAllowed) {
            bestScore = Math.max(bestScore, 620 - dist * 130);
          } else if (target.length > phoneticQuery.length) {
            // Prefix typo tolerance (e.g. "baqar" vs "baqara")
            const prefixSlice = target.slice(0, phoneticQuery.length);
            const prefixDist = editDistance(phoneticQuery, prefixSlice, 1);
            if (prefixDist <= 1) {
              bestScore = Math.max(bestScore, 510 - prefixDist * 90);
            }
          }
        }
      }
    }
  }

  return bestScore;
}

/**
 * Fuzzy-searches and ranks the 114 surahs by English transliteration, phonetic spelling,
 * typos, subsequence, translated meaning, Arabic name, or surah number.
 */
export function filterSurahs(
  chapters: readonly SurahChapter[],
  rawQuery: string,
): SurahChapter[] {
  const trimmed = rawQuery.trim();
  if (!trimmed) return [...chapters];

  const scored: Array<{ chapter: SurahChapter; score: number }> = [];
  for (const chapter of chapters) {
    const score = scoreSurahMatch(chapter, trimmed);
    if (score > 0) {
      scored.push({ chapter, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.chapter.id - b.chapter.id);
  return scored.map((entry) => entry.chapter);
}

/**
 * Cleans Quran.com translation HTML by removing footnote superscript markers,
 * stripping tags, and decoding common HTML entities.
 */
export function sanitizeTranslationHtml(raw: string): string {
  if (!raw) return '';

  return raw
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;|&#x27;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+([,.;:?!])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats seconds into tabular mm:ss or h:mm:ss.
 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export interface AyahVisualState {
  distance: number;
  isActive: boolean;
  opacity: number;
  scale: number;
}

/**
 * Smooth distance-based attenuation for the synced ayah theater.
 */
export function computeAyahVisualState(
  index: number,
  activeIndex: number,
): AyahVisualState {
  const distance = Math.abs(index - activeIndex);
  if (distance === 0) {
    return { distance: 0, isActive: true, opacity: 1, scale: 1 };
  }
  if (distance === 1) {
    return { distance: 1, isActive: false, opacity: 0.44, scale: 0.94 };
  }
  if (distance === 2) {
    return { distance: 2, isActive: false, opacity: 0.25, scale: 0.9 };
  }
  return {
    distance,
    isActive: false,
    opacity: 0.15,
    scale: 0.88,
  };
}

export type AyahLengthTier = 'short' | 'medium' | 'long' | 'extended';

/**
 * Classifies an ayah by combined Arabic and English character length so
 * long Madani verses (e.g. Al-Baqarah 2:282) scale cleanly without clipping.
 */
export function getAyahLengthTier(
  arabicText: string,
  translationText: string,
): AyahLengthTier {
  const effectiveLen = Math.max(translationText.length, arabicText.length * 0.9);
  if (effectiveLen <= 105) return 'short';
  if (effectiveLen <= 230) return 'medium';
  if (effectiveLen <= 460) return 'long';
  return 'extended';
}
