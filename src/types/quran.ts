export interface SurahChapter {
  id: number;
  nameSimple: string;
  nameComplex: string;
  nameArabic: string;
  translatedName: string;
  revelationPlace: 'makkah' | 'madinah' | string;
  versesCount: number;
  bismillahPre: boolean;
}

export interface Reciter {
  id: number;
  name: string;
  style: string | null;
  qirat: string | null;
}

export interface WordSegment {
  wordPosition: number; // 1-based position within verse
  timestampFrom: number; // milliseconds
  timestampTo: number; // milliseconds
}

export interface AyahTiming {
  verseKey: string;
  verseNumber: number;
  timestampFrom: number; // milliseconds
  timestampTo: number; // milliseconds
  duration: number; // milliseconds
  segments: WordSegment[];
}

export interface AyahWord {
  position: number; // 1-based position within verse
  textUthmani: string;
  translation: string;
  transliteration: string;
  audioUrl: string | null;
}

export interface AyahItem {
  id: number;
  verseNumber: number;
  verseKey: string;
  textUthmani: string;
  translationText: string;
  juzNumber: number;
  pageNumber: number;
  words: AyahWord[];
}

export interface TranslationMeta {
  id: number;
  name: string;
  authorName: string;
}

export interface SurahPayload {
  chapterId: number;
  reciterId: number;
  audioUrl: string;
  translation: TranslationMeta;
  ayahs: AyahItem[];
  timings: AyahTiming[];
  wordsHydrated?: boolean;
}

export type AudioStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'error';

export type AtmosphereMood = 'midnight-silk' | 'lunar-mist' | 'still-night';

export interface ReflectionBookmark {
  verseKey: string;
  chapterId: number;
  verseNumber: number;
  surahName: string;
  surahArabic: string;
  textUthmani: string;
  translationText: string;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface ListeningSession {
  chapterId: number;
  surahName: string;
  surahArabic: string;
  verseKey: string;
  ayahIndex: number;
  reciterId: number;
  reciterName: string;
  lastListenedAt: number;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
