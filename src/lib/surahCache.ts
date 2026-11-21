import type { AyahTiming, AyahWord, SurahPayload } from '../types/quran';

export interface AudioOnlyPayload {
  chapterId: number;
  reciterId: number;
  audioUrl: string;
  timings: AyahTiming[];
}

export class SurahCache {
  private readonly maxEntries: number;
  private readonly store = new Map<string, SurahPayload>();
  private readonly inflight = new Map<string, Promise<SurahPayload>>();
  private readonly wordsStore = new Map<number, Record<string, AyahWord[]>>();
  private readonly wordsInflight = new Map<number, Promise<Record<string, AyahWord[]>>>();

  constructor(maxEntries = 32) {
    this.maxEntries = maxEntries;
  }

  static makeKey(chapterId: number, reciterId: number): string {
    return `${reciterId}:${chapterId}`;
  }

  get(chapterId: number, reciterId: number): SurahPayload | undefined {
    const key = SurahCache.makeKey(chapterId, reciterId);
    const existing = this.store.get(key);
    if (!existing) return undefined;
    // Refresh LRU recency
    this.store.delete(key);
    this.store.set(key, existing);
    return existing;
  }

  has(chapterId: number, reciterId: number): boolean {
    return this.store.has(SurahCache.makeKey(chapterId, reciterId));
  }

  set(payload: SurahPayload): void {
    const cachedWords = this.wordsStore.get(payload.chapterId);
    const mergedPayload: SurahPayload =
      !payload.wordsHydrated && cachedWords
        ? {
            ...payload,
            wordsHydrated: true,
            ayahs: payload.ayahs.map((a) => ({
              ...a,
              words: cachedWords[a.verseKey] ?? a.words,
            })),
          }
        : payload;

    if (mergedPayload.wordsHydrated && !cachedWords) {
      const extracted: Record<string, AyahWord[]> = {};
      for (const a of mergedPayload.ayahs) {
        if (a.words && a.words.length > 0) {
          extracted[a.verseKey] = a.words;
        }
      }
      if (Object.keys(extracted).length > 0) {
        this.wordsStore.set(mergedPayload.chapterId, extracted);
      }
    }

    const key = SurahCache.makeKey(mergedPayload.chapterId, mergedPayload.reciterId);
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    this.store.set(key, mergedPayload);
    if (this.store.size > this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
  }

  /**
   * Attaches hydrated word-by-word data to all cached reciter entries for chapterId.
   */
  mergeWords(chapterId: number, wordsByVerse: Record<string, AyahWord[]>): void {
    this.wordsStore.set(chapterId, wordsByVerse);
    for (const [key, entry] of this.store.entries()) {
      if (entry.chapterId === chapterId && !entry.wordsHydrated) {
        this.store.set(key, {
          ...entry,
          wordsHydrated: true,
          ayahs: entry.ayahs.map((a) => ({
            ...a,
            words: wordsByVerse[a.verseKey] ?? a.words,
          })),
        });
      }
    }
  }

  getWords(chapterId: number): Record<string, AyahWord[]> | undefined {
    return this.wordsStore.get(chapterId);
  }

  async getOrFetchWords(
    chapterId: number,
    fetcher: () => Promise<Record<string, AyahWord[]>>,
  ): Promise<Record<string, AyahWord[]>> {
    const cached = this.wordsStore.get(chapterId);
    if (cached) return cached;

    const pending = this.wordsInflight.get(chapterId);
    if (pending) return pending;

    const promise = fetcher()
      .then((wordsByVerse) => {
        this.mergeWords(chapterId, wordsByVerse);
        this.wordsInflight.delete(chapterId);
        return wordsByVerse;
      })
      .catch((err) => {
        this.wordsInflight.delete(chapterId);
        throw err;
      });

    this.wordsInflight.set(chapterId, promise);
    return promise;
  }

  /**
   * Returns an existing cached SurahPayload, attaches to an already in-flight
   * request for the same (chapterId, reciterId), or starts a single shared fetch.
   */
  async getOrFetch(
    chapterId: number,
    reciterId: number,
    fetcher: () => Promise<SurahPayload>,
  ): Promise<SurahPayload> {
    const cached = this.get(chapterId, reciterId);
    if (cached) return cached;

    const key = SurahCache.makeKey(chapterId, reciterId);
    const pending = this.inflight.get(key);
    if (pending) return pending;

    const promise = fetcher()
      .then((payload) => {
        this.set(payload);
        this.inflight.delete(key);
        return this.get(chapterId, reciterId) ?? payload;
      })
      .catch((err) => {
        this.inflight.delete(key);
        throw err;
      });

    this.inflight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.store.clear();
    this.inflight.clear();
    this.wordsStore.clear();
    this.wordsInflight.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

export const clientSurahCache = new SurahCache(32);
