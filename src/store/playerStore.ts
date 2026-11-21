import { create } from 'zustand';
import {
  invokeSeekImmediate,
  invokeTogglePlayImmediate,
  readLiveAudioTime,
} from '../lib/audioBridge';
import {
  findActiveAyahIndex,
  findActiveWordPosition,
  findTimestampForVerse,
  findTimestampForWord,
} from '../lib/quranUtils';
import { shaderSignal, triggerAyahPulse } from '../lib/shaderSignal';
import { clientSurahCache, type AudioOnlyPayload } from '../lib/surahCache';
import type {
  AudioStatus,
  AyahWord,
  Reciter,
  SurahChapter,
  SurahPayload,
} from '../types/quran';

interface SeekRequest {
  timeSeconds: number;
  nonce: number;
  playAfter?: boolean;
}

interface PlayerState {
  chapters: SurahChapter[];
  reciters: Reciter[];
  bootLoading: boolean;
  bootError: string | null;

  currentChapterId: number;
  currentReciterId: number | null;
  surahData: SurahPayload | null;
  surahLoading: boolean;
  surahError: string | null;

  audioStatus: AudioStatus;
  audioError: string | null;
  isPlaying: boolean;
  shouldAutoPlay: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;

  activeAyahIndex: number;
  activeWordPosition: number | null;
  autoFollow: boolean;
  surahDrawerOpen: boolean;

  pendingSeekVerseKey: string | null;
  seekRequest: SeekRequest | null;
  playbackNonce: number;

  // Actions
  initialize: () => Promise<void>;
  loadSurah: (
    chapterId: number,
    reciterId: number,
    options?: { preserveAyah?: boolean; autoPlay?: boolean; targetVerseKey?: string | null },
  ) => Promise<void>;
  hydrateChapterWords: (chapterId: number) => void;
  prefetchSurah: (chapterId: number, reciterId?: number) => void;
  selectSurah: (chapterId: number, autoPlay?: boolean) => Promise<void>;
  jumpToVerse: (
    chapterId: number,
    verseKey: string,
    autoPlay?: boolean,
    reciterIdOverride?: number,
  ) => Promise<void>;
  selectReciter: (reciterId: number) => Promise<void>;
  retryCurrentSurah: () => Promise<void>;

  setSurahDrawerOpen: (open: boolean) => void;
  setAutoFollow: (follow: boolean) => void;
  resumeAutoFollow: () => void;

  setAudioStatus: (status: AudioStatus, error?: string | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setShouldAutoPlay: (autoPlay: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setActiveAyahIndex: (index: number, emitPulse?: boolean) => void;
  setActiveWordPosition: (wordPosition: number | null) => void;
  clearPendingSeekVerseKey: () => void;

  requestTogglePlay: () => void;
  requestSeekToSeconds: (seconds: number, playAfter?: boolean) => void;
  seekToAyah: (index: number, playAfter?: boolean) => void;
  seekToWord: (ayahIndex: number, wordPosition: number, playAfter?: boolean) => void;
  nextAyah: () => void;
  prevAyah: () => void;
  nextSurah: (autoPlay?: boolean) => Promise<void>;
  prevSurah: (autoPlay?: boolean) => Promise<void>;

  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

let surahFetchSequence = 0;
let rapidSwitchTimer: ReturnType<typeof setTimeout> | null = null;
let lastSkipTimestamp = 0;
let audioOnlyAbort: AbortController | null = null;
let activeSurahAbort: AbortController | null = null;
let activeWordsAbort: AbortController | null = null;

async function fetchSurahFromApi(
  chapterId: number,
  reciterId: number,
  signal?: AbortSignal,
): Promise<SurahPayload> {
  const response = await fetch(
    `/api/surah/${chapterId}?reciterId=${encodeURIComponent(reciterId)}`,
    { signal },
  );

  if (!response.ok) {
    let errMsg = 'Unable to load surah audio and verses.';
    try {
      const errJson = (await response.json()) as { error?: string };
      if (errJson.error) errMsg = errJson.error;
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(errMsg);
  }

  return (await response.json()) as SurahPayload;
}

async function fetchWordsFromApi(
  chapterId: number,
  signal?: AbortSignal,
): Promise<Record<string, AyahWord[]>> {
  const response = await fetch(`/api/words/${chapterId}`, { signal });
  if (!response.ok) {
    throw new Error('Unable to load word-by-word data.');
  }
  const json = (await response.json()) as { wordsByVerse?: Record<string, AyahWord[]> };
  return json.wordsByVerse ?? {};
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  chapters: [],
  reciters: [],
  bootLoading: true,
  bootError: null,

  currentChapterId: 1,
  currentReciterId: null,
  surahData: null,
  surahLoading: true,
  surahError: null,

  audioStatus: 'idle',
  audioError: null,
  isPlaying: false,
  shouldAutoPlay: false,
  currentTime: 0,
  duration: 0,
  volume: 0.85,
  isMuted: false,

  activeAyahIndex: 0,
  activeWordPosition: null,
  autoFollow: true,
  surahDrawerOpen: false,

  pendingSeekVerseKey: null,
  seekRequest: null,
  playbackNonce: 0,

  initialize: async () => {
    set({ bootLoading: true, bootError: null });
    try {
      const [chaptersRes, recitersRes] = await Promise.all([
        fetch('/api/chapters'),
        fetch('/api/reciters'),
      ]);

      if (!chaptersRes.ok || !recitersRes.ok) {
        throw new Error('Could not reach the Qur’an API service.');
      }

      const chaptersJson = (await chaptersRes.json()) as { chapters?: SurahChapter[] };
      const recitersJson = (await recitersRes.json()) as { reciters?: Reciter[] };

      const chapters = chaptersJson.chapters ?? [];
      const reciters = recitersJson.reciters ?? [];

      if (chapters.length === 0 || reciters.length === 0) {
        throw new Error('Received incomplete catalog from the Qur’an API.');
      }

      const defaultReciterId = reciters[0].id;
      const defaultChapterId = get().currentChapterId || 1;

      set({
        chapters,
        reciters,
        currentReciterId: defaultReciterId,
        bootLoading: false,
        bootError: null,
      });

      await get().loadSurah(defaultChapterId, defaultReciterId, {
        preserveAyah: false,
        autoPlay: false,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to initialize Qur’an player.';
      set({
        bootLoading: false,
        bootError: message,
        surahLoading: false,
      });
    }
  },

  /**
   * Background word-by-word hydration: seamlessly attaches Arabic word glosses &
   * transliterations to the rendered surah without interrupting audio or scroll.
   */
  hydrateChapterWords: (chapterId) => {
    const current = get().surahData;
    if (!current || current.chapterId !== chapterId || current.wordsHydrated) return;

    const cachedWords = clientSurahCache.getWords(chapterId);
    if (cachedWords) {
      clientSurahCache.mergeWords(chapterId, cachedWords);
      set((state) => {
        if (!state.surahData || state.surahData.chapterId !== chapterId) return state;
        return {
          surahData: {
            ...state.surahData,
            wordsHydrated: true,
            ayahs: state.surahData.ayahs.map((a) => ({
              ...a,
              words: cachedWords[a.verseKey] ?? a.words,
            })),
          },
        };
      });
      return;
    }

    if (activeWordsAbort) {
      activeWordsAbort.abort();
    }
    const controller = new AbortController();
    activeWordsAbort = controller;

    void clientSurahCache
      .getOrFetchWords(chapterId, () => fetchWordsFromApi(chapterId, controller.signal))
      .then((wordsByVerse) => {
        if (controller.signal.aborted) return;
        set((state) => {
          if (!state.surahData || state.surahData.chapterId !== chapterId) return state;
          return {
            surahData: {
              ...state.surahData,
              wordsHydrated: true,
              ayahs: state.surahData.ayahs.map((a) => ({
                ...a,
                words: wordsByVerse[a.verseKey] ?? a.words,
              })),
            },
          };
        });
      })
      .catch(() => {
        // Silent best-effort background hydration; Uthmani verse text is already rendered
      });
  },

  prefetchSurah: (chapterId, reciterIdOverride) => {
    if (chapterId < 1 || chapterId > 114) return;
    const reciterId = reciterIdOverride ?? get().currentReciterId ?? get().reciters[0]?.id;
    if (!reciterId) return;
    if (clientSurahCache.has(chapterId, reciterId)) return;

    void clientSurahCache
      .getOrFetch(chapterId, reciterId, () => fetchSurahFromApi(chapterId, reciterId))
      .catch(() => {
        // Silent best-effort prefetch
      });
  },

  loadSurah: async (chapterId, reciterId, options = {}) => {
    const {
      preserveAyah = false,
      autoPlay = false,
      targetVerseKey: explicitVerseKey = null,
    } = options;

    if (rapidSwitchTimer) {
      clearTimeout(rapidSwitchTimer);
      rapidSwitchTimer = null;
    }
    if (audioOnlyAbort) {
      audioOnlyAbort.abort();
      audioOnlyAbort = null;
    }
    if (activeSurahAbort) {
      activeSurahAbort.abort();
      activeSurahAbort = null;
    }
    if (!preserveAyah && activeWordsAbort) {
      activeWordsAbort.abort();
      activeWordsAbort = null;
    }

    const seq = ++surahFetchSequence;
    const prevState = get();
    const preservedVerseKey =
      explicitVerseKey ??
      (preserveAyah && prevState.surahData
        ? prevState.surahData.ayahs[prevState.activeAyahIndex]?.verseKey ?? null
        : null);

    // Fast path 1: Instant 0ms cache hit (zero skeleton flash!)
    const cached = clientSurahCache.get(chapterId, reciterId);
    if (cached) {
      const nextAyahIdx = preservedVerseKey
        ? Math.max(
            0,
            cached.ayahs.findIndex((a) => a.verseKey === preservedVerseKey),
          )
        : 0;

      const mappedStartSeconds = preservedVerseKey
        ? findTimestampForVerse(cached.timings, preservedVerseKey, nextAyahIdx)
        : 0;

      const inferredDuration =
        cached.timings.length > 0
          ? cached.timings[cached.timings.length - 1].timestampTo / 1000
          : 0;

      if (!preserveAyah && !explicitVerseKey) {
        shaderSignal.progressTarget = 0;
      }

      set((state) => ({
        currentChapterId: chapterId,
        currentReciterId: reciterId,
        surahData: cached,
        surahLoading: false,
        surahError: null,
        audioError: null,
        audioStatus: autoPlay ? 'loading' : 'ready',
        shouldAutoPlay: autoPlay,
        pendingSeekVerseKey: preservedVerseKey,
        activeAyahIndex: nextAyahIdx,
        activeWordPosition: null,
        currentTime: mappedStartSeconds,
        duration: inferredDuration,
        autoFollow: preserveAyah ? state.autoFollow : true,
        playbackNonce: state.playbackNonce + 1,
      }));

      if (!cached.wordsHydrated) {
        get().hydrateChapterWords(chapterId);
      }
      return;
    }

    // Fast path 2: Switching reciter on an already-loaded surah -> fetch tiny /api/audio JSON only!
    if (preserveAyah && prevState.surahData && prevState.surahData.chapterId === chapterId) {
      const existingVerses = prevState.surahData.ayahs;
      const existingTranslation = prevState.surahData.translation;
      const existingHydrated = prevState.surahData.wordsHydrated;

      const controller = new AbortController();
      audioOnlyAbort = controller;

      set({
        currentChapterId: chapterId,
        currentReciterId: reciterId,
        surahError: null,
        audioError: null,
        audioStatus: 'loading',
        shouldAutoPlay: autoPlay,
        pendingSeekVerseKey: preservedVerseKey,
      });

      try {
        const res = await fetch(
          `/api/audio/${chapterId}?reciterId=${encodeURIComponent(reciterId)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error('Unable to switch reciter audio.');

        const audioJson = (await res.json()) as AudioOnlyPayload;
        if (seq !== surahFetchSequence || controller.signal.aborted) return;

        const mergedPayload: SurahPayload = {
          chapterId,
          reciterId,
          audioUrl: audioJson.audioUrl,
          translation: existingTranslation,
          ayahs: existingVerses,
          timings: audioJson.timings,
          wordsHydrated: existingHydrated,
        };
        clientSurahCache.set(mergedPayload);

        const nextAyahIdx = preservedVerseKey
          ? Math.max(
              0,
              mergedPayload.ayahs.findIndex((a) => a.verseKey === preservedVerseKey),
            )
          : 0;
        const mappedStartSeconds = preservedVerseKey
          ? findTimestampForVerse(mergedPayload.timings, preservedVerseKey, nextAyahIdx)
          : 0;
        const inferredDuration =
          mergedPayload.timings.length > 0
            ? mergedPayload.timings[mergedPayload.timings.length - 1].timestampTo / 1000
            : 0;

        set((state) => ({
          surahData: mergedPayload,
          surahLoading: false,
          surahError: null,
          activeAyahIndex: nextAyahIdx,
          activeWordPosition: null,
          currentTime: mappedStartSeconds,
          duration: inferredDuration,
          audioStatus: 'ready',
          playbackNonce: state.playbackNonce + 1,
        }));
      } catch (error) {
        if (controller.signal.aborted || seq !== surahFetchSequence) return;
        const message =
          error instanceof Error ? error.message : 'Unable to switch reciter right now.';
        set({
          audioStatus: 'error',
          audioError: message,
          isPlaying: false,
        });
        shaderSignal.playingTarget = 0;
      }
      return;
    }

    // Standard fast-path surah fetch with real AbortController cancellation
    const controller = new AbortController();
    activeSurahAbort = controller;

    set({
      currentChapterId: chapterId,
      currentReciterId: reciterId,
      surahLoading: true,
      surahError: null,
      audioError: null,
      audioStatus: 'loading',
      shouldAutoPlay: autoPlay,
      pendingSeekVerseKey: explicitVerseKey,
      surahData: null,
      activeAyahIndex: 0,
      activeWordPosition: null,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      autoFollow: true,
    });

    shaderSignal.playingTarget = 0;
    shaderSignal.progressTarget = 0;

    try {
      const payload = await clientSurahCache.getOrFetch(chapterId, reciterId, () =>
        fetchSurahFromApi(chapterId, reciterId, controller.signal),
      );

      if (seq !== surahFetchSequence || controller.signal.aborted) return;

      const targetIdx = explicitVerseKey
        ? Math.max(
            0,
            payload.ayahs.findIndex((a) => a.verseKey === explicitVerseKey),
          )
        : 0;
      const mappedStartSeconds = explicitVerseKey
        ? findTimestampForVerse(payload.timings, explicitVerseKey, targetIdx)
        : 0;
      const inferredDuration =
        payload.timings.length > 0
          ? payload.timings[payload.timings.length - 1].timestampTo / 1000
          : 0;

      set((state) => ({
        surahData: payload,
        surahLoading: false,
        surahError: null,
        activeAyahIndex: targetIdx,
        activeWordPosition: null,
        currentTime: mappedStartSeconds,
        duration: inferredDuration,
        audioStatus: 'ready',
        playbackNonce: state.playbackNonce + 1,
      }));

      // Trigger non-blocking background word-by-word hydration
      if (!payload.wordsHydrated) {
        get().hydrateChapterWords(chapterId);
      }
    } catch (error) {
      if (controller.signal.aborted || seq !== surahFetchSequence) return;
      const message =
        error instanceof Error ? error.message : 'Unable to load this surah right now.';
      set({
        surahLoading: false,
        surahError: message,
        audioStatus: 'error',
        audioError: message,
        isPlaying: false,
      });
      shaderSignal.playingTarget = 0;
    }
  },

  selectSurah: async (chapterId, autoPlay = true) => {
    const reciterId = get().currentReciterId ?? get().reciters[0]?.id ?? 7;
    set({ surahDrawerOpen: false });
    await get().loadSurah(chapterId, reciterId, {
      preserveAyah: false,
      autoPlay,
    });
  },

  jumpToVerse: async (chapterId, verseKey, autoPlay = true, reciterIdOverride) => {
    const state = get();
    const reciterId =
      reciterIdOverride ?? state.currentReciterId ?? state.reciters[0]?.id ?? 7;

    if (
      state.surahData &&
      state.surahData.chapterId === chapterId &&
      state.currentReciterId === reciterId
    ) {
      const idx = state.surahData.ayahs.findIndex((a) => a.verseKey === verseKey);
      if (idx >= 0) {
        get().seekToAyah(idx, autoPlay);
        return;
      }
    }

    await get().loadSurah(chapterId, reciterId, {
      preserveAyah: false,
      autoPlay,
      targetVerseKey: verseKey,
    });
  },

  selectReciter: async (reciterId) => {
    const { currentChapterId, currentReciterId, isPlaying } = get();
    if (reciterId === currentReciterId) return;
    await get().loadSurah(currentChapterId, reciterId, {
      preserveAyah: true,
      autoPlay: isPlaying,
    });
  },

  retryCurrentSurah: async () => {
    const { chapters, currentChapterId, currentReciterId, reciters } = get();
    if (chapters.length === 0 || reciters.length === 0) {
      await get().initialize();
      return;
    }
    const reciterId = currentReciterId ?? reciters[0]?.id ?? 7;
    await get().loadSurah(currentChapterId, reciterId, {
      preserveAyah: false,
      autoPlay: false,
    });
  },

  setSurahDrawerOpen: (open) => set({ surahDrawerOpen: open }),

  setAutoFollow: (follow) => set({ autoFollow: follow }),

  resumeAutoFollow: () => set({ autoFollow: true }),

  setAudioStatus: (status, error = null) =>
    set({ audioStatus: status, audioError: error }),

  setIsPlaying: (playing) => {
    shaderSignal.playingTarget = playing ? 1 : 0;
    set({ isPlaying: playing });
  },

  setShouldAutoPlay: (autoPlay) => set({ shouldAutoPlay: autoPlay }),

  setCurrentTime: (time) => set({ currentTime: time }),

  setDuration: (duration) => set({ duration }),

  setActiveAyahIndex: (index, emitPulse = true) => {
    const prev = get().activeAyahIndex;
    if (prev !== index) {
      if (emitPulse) {
        triggerAyahPulse();
      }
      set({ activeAyahIndex: index, activeWordPosition: null });
    }
  },

  setActiveWordPosition: (wordPosition) => {
    if (get().activeWordPosition !== wordPosition) {
      set({ activeWordPosition: wordPosition });
    }
  },

  clearPendingSeekVerseKey: () => set({ pendingSeekVerseKey: null }),

  requestTogglePlay: () => {
    const state = get();
    if (state.surahLoading || !state.surahData) return;
    set({
      shouldAutoPlay: !state.isPlaying,
      audioError: null,
    });
    invokeTogglePlayImmediate();
  },

  requestSeekToSeconds: (seconds, playAfter) => {
    const clamped = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    const timings = get().surahData?.timings ?? [];
    const nextIdx =
      timings.length > 0 ? findActiveAyahIndex(timings, clamped * 1000) : get().activeAyahIndex;
    const prevIdx = get().activeAyahIndex;
    const nextWordPos =
      timings[nextIdx]?.segments
        ? findActiveWordPosition(timings[nextIdx].segments, clamped * 1000)
        : null;

    if (nextIdx !== prevIdx) {
      triggerAyahPulse();
    }

    const handledImmediately = invokeSeekImmediate(clamped, playAfter);

    set((state) => ({
      currentTime: clamped,
      activeAyahIndex: nextIdx,
      activeWordPosition: nextWordPos,
      ...(playAfter === true ? { shouldAutoPlay: true } : {}),
      ...(handledImmediately
        ? {}
        : {
            seekRequest: {
              timeSeconds: clamped,
              nonce: (state.seekRequest?.nonce ?? 0) + 1,
              playAfter,
            },
          }),
    }));
  },

  seekToAyah: (index, playAfter = true) => {
    const { surahData } = get();
    if (!surahData || surahData.ayahs.length === 0) return;

    const clampedIdx = Math.max(0, Math.min(surahData.ayahs.length - 1, index));
    const verseKey = surahData.ayahs[clampedIdx]?.verseKey;
    const targetSec = findTimestampForVerse(surahData.timings, verseKey, clampedIdx);
    const firstWordPos = surahData.timings[clampedIdx]?.segments?.[0]?.wordPosition ?? null;

    triggerAyahPulse();
    const handledImmediately = invokeSeekImmediate(targetSec, playAfter);

    set((state) => ({
      activeAyahIndex: clampedIdx,
      activeWordPosition: playAfter ? firstWordPos : null,
      autoFollow: true,
      currentTime: targetSec,
      ...(playAfter ? { shouldAutoPlay: true } : {}),
      ...(handledImmediately
        ? {}
        : {
            seekRequest: {
              timeSeconds: targetSec,
              nonce: (state.seekRequest?.nonce ?? 0) + 1,
              playAfter,
            },
          }),
    }));
  },

  seekToWord: (ayahIndex, wordPosition, playAfter = true) => {
    const { surahData } = get();
    if (!surahData || surahData.ayahs.length === 0) return;

    const clampedIdx = Math.max(0, Math.min(surahData.ayahs.length - 1, ayahIndex));
    const verseKey = surahData.ayahs[clampedIdx]?.verseKey;
    const timing =
      surahData.timings.find((t) => t.verseKey === verseKey) ??
      surahData.timings[clampedIdx];
    const targetSec =
      findTimestampForWord(timing, wordPosition) ??
      findTimestampForVerse(surahData.timings, verseKey, clampedIdx);

    triggerAyahPulse();
    const handledImmediately = invokeSeekImmediate(targetSec, playAfter);

    set((state) => ({
      activeAyahIndex: clampedIdx,
      activeWordPosition: wordPosition,
      autoFollow: true,
      currentTime: targetSec,
      ...(playAfter ? { shouldAutoPlay: true } : {}),
      ...(handledImmediately
        ? {}
        : {
            seekRequest: {
              timeSeconds: targetSec,
              nonce: (state.seekRequest?.nonce ?? 0) + 1,
              playAfter,
            },
          }),
    }));
  },

  nextAyah: () => {
    const { surahData, activeAyahIndex, isPlaying } = get();
    if (!surahData) return;
    if (activeAyahIndex < surahData.ayahs.length - 1) {
      get().seekToAyah(activeAyahIndex + 1, isPlaying);
    } else {
      void get().nextSurah(isPlaying);
    }
  },

  prevAyah: () => {
    const { surahData, activeAyahIndex, isPlaying, currentTime } = get();
    if (!surahData) return;
    const liveTime = readLiveAudioTime(currentTime);
    const currentTiming = surahData.timings[activeAyahIndex];
    if (
      currentTiming &&
      activeAyahIndex > 0 &&
      liveTime - currentTiming.timestampFrom / 1000 > 2.5
    ) {
      get().seekToAyah(activeAyahIndex, isPlaying);
    } else if (activeAyahIndex > 0) {
      get().seekToAyah(activeAyahIndex - 1, isPlaying);
    } else {
      get().seekToAyah(0, isPlaying);
    }
  },

  nextSurah: async (autoPlay) => {
    const { currentChapterId, currentReciterId, reciters, isPlaying } = get();
    const nextId = currentChapterId >= 114 ? 1 : currentChapterId + 1;
    const reciterId = currentReciterId ?? reciters[0]?.id ?? 7;
    const shouldPlay = autoPlay ?? isPlaying;

    // Instant 0ms switch when already prefetched/cached
    if (clientSurahCache.has(nextId, reciterId)) {
      lastSkipTimestamp = performance.now();
      await get().loadSurah(nextId, reciterId, { preserveAyah: false, autoPlay: shouldPlay });
      return;
    }

    // Leading-edge instant fetch on normal click; 65ms coalescing only during rapid multi-taps
    const now = performance.now();
    const isRapidBurst = now - lastSkipTimestamp < 160;
    lastSkipTimestamp = now;

    if (!isRapidBurst) {
      await get().loadSurah(nextId, reciterId, { preserveAyah: false, autoPlay: shouldPlay });
      return;
    }

    set({ currentChapterId: nextId, shouldAutoPlay: shouldPlay });
    if (rapidSwitchTimer) clearTimeout(rapidSwitchTimer);
    rapidSwitchTimer = setTimeout(() => {
      rapidSwitchTimer = null;
      void get().loadSurah(nextId, reciterId, { preserveAyah: false, autoPlay: shouldPlay });
    }, 65);
  },

  prevSurah: async (autoPlay) => {
    const { currentChapterId, currentReciterId, reciters, isPlaying } = get();
    const prevId = currentChapterId <= 1 ? 114 : currentChapterId - 1;
    const reciterId = currentReciterId ?? reciters[0]?.id ?? 7;
    const shouldPlay = autoPlay ?? isPlaying;

    if (clientSurahCache.has(prevId, reciterId)) {
      lastSkipTimestamp = performance.now();
      await get().loadSurah(prevId, reciterId, { preserveAyah: false, autoPlay: shouldPlay });
      return;
    }

    const now = performance.now();
    const isRapidBurst = now - lastSkipTimestamp < 160;
    lastSkipTimestamp = now;

    if (!isRapidBurst) {
      await get().loadSurah(prevId, reciterId, { preserveAyah: false, autoPlay: shouldPlay });
      return;
    }

    set({ currentChapterId: prevId, shouldAutoPlay: shouldPlay });
    if (rapidSwitchTimer) clearTimeout(rapidSwitchTimer);
    rapidSwitchTimer = setTimeout(() => {
      rapidSwitchTimer = null;
      void get().loadSurah(prevId, reciterId, { preserveAyah: false, autoPlay: shouldPlay });
    }, 65);
  },

  setVolume: (volume) => {
    const clamped = Math.max(0, Math.min(1, volume));
    set({ volume: clamped, isMuted: clamped === 0 });
  },

  toggleMute: () =>
    set((state) => ({
      isMuted: !state.isMuted,
      volume: state.isMuted && state.volume === 0 ? 0.7 : state.volume,
    })),
}));
