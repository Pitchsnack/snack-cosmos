/**
 * Startup Cover Page — fixed PitchSnack cover backgrounds.
 *
 * Presentation-only. Exactly six fixed backgrounds are supported; no generated
 * variants. Selection never touches Media1 or any startup business data, and no
 * backend contract exists yet, so the choice is persisted locally per startup
 * ref and broadcast in-tab.
 *
 * // TODO: wire to SnackPortal2 API Gateway (cover background persistence)
 */

export type CoverBackgroundId =
  | "yellow"
  | "orange"
  | "red"
  | "blue"
  | "purple"
  | "mix";

export interface CoverBackgroundPreset {
  id: CoverBackgroundId;
  label: string;
  /** CSS background value used for the left cover surface. */
  css: string;
  /** Small swatch used inside the selector. */
  swatch: string;
}

/** Yellow is the default. Order is fixed. */
export const COVER_BACKGROUNDS: CoverBackgroundPreset[] = [
  {
    id: "yellow",
    label: "Yellow",
    css: "radial-gradient(120% 90% at 20% 0%, #F7C948 0%, #C98A12 45%, #2B2A12 100%)",
    swatch: "linear-gradient(135deg, #F7C948, #C98A12)",
  },
  {
    id: "orange",
    label: "Orange",
    css: "radial-gradient(120% 90% at 20% 0%, #FB8B24 0%, #C2410C 45%, #2A1608 100%)",
    swatch: "linear-gradient(135deg, #FB8B24, #C2410C)",
  },
  {
    id: "red",
    label: "Red",
    css: "radial-gradient(120% 90% at 20% 0%, #EF4444 0%, #991B1B 45%, #260B0B 100%)",
    swatch: "linear-gradient(135deg, #EF4444, #991B1B)",
  },
  {
    id: "blue",
    label: "Blue",
    css: "radial-gradient(120% 90% at 20% 0%, #3B82F6 0%, #0B2D63 45%, #08111F 100%)",
    swatch: "linear-gradient(135deg, #3B82F6, #0B2D63)",
  },
  {
    id: "purple",
    label: "Purple",
    css: "radial-gradient(120% 90% at 20% 0%, #A855F7 0%, #5B21B6 45%, #170B26 100%)",
    swatch: "linear-gradient(135deg, #A855F7, #5B21B6)",
  },
  {
    id: "mix",
    label: "Mix",
    css: "linear-gradient(135deg, #F7C948 0%, #FB8B24 25%, #EF4444 50%, #6D28D9 75%, #0B2D63 100%)",
    swatch: "linear-gradient(135deg, #F7C948, #EF4444, #6D28D9)",
  },
];

export const DEFAULT_COVER_BACKGROUND: CoverBackgroundId = "yellow";

export function coverBackgroundPreset(id: CoverBackgroundId | null): CoverBackgroundPreset {
  return (
    COVER_BACKGROUNDS.find((b) => b.id === id) ??
    COVER_BACKGROUNDS.find((b) => b.id === DEFAULT_COVER_BACKGROUND)!
  );
}

const STORAGE_KEY = "sp2.cover-background.v1";
const EVENT = "sp2:cover-background-changed";

type Store = Record<string, CoverBackgroundId>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Store;
  } catch {
    return {};
  }
}

/** Returns the explicitly selected background, or null when none was chosen. */
export function getCoverBackground(startupRef: string): CoverBackgroundId | null {
  const v = readStore()[startupRef];
  return v && COVER_BACKGROUNDS.some((b) => b.id === v) ? v : null;
}

export function setCoverBackground(startupRef: string, id: CoverBackgroundId): void {
  if (typeof window === "undefined") return;
  const next = { ...readStore(), [startupRef]: id };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { startupRef } }));
}

export function clearCoverBackground(startupRef: string): void {
  if (typeof window === "undefined") return;
  const next = readStore();
  delete next[startupRef];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { startupRef } }));
}

export function subscribeCoverBackground(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
