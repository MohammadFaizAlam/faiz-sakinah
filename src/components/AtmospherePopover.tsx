import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, SlidersHorizontal, X } from 'lucide-react';
import { shaderSignal } from '../lib/shaderSignal';
import { useJourneyStore } from '../store/journeyStore';
import type { AtmosphereMood } from '../types/quran';

const MOOD_OPTIONS: Array<{
  id: AtmosphereMood;
  label: string;
  caption: string;
  swatchClass: string;
}> = [
  {
    id: 'midnight-silk',
    label: 'Midnight Silk',
    caption: 'Liquid silver ribbons on deep navy',
    swatchClass:
      'bg-[radial-gradient(circle_at_30%_30%,rgba(199,213,236,0.55)_0%,rgba(143,163,199,0.22)_42%,rgba(10,15,30,0.96)_100%)]',
  },
  {
    id: 'lunar-mist',
    label: 'Lunar Mist',
    caption: 'Softer moonlit swells & gentle wash',
    swatchClass:
      'bg-[radial-gradient(circle_at_60%_35%,rgba(143,163,199,0.58)_0%,rgba(74,98,140,0.34)_52%,rgba(12,18,36,0.95)_100%)]',
  },
  {
    id: 'still-night',
    label: 'Still Night',
    caption: 'Minimal sanctuary with quiet vocal halo',
    swatchClass:
      'bg-[radial-gradient(circle_at_50%_50%,rgba(143,163,199,0.26)_0%,rgba(10,15,30,0.98)_72%)]',
  },
];

function LiveVoiceMeter() {
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    let rafId = 0;
    const smooth = [0.14, 0.14, 0.14, 0.14, 0.14];

    const tick = () => {
      const sensitivity = shaderSignal.reactivityTarget;
      for (let i = 0; i < 5; i += 1) {
        const raw = Math.min(1, shaderSignal.meterBands[i] * sensitivity);
        const target = Math.max(0.16, raw);
        smooth[i] += (target - smooth[i]) * 0.22;
        const el = barRefs.current[i];
        if (el) {
          el.style.transform = `scaleY(${smooth[i].toFixed(3)})`;
          el.style.opacity = `${(0.35 + smooth[i] * 0.65).toFixed(2)}`;
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div aria-hidden="true" className="flex items-end gap-1 h-4 px-1">
      {[0, 1, 2, 3, 4].map((idx) => (
        <span
          key={idx}
          ref={(el) => {
            barRefs.current[idx] = el;
          }}
          className="w-[2.5px] h-full rounded-full bg-[#8FA3C7] origin-bottom"
          style={{ transform: 'scaleY(0.16)', opacity: 0.4 }}
        />
      ))}
    </div>
  );
}

export function AtmospherePopover() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const atmosphereMood = useJourneyStore((s) => s.atmosphereMood);
  const voiceReactivity = useJourneyStore((s) => s.voiceReactivity);
  const wordHighlightEnabled = useJourneyStore((s) => s.wordHighlightEnabled);
  const setAtmosphereMood = useJourneyStore((s) => s.setAtmosphereMood);
  const setVoiceReactivity = useJourneyStore((s) => s.setVoiceReactivity);
  const setWordHighlightEnabled = useJourneyStore((s) => s.setWordHighlightEnabled);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const reactivityLabel =
    voiceReactivity <= 0.05
      ? 'Still'
      : voiceReactivity < 0.75
        ? 'Subtle'
        : voiceReactivity <= 1.15
          ? 'Balanced'
          : 'Expressive';

  const reactivityPercent = Math.round((voiceReactivity / 1.5) * 100);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Atmosphere and visualizer tuning"
        className={`h-8 w-8 sm:w-auto sm:h-10 sm:px-3.5 rounded-full text-xs sm:text-sm transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-ring border ${
          open
            ? 'bg-[#151D33] border-[#8FA3C7]/48 text-[#ECE9E1] shadow-[0_0_20px_-6px_rgba(143,163,199,0.45)]'
            : 'bg-[#0F1629]/80 border-[#8FA3C7]/16 text-[#ECE9E1]/88 hover:border-[#8FA3C7]/35 hover:text-[#ECE9E1]'
        }`}
      >
        <SlidersHorizontal className="w-3.5 h-3.5 text-[#8FA3C7]" aria-hidden="true" />
        <span className="hidden sm:inline">Atmosphere</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Mobile backdrop scrim so the viewport-centered panel feels grounded */}
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0.01 : 0.18 }}
              onClick={() => setOpen(false)}
              className="sm:hidden fixed inset-0 z-40 bg-[#050812]/65"
            />

            <motion.div
              role="dialog"
              aria-label="Atmosphere visualizer tuning"
              data-testid="atmosphere-popover"
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
              className="glass-surface-elevated fixed inset-x-3 top-[4.15rem] z-50 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2.5 sm:w-[344px] rounded-2xl p-4 sm:p-5 border border-[#8FA3C7]/24 shadow-[0_28px_72px_-16px_rgba(0,0,0,0.88)] max-h-[calc(100dvh-5.5rem)] overflow-y-auto sanctuary-scroll"
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-3 mb-3.5">
                <div>
                  <p className="font-editorial text-xl text-[#ECE9E1] leading-none tracking-[-0.01em]">
                    Sanctuary <span className="italic text-[#8FA3C7]">Atmosphere</span>
                  </p>
                  <p className="text-[11px] text-[#8FA3C7]/62 mt-1">
                    Tune shader mood and live vocal response
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <LiveVoiceMeter />
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close atmosphere menu"
                    className="sm:hidden w-7 h-7 rounded-full flex items-center justify-center text-[#8FA3C7]/75 hover:text-[#ECE9E1] hover:bg-[#8FA3C7]/14 transition-colors cursor-pointer focus-ring"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Shader Mood Cards with miniature visual swatches */}
              <div className="space-y-2">
                {MOOD_OPTIONS.map((option) => {
                  const selected = atmosphereMood === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setAtmosphereMood(option.id)}
                      aria-pressed={selected}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center gap-3 cursor-pointer focus-ring ${
                        selected
                          ? 'bg-[#8FA3C7]/[0.15] border-[#8FA3C7]/42 text-[#ECE9E1]'
                          : 'bg-[#0A0F1E]/52 border-[#8FA3C7]/[0.1] text-[#ECE9E1]/80 hover:bg-[#0F1629]/80 hover:border-[#8FA3C7]/26 hover:text-[#ECE9E1]'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`w-9 h-9 rounded-lg shrink-0 border border-[#8FA3C7]/25 ${option.swatchClass}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium leading-tight">
                          {option.label}
                        </p>
                        <p className="text-[11px] text-[#8FA3C7]/68 mt-0.5 truncate">
                          {option.caption}
                        </p>
                      </div>
                      <span
                        aria-hidden="true"
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-opacity ${
                          selected
                            ? 'bg-[#8FA3C7] text-[#0A0F1E] opacity-100'
                            : 'opacity-0'
                        }`}
                      >
                        <Check className="w-3 h-3 stroke-[2.5]" />
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Voice Reactivity Tuning */}
              <div className="mt-4 pt-3.5 border-t border-[#8FA3C7]/[0.12]">
                <div className="flex items-center justify-between text-xs mb-2.5">
                  <label htmlFor="voice-reactivity-range" className="text-[#ECE9E1]/90 font-medium">
                    Voice reactivity
                  </label>
                  <span className="text-[11px] text-[#8FA3C7] tabular-nums">
                    {reactivityLabel}
                  </span>
                </div>
                <div className="relative flex items-center h-5">
                  <div className="w-full h-1.5 rounded-full bg-[#8FA3C7]/[0.16] overflow-hidden pointer-events-none">
                    <div
                      className="h-full rounded-full bg-[#8FA3C7]"
                      style={{ width: `${reactivityPercent}%` }}
                    />
                  </div>
                  <input
                    id="voice-reactivity-range"
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.05}
                    value={voiceReactivity}
                    onChange={(e) => setVoiceReactivity(Number.parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute w-3.5 h-3.5 rounded-full bg-[#ECE9E1] ring-2 ring-[#0A0F1E]/80 shadow-[0_0_10px_rgba(143,163,199,0.5)] -translate-x-1/2"
                    style={{ left: `${reactivityPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[#8FA3C7]/48 mt-1">
                  <span>Still</span>
                  <span>Balanced</span>
                  <span>Expressive</span>
                </div>
              </div>

              {/* Word-by-Word Highlighting Toggle */}
              <div className="mt-3.5 pt-3.5 border-t border-[#8FA3C7]/[0.12] flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[#ECE9E1]/90">Word-by-word glow</p>
                  <p className="text-[11px] text-[#8FA3C7]/62">
                    Illuminate each Arabic word as recited
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={wordHighlightEnabled}
                  aria-label="Toggle word-by-word highlighting"
                  onClick={() => setWordHighlightEnabled(!wordHighlightEnabled)}
                  className={`relative w-10 h-6 rounded-full transition-colors shrink-0 cursor-pointer focus-ring border ${
                    wordHighlightEnabled
                      ? 'bg-[#8FA3C7]/35 border-[#8FA3C7]/60'
                      : 'bg-[#0A0F1E]/80 border-[#8FA3C7]/22'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-[#ECE9E1] transition-transform duration-200 ${
                      wordHighlightEnabled ? 'translate-x-[19px]' : 'translate-x-[3px]'
                    }`}
                  />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
