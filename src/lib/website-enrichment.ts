export type WebsiteEnrichmentStatus = "idle" | "running" | "done" | "failed";
export type WebsiteEnrichmentDTO = {
  status: WebsiteEnrichmentStatus;
  websiteKey: string | null;
  domain: string | null;
  result?: any;
  filled?: string[];
};

export function websiteKey(value: string): string {
  const withScheme = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  try {
    const u = new URL(withScheme);
    return `${u.protocol}//${u.hostname.toLowerCase().replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`;
  } catch { return value.trim().toLowerCase().replace(/\/+$/, ""); }
}

export function websiteDomain(value: string): string {
  try { return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.replace(/^www\./, ""); }
  catch { return value.replace(/^https?:\/\//i, "").replace(/^www\./, "").split("/")[0] ?? ""; }
}

export function shortDescriptionFrom(bio: string): string {
  const parts = bio.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/u).filter(Boolean);
  let out = parts.slice(0, 2).join(" ");
  const words = (v: string) => v.trim().split(/\s+/).filter(Boolean).length;
  if (words(out) > 25) out = parts[0] ?? out;
  if (words(out) > 25) out = `${out.split(/\s+/).slice(0, 25).join(" ").replace(/[,;:]$/, "")}.`;
  return out.slice(0, 300);
}

export function capWords(text: string, limit: number): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return words.slice(0, limit).join(" ");
}

export function enrichmentDto(row: { website_enrichment?: unknown; website?: unknown } | null): WebsiteEnrichmentDTO {
  const raw = (row?.website_enrichment ?? null) as { status?: string; website_key?: string; result?: Record<string, unknown>; filled?: string[] } | null;
  const key = raw?.website_key ?? null;
  return {
    status: raw?.status === "running" || raw?.status === "done" || raw?.status === "failed" ? raw.status : "idle",
    websiteKey: key,
    domain: key ? websiteDomain(key) : null,
    result: raw?.result ?? null,
    filled: raw?.filled ?? [],
  };
}
