import { Bookmark, Clock, Compass, Flame, Play, Trash2 } from 'lucide-react';
import { formatListeningDuration } from '../lib/journeyUtils';
import { useJourneyStore } from '../store/journeyStore';
import { usePlayerStore } from '../store/playerStore';

interface JourneyPanelContentProps {
  mode: 'bookmarks' | 'journey';
  onAfterNavigate?: () => void;
}

export function JourneyPanelContent({
  mode,
  onAfterNavigate,
}: JourneyPanelContentProps) {
  const bookmarks = useJourneyStore((s) => s.bookmarks);
  const recentSessions = useJourneyStore((s) => s.recentSessions);
  const totalListeningSeconds = useJourneyStore((s) => s.totalListeningSeconds);
  const visitedSurahIds = useJourneyStore((s) => s.visitedSurahIds);
  const streakDays = useJourneyStore((s) => s.streakDays);
  const deleteBookmark = useJourneyStore((s) => s.deleteBookmark);

  const jumpToVerse = usePlayerStore((s) => s.jumpToVerse);
  const currentChapterId = usePlayerStore((s) => s.currentChapterId);

  if (mode === 'bookmarks') {
    if (bookmarks.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-10">
          <Bookmark
            className="w-6 h-6 text-[#8FA3C7]/45 mb-3"
            aria-hidden="true"
          />
          <p className="font-editorial text-xl text-[#ECE9E1]/90">
            No reflections <span className="italic text-[#8FA3C7]">yet</span>
          </p>
          <p className="text-xs text-[#8FA3C7]/62 mt-1.5 leading-relaxed max-w-[220px]">
            Tap the bookmark icon beside any ayah (or press{' '}
            <kbd className="px-1 py-0.5 rounded bg-[#0F1629] border border-[#8FA3C7]/20 text-[10px] font-mono">
              B
            </kbd>
            ) to save a verse and personal note.
          </p>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto sanctuary-scroll -mx-2 px-2 space-y-2 pr-2 pb-4">
        {bookmarks.map((bm) => (
          <div
            key={bm.verseKey}
            className="group rounded-2xl bg-[#0F1629]/55 border border-[#8FA3C7]/[0.12] hover:border-[#8FA3C7]/32 transition-colors p-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  void jumpToVerse(bm.chapterId, bm.verseKey, true);
                  onAfterNavigate?.();
                }}
                className="flex items-center gap-2 min-w-0 text-left cursor-pointer focus-ring rounded"
              >
                <span className="text-[11px] tracking-[0.14em] text-[#8FA3C7] tabular-nums shrink-0">
                  {bm.verseKey}
                </span>
                <span className="text-xs font-medium text-[#ECE9E1] truncate group-hover:text-[#8FA3C7] transition-colors">
                  {bm.surahName}
                </span>
              </button>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    void jumpToVerse(bm.chapterId, bm.verseKey, true);
                    onAfterNavigate?.();
                  }}
                  aria-label={`Play from ${bm.surahName} ${bm.verseKey}`}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[#8FA3C7]/80 hover:text-[#0A0F1E] hover:bg-[#8FA3C7] transition-colors cursor-pointer focus-ring"
                >
                  <Play className="w-3 h-3 fill-current translate-x-[0.5px]" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteBookmark(bm.verseKey)}
                  aria-label={`Remove bookmark ${bm.verseKey}`}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[#8FA3C7]/55 hover:text-[#ECE9E1] hover:bg-[#8FA3C7]/14 transition-colors cursor-pointer focus-ring"
                >
                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>
            </div>

            <p
              dir="rtl"
              lang="ar"
              className="font-arabic text-right text-base text-[#ECE9E1]/88 mt-2 line-clamp-1 leading-[1.9]"
            >
              {bm.textUthmani}
            </p>
            <p className="font-editorial text-[15px] text-[#ECE9E1]/72 line-clamp-2 mt-1 leading-snug">
              {bm.translationText}
            </p>

            {bm.note && (
              <p className="mt-2.5 pt-2 border-t border-[#8FA3C7]/[0.1] text-xs text-[#8FA3C7]/90 leading-relaxed whitespace-pre-wrap">
                {bm.note}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Listening Journey view
  const completionPct = Math.round((visitedSurahIds.length / 114) * 100);

  return (
    <div className="flex-1 overflow-y-auto sanctuary-scroll -mx-2 px-2 pb-4 space-y-4">
      {/* Quiet 3-metric journey overview */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-[#0F1629]/60 border border-[#8FA3C7]/[0.12] px-2.5 py-3 text-center">
          <Clock className="w-3.5 h-3.5 text-[#8FA3C7]/80 mx-auto mb-1.5" aria-hidden="true" />
          <p className="text-sm font-medium text-[#ECE9E1] tabular-nums">
            {formatListeningDuration(totalListeningSeconds)}
          </p>
          <p className="text-[10px] text-[#8FA3C7]/60 mt-0.5">Listened</p>
        </div>

        <div className="rounded-xl bg-[#0F1629]/60 border border-[#8FA3C7]/[0.12] px-2.5 py-3 text-center">
          <Compass className="w-3.5 h-3.5 text-[#8FA3C7]/80 mx-auto mb-1.5" aria-hidden="true" />
          <p className="text-sm font-medium text-[#ECE9E1] tabular-nums">
            {visitedSurahIds.length}
            <span className="text-[#8FA3C7]/55">/114</span>
          </p>
          <p className="text-[10px] text-[#8FA3C7]/60 mt-0.5">Surahs</p>
        </div>

        <div className="rounded-xl bg-[#0F1629]/60 border border-[#8FA3C7]/[0.12] px-2.5 py-3 text-center">
          <Flame className="w-3.5 h-3.5 text-[#8FA3C7]/80 mx-auto mb-1.5" aria-hidden="true" />
          <p className="text-sm font-medium text-[#ECE9E1] tabular-nums">
            {streakDays}d
          </p>
          <p className="text-[10px] text-[#8FA3C7]/60 mt-0.5">Streak</p>
        </div>
      </div>

      {/* Subtle Qur'an journey progress hairline */}
      <div className="rounded-xl bg-[#0F1629]/45 border border-[#8FA3C7]/[0.1] px-3.5 py-3">
        <div className="flex items-center justify-between text-[11px] text-[#8FA3C7]/72 tabular-nums mb-2">
          <span>Surahs explored</span>
          <span>{completionPct}%</span>
        </div>
        <div className="h-[3px] w-full rounded-full bg-[#8FA3C7]/[0.14] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#8FA3C7] transition-[width] duration-500"
            style={{ width: `${Math.max(visitedSurahIds.length > 0 ? 3 : 0, completionPct)}%` }}
          />
        </div>
      </div>

      {/* Recent listening sessions */}
      <div>
        <h3 className="text-[11px] tracking-[0.16em] text-[#8FA3C7]/72 mb-2 px-1">
          Continue listening
        </h3>

        {recentSessions.length === 0 ? (
          <p className="text-xs text-[#8FA3C7]/58 px-1 leading-relaxed">
            Press play on any surah and your listening trail will appear here for one-tap resume.
          </p>
        ) : (
          <div className="space-y-1.5">
            {recentSessions.map((session) => {
              const isCurrent = session.chapterId === currentChapterId;
              return (
                <button
                  key={`${session.chapterId}-${session.verseKey}`}
                  type="button"
                  onClick={() => {
                    void jumpToVerse(
                      session.chapterId,
                      session.verseKey,
                      true,
                      session.reciterId,
                    );
                    onAfterNavigate?.();
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 border transition-all cursor-pointer focus-ring ${
                    isCurrent
                      ? 'bg-[#8FA3C7]/[0.13] border-[#8FA3C7]/28 text-[#ECE9E1]'
                      : 'bg-[#0F1629]/40 border-[#8FA3C7]/[0.08] text-[#ECE9E1]/82 hover:bg-[#8FA3C7]/[0.08] hover:border-[#8FA3C7]/22'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium truncate">
                        {session.surahName}
                      </span>
                      <span className="text-[11px] text-[#8FA3C7] tabular-nums shrink-0">
                        {session.verseKey}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8FA3C7]/60 truncate mt-0.5">
                      {session.reciterName}
                    </p>
                  </div>

                  <span
                    dir="rtl"
                    lang="ar"
                    className="font-arabic text-base text-[#8FA3C7]/85 shrink-0"
                  >
                    {session.surahArabic}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
