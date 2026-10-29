import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { signStartupListMedia } from "@/lib/startups.functions";

type Signed = { logo: string | null; tile: string | null; expiresAt: number };

/** Browser-wide cache of signed card media, reused until shortly before expiry. */
const cache = new Map<string, Signed>();
const inflight = new Set<string>();
const REFRESH_MARGIN_MS = 5 * 60_000;
const FIRST_BATCH = 12;

const fresh = (id: string) => {
  const c = cache.get(id);
  return !!c && c.expiresAt - REFRESH_MARGIN_MS > Date.now();
};

/**
 * Fills logo/tile signed URLs into list rows after the rows have rendered.
 * The first cards (on screen) are signed first in one batched call, the rest
 * in a second call. Rows keep their placeholder until their URL arrives.
 */
export function useListMedia<T extends { id: string; logo_signed_url: string | null; tile_image_signed_url?: string | null }>(
  rows: T[],
): T[] {
  const sign = useServerFn(signStartupListMedia);
  const [version, setVersion] = useState(0);
  const key = rows.map((r) => r.id).join(",");

  useEffect(() => {
    const need = rows.map((r) => r.id).filter((id) => !fresh(id) && !inflight.has(id));
    if (need.length === 0) return;
    const run = async (ids: string[]) => {
      if (ids.length === 0) return;
      ids.forEach((id) => inflight.add(id));
      try {
        const res = await sign({ data: { ids } });
        const expiresAt = Date.now() + res.ttlSeconds * 1000;
        for (const it of res.items) cache.set(it.id, { logo: it.logo, tile: it.tile, expiresAt });
        setVersion((v) => v + 1);
      } catch {
        /* cards keep their placeholder */
      } finally {
        ids.forEach((id) => inflight.delete(id));
      }
    };
    void (async () => {
      await run(need.slice(0, FIRST_BATCH));
      await run(need.slice(FIRST_BATCH));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return useMemo(() => {
    void version;
    return rows.map((r) => {
      const c = cache.get(r.id);
      return c ? { ...r, logo_signed_url: c.logo, tile_image_signed_url: c.tile } : r;
    });
  }, [rows, version]);
}
