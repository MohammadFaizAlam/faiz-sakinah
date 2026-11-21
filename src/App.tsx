import { useEffect } from 'react';
import { AudioEngine } from './components/AudioEngine';
import { AyahTheater } from './components/AyahTheater';
import { DesktopSidebar } from './components/DesktopSidebar';
import { JourneyDrawer } from './components/JourneyDrawer';
import { PlayerDock } from './components/PlayerDock';
import { ReflectionModal } from './components/ReflectionModal';
import { SilkWebGLBackground } from './components/SilkWebGLBackground';
import { SurahDrawer } from './components/SurahDrawer';
import { TopBar } from './components/TopBar';
import { usePlayerStore } from './store/playerStore';

export default function App() {
  const initialize = usePlayerStore((s) => s.initialize);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentChapterId = usePlayerStore((s) => s.currentChapterId);
  const activeAyahIndex = usePlayerStore((s) => s.activeAyahIndex);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <div
      id="top"
      data-playing={isPlaying ? 'true' : 'false'}
      data-chapter-id={currentChapterId}
      data-active-ayah={activeAyahIndex + 1}
      className="relative isolate h-dvh w-full overflow-hidden flex flex-col text-[#ECE9E1]"
    >
      {/* Persistent full-viewport voice-reactive WebGL silk canvas (mounted once) */}
      <SilkWebGLBackground />

      {/* Headless high-precision audio, word sync & Web Audio analyzer engine */}
      <AudioEngine />

      {/* Minimal luxury top bar */}
      <TopBar />

      {/* Full-height split workspace: Left panel extends 100% to bottom; Right column centers both Ayah theater and Player dock */}
      <div className="relative z-10 flex-1 min-h-0 flex overflow-hidden">
        <DesktopSidebar />

        <main className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
          <AyahTheater />
          <PlayerDock />
        </main>
      </div>

      {/* Animated 114-surah selector modal / mobile bottom sheet */}
      <SurahDrawer />

      {/* Personal reflection & bookmark editor modal */}
      <ReflectionModal />

      {/* Mobile/tablet reflections & listening journey sheet */}
      <JourneyDrawer />
    </div>
  );
}
