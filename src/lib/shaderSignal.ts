import type { AtmosphereMood } from '../types/quran';

/**
 * Zero-re-render mutable signal bridge between audio/ayah/voice state and the WebGL shader loop.
 * Read directly inside requestAnimationFrame / afterDraw without triggering React updates.
 */
export interface ShaderSignal {
  playingTarget: number; // 0 when paused, 1 when playing
  progressTarget: number; // 0..1 normalized surah playback progress
  bloomYTarget: number; // 0..1 normalized viewport Y (0 = bottom, 1 = top in GLSL UV)
  ayahPulseStamp: number; // performance.now() timestamp of last active ayah transition
  pointerX: number; // -1..1 gentle pointer parallax
  pointerY: number; // -1..1 gentle pointer parallax
  // Live Web Audio AnalyserNode vocal metrics (0..1)
  voiceLevelTarget: number; // Vocal core energy (~120Hz - 2800Hz)
  voiceWarmthTarget: number; // Baritone warmth (~80Hz - 450Hz)
  voiceCrestTarget: number; // Upper vocal clarity shimmer (~1800Hz - 5500Hz)
  // User Atmosphere visualizer tuning
  moodIndex: number; // 0 = midnight-silk, 1 = lunar-mist, 2 = still-night
  reactivityTarget: number; // 0..1.5 sensitivity multiplier
  // Live meter bands for Atmosphere popover (5 bars, 0..1)
  meterBands: [number, number, number, number, number];
}

export function moodToIndex(mood: AtmosphereMood): number {
  if (mood === 'lunar-mist') return 1;
  if (mood === 'still-night') return 2;
  return 0;
}

export const shaderSignal: ShaderSignal = {
  playingTarget: 0,
  progressTarget: 0,
  bloomYTarget: 0.52,
  ayahPulseStamp: -10000,
  pointerX: 0,
  pointerY: 0,
  voiceLevelTarget: 0,
  voiceWarmthTarget: 0,
  voiceCrestTarget: 0,
  moodIndex: 0,
  reactivityTarget: 1.0,
  meterBands: [0, 0, 0, 0, 0],
};

export function triggerAyahPulse(): void {
  shaderSignal.ayahPulseStamp =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
}
