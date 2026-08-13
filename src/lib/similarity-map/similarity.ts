/**
 * Startup Similarity Map — pure grouping / similarity logic.
 *
 * Discovery layer only: reads existing Startup Directory classifications
 * (industry, product_tags, market_tags). No new fields, no mutations.
 */
import type { StartupListItem } from "@/lib/startups.functions";

export type SimilarityMode = "industry" | "product" | "market" | "all";

export const SIMILARITY_MODES: { value: SimilarityMode; label: string }[] = [
  { value: "industry", label: "Industry" },
  { value: "product", label: "Product & Service Tags" },
  { value: "market", label: "Market Tags" },
  { value: "all", label: "All Combined" },
];

export const UNCLASSIFIED = "Unclassified";

export function dimensionTags(s: StartupListItem, mode: SimilarityMode): string[] {
  switch (mode) {
    case "industry":
      return s.industry ?? [];
    case "product":
      return s.product_tags ?? [];
    case "market":
      return s.market_tags ?? [];
    case "all":
      return [...(s.industry ?? []), ...(s.product_tags ?? []), ...(s.market_tags ?? [])];
  }
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sa = new Set(a.map((t) => t.toLowerCase()));
  const sb = new Set(b.map((t) => t.toLowerCase()));
  let inter = 0;
  sa.forEach((t) => {
    if (sb.has(t)) inter += 1;
  });
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** 0–1 similarity between two startups for the active mode. */
export function similarity(a: StartupListItem, b: StartupListItem, mode: SimilarityMode): number {
  if (mode !== "all") return jaccard(dimensionTags(a, mode), dimensionTags(b, mode));
  const i = jaccard(a.industry ?? [], b.industry ?? []);
  const p = jaccard(a.product_tags ?? [], b.product_tags ?? []);
  const m = jaccard(a.market_tags ?? [], b.market_tags ?? []);
  return i * 0.4 + p * 0.35 + m * 0.25;
}

export interface Cluster {
  key: string;
  name: string;
  members: StartupListItem[];
}

/**
 * Assigns each startup to the most globally-frequent tag it carries in the
 * active dimension, so clusters emerge from real data rather than presets.
 */
export function buildClusters(rows: StartupListItem[], mode: SimilarityMode): Cluster[] {
  const dim: SimilarityMode = mode === "all" ? "industry" : mode;
  const freq = new Map<string, number>();
  for (const r of rows) {
    for (const t of dimensionTags(r, dim)) {
      const k = t.trim();
      if (k) freq.set(k, (freq.get(k) ?? 0) + 1);
    }
  }
  const groups = new Map<string, StartupListItem[]>();
  for (const r of rows) {
    const tags = dimensionTags(r, dim)
      .map((t) => t.trim())
      .filter(Boolean);
    let best = UNCLASSIFIED;
    let bestN = -1;
    for (const t of tags) {
      const n = freq.get(t) ?? 0;
      if (n > bestN || (n === bestN && t.localeCompare(best) < 0)) {
        best = t;
        bestN = n;
      }
    }
    const list = groups.get(best);
    if (list) list.push(r);
    else groups.set(best, [r]);
  }
  return [...groups.entries()]
    .map(([key, members]) => ({ key, name: key, members }))
    .sort((a, b) =>
      a.key === UNCLASSIFIED
        ? 1
        : b.key === UNCLASSIFIED
          ? -1
          : b.members.length - a.members.length || a.name.localeCompare(b.name),
    );
}

export interface SimilarMatch {
  startup: StartupListItem;
  score: number;
}

/** Ranked neighbours of `id` above `threshold` (0–1) for the active mode. */
export function similarTo(
  rows: StartupListItem[],
  id: string,
  mode: SimilarityMode,
  threshold: number,
  limit = 24,
): SimilarMatch[] {
  const self = rows.find((r) => r.id === id);
  if (!self) return [];
  return rows
    .filter((r) => r.id !== id)
    .map((r) => ({ startup: r, score: similarity(self, r, mode) }))
    .filter((m) => m.score >= threshold && m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
