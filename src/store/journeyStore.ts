import { create } from 'zustand';
import {
  computeUpdatedStreak,
  getLocalDateKey,
  removeReflectionBookmark,
  upsertListeningSession,
  upsertReflectionBookmark,
} from '../lib/journeyUtils';
import { moodToIndex, shaderSignal } from '../lib/shaderSignal';
import type {
  AtmosphereMood,
  AyahItem,
  AyahWord,
  ListeningSession,
  ReflectionBookmark,
  SurahChapter,
} from '../types/quran';

const STORAGE_KEY = 'sakinah:journey:v1';

interface PersistedJourneyData {
  bookmarks: ReflectionBookmark[];
  recentSessions: ListeningSession[];
  totalListeningSeconds: number;
  visitedSurahIds: number[];
  streakDays: number;
  lastActiveDate: string | null;
  atmosphereMood: AtmosphereMood;
  voiceReactivity: number;
  wordHighlightEnabled: boolean;
}

const DEFAULT_PERSISTED: PersistedJourneyData = {
  bookmarks: [],
  recentSessions: [],
  totalListeningSeconds: 0,
  visitedSurahIds: [],
  streakDays: 0,
  lastActiveDate: null,
  atmosphereMood: 'midnight-silk',
  voiceReactivity: 1.0,
  wordHighlightEnabled: true,
};

function loadPersisted(): PersistedJourneyData {
  if (typeof window === 'undefined') return DEFAULT_PERSISTED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PERSISTED;
    const parsed = JSON.parse(raw) as Partial<PersistedJourneyData>;
    const validMood: AtmosphereMood =
      parsed.atmosphereMood === 'lunar-mist' || parsed.atmosphereMood === 'still-night'
        ? parsed.atmosphereMood
        : 'midnight-silk';

    return {
      bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
      recentSessions: Array.isArray(parsed.recentSessions) ? parsed.recentSessions : [],
      totalListeningSeconds:
        typeof parsed.totalListeningSeconds === 'number' &&
        Number.isFinite(parsed.totalListeningSeconds)
          ? Math.max(0, parsed.totalListeningSeconds)
          : 0,
      visitedSurahIds: Array.isArray(parsed.visitedSurahIds)
        ? parsed.visitedSurahIds.filter((id): id is number => typeof id === 'number')
        : [],
      streakDays:
        typeof parsed.streakDays === 'number' && Number.isFinite(parsed.streakDays)
          ? Math.max(0, parsed.streakDays)
          : 0,
      lastActiveDate:
        typeof parsed.lastActiveDate === 'string' ? parsed.lastActiveDate : null,
      atmosphereMood: validMood,
      voiceReactivity:
        typeof parsed.voiceReactivity === 'number' &&
        Number.isFinite(parsed.voiceReactivity)
          ? Math.max(0, Math.min(1.5, parsed.voiceReactivity))
          : 1.0,
      wordHighlightEnabled:
        typeof parsed.wordHighlightEnabled === 'boolean'
          ? parsed.wordHighlightEnabled
          : true,
    };
  } catch {
    return DEFAULT_PERSISTED;
  }
}

function savePersisted(data: PersistedJourneyData): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota or private-mode errors gracefully
  }
}

export interface InspectedWordState {
  word: AyahWord;
  ayahIndex: number;
  verseKey: string;
  surahName: string;
}

export interface ReflectionTargetState {
  ayah: AyahItem;
  chapter: SurahChapter;
}

interface JourneyState extends PersistedJourneyData {
  inspectedWord: InspectedWordState | null;
  reflectionTarget: ReflectionTargetState | null;
  journeyDrawerOpen: boolean;

  setInspectedWord: (target: InspectedWordState | null) => void;
  setReflectionTarget: (target: ReflectionTargetState | null) => void;
  setJourneyDrawerOpen: (open: boolean) => void;

  saveBookmark: (input: Omit<ReflectionBookmark, 'createdAt' | 'updatedAt'>) => void;
  deleteBookmark: (verseKey: string) => void;

  recordListeningProgress: (params: {
    deltaSeconds: number;
    chapter: SurahChapter;
    verseKey: string;
    ayahIndex: number;
    reciterId: number;
    reciterName: string;
  }) => void;

  recordSurahVisit: (params: {
    chapter: SurahChapter;
    verseKey: string;
    ayahIndex: number;
    reciterId: number;
    reciterName: string;
  }) => void;

  setAtmosphereMood: (mood: AtmosphereMood) => void;
  setVoiceReactivity: (value: number) => void;
  setWordHighlightEnabled: (enabled: boolean) => void;
}

const initial = loadPersisted();
// Sync initial persisted visualizer settings into the zero-render WebGL signal bridge
shaderSignal.moodIndex = moodToIndex(initial.atmosphereMood);
shaderSignal.reactivityTarget = initial.voiceReactivity;

function pickPersisted(state: JourneyState): PersistedJourneyData {
  return {
    bookmarks: state.bookmarks,
    recentSessions: state.recentSessions,
    totalListeningSeconds: state.totalListeningSeconds,
    visitedSurahIds: state.visitedSurahIds,
    streakDays: state.streakDays,
    lastActiveDate: state.lastActiveDate,
    atmosphereMood: state.atmosphereMood,
    voiceReactivity: state.voiceReactivity,
    wordHighlightEnabled: state.wordHighlightEnabled,
  };
}

export const useJourneyStore = create<JourneyState>((set, get) => ({
  ...initial,
  inspectedWord: null,
  reflectionTarget: null,
  journeyDrawerOpen: false,

  setInspectedWord: (target) => set({ inspectedWord: target }),
  setReflectionTarget: (target) => set({ reflectionTarget: target }),
  setJourneyDrawerOpen: (open) => set({ journeyDrawerOpen: open }),

  saveBookmark: (input) => {
    const nextBookmarks = upsertReflectionBookmark(get().bookmarks, input);
    const streak = computeUpdatedStreak(
      get().streakDays,
      get().lastActiveDate,
      getLocalDateKey(),
    );
    set({
      bookmarks: nextBookmarks,
      streakDays: streak.streakDays,
      lastActiveDate: streak.lastActiveDate,
    });
    savePersisted(pickPersisted(get()));
  },

  deleteBookmark: (verseKey) => {
    const nextBookmarks = removeReflectionBookmark(get().bookmarks, verseKey);
    set({ bookmarks: nextBookmarks });
    savePersisted(pickPersisted(get()));
  },

  recordListeningProgress: ({
    deltaSeconds,
    chapter,
    verseKey,
    ayahIndex,
    reciterId,
    reciterName,
  }) => {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    const state = get();
    const visited = state.visitedSurahIds.includes(chapter.id)
      ? state.visitedSurahIds
      : [...state.visitedSurahIds, chapter.id];
    const streak = computeUpdatedStreak(
      state.streakDays,
      state.lastActiveDate,
      getLocalDateKey(),
    );
    const recentSessions = upsertListeningSession(state.recentSessions, {
      chapterId: chapter.id,
      surahName: chapter.nameSimple,
      surahArabic: chapter.nameArabic,
      verseKey,
      ayahIndex,
      reciterId,
      reciterName,
      lastListenedAt: Date.now(),
    });

    set({
      totalListeningSeconds: state.totalListeningSeconds + deltaSeconds,
      visitedSurahIds: visited,
      streakDays: streak.streakDays,
      lastActiveDate: streak.lastActiveDate,
      recentSessions,
    });
    savePersisted(pickPersisted(get()));
  },

  recordSurahVisit: ({ chapter, verseKey, ayahIndex, reciterId, reciterName }) => {
    const state = get();
    const visited = state.visitedSurahIds.includes(chapter.id)
      ? state.visitedSurahIds
      : [...state.visitedSurahIds, chapter.id];
    const recentSessions = upsertListeningSession(state.recentSessions, {
      chapterId: chapter.id,
      surahName: chapter.nameSimple,
      surahArabic: chapter.nameArabic,
      verseKey,
      ayahIndex,
      reciterId,
      reciterName,
      lastListenedAt: Date.now(),
    });
    set({ visitedSurahIds: visited, recentSessions });
    savePersisted(pickPersisted(get()));
  },

  setAtmosphereMood: (mood) => {
    shaderSignal.moodIndex = moodToIndex(mood);
    set({ atmosphereMood: mood });
    savePersisted(pickPersisted(get()));
  },

  setVoiceReactivity: (value) => {
    const clamped = Math.max(0, Math.min(1.5, value));
    shaderSignal.reactivityTarget = clamped;
    set({ voiceReactivity: clamped });
    savePersisted(pickPersisted(get()));
  },

  setWordHighlightEnabled: (enabled) => {
    set({ wordHighlightEnabled: enabled });
    savePersisted(pickPersisted(get()));
  },
}));
