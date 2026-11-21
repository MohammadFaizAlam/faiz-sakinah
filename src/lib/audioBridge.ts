/**
 * Direct imperative bridge to the mounted HTMLAudioElement for <16ms seeking and
 * immediate transport response without waiting for React effect cycles.
 */
export interface AudioBridgeHandlers {
  seekImmediate: (seconds: number, playAfter?: boolean) => void;
  togglePlayImmediate: () => void;
  getCurrentTime: () => number;
}

let activeHandlers: AudioBridgeHandlers | null = null;

export function registerAudioBridge(handlers: AudioBridgeHandlers | null): void {
  activeHandlers = handlers;
}

export function invokeSeekImmediate(seconds: number, playAfter?: boolean): boolean {
  if (!activeHandlers) return false;
  activeHandlers.seekImmediate(seconds, playAfter);
  return true;
}

export function invokeTogglePlayImmediate(): boolean {
  if (!activeHandlers) return false;
  activeHandlers.togglePlayImmediate();
  return true;
}

export function readLiveAudioTime(fallback: number): number {
  return activeHandlers ? activeHandlers.getCurrentTime() : fallback;
}
