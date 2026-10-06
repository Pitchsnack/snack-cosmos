import { createServerFn } from "@tanstack/react-start";

/**
 * Public homepage hero pictures. Visitors aren't signed in, so this signs two
 * fixed, anonymous images (the Packaging sector cover and the Private equity
 * investor cover) and nothing else. Returns nulls when storage can't serve them.
 */
type HeroImgs = { seller: string | null; investor: string | null };
let cache: { at: number; v: HeroImgs } | null = null;
const TTL = 60 * 60 * 1000; // reuse for 1h; URLs are valid 12h

export const getHomeHeroImages = createServerFn({ method: "GET" }).handler(async (): Promise<HeroImgs> => {
  if (cache && Date.now() - cache.at < TTL) return cache.v;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const [{ data: sec }, { data: inv }] = await Promise.all([
      sb.from("sector_images").select("storage_path").eq("sector_key", "Packaging").order("uploaded_at").limit(1).maybeSingle(),
      sb.from("investor_images").select("storage_path").eq("type_key", "Private equity").order("uploaded_at").limit(1).maybeSingle(),
    ]);
    const paths = [sec?.storage_path, inv?.storage_path].filter(Boolean) as string[];
    if (!paths.length) return { seller: null, investor: null };
    const { data: signed } = await sb.storage.from("public-images").createSignedUrls(paths, 60 * 60 * 12);
    const url = (p?: string) => (p ? signed?.find((s: any) => s.path === p)?.signedUrl ?? null : null);
    const v = { seller: url(sec?.storage_path) as string | null, investor: url(inv?.storage_path) as string | null };
    if (v.seller || v.investor) cache = { at: Date.now(), v };
    return v;
  } catch {
    return { seller: null, investor: null };
  }
});
