import { useEffect, useRef } from 'react';
import { registerAudioBridge } from '../lib/audioBridge';
import {
  findActiveAyahIndex,
  findActiveWordPosition,
  findTimestampForVerse,
} from '../lib/quranUtils';
import { shaderSignal } from '../lib/shaderSignal';
import { useJourneyStore } from '../store/journeyStore';
import { usePlayerStore } from '../store/playerStore';

interface AudioAnalyserHandle {
  ctx: AudioContext;
  analyser: AnalyserNode;
  bins: Uint8Array<ArrayBuffer>;
}

export function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AudioAnalyserHandle | null>(null);
  const analyserFailedRef = useRef<boolean>(false);
  const rafRef = useRef<number>(0);
  const lastUiTimePushRef = useRef<number>(0);
  const lastJourneyTickRef = useRef<number>(0);
  const accumulatedListenSecRef = useRef<number>(0);
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const surahData = usePlayerStore((s) => s.surahData);
  const playbackNonce = usePlayerStore((s) => s.playbackNonce);
  const shouldAutoPlay = usePlayerStore((s) => s.shouldAutoPlay);
  const seekRequest = usePlayerStore((s) => s.seekRequest);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const chapters = usePlayerStore((s) => s.chapters);
  const reciters = usePlayerStore((s) => s.reciters);
  const currentChapterId = usePlayerStore((s) => s.currentChapterId);
  const currentReciterId = usePlayerStore((s) => s.currentReciterId);

  // Lazily attach Web Audio AnalyserNode on user play gesture for real-time vocal reactivity
  const ensureAudioAnalyser = () => {
    if (analyserRef.current) {
      if (analyserRef.current.ctx.state === 'suspended') {
        void analyserRef.current.ctx.resume().catch(() => {});
      }
      return analyserRef.current;
    }
    if (analyserFailedRef.current) return null;

    const audio = audioRef.current;
    if (!audio || typeof window === 'undefined') return null;

    const AudioCtxCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxCtor) {
      analyserFailedRef.current = true;
      return null;
    }

    try {
      const ctx = new AudioCtxCtor();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyser.connect(ctx.destination);

      const bins = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      analyserRef.current = { ctx, analyser, bins };
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      return analyserRef.current;
    } catch {
      analyserFailedRef.current = true;
      return null;
    }
  };

  // Flush accumulated listening seconds to personal Listening Journey store
  const flushListeningJourney = () => {
    const delta = accumulatedListenSecRef.current;
    if (delta < 1) return;
    accumulatedListenSecRef.current = 0;

    const st = usePlayerStore.getState();
    const chapter = st.chapters.find((c) => c.id === st.currentChapterId);
    const reciter = st.reciters.find((r) => r.id === st.currentReciterId);
    if (!chapter) return;

    const verseKey =
      st.surahData?.ayahs[st.activeAyahIndex]?.verseKey ?? `${chapter.id}:1`;

    useJourneyStore.getState().recordListeningProgress({
      deltaSeconds: Math.round(delta),
      chapter,
      verseKey,
      ayahIndex: st.activeAyahIndex,
      reciterId: reciter?.id ?? st.currentReciterId ?? 7,
      reciterName: reciter?.name ?? 'Reciter',
    });
  };

  // Register direct imperative bridge for <16ms seeking & transport control
  useEffect(() => {
    const seekImmediate = (seconds: number, playAfter?: boolean) => {
      const audio = audioRef.current;
      if (!audio) return;

      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const target =
        duration > 0
          ? Math.max(0, Math.min(duration - 0.05, seconds))
          : Math.max(0, seconds);

      try {
        audio.currentTime = target;
      } catch {
        // Ignore if media hasn't reached HAVE_METADATA yet
      }

      if (duration > 0) {
        shaderSignal.progressTarget = Math.max(0, Math.min(1, target / duration));
      }

      if (playAfter === true && audio.paused) {
        ensureAudioAnalyser();
        const p = audio.play();
        if (p && typeof p.catch === 'function') {
          p.catch((err: unknown) => {
            const domErr = err as { name?: string };
            if (domErr?.name === 'NotAllowedError') {
              usePlayerStore.getState().setShouldAutoPlay(false);
              usePlayerStore.getState().setIsPlaying(false);
              usePlayerStore.getState().setAudioStatus('paused', null);
            }
          });
        }
      }
    };

    const togglePlayImmediate = () => {
      const audio = audioRef.current;
      if (!audio || !audio.src) return;
      if (audio.paused) {
        ensureAudioAnalyser();
        const p = audio.play();
        if (p && typeof p.catch === 'function') {
          p.catch((err: unknown) => {
            const domErr = err as { name?: string };
            if (domErr?.name === 'NotAllowedError') {
              usePlayerStore.getState().setShouldAutoPlay(false);
              usePlayerStore.getState().setIsPlaying(false);
              usePlayerStore.getState().setAudioStatus('paused', null);
            } else if (domErr?.name !== 'AbortError') {
              usePlayerStore
                .getState()
                .setAudioStatus('error', 'Unable to stream audio. Tap play to retry.');
              usePlayerStore.getState().setIsPlaying(false);
            }
          });
        }
      } else {
        audio.pause();
      }
    };

    registerAudioBridge({
      seekImmediate,
      togglePlayImmediate,
      getCurrentTime: () => audioRef.current?.currentTime ?? 0,
    });

    return () => registerAudioBridge(null);
  }, []);

  // Sync volume & mute to HTMLAudioElement
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = isMuted;
  }, [volume, isMuted]);

  // Background idle prefetch for adjacent surahs (+1, +2, -1) so skipping ahead is 0ms instant!
  useEffect(() => {
    if (!surahData || !currentReciterId) return;

    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
    }

    prefetchTimerRef.current = setTimeout(() => {
      const st = usePlayerStore.getState();
      const next1 = surahData.chapterId >= 114 ? 1 : surahData.chapterId + 1;
      const next2 = next1 >= 114 ? 1 : next1 + 1;
      const prev1 = surahData.chapterId <= 1 ? 114 : surahData.chapterId - 1;
      st.prefetchSurah(next1, currentReciterId);
      st.prefetchSurah(prev1, currentReciterId);
      st.prefetchSurah(next2, currentReciterId);
    }, 280);

    return () => {
      if (prefetchTimerRef.current) {
        clearTimeout(prefetchTimerRef.current);
        prefetchTimerRef.current = null;
      }
    };
  }, [surahData?.chapterId, currentReciterId]);

  // Load new audio URL when surahData or playbackNonce updates
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!surahData?.audioUrl) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      return;
    }

    const state = usePlayerStore.getState();
    const targetVerseKey = state.pendingSeekVerseKey;
    const desiredAutoPlay = state.shouldAutoPlay;
    const timings = surahData.timings;

    let cancelled = false;
    const isSameUrl = audio.src === surahData.audioUrl;

    if (!isSameUrl) {
      audio.pause();
      audio.src = surahData.audioUrl;
      audio.load();
    }

    const applyInitialSeekAndPlay = () => {
      if (cancelled) return;
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      if (duration > 0) {
        usePlayerStore.getState().setDuration(duration);
      }

      if (targetVerseKey) {
        const mappedSec = findTimestampForVerse(
          timings,
          targetVerseKey,
          usePlayerStore.getState().activeAyahIndex,
        );
        if (mappedSec > 0 && (duration === 0 || mappedSec < duration)) {
          try {
            audio.currentTime = mappedSec;
          } catch {
            // ignore seek failure prior to buffer readiness
          }
        }
        usePlayerStore.getState().clearPendingSeekVerseKey();
      } else if (!isSameUrl) {
        try {
          audio.currentTime = 0;
        } catch {
          // ignore
        }
      }

      if (desiredAutoPlay) {
        ensureAudioAnalyser();
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch((err: unknown) => {
            if (cancelled) return;
            const domErr = err as { name?: string };
            if (domErr?.name === 'NotAllowedError') {
              usePlayerStore.getState().setShouldAutoPlay(false);
              usePlayerStore.getState().setIsPlaying(false);
              usePlayerStore.getState().setAudioStatus('paused', null);
            } else if (domErr?.name !== 'AbortError') {
              usePlayerStore
                .getState()
                .setAudioStatus('error', 'Playback could not start. Tap play to retry.');
              usePlayerStore.getState().setIsPlaying(false);
            }
          });
        }
      } else {
        usePlayerStore.getState().setAudioStatus('ready', null);
      }
    };

    if (audio.readyState >= 1) {
      applyInitialSeekAndPlay();
    } else {
      audio.addEventListener('loadedmetadata', applyInitialSeekAndPlay, { once: true });
    }

    return () => {
      cancelled = true;
      audio.removeEventListener('loadedmetadata', applyInitialSeekAndPlay);
    };
  }, [surahData?.audioUrl, playbackNonce]);

  // Fallback sync for declarative play/pause state changes (e.g. MediaSession)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !surahData?.audioUrl) return;

    if (shouldAutoPlay && audio.paused && audio.readyState >= 1) {
      ensureAudioAnalyser();
      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch((err: unknown) => {
          const domErr = err as { name?: string };
          if (domErr?.name === 'NotAllowedError') {
            usePlayerStore.getState().setShouldAutoPlay(false);
            usePlayerStore.getState().setIsPlaying(false);
            usePlayerStore.getState().setAudioStatus('paused', null);
          } else if (domErr?.name !== 'AbortError') {
            usePlayerStore
              .getState()
              .setAudioStatus('error', 'Unable to stream audio. Check connection and retry.');
            usePlayerStore.getState().setIsPlaying(false);
          }
        });
      }
    } else if (!shouldAutoPlay && !audio.paused) {
      audio.pause();
    }
  }, [shouldAutoPlay, surahData?.audioUrl]);

  // Fallback seek listener if bridge wasn't ready yet
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !seekRequest) return;

    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const target =
      duration > 0
        ? Math.max(0, Math.min(duration - 0.05, seekRequest.timeSeconds))
        : Math.max(0, seekRequest.timeSeconds);

    try {
      audio.currentTime = target;
    } catch {
      // ignore
    }

    if (seekRequest.playAfter && audio.paused) {
      ensureAudioAnalyser();
      audio.play().catch(() => {
        // handled by audio listeners
      });
    }
  }, [seekRequest]);

  // High-precision requestAnimationFrame ayah + word sync + live Web Audio FFT vocal extraction
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const resetVocalSignals = () => {
      shaderSignal.voiceLevelTarget = 0;
      shaderSignal.voiceWarmthTarget = 0;
      shaderSignal.voiceCrestTarget = 0;
      shaderSignal.meterBands[0] = 0;
      shaderSignal.meterBands[1] = 0;
      shaderSignal.meterBands[2] = 0;
      shaderSignal.meterBands[3] = 0;
      shaderSignal.meterBands[4] = 0;
    };

    const sampleVocalEnergy = (activeWordPos: number | null) => {
      const handle = analyserRef.current;
      if (handle && handle.ctx.state === 'running') {
        handle.analyser.getByteFrequencyData(handle.bins);
        const bins = handle.bins;

        // Average vocal frequency ranges cleanly (at 44.1kHz / 256 FFT, each bin ≈ 172Hz)
        let warmthSum = 0;
        for (let i = 1; i <= 4; i += 1) warmthSum += bins[i];
        const warmth = Math.min(1, warmthSum / (4 * 200));

        let coreSum = 0;
        for (let i = 2; i <= 14; i += 1) coreSum += bins[i];
        const core = Math.min(1, coreSum / (13 * 165));

        let crestSum = 0;
        for (let i = 12; i <= 32; i += 1) crestSum += bins[i];
        const crest = Math.min(1, crestSum / (21 * 120));

        // If the browser has a live audio output, use exact FFT; if silent/muted output yields 0 while word is actively spoken, gently breathe
        if (core > 0.015 || warmth > 0.015) {
          shaderSignal.voiceWarmthTarget = warmth;
          shaderSignal.voiceLevelTarget = core;
          shaderSignal.voiceCrestTarget = crest;
          shaderSignal.meterBands[0] = Math.min(1, bins[1] / 210);
          shaderSignal.meterBands[1] = Math.min(1, (bins[3] + bins[4]) / 380);
          shaderSignal.meterBands[2] = Math.min(1, (bins[6] + bins[8]) / 340);
          shaderSignal.meterBands[3] = Math.min(1, (bins[11] + bins[14]) / 300);
          shaderSignal.meterBands[4] = Math.min(1, (bins[18] + bins[24]) / 260);
          return;
        }
      }

      // Gentle cadence fallback when muted or audio context isn't running
      if (!audio.paused && activeWordPos !== null) {
        const t = performance.now() * 0.004;
        const gentle = 0.24 + 0.14 * Math.sin(t * 2.1);
        shaderSignal.voiceWarmthTarget = gentle * 0.9;
        shaderSignal.voiceLevelTarget = gentle;
        shaderSignal.voiceCrestTarget = gentle * 0.65;
        shaderSignal.meterBands[0] = gentle * 0.7;
        shaderSignal.meterBands[1] = gentle * 1.1;
        shaderSignal.meterBands[2] = gentle * 1.2;
        shaderSignal.meterBands[3] = gentle * 0.9;
        shaderSignal.meterBands[4] = gentle * 0.6;
      } else {
        resetVocalSignals();
      }
    };

    const syncFromAudio = (forceTimePush = false) => {
      const state = usePlayerStore.getState();
      const timings = state.surahData?.timings;
      const nowSec = audio.currentTime || 0;
      const dur = Number.isFinite(audio.duration) ? audio.duration : state.duration;

      if (dur > 0) {
        shaderSignal.progressTarget = Math.max(0, Math.min(1, nowSec / dur));
      }

      let activeIdx = state.activeAyahIndex;
      let activeWordPos: number | null = null;

      if (timings && timings.length > 0) {
        activeIdx = findActiveAyahIndex(timings, nowSec * 1000);
        if (activeIdx !== state.activeAyahIndex) {
          state.setActiveAyahIndex(activeIdx, true);
        }

        const activeTiming = timings[activeIdx];
        if (!audio.paused || nowSec > 0) {
          activeWordPos = findActiveWordPosition(activeTiming?.segments, nowSec * 1000);
        }
        state.setActiveWordPosition(activeWordPos);
      }

      const nowMs = performance.now();

      if (!audio.paused && !audio.ended) {
        sampleVocalEnergy(activeWordPos);

        if (lastJourneyTickRef.current > 0) {
          const dtSec = Math.min(1.5, Math.max(0, (nowMs - lastJourneyTickRef.current) / 1000));
          accumulatedListenSecRef.current += dtSec;
          if (accumulatedListenSecRef.current >= 4) {
            flushListeningJourney();
          }
        }
        lastJourneyTickRef.current = nowMs;
      } else {
        resetVocalSignals();
        lastJourneyTickRef.current = 0;
      }

      if (forceTimePush || nowMs - lastUiTimePushRef.current >= 90) {
        lastUiTimePushRef.current = nowMs;
        if (Math.abs(state.currentTime - nowSec) >= 0.04 || forceTimePush) {
          state.setCurrentTime(nowSec);
        }
      }
    };

    const startRaf = () => {
      cancelAnimationFrame(rafRef.current);
      lastJourneyTickRef.current = performance.now();
      const step = () => {
        if (!audio.paused && !audio.ended) {
          syncFromAudio(false);
          rafRef.current = requestAnimationFrame(step);
        }
      };
      rafRef.current = requestAnimationFrame(step);
    };

    const stopRaf = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      lastJourneyTickRef.current = 0;
      resetVocalSignals();
      flushListeningJourney();
    };

    const recordVisitNow = () => {
      const st = usePlayerStore.getState();
      const chapter = st.chapters.find((c) => c.id === st.currentChapterId);
      const reciter = st.reciters.find((r) => r.id === st.currentReciterId);
      if (!chapter) return;
      const verseKey =
        st.surahData?.ayahs[st.activeAyahIndex]?.verseKey ?? `${chapter.id}:1`;
      useJourneyStore.getState().recordSurahVisit({
        chapter,
        verseKey,
        ayahIndex: st.activeAyahIndex,
        reciterId: reciter?.id ?? st.currentReciterId ?? 7,
        reciterName: reciter?.name ?? 'Reciter',
      });
    };

    const onPlay = () => {
      ensureAudioAnalyser();
      usePlayerStore.getState().setIsPlaying(true);
      usePlayerStore.getState().setAudioStatus('playing', null);
      recordVisitNow();
      startRaf();
    };

    const onPlaying = () => {
      usePlayerStore.getState().setIsPlaying(true);
      usePlayerStore.getState().setAudioStatus('playing', null);
      startRaf();
    };

    const onPause = () => {
      stopRaf();
      const st = usePlayerStore.getState();
      st.setIsPlaying(false);
      if (st.audioStatus !== 'loading' && st.audioStatus !== 'error') {
        st.setAudioStatus('paused', null);
      }
      syncFromAudio(true);
    };

    const onWaiting = () => {
      if (!audio.paused) {
        usePlayerStore.getState().setAudioStatus('buffering', null);
      }
    };

    const onStalled = () => {
      if (!audio.paused && audio.readyState < 3) {
        usePlayerStore.getState().setAudioStatus('buffering', null);
      }
    };

    const onCanPlay = () => {
      const st = usePlayerStore.getState();
      if (st.audioStatus === 'buffering' || st.audioStatus === 'loading') {
        st.setAudioStatus(audio.paused ? 'ready' : 'playing', null);
      }
    };

    const onDurationChange = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        usePlayerStore.getState().setDuration(audio.duration);
      }
    };

    const onSeeked = () => syncFromAudio(true);
    const onTimeUpdate = () => {
      if (audio.paused) {
        syncFromAudio(true);
      }
    };

    const onEnded = () => {
      stopRaf();
      const st = usePlayerStore.getState();
      st.setIsPlaying(false);
      if (st.currentChapterId < 114) {
        void st.nextSurah(true);
      } else {
        st.setShouldAutoPlay(false);
        st.setAudioStatus('paused', null);
      }
    };

    const onError = () => {
      stopRaf();
      const st = usePlayerStore.getState();
      if (!st.surahData?.audioUrl) return;
      st.setIsPlaying(false);
      st.setShouldAutoPlay(false);
      st.setAudioStatus(
        'error',
        'Audio stream interrupted. Check your connection or try another reciter.',
      );
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('stalled', onStalled);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('seeked', onSeeked);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      stopRaf();
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('stalled', onStalled);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('seeked', onSeeked);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

  // Media Session API for lock-screen and OS hardware media controls
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const chapter = chapters.find((c) => c.id === currentChapterId);
    const reciter = reciters.find((r) => r.id === currentReciterId);

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: chapter
          ? `${chapter.id}. ${chapter.nameSimple} — ${chapter.translatedName}`
          : 'Al-Qur’an',
        artist: reciter?.name ?? 'Sakinah',
        album: 'Sakinah Qur’an Sanctuary',
      });

      navigator.mediaSession.setActionHandler('play', () => {
        usePlayerStore.getState().setShouldAutoPlay(true);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        usePlayerStore.getState().setShouldAutoPlay(false);
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        void usePlayerStore.getState().prevSurah();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        void usePlayerStore.getState().nextSurah();
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number') {
          usePlayerStore.getState().requestSeekToSeconds(details.seekTime);
        }
      });
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        const cur = audioRef.current?.currentTime ?? 0;
        usePlayerStore.getState().requestSeekToSeconds(Math.max(0, cur - 10));
      });
      navigator.mediaSession.setActionHandler('seekforward', () => {
        const cur = audioRef.current?.currentTime ?? 0;
        usePlayerStore.getState().requestSeekToSeconds(cur + 10);
      });
    } catch {
      // MediaSession unsupported action in some browsers
    }
  }, [chapters, reciters, currentChapterId, currentReciterId]);

  // Global keyboard shortcuts (Space, Arrows, Mute, '/' to open Surah drawer, 'b' to reflect/bookmark)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable;

      if (isEditable) return;

      const state = usePlayerStore.getState();
      const journeyState = useJourneyStore.getState();
      if (
        state.surahDrawerOpen ||
        journeyState.reflectionTarget !== null ||
        journeyState.journeyDrawerOpen
      ) {
        return;
      }

      if (e.code === 'Space') {
        if (tag === 'button' || target?.getAttribute('role') === 'slider') return;
        e.preventDefault();
        state.requestTogglePlay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const cur = audioRef.current?.currentTime ?? state.currentTime;
        state.requestSeekToSeconds(cur + 5);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const cur = audioRef.current?.currentTime ?? state.currentTime;
        state.requestSeekToSeconds(Math.max(0, cur - 5));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        state.nextAyah();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        state.prevAyah();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        state.toggleMute();
      } else if (e.key === '/') {
        e.preventDefault();
        state.setSurahDrawerOpen(true);
      } else if (e.key === 'b' || e.key === 'B') {
        const chapter = state.chapters.find((c) => c.id === state.currentChapterId);
        const activeAyah = state.surahData?.ayahs[state.activeAyahIndex];
        if (chapter && activeAyah) {
          e.preventDefault();
          journeyState.setReflectionTarget({ ayah: activeAyah, chapter });
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <audio
      ref={audioRef}
      crossOrigin="anonymous"
      preload="auto"
      className="hidden"
    />
  );
}
