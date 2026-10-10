/**
 * Card-sized (≈640px) cover addresses for sector and investor library pictures.
 * Signed for 7 days and reused while at least a day remains, so the browser
 * sees the same address between visits and can cache the picture.
 */
const BUCKET = "public-images";
const TTL = 60 * 60 * 24 * 7;
const REUSE_MS = 1000 * 60 * 60 * 24;
const cache = new Map<string, { url: string; exp: number }>();

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function signCard(sb: any, path: string): Promise<string | null> {
  const hit = cache.get(path);
  if (hit && hit.exp - Date.now() > REUSE_MS) return hit.url;
  let url: string | null = null;
  const t = await sb.storage.from(BUCKET).createSignedUrl(path, TTL, { transform: { width: 640, resize: "contain", quality: 75 } });
  if (!t.error && t.data?.signedUrl) url = t.data.signedUrl;
  if (!url) {
    const f = await sb.storage.from(BUCKET).createSignedUrl(path, TTL);
    url = f.data?.signedUrl ?? null;
  }
  if (url) cache.set(path, { url, exp: Date.now() + TTL * 1000 });
  return url;
}

type Row = { id: string; key: string; storage_path: string };

async function load(table: "sector_images" | "investor_images", keyCol: string) {
  const sb = await admin();
  const { data } = await sb.from(table).select(`id, ${keyCol}, storage_path`).order("uploaded_at", { ascending: true });
  const rows: Row[] = (data ?? []).map((r: any) => ({ id: r.id, key: r[keyCol], storage_path: r.storage_path }));
  return { sb, rows };
}

/** Same rule as resolveCover: picked image in its sector → sector's oldest → none. */
export async function sectorCoverResolver() {
  const { sb, rows } = await load("sector_images", "sector_key");
  return async (sector: string | null | undefined, picked?: string | null): Promise<string | null> => {
    let row: Row | undefined;
    if (picked) { const p = rows.find((r) => r.id === picked); if (p && (!sector || p.key === sector)) row = p; }
    if (!row && sector) row = rows.find((r) => r.key === sector);
    return row ? signCard(sb, row.storage_path) : null;
  };
}

/** Same rule as resolveInvestorCover: type's oldest image → "Investor" image → none. */
export async function investorCoverResolver() {
  const { sb, rows } = await load("investor_images", "type_key");
  return async (type: string | null | undefined): Promise<string | null> => {
    const t = (type ?? "").trim().toLowerCase();
    const row = rows.find((r) => r.key.toLowerCase() === t) ?? rows.find((r) => r.key === "Investor");
    return row ? signCard(sb, row.storage_path) : null;
  };
}
