import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Bookmark, BookOpen, Check, ChevronDown, Mic2, Volume2, X } from 'lucide-react';
import { useJourneyStore } from '../store/journeyStore';
import { usePlayerStore } from '../store/playerStore';
import { AtmospherePopover } from './AtmospherePopover';

export function TopBar() {
  const [reciterMenuOpen, setReciterMenuOpen] = useState(false);
  const reciterDropdownRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const chapters = usePlayerStore((s) => s.chapters);
  const reciters = usePlayerStore((s) => s.reciters);
  const currentChapterId = usePlayerStore((s) => s.currentChapterId);
  const currentReciterId = usePlayerStore((s) => s.currentReciterId);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const surahDrawerOpen = usePlayerStore((s) => s.surahDrawerOpen);
  const setSurahDrawerOpen = usePlayerStore((s) => s.setSurahDrawerOpen);
  const selectReciter = usePlayerStore((s) => s.selectReciter);

  const bookmarksCount = useJourneyStore((s) => s.bookmarks.length);
  const setJourneyDrawerOpen = useJourneyStore((s) => s.setJourneyDrawerOpen);

  const currentChapter = chapters.find((c) => c.id === currentChapterId);
  const currentReciter = reciters.find((r) => r.id === currentReciterId);

  useEffect(() => {
    if (!reciterMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        reciterDropdownRef.current &&
        !reciterDropdownRef.current.contains(e.target as Node)
      ) {
        setReciterMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReciterMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [reciterMenuOpen]);

  return (
    <header className="relative z-30 h-14 sm:h-16 px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-8 border-b border-[#8FA3C7]/[0.1] bg-[#0A0F1E]/45 shrink-0">
      {/* Zone 1: Single-line luxury wordmark */}
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          usePlayerStore.getState().resumeAutoFollow();
        }}
        className="font-editorial text-[1.4rem] sm:text-[1.65rem] tracking-[-0.02em] text-[#ECE9E1] whitespace-nowrap shrink-0 focus-ring rounded"
      >
        Sakinah
      </a>

      {/* Zone 2: Quiet always-visible Now Playing summary */}
      <div className="hidden md:flex items-center gap-2.5 min-w-0 text-sm text-[#8FA3C7]/75 truncate">
        {currentChapter && (
          <>
            <span className="tabular-nums text-[#8FA3C7]/60 shrink-0">
              {String(currentChapter.id).padStart(2, '0')}
            </span>
            <span className="text-[#ECE9E1] font-medium truncate">
              {currentChapter.nameSimple}
            </span>
            <span aria-hidden="true" className="text-[#8FA3C7]/35 shrink-0">
              ·
            </span>
            <span className="font-editorial italic text-base text-[#8FA3C7]/90 truncate">
              {currentReciter?.name ?? 'Loading reciter'}
            </span>
          </>
        )}
      </div>

      {/* Zone 3: Atmosphere tuning + mobile Journey & Reciter + Prominent Surah button */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Voice-reactive Atmosphere & visualizer tuning */}
        <AtmospherePopover />

        {/* Mobile/tablet Reflections & Journey drawer button */}
        <button
          type="button"
          onClick={() => setJourneyDrawerOpen(true)}
          aria-label="Open reflections and listening journey"
          className="lg:hidden relative h-8 w-8 sm:h-10 sm:w-10 rounded-full text-[#ECE9E1]/88 bg-[#0F1629]/80 border border-[#8FA3C7]/16 hover:border-[#8FA3C7]/35 transition-colors inline-flex items-center justify-center shrink-0 cursor-pointer focus-ring"
        >
          <Bookmark
            className={`w-3.5 h-3.5 text-[#8FA3C7] ${bookmarksCount > 0 ? 'fill-current' : ''}`}
            aria-hidden="true"
          />
        </button>

        {/* Reciter selector dropdown on mobile/tablet */}
        <div ref={reciterDropdownRef} className="relative lg:hidden">
          <button
            type="button"
            onClick={() => setReciterMenuOpen((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={reciterMenuOpen}
            aria-label="Select reciter"
            className={`h-8 sm:h-10 px-2 sm:px-3.5 rounded-full text-xs sm:text-sm transition-all inline-flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-ring border ${
              reciterMenuOpen
                ? 'bg-[#151D33] border-[#8FA3C7]/48 text-[#ECE9E1]'
                : 'bg-[#0F1629]/80 border-[#8FA3C7]/16 text-[#ECE9E1]/90 hover:border-[#8FA3C7]/35'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5 text-[#8FA3C7] shrink-0" aria-hidden="true" />
            <span className="max-w-[54px] sm:max-w-[140px] truncate">
              {currentReciter?.name ?? 'Reciter'}
            </span>
            <ChevronDown
              className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#8FA3C7]/75 transition-transform duration-200 ${
                reciterMenuOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          <AnimatePresence>
            {reciterMenuOpen && (
              <>
                <motion.div
                  aria-hidden="true"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0.01 : 0.18 }}
                  onClick={() => setReciterMenuOpen(false)}
                  className="sm:hidden fixed inset-0 z-40 bg-[#050812]/65"
                />

                <motion.div
                  role="listbox"
                  aria-label="Available reciters"
                  initial={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: -8, scale: 0.98 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: -6, scale: 0.98 }
                  }
                  transition={{
                    duration: prefersReducedMotion ? 0.01 : 0.2,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="glass-surface-elevated fixed inset-x-3 top-[4.15rem] z-50 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2.5 sm:w-[316px] rounded-2xl border border-[#8FA3C7]/24 shadow-[0_28px_72px_-16px_rgba(0,0,0,0.88)] overflow-hidden flex flex-col max-h-[min(72dvh,420px)]"
                >
                  <div className="px-4 pt-3.5 pb-3 border-b border-[#8FA3C7]/[0.12] flex items-start justify-between gap-3 shrink-0">
                    <div>
                      <p className="font-editorial text-xl text-[#ECE9E1] leading-none">
                        Choose <span className="italic text-[#8FA3C7]">Reciter</span>
                      </p>
                      <p className="text-[11px] text-[#8FA3C7]/62 mt-1">
                        {reciters.length} voices · Preserves your active ayah
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReciterMenuOpen(false)}
                      aria-label="Close reciter menu"
                      className="sm:hidden w-7 h-7 rounded-full flex items-center justify-center text-[#8FA3C7]/75 hover:text-[#ECE9E1] hover:bg-[#8FA3C7]/14 transition-colors cursor-pointer focus-ring"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto sanctuary-scroll p-2 space-y-1">
                    {reciters.map((reciter) => {
                      const selected = reciter.id === currentReciterId;
                      return (
                        <button
                          key={reciter.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => {
                            setReciterMenuOpen(false);
                            void selectReciter(reciter.id);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 border transition-all cursor-pointer focus-ring ${
                            selected
                              ? 'bg-[#8FA3C7]/[0.16] border-[#8FA3C7]/36 text-[#ECE9E1]'
                              : 'border-transparent text-[#ECE9E1]/80 hover:bg-[#8FA3C7]/[0.08] hover:text-[#ECE9E1]'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium truncate leading-snug">
                              {reciter.name}
                            </p>
                            <p className="text-[11px] text-[#8FA3C7]/62 truncate mt-0.5">
                              {reciter.style ?? 'Murattal'}
                              {reciter.qirat ? ` · ${reciter.qirat}` : ''}
                            </p>
                          </div>
                          {selected && (
                            <span
                              className="shrink-0 text-[#8FA3C7]"
                              aria-hidden="true"
                            >
                              {isPlaying ? (
                                <Volume2 className="w-4 h-4" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Prominent Surah button */}
        <button
          type="button"
          onClick={() => setSurahDrawerOpen(true)}
          aria-expanded={surahDrawerOpen}
          aria-controls="surah-menu-dialog"
          aria-label="Open Surah menu"
          className="h-8 sm:h-10 px-2.5 sm:px-5 rounded-full text-xs sm:text-sm font-medium text-[#ECE9E1] bg-[#151D33]/90 border border-[#8FA3C7]/28 hover:border-[#8FA3C7]/58 hover:bg-[#192440] transition-colors inline-flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 cursor-pointer focus-ring"
        >
          <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8FA3C7]" aria-hidden="true" />
          <span>Surah</span>
        </button>
      </div>
    </header>
  );
}
