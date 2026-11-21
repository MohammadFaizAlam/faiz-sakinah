import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Play, Volume2, X } from 'lucide-react';
import { useJourneyStore } from '../store/journeyStore';
import { usePlayerStore } from '../store/playerStore';

export function WordInspectorPopover() {
  const inspectedWord = useJourneyStore((s) => s.inspectedWord);
  const setInspectedWord = useJourneyStore((s) => s.setInspectedWord);
  const seekToWord = usePlayerStore((s) => s.seekToWord);
  const prefersReducedMotion = useReducedMotion();

  const wordAudioRef = useRef<HTMLAudioElement | null>(null);
  const [pronouncing, setPronouncing] = useState(false);

  // Stop any word pronunciation audio if inspected word changes or closes
  useEffect(() => {
    setPronouncing(false);
    if (wordAudioRef.current) {
      wordAudioRef.current.pause();
      wordAudioRef.current = null;
    }
  }, [inspectedWord?.verseKey, inspectedWord?.word.position]);

  // Dismiss cleanly on Escape
  useEffect(() => {
    if (!inspectedWord) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInspectedWord(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inspectedWord, setInspectedWord]);

  const handlePronounce = () => {
    if (!inspectedWord?.word.audioUrl) return;
    if (wordAudioRef.current) {
      wordAudioRef.current.pause();
      wordAudioRef.current = null;
    }

    const clip = new Audio(inspectedWord.word.audioUrl);
    wordAudioRef.current = clip;
    setPronouncing(true);

    clip.addEventListener('ended', () => setPronouncing(false), { once: true });
    clip.addEventListener('error', () => setPronouncing(false), { once: true });
    void clip.play().catch(() => setPronouncing(false));
  };

  const handleSeekToWord = () => {
    if (!inspectedWord) return;
    seekToWord(inspectedWord.ayahIndex, inspectedWord.word.position, true);
    setInspectedWord(null);
  };

  return (
    <AnimatePresence>
      {inspectedWord && (
        <motion.div
          role="dialog"
          aria-label={`Word insight: ${inspectedWord.word.translation || inspectedWord.word.textUthmani}`}
          data-testid="word-inspector-popover"
          initial={{ opacity: 0, y: 14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ duration: prefersReducedMotion ? 0.01 : 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-none absolute inset-x-4 sm:inset-x-8 bottom-4 z-30 flex justify-center"
        >
          <div className="pointer-events-auto glass-surface-elevated w-full max-w-md rounded-2xl px-5 py-4 border border-[#8FA3C7]/28 shadow-[0_24px_56px_-18px_rgba(0,0,0,0.8)]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] tracking-[0.16em] text-[#8FA3C7]/72 tabular-nums">
                  {inspectedWord.surahName} · {inspectedWord.verseKey} · Word{' '}
                  {inspectedWord.word.position}
                </p>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
                  <span
                    dir="rtl"
                    lang="ar"
                    className="font-arabic text-3xl sm:text-[2.1rem] text-[#ECE9E1] leading-[1.6]"
                  >
                    {inspectedWord.word.textUthmani}
                  </span>
                  {inspectedWord.word.transliteration && (
                    <span className="font-editorial italic text-lg sm:text-xl text-[#8FA3C7]">
                      {inspectedWord.word.transliteration}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm sm:text-[15px] text-[#ECE9E1]/90 leading-snug">
                  {inspectedWord.word.translation || 'Word-by-word gloss'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setInspectedWord(null)}
                aria-label="Close word insight"
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#8FA3C7]/75 hover:text-[#ECE9E1] hover:bg-[#8FA3C7]/14 transition-colors shrink-0 cursor-pointer focus-ring"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-3.5 pt-3 border-t border-[#8FA3C7]/[0.12] flex items-center justify-between gap-2.5">
              {inspectedWord.word.audioUrl ? (
                <button
                  type="button"
                  onClick={handlePronounce}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer focus-ring ${
                    pronouncing
                      ? 'bg-[#8FA3C7]/24 text-[#ECE9E1] border border-[#8FA3C7]/45'
                      : 'bg-[#0F1629]/85 text-[#ECE9E1]/88 border border-[#8FA3C7]/18 hover:border-[#8FA3C7]/40 hover:text-[#ECE9E1]'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5 text-[#8FA3C7]" aria-hidden="true" />
                  <span>{pronouncing ? 'Pronouncing…' : 'Pronounce word'}</span>
                </button>
              ) : (
                <span className="text-[11px] text-[#8FA3C7]/55">Tap another word to inspect</span>
              )}

              <button
                type="button"
                onClick={handleSeekToWord}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium bg-[#8FA3C7] text-[#0A0F1E] hover:bg-[#A6B8D8] transition-colors cursor-pointer focus-ring"
              >
                <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                <span>Recite from here</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
