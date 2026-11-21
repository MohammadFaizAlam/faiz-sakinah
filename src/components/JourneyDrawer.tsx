import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { useJourneyStore } from '../store/journeyStore';
import { JourneyPanelContent } from './JourneyPanelContent';

export function JourneyDrawer() {
  const open = useJourneyStore((s) => s.journeyDrawerOpen);
  const setOpen = useJourneyStore((s) => s.setJourneyDrawerOpen);
  const bookmarksCount = useJourneyStore((s) => s.bookmarks.length);
  const prefersReducedMotion = useReducedMotion();
  const [tab, setTab] = useState<'bookmarks' | 'journey'>('bookmarks');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <div
          id="journey-drawer-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Reflections and listening journey"
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-6 lg:hidden"
        >
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.2 }}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[#050812]/80"
          />

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full md:max-w-lg h-[78dvh] glass-surface-elevated rounded-t-3xl md:rounded-3xl p-5 flex flex-col border border-[#8FA3C7]/22 overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
              <h2 className="font-editorial text-2xl text-[#ECE9E1] tracking-[-0.015em]">
                Reflections & <span className="italic text-[#8FA3C7]">Journey</span>
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close reflections panel"
                className="w-9 h-9 rounded-full flex items-center justify-center text-[#8FA3C7]/75 hover:text-[#ECE9E1] hover:bg-[#8FA3C7]/14 transition-colors cursor-pointer focus-ring"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#0A0F1E]/75 border border-[#8FA3C7]/[0.12] mb-4 shrink-0">
              <button
                type="button"
                onClick={() => setTab('bookmarks')}
                className={`py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer focus-ring ${
                  tab === 'bookmarks'
                    ? 'bg-[#8FA3C7]/18 text-[#ECE9E1]'
                    : 'text-[#8FA3C7]/70 hover:text-[#ECE9E1]'
                }`}
              >
                Bookmarks{bookmarksCount > 0 ? ` (${bookmarksCount})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setTab('journey')}
                className={`py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer focus-ring ${
                  tab === 'journey'
                    ? 'bg-[#8FA3C7]/18 text-[#ECE9E1]'
                    : 'text-[#8FA3C7]/70 hover:text-[#ECE9E1]'
                }`}
              >
                Journey
              </button>
            </div>

            <JourneyPanelContent
              mode={tab}
              onAfterNavigate={() => setOpen(false)}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
