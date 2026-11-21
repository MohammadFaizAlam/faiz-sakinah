import { useState } from 'react';
import { ArrowUpRight, BookOpen, Check, ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';
import { useJourneyStore } from '../store/journeyStore';
import { usePlayerStore } from '../store/playerStore';
import { JourneyPanelContent } from './JourneyPanelContent';

type SidebarTab = 'reciters' | 'bookmarks' | 'journey';

export function DesktopSidebar() {
  const [activeTab, setActiveTab] = useState<SidebarTab>('reciters');

  const chapters = usePlayerStore((s) => s.chapters);
  const reciters = usePlayerStore((s) => s.reciters);
  const currentChapterId = usePlayerStore((s) => s.currentChapterId);
  const currentReciterId = usePlayerStore((s) => s.currentReciterId);
  const surahData = usePlayerStore((s) => s.surahData);
  const activeAyahIndex = usePlayerStore((s) => s.activeAyahIndex);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const selectReciter = usePlayerStore((s) => s.selectReciter);
  const setSurahDrawerOpen = usePlayerStore((s) => s.setSurahDrawerOpen);
  const prevSurah = usePlayerStore((s) => s.prevSurah);
  const nextSurah = usePlayerStore((s) => s.nextSurah);

  const bookmarksCount = useJourneyStore((s) => s.bookmarks.length);

  const currentChapter = chapters.find((c) => c.id === currentChapterId);
  const totalAyahs = surahData?.ayahs.length ?? currentChapter?.versesCount ?? 0;
  const ayahProgressPercent =
    totalAyahs > 0 ? Math.min(100, Math.round(((activeAyahIndex + 1) / totalAyahs) * 100)) : 0;

  return (
    <aside
      aria-label="Surah details, reciters, bookmarks, and journey"
      className="hidden lg:flex flex-col w-[332px] xl:w-[364px] shrink-0 h-full border-r border-[#8FA3C7]/[0.1] bg-[#0A0F1E]/46 px-6 py-6 overflow-hidden"
    >
      {/* Top Meta Row: Surah counter + quick prev/next surah step */}
      <div className="flex items-center justify-between gap-2 mb-3.5 shrink-0">
        <span className="text-[11px] tracking-[0.16em] text-[#8FA3C7]/70 tabular-nums">
          Surah {String(currentChapterId).padStart(2, '0')} / 114
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void prevSurah()}
            aria-label="Previous Surah from sidebar"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8FA3C7]/70 hover:text-[#ECE9E1] hover:bg-[#8FA3C7]/12 transition-colors cursor-pointer focus-ring"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => void nextSurah()}
            aria-label="Next Surah from sidebar"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8FA3C7]/70 hover:text-[#ECE9E1] hover:bg-[#8FA3C7]/12 transition-colors cursor-pointer focus-ring"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Interactive Current Surah Editorial Plate */}
      <div className="pb-5 border-b border-[#8FA3C7]/[0.1] shrink-0">
        <button
          type="button"
          onClick={() => setSurahDrawerOpen(true)}
          aria-label={
            currentChapter
              ? `${currentChapter.nameSimple}, ${currentChapter.translatedName}. Browse all 114 surahs`
              : 'Browse all 114 surahs'
          }
          className="group w-full text-left rounded-2xl p-4 -mx-1 bg-[#0F1629]/55 border border-[#8FA3C7]/[0.13] hover:bg-[#131C33]/75 hover:border-[#8FA3C7]/35 transition-all duration-200 cursor-pointer focus-ring"
        >
          {currentChapter ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <p
                  dir="rtl"
                  lang="ar"
                  className="font-arabic text-left text-[2.2rem] text-[#8FA3C7]/95 group-hover:text-[#ECE9E1] transition-colors leading-[1.45]"
                >
                  {currentChapter.nameArabic}
                </p>
                <span
                  aria-hidden="true"
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[#8FA3C7]/60 group-hover:text-[#ECE9E1] group-hover:bg-[#8FA3C7]/14 transition-all shrink-0 mt-1"
                >
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </div>

              <h1 className="font-editorial text-[1.95rem] text-[#ECE9E1] tracking-[-0.02em] leading-[1.08] mt-1">
                {currentChapter.nameSimple}
              </h1>
              <p className="font-editorial italic text-[1.3rem] text-[#8FA3C7] leading-[1.2] mt-0.5">
                {currentChapter.translatedName}
              </p>

              <div className="mt-3 flex items-center justify-between gap-2 text-xs text-[#8FA3C7]/65 tabular-nums">
                <span>
                  <span className="capitalize">{currentChapter.revelationPlace}</span> ·{' '}
                  {currentChapter.versesCount} ayahs
                </span>
                {totalAyahs > 0 && (
                  <span>
                    Ayah {activeAyahIndex + 1} / {totalAyahs}
                  </span>
                )}
              </div>

              {/* Subtle ayah progress hairline */}
              <div
                aria-hidden="true"
                className="mt-2.5 h-[2px] w-full rounded-full bg-[#8FA3C7]/[0.12] overflow-hidden"
              >
                <div
                  className="h-full bg-[#8FA3C7]/80 transition-[width] duration-300 ease-out"
                  style={{ width: `${ayahProgressPercent}%` }}
                />
              </div>

              {/* Quiet action cue footer inside card */}
              <div className="mt-3 pt-2.5 border-t border-[#8FA3C7]/[0.09] flex items-center justify-between text-xs text-[#8FA3C7]/80 group-hover:text-[#ECE9E1] transition-colors">
                <span className="inline-flex items-center gap-2 font-medium">
                  <BookOpen className="w-3.5 h-3.5 text-[#8FA3C7]" aria-hidden="true" />
                  <span>Browse all 114 Surahs</span>
                </span>
                <kbd className="px-1.5 py-0.5 rounded bg-[#0A0F1E]/70 border border-[#8FA3C7]/15 text-[10px] font-mono text-[#8FA3C7]/70">
                  /
                </kbd>
              </div>
            </>
          ) : (
            <div className="space-y-3 py-2">
              <div className="h-9 w-28 rounded bg-[#8FA3C7]/15 animate-pulse" />
              <div className="h-7 w-40 rounded bg-[#8FA3C7]/12 animate-pulse" />
              <div className="h-5 w-32 rounded bg-[#8FA3C7]/10 animate-pulse" />
            </div>
          )}
        </button>
      </div>

      {/* Lower Panel Switcher: Reciters | Bookmarks | Journey */}
      <div className="flex-1 min-h-0 flex flex-col pt-4">
        <div
          role="tablist"
          aria-label="Sidebar sections"
          className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#0F1629]/75 border border-[#8FA3C7]/[0.12] mb-3.5 shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'reciters'}
            onClick={() => setActiveTab('reciters')}
            className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer focus-ring ${
              activeTab === 'reciters'
                ? 'bg-[#8FA3C7]/18 text-[#ECE9E1]'
                : 'text-[#8FA3C7]/68 hover:text-[#ECE9E1]'
            }`}
          >
            Reciters
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'bookmarks'}
            onClick={() => setActiveTab('bookmarks')}
            className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer focus-ring tabular-nums ${
              activeTab === 'bookmarks'
                ? 'bg-[#8FA3C7]/18 text-[#ECE9E1]'
                : 'text-[#8FA3C7]/68 hover:text-[#ECE9E1]'
            }`}
          >
            Saved{bookmarksCount > 0 ? ` (${bookmarksCount})` : ''}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'journey'}
            onClick={() => setActiveTab('journey')}
            className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer focus-ring ${
              activeTab === 'journey'
                ? 'bg-[#8FA3C7]/18 text-[#ECE9E1]'
                : 'text-[#8FA3C7]/68 hover:text-[#ECE9E1]'
            }`}
          >
            Journey
          </button>
        </div>

        {activeTab === 'reciters' ? (
          <>
            <div className="flex items-baseline justify-between mb-1 shrink-0">
              <h2 className="text-[11px] tracking-[0.16em] text-[#8FA3C7]/75">Reciter</h2>
              <span className="text-[11px] text-[#8FA3C7]/52 tabular-nums">
                {reciters.length > 0 ? `${reciters.length} voices` : ''}
              </span>
            </div>
            <p className="text-[11px] text-[#8FA3C7]/48 mb-2.5 shrink-0">
              Switching voice preserves your active ayah
            </p>

            <div
              role="listbox"
              aria-label="Choose a reciter"
              className="flex-1 overflow-y-auto sanctuary-scroll -mx-2 px-2 space-y-1 pr-2 pb-4"
            >
              {reciters.length === 0 ? (
                <div className="space-y-2 py-2">
                  {[0, 1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="h-12 rounded-xl bg-[#8FA3C7]/10 animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                reciters.map((reciter) => {
                  const selected = reciter.id === currentReciterId;
                  return (
                    <button
                      key={reciter.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => void selectReciter(reciter.id)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 transition-all duration-150 cursor-pointer focus-ring ${
                        selected
                          ? 'bg-[#8FA3C7]/[0.15] border border-[#8FA3C7]/28 text-[#ECE9E1]'
                          : 'border border-transparent text-[#ECE9E1]/74 hover:bg-[#8FA3C7]/[0.07] hover:text-[#ECE9E1]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug truncate">
                          {reciter.name}
                        </p>
                        <p className="text-[11px] text-[#8FA3C7]/60 truncate mt-0.5">
                          {reciter.style ?? 'Murattal'}
                          {reciter.qirat ? ` · ${reciter.qirat}` : ''}
                        </p>
                      </div>
                      {selected && (
                        <span className="shrink-0 text-[#8FA3C7]" aria-hidden="true">
                          {isPlaying ? (
                            <Volume2 className="w-4 h-4" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <JourneyPanelContent mode={activeTab} />
        )}

        {/* Quiet translation attribution */}
        {surahData?.translation && (
          <div className="pt-3 mt-1 border-t border-[#8FA3C7]/[0.08] text-[11px] text-[#8FA3C7]/55 truncate shrink-0">
            Translation · {surahData.translation.name}
          </div>
        )}
      </div>
    </aside>
  );
}
