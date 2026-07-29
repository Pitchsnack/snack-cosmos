import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Client-side favorite/bookmark store for startups.
 *
 * Shared by My Startups and the Startup Directory so favorite state stays in
 * sync across surfaces. Persisted in localStorage; syncs across tabs and
 * components via the storage event and an in-page CustomEvent. No backend calls.
 */

const STORAGE_KEY = "sp2:favorites:startups";
const CHANGE_EVENT = "sp2:favorites:startups:change";

function read(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? arr.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

function write(set: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function useFavoriteStartups() {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setIds(read());
    const sync = () => setIds(read());
    window.addEventListener("storage", sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  const isFavorite = useCallback((id: string) => ids.has(id), [ids]);
  const isPending = useCallback((id: string) => pending.has(id), [pending]);

  const setPendingFor = useCallback((id: string, on: boolean) => {
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  /**
   * Optimistic toggle with rollback: the UI updates immediately, and if the
   * write fails the previous visual state is restored and an error is shown.
   */
  const toggle = useCallback(
    (id: string) => {
      // Prevent duplicate in-flight requests for the same startup.
      let duplicate = false;
      setPending((prev) => {
        if (prev.has(id)) {
          duplicate = true;
          return prev;
        }
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      if (duplicate) return;

      const previous = read();
      const willFavorite = !previous.has(id);
      const next = new Set(previous);
      if (willFavorite) next.add(id);
      else next.delete(id);

      // Optimistic update.
      setIds(next);
      try {
        write(next);
      } catch {
        setIds(previous);
        try {
          write(previous);
        } catch {
          /* nothing more we can do */
        }
        toast.error(
          willFavorite ? "Could not add to Favorites" : "Could not remove from Favorites",
          { description: "Your favorites could not be updated. Please try again." },
        );
      } finally {
        setPendingFor(id, false);
      }
    },
    [setPendingFor],
  );

  const remove = useCallback((id: string) => {
    const next = read();
    if (next.delete(id)) write(next);
  }, []);

  return { ids, isFavorite, isPending, toggle, remove };
}
