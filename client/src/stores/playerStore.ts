import { create } from 'zustand';

interface PlayerState {
  /** Current playback time in milliseconds (raw audio time). */
  timeMs: number;
  isPlaying: boolean;
  durationMs: number;
  showTranslations: boolean;
  /**
   * Offset of the lyrics relative to the audio source. Positive when lyrics
   * should be shown LATER than the audio (e.g. video has an intro).
   * Effective lyric time = timeMs - lyricsOffsetMs.
   */
  lyricsOffsetMs: number;
  /**
   * When true, the next click on any lyric line is treated as a "this line
   * plays right now" pick. The offset is recomputed from the current audio
   * time and the picked line's startMs.
   */
  syncPickMode: boolean;

  setTime: (ms: number) => void;
  setPlaying: (playing: boolean) => void;
  setDuration: (ms: number) => void;
  toggleTranslations: () => void;
  setLyricsOffset: (ms: number) => void;
  setSyncPickMode: (v: boolean) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  timeMs: 0,
  isPlaying: false,
  durationMs: 0,
  showTranslations: true,
  lyricsOffsetMs: 0,
  syncPickMode: false,

  setTime: (timeMs) => set({ timeMs }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setDuration: (durationMs) => set({ durationMs }),
  toggleTranslations: () => set((s) => ({ showTranslations: !s.showTranslations })),
  setLyricsOffset: (lyricsOffsetMs) => set({ lyricsOffsetMs }),
  setSyncPickMode: (syncPickMode) => set({ syncPickMode }),
  reset: () => set({ timeMs: 0, isPlaying: false, lyricsOffsetMs: 0, syncPickMode: false }),
}));
