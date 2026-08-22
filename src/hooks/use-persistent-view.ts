import { useEffect, useState } from "react";
import type { ViewMode } from "@/components/shared/view-toggle";

const VALID: readonly string[] = ["grid", "split", "list"];

/**
 * Remembers a directory's view mode (Grid / Split / List) in localStorage.
 *
 * Precedence: an explicit `view` URL param wins (shared links keep working);
 * otherwise the saved preference applies; otherwise the default is "split".
 * The saved value is read in an effect to avoid SSR hydration mismatch, so
 * first paint uses the default and swaps to the saved view right after mount.
 */
export function usePersistentView(storageKey: string, urlView?: ViewMode) {
  const [saved, setSaved] = useState<ViewMode | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw && VALID.includes(raw)) setSaved(raw as ViewMode);
    } catch {
      // storage unavailable (private mode, etc.) — fall back to default
    }
  }, [storageKey]);

  const view: ViewMode = urlView ?? saved ?? "split";

  const persist = (v: ViewMode) => {
    setSaved(v);
    try {
      window.localStorage.setItem(storageKey, v);
    } catch {
      // ignore — persistence is best-effort
    }
  };

  return { view, persist };
}
