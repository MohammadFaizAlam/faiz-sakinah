import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowDown, Bookmark, RotateCcw } from 'lucide-react';
import {
  computeAyahVisualState,
  getAyahLengthTier,
  type AyahLengthTier,
} from '../lib/quranUtils';
import { shaderSignal } from '../lib/shaderSignal';
import { useJourneyStore } from '../store/journeyStore';
import { usePlayerStore } from '../store/playerStore';
import type { AyahItem, AyahWord } from '../types/quran';
import { WordInspectorPopover } from './WordInspectorPopover';

interface AyahRowProps {
  ayah: AyahItem;
  index: number;
  activeIndex: number;
  activeWordPosition: number | null;
  wordHighlightEnabled: boolean;
  inspectedWordPosition: number | null;
  isBookmarked: boolean;
  hasNote: boolean;
  isPlaying: boolean;
  onSelect: (index: number) => void;
  onInspectWord: (ayahIndex: number, ayah: AyahItem, word: AyahWord) => void;
  onOpenReflection: (ayah: AyahItem) => void;
  registerRef: (index: number, el: HTMLDivElement | null) => void;
}

const TIER_STYLES: Record<
  AyahLengthTier,
  {
    wrapper: string;
    container: string;
    arabicActive: string;
    arabicInactive: string;
    englishActive: string;
    englishInactive: string;
  }
> = {
  short: {
    wrapper: 'px-3 sm:px-6 py-6 sm:py-8',
    container: 'max-w-3xl gap-4 sm:gap-5',
    arabicActive:
      'text-[1.7rem] sm:text-[2.1rem] lg:text-[2.3rem] leading-[2.25] text-[#ECE9E1]',
    arabicInactive:
      'text-[1.45rem] sm:text-[1.8rem] lg:text-[1.95rem] leading-[2.2] text-[#ECE9E1]/85',
    englishActive:
      'text-balance text-[1.55rem] sm:text-[2rem] lg:text-[2.3rem] leading-[1.24] text-[#ECE9E1]',
    englishInactive:
      'text-balance text-[1.3rem] sm:text-[1.7rem] lg:text-[1.9rem] leading-[1.3] text-[#ECE9E1]/80',
  },
  medium: {
    wrapper: 'px-3 sm:px-6 py-5 sm:py-7',
    container: 'max-w-3xl gap-3.5 sm:gap-4',
    arabicActive:
      'text-[1.48rem] sm:text-[1.82rem] lg:text-[2rem] leading-[2.15] text-[#ECE9E1]',
    arabicInactive:
      'text-[1.3rem] sm:text-[1.58rem] lg:text-[1.72rem] leading-[2.1] text-[#ECE9E1]/85',
    englishActive:
      'text-balance text-[1.32rem] sm:text-[1.68rem] lg:text-[1.9rem] leading-[1.32] text-[#ECE9E1]',
    englishInactive:
      'text-balance text-[1.15rem] sm:text-[1.44rem] lg:text-[1.62rem] leading-[1.36] text-[#ECE9E1]/80',
  },
  long: {
    wrapper: 'px-3 sm:px-6 py-5 sm:py-6',
    container: 'max-w-3xl xl:max-w-4xl gap-3.5 sm:gap-4',
    arabicActive:
      'text-[1.28rem] sm:text-[1.52rem] lg:text-[1.68rem] leading-[2.05] text-[#ECE9E1]',
    arabicInactive:
      'text-[1.16rem] sm:text-[1.36rem] lg:text-[1.48rem] leading-[2.0] text-[#ECE9E1]/85',
    englishActive:
      'text-[1.12rem] sm:text-[1.34rem] lg:text-[1.48rem] leading-[1.42] text-[#ECE9E1]',
    englishInactive:
      'text-[1.02rem] sm:text-[1.2rem] lg:text-[1.32rem] leading-[1.44] text-[#ECE9E1]/80',
  },
  extended: {
    wrapper: 'px-3 sm:px-6 py-3 sm:py-4',
    container: 'max-w-3xl xl:max-w-4xl gap-2.5 sm:gap-3',
    arabicActive:
      'text-[1.08rem] sm:text-[1.22rem] lg:text-[1.34rem] leading-[1.85] text-[#ECE9E1]',
    arabicInactive:
      'text-[1rem] sm:text-[1.14rem] lg:text-[1.24rem] leading-[1.82] text-[#ECE9E1]/85',
    englishActive:
      'text-[0.95rem] sm:text-[1.08rem] lg:text-[1.18rem] leading-[1.45] text-[#ECE9E1]',
    englishInactive:
      'text-[0.9rem] sm:text-[1.02rem] lg:text-[1.1rem] leading-[1.45] text-[#ECE9E1]/80',
  },
};

const AyahRow = memo(function AyahRow({
  ayah,
  index,
  activeIndex,
  activeWordPosition,
  wordHighlightEnabled,
  inspectedWordPosition,
  isBookmarked,
  hasNote,
  isPlaying,
  onSelect,
  onInspectWord,
  onOpenReflection,
  registerRef,
}: AyahRowProps) {
  const visual = computeAyahVisualState(index, activeIndex);
  const isActive = visual.isActive;
  const tier = getAyahLengthTier(ayah.textUthmani, ayah.translationText);
  const styles = TIER_STYLES[tier];
  const effectiveScale =
    tier === 'long' || tier === 'extended'
      ? Math.max(visual.scale, 0.96)
      : visual.scale;

  const handleRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(index);
    }
  };

  return (
    <div
      ref={(el) => registerRef(index, el)}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(index)}
      onKeyDown={handleRowKeyDown}
      aria-current={isActive ? 'true' : undefined}
      aria-label={`Ayah ${ayah.verseKey}: ${ayah.translationText}`}
      data-ayah-index={index}
      data-ayah-tier={tier}
      data-active={isActive ? 'true' : 'false'}
      style={{
        opacity: visual.opacity,
        transform: `scale(${effectiveScale})`,
      }}
      className={`group relative w-full text-center ${styles.wrapper} rounded-2xl transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] origin-center cursor-pointer focus-ring hover:opacity-95`}
    >
      {/* Borderless soft luminous aura behind the active ayah */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 inset-y-0 rounded-3xl transition-opacity duration-700 ${
          isActive
            ? isPlaying
              ? 'opacity-100 bg-[radial-gradient(ellipse_62%_70%_at_50%_50%,rgba(143,163,199,0.11)_0%,rgba(143,163,199,0.02)_55%,transparent_100%)]'
              : 'opacity-80 bg-[radial-gradient(ellipse_62%_70%_at_50%_50%,rgba(143,163,199,0.08)_0%,rgba(143,163,199,0.015)_55%,transparent_100%)]'
            : 'opacity-0 group-hover:opacity-60 bg-[radial-gradient(ellipse_55%_65%_at_50%_50%,rgba(143,163,199,0.055)_0%,transparent_100%)]'
        }`}
      />

      <div
        className={`relative z-10 mx-auto flex flex-col items-center ${styles.container}`}
      >
        {/* Quiet unboxed ayah index + bookmark/reflection action */}
        <div className="inline-flex items-center gap-2">
          <span
            className={`text-xs tracking-[0.18em] tabular-nums transition-colors duration-500 ${
              isActive ? 'text-[#8FA3C7]' : 'text-[#8FA3C7]/60'
            }`}
          >
            {ayah.verseKey}
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenReflection(ayah);
            }}
            aria-label={
              isBookmarked
                ? `Edit reflection bookmark for ${ayah.verseKey}`
                : `Bookmark and reflect on ${ayah.verseKey}`
            }
            data-testid={`bookmark-ayah-${ayah.verseKey}`}
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-1 transition-all duration-200 cursor-pointer focus-ring ${
              isBookmarked
                ? 'text-[#8FA3C7] opacity-100 hover:text-[#ECE9E1]'
                : isActive
                  ? 'text-[#8FA3C7]/55 opacity-85 hover:opacity-100 hover:text-[#ECE9E1] hover:bg-[#8FA3C7]/12'
                  : 'text-[#8FA3C7]/45 opacity-0 group-hover:opacity-85 focus-visible:opacity-100 hover:text-[#ECE9E1] hover:bg-[#8FA3C7]/12'
            }`}
          >
            <Bookmark
              className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`}
              aria-hidden="true"
            />
            {hasNote && (
              <span className="text-[10px] tracking-[0.1em] text-[#8FA3C7]/85">
                Note
              </span>
            )}
          </button>
        </div>

        {/* Arabic Quranic text with real-time word-by-word highlighting & tap-to-inspect */}
        {ayah.words && ayah.words.length > 0 ? (
          <p
            dir="rtl"
            lang="ar"
            className={`font-arabic text-center transition-colors duration-500 ${
              isActive ? styles.arabicActive : styles.arabicInactive
            }`}
          >
            {ayah.words.map((word, wIdx) => {
              const isSpoken =
                isActive &&
                wordHighlightEnabled &&
                activeWordPosition === word.position;
              const isInspected = inspectedWordPosition === word.position;

              return (
                <span key={`${ayah.verseKey}-w-${word.position}`}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onInspectWord(index, ayah, word);
                    }}
                    data-word-pos={word.position}
                    data-word-spoken={isSpoken ? 'true' : 'false'}
                    title={
                      word.translation
                        ? `${word.transliteration ? `${word.transliteration} — ` : ''}${word.translation}`
                        : undefined
                    }
                    className={`inline-block leading-[1.58] rounded-xl px-1.5 py-0.5 align-baseline transition-[color,background-color,box-shadow,filter] duration-200 cursor-pointer focus-ring ${
                      isSpoken
                        ? 'text-white bg-[#8FA3C7]/[0.18] shadow-[0_0_26px_rgba(143,163,199,0.34)] drop-shadow-[0_0_12px_rgba(143,163,199,0.55)]'
                        : isInspected
                          ? 'text-white bg-[#8FA3C7]/[0.16] ring-1 ring-[#8FA3C7]/40'
                          : 'hover:bg-[#8FA3C7]/[0.11] hover:text-[#ECE9E1]'
                    }`}
                  >
                    {word.textUthmani}
                  </button>
                  {wIdx < ayah.words.length - 1 ? ' ' : ''}
                </span>
              );
            })}
          </p>
        ) : (
          <p
            dir="rtl"
            lang="ar"
            className={`font-arabic text-center transition-colors duration-500 ${
              isActive ? styles.arabicActive : styles.arabicInactive
            }`}
          >
            {ayah.textUthmani}
          </p>
        )}

        {/* Editorial serif translation scaled adaptively by verse length */}
        <p
          className={`font-editorial transition-colors duration-500 tracking-[-0.015em] ${
            isActive ? styles.englishActive : styles.englishInactive
          }`}
        >
          {ayah.translationText}
        </p>
      </div>
    </div>
  );
});

export function AyahTheater() {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollAnimRaf = useRef<number>(0);
  const programmaticUntilRef = useRef<number>(0);
  const prefersReducedMotion = useReducedMotion();

  const surahData = usePlayerStore((s) => s.surahData);
  const surahLoading = usePlayerStore((s) => s.surahLoading);
  const surahError = usePlayerStore((s) => s.surahError);
  const bootLoading = usePlayerStore((s) => s.bootLoading);
  const bootError = usePlayerStore((s) => s.bootError);
  const chapters = usePlayerStore((s) => s.chapters);
  const currentChapterId = usePlayerStore((s) => s.currentChapterId);
  const activeAyahIndex = usePlayerStore((s) => s.activeAyahIndex);
  const activeWordPosition = usePlayerStore((s) => s.activeWordPosition);
  const autoFollow = usePlayerStore((s) => s.autoFollow);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const seekToAyah = usePlayerStore((s) => s.seekToAyah);
  const setAutoFollow = usePlayerStore((s) => s.setAutoFollow);
  const resumeAutoFollow = usePlayerStore((s) => s.resumeAutoFollow);
  const retryCurrentSurah = usePlayerStore((s) => s.retryCurrentSurah);

  const bookmarks = useJourneyStore((s) => s.bookmarks);
  const wordHighlightEnabled = useJourneyStore((s) => s.wordHighlightEnabled);
  const inspectedWord = useJourneyStore((s) => s.inspectedWord);
  const setInspectedWord = useJourneyStore((s) => s.setInspectedWord);
  const setReflectionTarget = useJourneyStore((s) => s.setReflectionTarget);

  const currentChapter = chapters.find((c) => c.id === currentChapterId) ?? null;

  const bookmarkMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const bm of bookmarks) {
      map.set(bm.verseKey, bm.note.trim().length > 0);
    }
    return map;
  }, [bookmarks]);

  const registerRef = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) {
      rowRefs.current.set(index, el);
    } else {
      rowRefs.current.delete(index);
    }
  }, []);

  // Update the WebGL bloom vertical position to follow the active ayah softly
  const syncBloomPosition = useCallback(() => {
    const activeEl = rowRefs.current.get(activeAyahIndex);
    if (!activeEl || typeof window === 'undefined') return;
    const rect = activeEl.getBoundingClientRect();
    const centerY = rect.top + Math.min(rect.height * 0.5, window.innerHeight * 0.35);
    // GLSL UV y=1 is top, y=0 is bottom
    const uvY = 1 - centerY / Math.max(window.innerHeight, 1);
    shaderSignal.bloomYTarget = Math.max(0.22, Math.min(0.78, uvY));
  }, [activeAyahIndex]);

  // Smoothly frame the active ayah: center normal verses, align tall verses cleanly near top safe area
  const scrollToActiveAyah = useCallback(
    (instant = false) => {
      const container = scrollRef.current;
      const targetEl = rowRefs.current.get(activeAyahIndex);
      if (!container || !targetEl) return;

      cancelAnimationFrame(scrollAnimRaf.current);

      const containerRect = container.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const currentTop = container.scrollTop;
      const isTallAyah = targetRect.height > container.clientHeight * 0.62;

      const deltaToTarget = isTallAyah
        ? targetRect.top - containerRect.top - Math.min(44, container.clientHeight * 0.07)
        : targetRect.top -
          containerRect.top -
          container.clientHeight * 0.46 +
          targetRect.height * 0.5;

      const destination = Math.max(
        0,
        Math.min(
          container.scrollHeight - container.clientHeight,
          currentTop + deltaToTarget,
        ),
      );

      if (instant || prefersReducedMotion || Math.abs(destination - currentTop) < 2) {
        programmaticUntilRef.current = performance.now() + 180;
        container.scrollTop = destination;
        syncBloomPosition();
        return;
      }

      const startTop = currentTop;
      const distance = destination - startTop;
      const duration = Math.min(820, Math.max(420, Math.abs(distance) * 0.45));
      const startTime = performance.now();
      programmaticUntilRef.current = startTime + duration + 140;

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        // Smooth quartic ease-out for calm luxury gliding
        const eased = 1 - Math.pow(1 - progress, 4);
        container.scrollTop = startTop + distance * eased;
        syncBloomPosition();

        if (progress < 1) {
          scrollAnimRaf.current = requestAnimationFrame(step);
        }
      };

      scrollAnimRaf.current = requestAnimationFrame(step);
    },
    [activeAyahIndex, prefersReducedMotion, syncBloomPosition],
  );

  // Auto-follow active ayah whenever index changes or autoFollow is resumed
  useEffect(() => {
    if (!autoFollow || !surahData) return;
    const raf = requestAnimationFrame(() => {
      scrollToActiveAyah(false);
    });
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(scrollAnimRaf.current);
    };
  }, [activeAyahIndex, autoFollow, surahData, scrollToActiveAyah]);

  // Keep active ayah cleanly framed when viewport resizes or device rotates
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    let lastWidth = container.clientWidth;
    let lastHeight = container.clientHeight;
    let rafId = 0;

    const observer = new ResizeObserver(() => {
      const nextWidth = container.clientWidth;
      const nextHeight = container.clientHeight;
      if (nextWidth === lastWidth && nextHeight === lastHeight) return;
      lastWidth = nextWidth;
      lastHeight = nextHeight;

      if (!usePlayerStore.getState().autoFollow) return;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        scrollToActiveAyah(true);
      });
    });

    observer.observe(container);
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [scrollToActiveAyah, surahData?.chapterId]);

  // Reset scroll to top & dismiss stale word inspector when switching surahs
  useEffect(() => {
    const container = scrollRef.current;
    setInspectedWord(null);
    if (container && surahData) {
      rowRefs.current.clear();
      programmaticUntilRef.current = performance.now() + 300;
      container.scrollTop = 0;
    }
  }, [surahData?.chapterId, setInspectedWord]);

  // Detect intentional manual user scrolling to pause auto-follow cleanly
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const pauseOnUserIntent = () => {
      cancelAnimationFrame(scrollAnimRaf.current);
      programmaticUntilRef.current = 0;
      if (usePlayerStore.getState().autoFollow) {
        setAutoFollow(false);
      }
    };

    const onScroll = () => {
      syncBloomPosition();
    };

    container.addEventListener('wheel', pauseOnUserIntent, { passive: true });
    container.addEventListener('touchmove', pauseOnUserIntent, { passive: true });
    container.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      container.removeEventListener('wheel', pauseOnUserIntent);
      container.removeEventListener('touchmove', pauseOnUserIntent);
      container.removeEventListener('scroll', onScroll);
    };
  }, [setAutoFollow, syncBloomPosition]);

  const handleSelectAyah = useCallback(
    (index: number) => {
      setInspectedWord(null);
      seekToAyah(index, true);
    },
    [seekToAyah, setInspectedWord],
  );

  const handleInspectWord = useCallback(
    (ayahIndex: number, ayah: AyahItem, word: AyahWord) => {
      const ch = usePlayerStore
        .getState()
        .chapters.find((c) => c.id === usePlayerStore.getState().currentChapterId);
      setInspectedWord({
        word,
        ayahIndex,
        verseKey: ayah.verseKey,
        surahName: ch?.nameSimple ?? `Surah ${usePlayerStore.getState().currentChapterId}`,
      });
    },
    [setInspectedWord],
  );

  const handleOpenReflection = useCallback(
    (ayah: AyahItem) => {
      const st = usePlayerStore.getState();
      const ch = st.chapters.find((c) => c.id === st.currentChapterId);
      if (!ch) return;
      setReflectionTarget({ ayah, chapter: ch });
    },
    [setReflectionTarget],
  );

  const errorMessage = bootError || surahError;
  const isLoading = bootLoading || surahLoading;

  return (
    <section
      aria-label="Synchronized Ayah Recitation"
      className="relative flex-1 min-w-0 h-full flex flex-col overflow-hidden"
    >
      {/* Loading skeleton */}
      {isLoading && !errorMessage && (
        <div
          aria-busy="true"
          aria-label="Loading surah verses"
          className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-10 max-w-2xl mx-auto w-full"
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-full flex flex-col items-center gap-4"
              style={{ opacity: i === 1 ? 0.85 : 0.32 }}
            >
              <div className="h-3 w-12 rounded bg-[#8FA3C7]/20 animate-pulse" />
              <div className="h-9 w-4/5 rounded-lg bg-[#8FA3C7]/15 animate-pulse" />
              <div className="h-7 w-11/12 rounded-lg bg-[#8FA3C7]/12 animate-pulse" />
              <div className="h-7 w-2/3 rounded-lg bg-[#8FA3C7]/10 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Error state with retry */}
      {errorMessage && !isLoading && (
        <div
          role="alert"
          className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12 max-w-md mx-auto gap-5"
        >
          <p className="font-editorial text-3xl text-[#ECE9E1] tracking-tight">
            Unable to load <span className="italic text-[#8FA3C7]">recitation</span>
          </p>
          <p className="text-sm text-[#8FA3C7]/75 leading-relaxed">{errorMessage}</p>
          <button
            type="button"
            onClick={() => void retryCurrentSurah()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-[#ECE9E1] bg-[#151D33] border border-[#8FA3C7]/25 hover:border-[#8FA3C7]/50 hover:bg-[#19233D] transition-colors cursor-pointer focus-ring"
          >
            <RotateCcw className="w-4 h-4 text-[#8FA3C7]" aria-hidden="true" />
            <span>Try again</span>
          </button>
        </div>
      )}

      {/* Synced Ayah Scroll Theater */}
      {!isLoading && !errorMessage && surahData && (
        <div
          ref={scrollRef}
          data-testid="ayah-scroll-container"
          className="flex-1 overflow-y-auto sanctuary-scroll ayah-scroll-mask px-3 sm:px-8 lg:px-12"
        >
          {/* Editorial Surah Prelude: full header on mobile/tablet; refined compact spacing on desktop */}
          <div className="pt-8 sm:pt-12 lg:pt-[14vh] pb-4 sm:pb-6 text-center max-w-2xl mx-auto">
            {currentChapter && (
              <div className="lg:hidden mb-4">
                <p className="text-xs tracking-[0.2em] text-[#8FA3C7]/70 tabular-nums mb-2.5">
                  Surah {String(currentChapter.id).padStart(2, '0')} · {currentChapter.versesCount}{' '}
                  ayahs ·{' '}
                  <span className="capitalize">{currentChapter.revelationPlace}</span>
                </p>
                <h1 className="font-editorial text-4xl sm:text-5xl text-[#ECE9E1] tracking-[-0.02em] leading-[1.06] text-balance">
                  {currentChapter.nameSimple}{' '}
                  <span className="italic font-normal text-[#8FA3C7]">
                    {currentChapter.translatedName}
                  </span>
                </h1>
                <p
                  dir="rtl"
                  lang="ar"
                  className="font-arabic text-3xl text-[#8FA3C7]/85 mt-2.5 leading-relaxed"
                >
                  {currentChapter.nameArabic}
                </p>
              </div>
            )}

            {/* Bismillah pre-header for chapters that begin with Bismillah */}
            {currentChapter?.bismillahPre && (
              <p
                dir="rtl"
                lang="ar"
                className="font-arabic text-xl sm:text-2xl text-[#ECE9E1]/68 pt-4 pb-2"
              >
                بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
              </p>
            )}
          </div>

          {/* Ayah list */}
          <div
            role="list"
            aria-label={
              currentChapter
                ? `Ayahs of Surah ${currentChapter.nameSimple}`
                : 'Surah ayahs'
            }
            className="flex flex-col gap-2 sm:gap-4 pb-[42vh]"
          >
            {surahData.ayahs.map((ayah, idx) => {
              const isBookmarked = bookmarkMap.has(ayah.verseKey);
              const hasNote = bookmarkMap.get(ayah.verseKey) === true;
              const inspectedPos =
                inspectedWord && inspectedWord.verseKey === ayah.verseKey
                  ? inspectedWord.word.position
                  : null;

              return (
                <div key={ayah.verseKey} role="listitem">
                  <AyahRow
                    ayah={ayah}
                    index={idx}
                    activeIndex={activeAyahIndex}
                    activeWordPosition={idx === activeAyahIndex ? activeWordPosition : null}
                    wordHighlightEnabled={wordHighlightEnabled}
                    inspectedWordPosition={inspectedPos}
                    isBookmarked={isBookmarked}
                    hasNote={hasNote}
                    isPlaying={isPlaying}
                    onSelect={handleSelectAyah}
                    onInspectWord={handleInspectWord}
                    onOpenReflection={handleOpenReflection}
                    registerRef={registerRef}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Word-by-Word Inspector Popover */}
      <WordInspectorPopover />

      {/* Subtle Resume Auto-Follow button when user scrolls manually */}
      <AnimatePresence>
        {!autoFollow && !inspectedWord && surahData && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none absolute bottom-5 inset-x-0 flex justify-center z-20"
          >
            <button
              type="button"
              onClick={() => {
                resumeAutoFollow();
                requestAnimationFrame(() => scrollToActiveAyah(false));
              }}
              className="pointer-events-auto glass-surface-elevated inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-medium text-[#ECE9E1] hover:border-[#8FA3C7]/45 transition-colors cursor-pointer focus-ring"
            >
              <ArrowDown className="w-3.5 h-3.5 text-[#8FA3C7]" aria-hidden="true" />
              <span>Resume</span>
              <span className="text-[#8FA3C7]/75 tabular-nums">
                {surahData.ayahs[activeAyahIndex]?.verseKey}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
