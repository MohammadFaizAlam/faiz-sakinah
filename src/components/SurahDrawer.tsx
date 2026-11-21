import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Bookmark, CornerDownLeft, Search, Volume2, X } from 'lucide-react';
import { filterSurahs } from '../lib/quranUtils';
import { useJourneyStore } from '../store/journeyStore';
import { usePlayerStore } from '../store/playerStore';
import type { SurahChapter } from '../types/quran';

type SurahFilterTab = 'all' | 'makkah' | 'madinah' | 'saved';

const QUICK_JUMP_IDS = [1, 2, 18, 36, 55, 67];

interface SurahRowProps {
  chapter: SurahChapter;
  isActive: boolean;
  isPlaying: boolean;
  isHighlighted: boolean;
  hasBookmark: boolean;
  onSelect: (id: number) => void;
  onHover: () => void;
  rowRef?: (el: HTMLButtonElement | null) => void;
}

const SurahRow = memo(function SurahRow({
  chapter,
  isActive,
  isPlaying,
  isHighlighted,
  hasBookmark,
  onSelect,
  onHover,
  rowRef,
}: SurahRowProps) {
  return (
    <button
      ref={rowRef}
      type="button"
      onClick={() => onSelect(chapter.id)}
      onMouseEnter={onHover}
      onFocus={onHover}
      aria-current={isActive ? 'true' : undefined}
      data-surah-id={chapter.id}
      data-highlighted={isHighlighted ? 'true' : 'false'}
      className={`group w-full text-left px-3.5 sm:px-4 py-3 rounded-2xl flex items-center justify-between gap-3.5 border transition-all duration-150 cursor-pointer focus-ring ${
        isActive
          ? 'bg-[#8FA3C7]/[0.16] border-[#8FA3C7]/42 text-[#ECE9E1] shadow-[0_10px_28px_-14px_rgba(143,163,199,0.4)]'
          : isHighlighted
            ? 'bg-[#8FA3C7]/[0.11] border-[#8FA3C7]/28 text-[#ECE9E1]'
            : 'border-transparent text-[#ECE9E1]/86 hover:bg-[#8FA3C7]/[0.075] hover:border-[#8FA3C7]/[0.14]'
      }`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Framed numeral emblem */}
        <span
          className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-medium tabular-nums shrink-0 border transition-colors ${
            isActive
              ? 'bg-[#8FA3C7] text-[#0A0F1E] border-[#8FA3C7]'
              : 'bg-[#0A0F1E]/70 text-[#8FA3C7]/80 border-[#8FA3C7]/[0.16] group-hover:border-[#8FA3C7]/35 group-hover:text-[#ECE9E1]'
          }`}
        >
          {isActive && isPlaying ? (
            <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            String(chapter.id).padStart(2, '0')
          )}
        </span>

        <div className="min-w-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-sm sm:text-[15px] font-medium truncate">
              {chapter.nameSimple}
            </span>
            <span className="font-editorial italic text-[15px] sm:text-base text-[#8FA3C7]/88 truncate">
              {chapter.translatedName}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#8FA3C7]/62 tabular-nums mt-0.5">
            <span>{chapter.versesCount} ayahs</span>
            <span aria-hidden="true" className="text-[#8FA3C7]/30">
              ·
            </span>
            <span className="capitalize">{chapter.revelationPlace}</span>
            {hasBookmark && (
              <>
                <span aria-hidden="true" className="text-[#8FA3C7]/30">
                  ·
                </span>
                <span className="inline-flex items-center gap-1 text-[#8FA3C7]/90">
                  <Bookmark className="w-2.5 h-2.5 fill-current" aria-hidden="true" />
                  <span>Saved</span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <span
        dir="rtl"
        lang="ar"
        className={`font-arabic text-xl sm:text-[1.45rem] shrink-0 leading-normal transition-colors ${
          isActive ? 'text-[#ECE9E1]' : 'text-[#8FA3C7]/82 group-hover:text-[#ECE9E1]'
        }`}
      >
        {chapter.nameArabic}
      </span>
    </button>
  );
});

export function SurahDrawer() {
  const [query, setQuery] = useState('');
  const [filterTab, setFilterTab] = useState<SurahFilterTab>('all');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const activeRowRef = useRef<HTMLButtonElement | null>(null);
  const highlightedRowRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const isOpen = usePlayerStore((s) => s.surahDrawerOpen);
  const chapters = usePlayerStore((s) => s.chapters);
  const currentChapterId = usePlayerStore((s) => s.currentChapterId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const setSurahDrawerOpen = usePlayerStore((s) => s.setSurahDrawerOpen);
  const selectSurah = usePlayerStore((s) => s.selectSurah);
  const prefetchSurah = usePlayerStore((s) => s.prefetchSurah);
  const hoverPrefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bookmarks = useJourneyStore((s) => s.bookmarks);
  const bookmarkedChapterIds = useMemo(() => {
    const ids = new Set<number>();
    for (const bm of bookmarks) ids.add(bm.chapterId);
    return ids;
  }, [bookmarks]);

  const tabFilteredChapters = useMemo(() => {
    if (filterTab === 'makkah') {
      return chapters.filter((c) => c.revelationPlace.toLowerCase() === 'makkah');
    }
    if (filterTab === 'madinah') {
      return chapters.filter((c) => c.revelationPlace.toLowerCase() === 'madinah');
    }
    if (filterTab === 'saved') {
      return chapters.filter((c) => bookmarkedChapterIds.has(c.id));
    }
    return chapters;
  }, [chapters, filterTab, bookmarkedChapterIds]);

  const filteredChapters = useMemo(
    () => filterSurahs(tabFilteredChapters, query),
    [tabFilteredChapters, query],
  );

  const quickJumpChapters = useMemo(
    () =>
      QUICK_JUMP_IDS.map((id) => chapters.find((c) => c.id === id)).filter(
        (c): c is SurahChapter => Boolean(c),
      ),
    [chapters],
  );

  // Reset highlighted index and prefetch top fuzzy match immediately when typing
  useEffect(() => {
    setHighlightedIndex(0);
    if (query.trim() && filteredChapters.length > 0) {
      const topId = filteredChapters[0].id;
      const timer = window.setTimeout(() => prefetchSurah(topId), 75);
      return () => window.clearTimeout(timer);
    }
  }, [query, filteredChapters, prefetchSurah]);

  useEffect(() => {
    if (!isOpen || !query.trim()) return;
    highlightedRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen, query]);

  const close = useCallback(() => {
    setSurahDrawerOpen(false);
  }, [setSurahDrawerOpen]);

  const handleSelectSurah = useCallback(
    (id: number) => {
      if (hoverPrefetchTimerRef.current) {
        clearTimeout(hoverPrefetchTimerRef.current);
      }
      setQuery('');
      setFilterTab('all');
      setHighlightedIndex(0);
      void selectSurah(id, true);
    },
    [selectSurah],
  );

  const handleRowHover = useCallback(
    (idx: number, chapterId: number) => {
      setHighlightedIndex(idx);
      if (hoverPrefetchTimerRef.current) {
        clearTimeout(hoverPrefetchTimerRef.current);
      }
      hoverPrefetchTimerRef.current = setTimeout(() => {
        prefetchSurah(chapterId);
      }, 45);
    },
    [prefetchSurah],
  );

  useEffect(() => {
    return () => {
      if (hoverPrefetchTimerRef.current) {
        clearTimeout(hoverPrefetchTimerRef.current);
      }
    };
  }, []);

  const bindActiveRow = useCallback((el: HTMLButtonElement | null) => {
    activeRowRef.current = el;
  }, []);

  const bindHighlightedRow = useCallback((el: HTMLButtonElement | null) => {
    highlightedRowRef.current = el;
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredChapters.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        Math.min(filteredChapters.length - 1, prev + 1),
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(0, prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredChapters[highlightedIndex] ?? filteredChapters[0];
      if (target) {
        handleSelectSurah(target.id);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setFilterTab('all');
      setHighlightedIndex(0);
      if (previouslyFocusedRef.current) {
        previouslyFocusedRef.current.focus();
        previouslyFocusedRef.current = null;
      }
      return;
    }

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus();
      activeRowRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' });
    }, 60);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, close]);

  const hasQuery = query.trim().length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          id="surah-menu-dialog"
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-6"
        >
          {/* Scrim backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.2 }}
            onClick={close}
            aria-hidden="true"
            className="absolute inset-0 bg-[#050812]/80"
          />

          {/* Bottom sheet on mobile, elevated editorial modal on desktop */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="surah-menu-title"
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 26, scale: 0.985 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 18, scale: 0.985 }
            }
            transition={{
              duration: prefersReducedMotion ? 0.01 : 0.26,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="glass-surface-elevated relative z-10 w-full md:max-w-[580px] h-[86dvh] md:h-[80dvh] max-h-[780px] rounded-t-3xl md:rounded-3xl border border-[#8FA3C7]/24 shadow-[0_32px_90px_-20px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden"
          >
            {/* Mobile drag handle indicator */}
            <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-[#8FA3C7]/30" aria-hidden="true" />
            </div>

            {/* Header */}
            <div className="px-5 sm:px-6 pt-3.5 md:pt-6 pb-4 border-b border-[#8FA3C7]/[0.12] shrink-0">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-[11px] tracking-[0.18em] text-[#8FA3C7]/68 tabular-nums mb-1">
                    Al-Qur’an · {filteredChapters.length} of {chapters.length || 114} Surahs
                  </p>
                  <h2
                    id="surah-menu-title"
                    className="font-editorial text-2xl sm:text-[2rem] text-[#ECE9E1] tracking-[-0.02em] leading-none"
                  >
                    Select a <span className="italic text-[#8FA3C7]">Surah</span>
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={close}
                  aria-label="Close Surah menu"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#8FA3C7]/80 hover:text-[#ECE9E1] bg-[#0A0F1E]/55 border border-[#8FA3C7]/16 hover:border-[#8FA3C7]/36 transition-colors cursor-pointer focus-ring"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              {/* Fuzzy search input */}
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8FA3C7]/65"
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search by name, meaning, Arabic, or number…"
                  aria-label="Search surahs by name or number"
                  className="w-full h-11 pl-10 pr-16 rounded-xl bg-[#0A0F1E]/85 border border-[#8FA3C7]/20 text-sm text-[#ECE9E1] placeholder:text-[#8FA3C7]/50 focus:outline-none focus:border-[#8FA3C7]/55 transition-colors"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {hasQuery && filteredChapters.length > 0 && (
                    <span
                      aria-hidden="true"
                      className="hidden sm:inline-flex items-center justify-center px-1.5 h-6 rounded bg-[#151D33] border border-[#8FA3C7]/20 text-[10px] text-[#8FA3C7]/80"
                    >
                      <CornerDownLeft className="w-3 h-3" />
                    </span>
                  )}
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        searchInputRef.current?.focus();
                      }}
                      aria-label="Clear surah search"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8FA3C7]/70 hover:text-[#ECE9E1] hover:bg-[#8FA3C7]/12 transition-colors cursor-pointer focus-ring"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              {/* Segmented Revelation / Saved Filter */}
              <div
                role="tablist"
                aria-label="Filter surahs"
                className="mt-3 grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#0A0F1E]/72 border border-[#8FA3C7]/[0.12]"
              >
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'makkah', label: 'Makkan' },
                    { id: 'madinah', label: 'Madinan' },
                    {
                      id: 'saved',
                      label:
                        bookmarkedChapterIds.size > 0
                          ? `Saved (${bookmarkedChapterIds.size})`
                          : 'Saved',
                    },
                  ] as const
                ).map((tab) => {
                  const selected = filterTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => {
                        setFilterTab(tab.id);
                        setHighlightedIndex(0);
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer focus-ring tabular-nums truncate ${
                        selected
                          ? 'bg-[#8FA3C7]/20 text-[#ECE9E1]'
                          : 'text-[#8FA3C7]/68 hover:text-[#ECE9E1]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Quiet Quick-Jump Strip when browsing All without a query */}
              {!hasQuery && filterTab === 'all' && quickJumpChapters.length > 0 && (
                <div className="mt-3 flex items-center gap-1.5 overflow-x-auto sanctuary-scroll pb-0.5">
                  <span className="text-[10px] tracking-[0.14em] text-[#8FA3C7]/52 shrink-0 pr-1">
                    Often recited
                  </span>
                  {quickJumpChapters.map((ch) => {
                    const active = ch.id === currentChapterId;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onMouseEnter={() => prefetchSurah(ch.id)}
                        onClick={() => handleSelectSurah(ch.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap shrink-0 border transition-colors cursor-pointer focus-ring ${
                          active
                            ? 'bg-[#8FA3C7]/20 border-[#8FA3C7]/45 text-[#ECE9E1]'
                            : 'bg-[#0F1629]/65 border-[#8FA3C7]/[0.12] text-[#8FA3C7]/85 hover:border-[#8FA3C7]/35 hover:text-[#ECE9E1]'
                        }`}
                      >
                        {ch.nameSimple}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 114 Surahs List */}
            <div
              role="list"
              aria-label="All 114 Surahs"
              className="flex-1 overflow-y-auto sanctuary-scroll px-3 sm:px-4 py-3 space-y-1"
            >
              {filteredChapters.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0.01 : 0.2 }}
                  className="py-16 px-6 text-center flex flex-col items-center gap-3"
                >
                  <p className="font-editorial text-2xl text-[#ECE9E1]">
                    {filterTab === 'saved' && !hasQuery ? (
                      <>
                        No saved surahs <span className="italic text-[#8FA3C7]">yet</span>
                      </>
                    ) : (
                      <>
                        No surah matches <span className="italic text-[#8FA3C7]">“{query}”</span>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-[#8FA3C7]/65 max-w-xs leading-relaxed">
                    {filterTab === 'saved' && !hasQuery
                      ? 'Bookmark any verse while listening and its surah will appear here.'
                      : 'Try searching by number (1–114), transliteration (e.g. Baqarah, Kahf), or Arabic.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setFilterTab('all');
                      searchInputRef.current?.focus();
                    }}
                    className="mt-2 px-4 py-2 rounded-full text-xs font-medium text-[#ECE9E1] bg-[#151D33] border border-[#8FA3C7]/25 hover:border-[#8FA3C7]/50 transition-colors cursor-pointer focus-ring"
                  >
                    Show all 114 surahs
                  </button>
                </motion.div>
              ) : (
                filteredChapters.map((chapter, idx) => {
                  const isActive = chapter.id === currentChapterId;
                  const isHighlighted = hasQuery && idx === highlightedIndex;
                  return (
                    <div key={chapter.id} role="listitem">
                      <SurahRow
                        chapter={chapter}
                        isActive={isActive}
                        isPlaying={isPlaying}
                        isHighlighted={isHighlighted}
                        hasBookmark={bookmarkedChapterIds.has(chapter.id)}
                        onSelect={handleSelectSurah}
                        onHover={() => handleRowHover(idx, chapter.id)}
                        rowRef={
                          isHighlighted
                            ? bindHighlightedRow
                            : isActive
                              ? bindActiveRow
                              : undefined
                        }
                      />
                    </div>
                  );
                })
              )}
            </div>

            {/* Quiet keyboard navigation footer on desktop */}
            <div className="hidden md:flex items-center justify-between px-6 py-2.5 border-t border-[#8FA3C7]/[0.1] bg-[#0A0F1E]/55 text-[11px] text-[#8FA3C7]/58 shrink-0">
              <span>Instant switching with pre-warmed audio</span>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#0F1629] border border-[#8FA3C7]/16 font-mono text-[10px] text-[#8FA3C7]/80">
                    ↑↓
                  </kbd>
                  <span>Navigate</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#0F1629] border border-[#8FA3C7]/16 font-mono text-[10px] text-[#8FA3C7]/80">
                    ↵
                  </kbd>
                  <span>Play</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#0F1629] border border-[#8FA3C7]/16 font-mono text-[10px] text-[#8FA3C7]/80">
                    Esc
                  </kbd>
                  <span>Close</span>
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
