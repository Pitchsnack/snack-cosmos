import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * Client-side favorite/bookmark store, scoped per entity type.
 *
 * Shared by My Startups, the Startup Directory and the Investor Directory so
 * favorite state stays in sync across surfaces of the same entity type.
 * Persisted in localStorage; syncs across tabs and components via the storage
 * event and an in-page CustomEvent. No backend calls.
 */

export type FavoriteEntity = "startups" | "investors";

function storageKey(entity: FavoriteEntity) {
  return `sp2:favorites:${entity}`;
}

function changeEvent(entity: FavoriteEntity) {
  return `sp2:favorites:${entity}:change`;
}

function read(entity: FavoriteEntity): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey(entity));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? arr.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

function write(entity: FavoriteEntity, set: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(entity), JSON.stringify([...set]));
  window.dispatchEvent(new CustomEvent(changeEvent(entity)));
}

export function useFavorites(entity: FavoriteEntity = "startups") {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const event = useMemo(() => changeEvent(entity), [entity]);

  useEffect(() => {
    setIds(read(entity));
    const sync = () => setIds(read(entity));
    window.addEventListener("storage", sync);
    window.addEventListener(event, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(event, sync);
    };
  }, [entity, event]);

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
      // Prevent duplicate in-flight requests for the same record.
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

      const previous = read(entity);
      const willFavorite = !previous.has(id);
      const next = new Set(previous);
      if (willFavorite) next.add(id);
      else next.delete(id);

      // Optimistic update.
      setIds(next);
      try {
        write(entity, next);
      } catch {
        setIds(previous);
        try {
          write(entity, previous);
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
    [entity, setPendingFor],
  );

  const remove = useCallback(
    (id: string) => {
      const next = read(entity);
      if (next.delete(id)) write(entity, next);
    },
    [entity],
  );

  return { ids, isFavorite, isPending, toggle, remove };
}

/** Startup-scoped favorites (existing call sites). */
export function useFavoriteStartups() {
  return useFavorites("startups");
}

/** Investor-scoped favorites. */
export function useFavoriteInvestors() {
  return useFavorites("investors");
}
