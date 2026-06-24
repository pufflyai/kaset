import { create } from "zustand";

export interface WebLLMStatus {
  /** True while the model is downloading / compiling. */
  loading: boolean;
  /** Progress in the range 0..1. */
  progress: number;
  /** Human-readable progress text from the engine. */
  text: string;
  /** Set once the model has finished loading at least once. */
  ready: boolean;
  error?: string;
  set: (next: Partial<Omit<WebLLMStatus, "set">>) => void;
}

export const useWebLLMStore = create<WebLLMStatus>((set) => ({
  loading: false,
  progress: 0,
  text: "",
  ready: false,
  error: undefined,
  set: (next) => set(next),
}));
