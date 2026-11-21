import { useCallback, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatTime } from '../lib/quranUtils';
import { usePlayerStore } from '../store/playerStore';

export function PlayerDock() {
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPercent, setScrubPercent] = useState(0);

  const chapters = usePlayerStore((s) => s.chapters);
  const reciters = usePlayerStore((s) => s.reciters);
  const currentChapterId = usePlayerStore((s) => s.currentChapterId);
  const currentReciterId = usePlayerStore((s) => s.currentReciterId);
  const surahData = usePlayerStore((s) => s.surahData);
  const surahLoading = usePlayerStore((s) => s.surahLoading);
  const audioStatus = usePlayerStore((s) => s.audioStatus);
  const audioError = usePlayerStore((s) => s.audioError);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);

  const requestTogglePlay = usePlayerStore((s) => s.requestTogglePlay);
  const requestSeekToSeconds = usePlayerStore((s) => s.requestSeekToSeconds);
  const prevSurah = usePlayerStore((s) => s.prevSurah);
  const nextSurah = usePlayerStore((s) => s.nextSurah);
  const prevAyah = usePlayerStore((s) => s.prevAyah);
  const nextAyah = usePlayerStore((s) => s.nextAyah);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const setSurahDrawerOpen = usePlayerStore((s) => s.setSurahDrawerOpen);
  const retryCurrentSurah = usePlayerStore((s) => s.retryCurrentSurah);

  const currentChapter = chapters.find((c) => c.id === currentChapterId);
  const currentReciter = reciters.find((r) => r.id === currentReciterId);

  const inferredDuration =
    duration > 0
      ? duration
      : surahData && surahData.timings.length > 0
        ? surahData.timings[surahData.timings.length - 1].timestampTo / 1000
        : 0;

  const livePercent =
    inferredDuration > 0
      ? Math.max(0, Math.min(100, (currentTime / inferredDuration) * 100))
      : 0;

  const displayPercent = isScrubbing ? scrubPercent : livePercent;
  const displayCurrentTime = isScrubbing
    ? (scrubPercent / 100) * inferredDuration
    : currentTime;

  const isBusy =
    surahLoading || audioStatus === 'loading' || audioStatus === 'buffering';

  const getPercentFromClientX = useCallback((clientX: number) => {
    const bar = progressBarRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (inferredDuration <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pct = getPercentFromClientX(e.clientX);
    setIsScrubbing(true);
    setScrubPercent(pct);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    setScrubPercent(getPercentFromClientX(e.clientX));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    const pct = getPercentFromClientX(e.clientX);
    setIsScrubbing(false);
    requestSeekToSeconds((pct / 100) * inferredDuration);
  };

  const handleSliderKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (inferredDuration <= 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      requestSeekToSeconds(Math.min(inferredDuration, currentTime + 5));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      requestSeekToSeconds(Math.max(0, currentTime - 5));
    } else if (e.key === 'Home') {
      e.preventDefault();
      requestSeekToSeconds(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      requestSeekToSeconds(inferredDuration);
    }
  };

  return (
    <footer
      aria-label="Audio player controls"
      className="relative z-30 shrink-0 px-4 sm:px-8 lg:px-12 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-5 pt-2"
    >
      <div className="glass-surface max-w-3xl w-full mx-auto rounded-2xl">
        {/* Inset Scrubbable Progress Slider with generous breathing room on all sides */}
        <div className="px-5 sm:px-6 pt-3.5 pb-1">
          <div
            ref={progressBarRef}
            role="slider"
            tabIndex={0}
            aria-label="Playback progress"
            aria-valuemin={0}
            aria-valuemax={Math.round(inferredDuration)}
            aria-valuenow={Math.round(displayCurrentTime)}
            aria-valuetext={`${formatTime(displayCurrentTime)} of ${formatTime(inferredDuration)}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => setIsScrubbing(false)}
            onKeyDown={handleSliderKeyDown}
            className="group relative h-5 w-full flex items-center cursor-pointer touch-none focus-ring rounded-full"
          >
            <div className="w-full h-[4px] rounded-full bg-[#8FA3C7]/[0.18] group-hover:h-[5px] transition-all">
              <div
                className="h-full rounded-full bg-[#8FA3C7] relative transition-[width] duration-75"
                style={{ width: `${displayPercent}%` }}
              >
                <span
                  aria-hidden="true"
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-[#ECE9E1] ring-2 ring-[#0A0F1E]/75 shadow-[0_0_10px_rgba(143,163,199,0.5)] scale-90 group-hover:scale-110 group-focus-visible:scale-110 transition-transform"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Responsive Dock Body: balanced stacked layout on mobile, 3-column console on md+ */}
        <div className="px-5 sm:px-6 pb-3.5 pt-1 flex flex-col gap-2.5 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:gap-4">
          {/* Row 1 (mobile) / Left col (desktop): Now Playing + Mobile Time */}
          <div className="min-w-0 flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSurahDrawerOpen(true)}
                aria-label={
                  currentChapter
                    ? `Now playing ${currentChapter.nameSimple}. Open Surah menu`
                    : 'Open Surah menu'
                }
                className="min-w-0 text-left group cursor-pointer focus-ring rounded-lg py-0.5"
              >
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-[13px] sm:text-sm font-medium text-[#ECE9E1] group-hover:text-[#8FA3C7] transition-colors truncate">
                    {currentChapter ? currentChapter.nameSimple : 'Al-Fatihah'}
                  </span>
                  {currentChapter && (
                    <span
                      dir="rtl"
                      lang="ar"
                      className="font-arabic text-[15px] sm:text-base text-[#8FA3C7]/80 shrink-0 leading-none"
                    >
                      {currentChapter.nameArabic}
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-[#8FA3C7]/68 truncate">
                  {audioError ? (
                    <span className="text-[#ECE9E1]/85">{audioError}</span>
                  ) : (
                    currentReciter?.name ?? 'Loading reciter...'
                  )}
                </p>
              </button>

              {audioError && (
                <button
                  type="button"
                  onClick={() => void retryCurrentSurah()}
                  aria-label="Retry audio playback"
                  className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[#8FA3C7] hover:text-[#ECE9E1] hover:bg-[#8FA3C7]/15 transition-colors cursor-pointer focus-ring"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Mobile tabular time readout aligned cleanly across from Now Playing */}
            <div className="md:hidden text-[11px] text-[#8FA3C7]/72 tabular-nums whitespace-nowrap shrink-0">
              <span className="text-[#ECE9E1]/90">{formatTime(displayCurrentTime)}</span>
              <span className="mx-1 text-[#8FA3C7]/35">/</span>
              <span>{formatTime(inferredDuration)}</span>
            </div>
          </div>

          {/* Row 2 (mobile, centered symmetric transport) / Center col (desktop) */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 md:gap-2">
            <button
              type="button"
              onClick={() => void prevSurah()}
              aria-label="Previous Surah"
              className="w-10 h-10 md:w-9 md:h-9 rounded-full flex items-center justify-center text-[#8FA3C7]/78 hover:text-[#ECE9E1] hover:bg-[#8FA3C7]/12 active:scale-95 transition-all cursor-pointer focus-ring"
            >
              <SkipBack className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={prevAyah}
              aria-label="Previous Ayah"
              className="w-10 h-10 md:w-9 md:h-9 rounded-full flex items-center justify-center text-[#8FA3C7]/78 hover:text-[#ECE9E1] hover:bg-[#8FA3C7]/12 active:scale-95 transition-all cursor-pointer focus-ring"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={requestTogglePlay}
              disabled={surahLoading || !surahData}
              aria-label={
                isBusy
                  ? 'Buffering audio'
                  : isPlaying
                    ? 'Pause recitation'
                    : 'Play recitation'
              }
              data-testid="play-pause-button"
              className="mx-1 w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center bg-[#8FA3C7] text-[#0A0F1E] hover:bg-[#A6B8D8] active:scale-[0.96] disabled:opacity-45 transition-all cursor-pointer focus-ring shadow-[0_8px_24px_-6px_rgba(143,163,199,0.45)] shrink-0"
            >
              {isBusy ? (
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 fill-current" aria-hidden="true" />
              ) : (
                <Play className="w-5 h-5 fill-current translate-x-[1px]" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={nextAyah}
              aria-label="Next Ayah"
              className="w-10 h-10 md:w-9 md:h-9 rounded-full flex items-center justify-center text-[#8FA3C7]/78 hover:text-[#ECE9E1] hover:bg-[#8FA3C7]/12 active:scale-95 transition-all cursor-pointer focus-ring"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => void nextSurah()}
              aria-label="Next Surah"
              className="w-10 h-10 md:w-9 md:h-9 rounded-full flex items-center justify-center text-[#8FA3C7]/78 hover:text-[#ECE9E1] hover:bg-[#8FA3C7]/12 active:scale-95 transition-all cursor-pointer focus-ring"
            >
              <SkipForward className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Right col (desktop): Tabular Time & Volume */}
          <div className="hidden md:flex items-center justify-end gap-4 min-w-0">
            <div className="text-xs text-[#8FA3C7]/75 tabular-nums whitespace-nowrap">
              <span className="text-[#ECE9E1]/90">{formatTime(displayCurrentTime)}</span>
              <span className="mx-1 text-[#8FA3C7]/40">/</span>
              <span>{formatTime(inferredDuration)}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted || volume === 0 ? 'Unmute audio' : 'Mute audio'}
                className="w-9 h-9 rounded-full flex items-center justify-center text-[#8FA3C7]/80 hover:text-[#ECE9E1] hover:bg-[#8FA3C7]/12 transition-colors cursor-pointer focus-ring"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Volume2 className="w-4 h-4" aria-hidden="true" />
                )}
              </button>

              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(Number.parseFloat(e.target.value))}
                aria-label="Volume"
                className="w-20 h-1 accent-[#8FA3C7] bg-[#8FA3C7]/20 rounded-full cursor-pointer focus-ring"
              />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
