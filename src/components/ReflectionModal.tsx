import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Bookmark, Trash2, X } from 'lucide-react';
import { useJourneyStore } from '../store/journeyStore';

export function ReflectionModal() {
  const reflectionTarget = useJourneyStore((s) => s.reflectionTarget);
  const setReflectionTarget = useJourneyStore((s) => s.setReflectionTarget);
  const bookmarks = useJourneyStore((s) => s.bookmarks);
  const saveBookmark = useJourneyStore((s) => s.saveBookmark);
  const deleteBookmark = useJourneyStore((s) => s.deleteBookmark);
  const prefersReducedMotion = useReducedMotion();

  const existing = reflectionTarget
    ? bookmarks.find((b) => b.verseKey === reflectionTarget.ayah.verseKey) ?? null
    : null;

  const [note, setNote] = useState('');

  useEffect(() => {
    if (reflectionTarget) {
      setNote(existing?.note ?? '');
    }
  }, [reflectionTarget?.ayah.verseKey, existing?.note]);

  useEffect(() => {
    if (!reflectionTarget) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setReflectionTarget(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [reflectionTarget, setReflectionTarget]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reflectionTarget) return;
    saveBookmark({
      verseKey: reflectionTarget.ayah.verseKey,
      chapterId: reflectionTarget.chapter.id,
      verseNumber: reflectionTarget.ayah.verseNumber,
      surahName: reflectionTarget.chapter.nameSimple,
      surahArabic: reflectionTarget.chapter.nameArabic,
      textUthmani: reflectionTarget.ayah.textUthmani,
      translationText: reflectionTarget.ayah.translationText,
      note,
    });
    setReflectionTarget(null);
  };

  const handleRemove = () => {
    if (!reflectionTarget) return;
    deleteBookmark(reflectionTarget.ayah.verseKey);
    setReflectionTarget(null);
  };

  return (
    <AnimatePresence>
      {reflectionTarget && (
        <div
          id="reflection-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reflection-modal-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6"
        >
          {/* Backdrop */}
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.2 }}
            onClick={() => setReflectionTarget(null)}
            className="absolute inset-0 bg-[#050812]/78"
          />

          {/* Modal Sheet */}
          <motion.form
            onSubmit={handleSave}
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full sm:max-w-lg glass-surface-elevated rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 border border-[#8FA3C7]/24 shadow-[0_28px_72px_-16px_rgba(0,0,0,0.85)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] tracking-[0.18em] text-[#8FA3C7]/72 tabular-nums">
                  {reflectionTarget.chapter.nameSimple} · {reflectionTarget.ayah.verseKey}
                </p>
                <h2
                  id="reflection-modal-title"
                  className="font-editorial text-2xl sm:text-3xl text-[#ECE9E1] tracking-[-0.015em] mt-1"
                >
                  Personal <span className="italic text-[#8FA3C7]">reflection</span>
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setReflectionTarget(null)}
                aria-label="Close reflection editor"
                className="w-9 h-9 rounded-full flex items-center justify-center text-[#8FA3C7]/75 hover:text-[#ECE9E1] hover:bg-[#8FA3C7]/14 transition-colors cursor-pointer focus-ring"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Verse excerpt */}
            <div className="mt-4 rounded-2xl bg-[#0A0F1E]/65 border border-[#8FA3C7]/[0.12] px-4 py-3.5 max-h-40 overflow-y-auto sanctuary-scroll">
              <p
                dir="rtl"
                lang="ar"
                className="font-arabic text-right text-lg sm:text-xl text-[#ECE9E1]/92 leading-[2]"
              >
                {reflectionTarget.ayah.textUthmani}
              </p>
              <p className="font-editorial text-base text-[#8FA3C7]/90 mt-2 leading-snug">
                {reflectionTarget.ayah.translationText}
              </p>
            </div>

            {/* Reflection textarea */}
            <div className="mt-4">
              <label
                htmlFor="reflection-note-input"
                className="block text-xs tracking-[0.14em] text-[#8FA3C7]/75 mb-2"
              >
                Private note (optional)
              </label>
              <textarea
                id="reflection-note-input"
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Write a quiet thought, reminder, or du'a inspired by this ayah…"
                className="w-full rounded-2xl bg-[#0A0F1E]/75 border border-[#8FA3C7]/18 focus:border-[#8FA3C7]/50 px-4 py-3 text-sm text-[#ECE9E1] placeholder:text-[#8FA3C7]/45 resize-none focus:outline-none transition-colors"
              />
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              {existing ? (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs text-[#8FA3C7]/80 hover:text-[#ECE9E1] hover:bg-[#8FA3C7]/12 transition-colors cursor-pointer focus-ring"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Remove bookmark</span>
                </button>
              ) : (
                <span className="text-[11px] text-[#8FA3C7]/55">
                  Saved privately on this device
                </span>
              )}

              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-medium bg-[#8FA3C7] text-[#0A0F1E] hover:bg-[#A6B8D8] transition-colors cursor-pointer focus-ring"
              >
                <Bookmark className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                <span>{existing ? 'Update reflection' : 'Save bookmark'}</span>
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}
