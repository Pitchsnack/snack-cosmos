/**
 * Acquisition Strategy — private per-startup strategy store.
 *
 * Holds the three strategy pillars from the PRD:
 *  1. Companies We Want to Acquire (target companies)
 *  2. Competitor Acquisition References (max 3, with simulated AI extraction)
 *  3. Acquisition Requirements (structured criteria)
 *
 * Persistence is client-side (localStorage) because no approved backend
 * acquisition-strategy contract exists yet — same pattern as the Basic
 * Information Restrictions store. The data is private to the workspace and
 * is never rendered on public/directory surfaces.
 */

import { useSyncExternalStore } from "react";

export type ExtractionStatus = "not_extracted" | "pending" | "extracted" | "failed";

export const MAX_COMPETITORS = 3;

/**
 * Read-only snapshot of an existing startup record the target is linked to.
 * Selecting "Use This Startup" in the P-18 duplicate check creates an
 * Acquisition Target *relationship* to that record — the original startup is
 * never recreated, copied into a second profile, or modified.
 */
export interface LinkedStartupSnapshot {
  name: string;
  website: string;
  logo: string | null;
  shortDescription: string | null;
  industry: string[];
  productTags: string[];
  marketTags: string[];
  headquarters: string | null;
  city: string | null;
}

export interface TargetCompany {
  id: string;
  name: string;
  website: string;
  /** Data URL (uploaded/snipped) or remote URL (auto-enrich favicon). */
  logo: string | null;
  /** "Why this company is attractive" — up to 5 keyword pills. */
  attractiveKeywords: string[];
  notes: string;
  /** Existing startup record id when this target links to one; null = manual entry. */
  linkedStartupId: string | null;
  /** Display snapshot of the linked startup (only when linkedStartupId is set). */
  linkedSnapshot: LinkedStartupSnapshot | null;
}

export interface CompetitorExtractionResult {
  acquisitionHistory: string[];
  acquiredCompanies: string[];
  commonThemes: string[];
  strategicPatterns: string[];
}

export interface CompetitorReference {
  id: string;
  name: string;
  website: string;
  logo: string | null;
  attractiveKeywords: string[];
  notes: string;
  linkedStartupId: string | null;
  linkedSnapshot: LinkedStartupSnapshot | null;
  status: ExtractionStatus;
  lastExtractedAt: string | null;
  result: CompetitorExtractionResult | null;
}

export interface AcquisitionRequirements {
  industries: string[];
  keywords: string[];
  productTags: string[];
  markets: string[];
  stages: string[];
  companySize: string;
  strategicReason: string;
}

export interface AcquisitionStrategy {
  targets: TargetCompany[];
  competitors: CompetitorReference[];
  requirements: AcquisitionRequirements;
  updatedAt: string | null;
}

export const EMPTY_REQUIREMENTS: AcquisitionRequirements = {
  industries: [],
  keywords: [],
  productTags: [],
  markets: [],
  stages: [],
  companySize: "",
  strategicReason: "",
};

export function emptyStrategy(): AcquisitionStrategy {
  return { targets: [], competitors: [], requirements: { ...EMPTY_REQUIREMENTS }, updatedAt: null };
}

const STORAGE_KEY = (startupId: string) => `sp2.acquisition-strategy.${startupId}`;
export const STRATEGY_CHANGE_EVENT = "sp2:acquisition-strategy:change";

/** Memoized snapshot cache so useSyncExternalStore returns stable identities. */
const cache = new Map<string, { raw: string | null; value: AcquisitionStrategy }>();

export function loadStrategy(startupId: string): AcquisitionStrategy {
  if (typeof window === "undefined") return emptyStrategy();
  const key = STORAGE_KEY(startupId);
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    raw = null;
  }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value;

  let value = emptyStrategy();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<AcquisitionStrategy>;
      value = {
        targets: Array.isArray(parsed.targets)
          ? parsed.targets.map(normalizeTarget).filter((t): t is TargetCompany => t !== null)
          : [],
        competitors: Array.isArray(parsed.competitors)
          ? parsed.competitors
              .map(normalizeCompetitor)
              .filter((c): c is CompetitorReference => c !== null)
          : [],
        requirements: { ...EMPTY_REQUIREMENTS, ...(parsed.requirements ?? {}) },
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      };
    } catch {
      value = emptyStrategy();
    }
  }
  cache.set(key, { raw, value });
  return value;
}

export function saveStrategy(startupId: string, strategy: AcquisitionStrategy) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY(startupId), JSON.stringify(strategy));
  window.dispatchEvent(new CustomEvent(STRATEGY_CHANGE_EVENT));
}

const EXTRACTION_STATUSES: ExtractionStatus[] = [
  "not_extracted",
  "pending",
  "extracted",
  "failed",
];

function toKeywords(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((k): k is string => typeof k === "string" && !!k.trim()).slice(0, 5);
}

/** Normalize persisted rows so older saves (with `source`, without logo/keywords) stay readable. */
function normalizeTarget(raw: unknown): TargetCompany | null {
  const t = raw as Partial<TargetCompany> | null;
  if (!t || typeof t.id !== "string" || typeof t.name !== "string") return null;
  return {
    id: t.id,
    name: t.name,
    website: typeof t.website === "string" ? t.website : "",
    logo: typeof t.logo === "string" && t.logo ? t.logo : null,
    attractiveKeywords: toKeywords(t.attractiveKeywords),
    notes: typeof t.notes === "string" ? t.notes : "",
  };
}

function normalizeCompetitor(raw: unknown): CompetitorReference | null {
  const c = raw as Partial<CompetitorReference> | null;
  if (!c || typeof c.id !== "string" || typeof c.name !== "string") return null;
  return {
    id: c.id,
    name: c.name,
    website: typeof c.website === "string" ? c.website : "",
    logo: typeof c.logo === "string" && c.logo ? c.logo : null,
    attractiveKeywords: toKeywords(c.attractiveKeywords),
    notes: typeof c.notes === "string" ? c.notes : "",
    status: EXTRACTION_STATUSES.includes(c.status as ExtractionStatus)
      ? (c.status as ExtractionStatus)
      : "not_extracted",
    lastExtractedAt: typeof c.lastExtractedAt === "string" ? c.lastExtractedAt : null,
    result: c.result ?? null,
  };
}

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", cb);
  window.addEventListener(STRATEGY_CHANGE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(STRATEGY_CHANGE_EVENT, cb);
  };
}

/** Reactive per-startup strategy hook. */
export function useAcquisitionStrategy(startupId: string | undefined) {
  const strategy = useSyncExternalStore(
    subscribe,
    () => (startupId ? loadStrategy(startupId) : emptyStrategy()),
    () => emptyStrategy(),
  );

  const update = (mutate: (draft: AcquisitionStrategy) => AcquisitionStrategy) => {
    if (!startupId) return;
    const next = mutate(loadStrategy(startupId));
    saveStrategy(startupId, { ...next, updatedAt: new Date().toISOString() });
  };

  return { strategy, update };
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Simulated acquisition-pattern extraction. Only Competitor Name + Website are
 * user inputs — the extraction derives placeholder intelligence from them.
 * Deterministic per name so repeated extracts of the same competitor agree.
 */
export function simulateExtraction(name: string, website: string): CompetitorExtractionResult {
  const seed = Array.from(name + website).reduce((a, c) => a + c.charCodeAt(0), 0);
  const sectors = ["SaaS", "Logistics Tech", "FoodTech", "Fintech", "AgriTech", "AI Tooling"];
  const pick = <T,>(arr: T[], n: number, offset = 0): T[] =>
    Array.from({ length: n }, (_, i) => arr[(seed + offset + i) % arr.length]);

  const acquired = Array.from({ length: 3 }, (_, i) => {
    const sector = sectors[(seed + i) % sectors.length];
    return `${sector} target ${String.fromCharCode(65 + ((seed + i) % 26))} (20${18 + ((seed + i) % 8)})`;
  });

  return {
    acquisitionHistory: [
      `${name} has completed an estimated ${2 + (seed % 4)} acquisitions over the past 5 years.`,
      `Deal cadence suggests one bolt-on acquisition every ${12 + (seed % 12)} months.`,
      `Typical entry point: ${pick(["minority stake", "majority stake", "full buyout"], 1)[0]} followed by integration.`,
    ],
    acquiredCompanies: acquired,
    commonThemes: pick(
      ["Route optimisation", "Data infrastructure", "Food safety", "Automation", "Supply chain visibility", "AI-driven analytics"],
      4,
    ),
    strategicPatterns: pick(
      [
        "Acquires technology teams rather than revenue",
        "Targets regional leaders before expanding",
        "Focuses on complementary product capability",
        "Prefers companies with 20–200 employees",
        "Buys to enter adjacent markets",
      ],
      3,
      2,
    ),
  };
}

export const EXTRACTION_STATUS_LABEL: Record<ExtractionStatus, string> = {
  not_extracted: "Not Extracted",
  pending: "Extraction Pending",
  extracted: "Extracted",
  failed: "Failed",
};

/** Human-readable export of the full strategy (Save/Export actions). */
export function buildStrategyExport(startupName: string, s: AcquisitionStrategy): string {
  const lines: (string | null)[] = [
    `# Acquisition Strategy — ${startupName}`,
    "",
    `Exported: ${new Date().toISOString()}`,
    s.updatedAt ? `Last saved: ${s.updatedAt}` : null,
    "",
    "## 1. Companies We Want to Acquire",
    ...(s.targets.length
      ? s.targets.map(
          (t) =>
            `- ${t.name}${t.website ? ` (${t.website})` : ""}${t.attractiveKeywords.length ? ` — Why attractive: ${t.attractiveKeywords.join(", ")}` : ""}${t.notes ? ` — ${t.notes}` : ""}`,
        )
      : ["- None added yet."]),
    "",
    "## 2. Competitor Acquisition References",
    ...(s.competitors.length
      ? s.competitors.map(
          (c) =>
            `- ${c.name}${c.website ? ` (${c.website})` : ""} — ${EXTRACTION_STATUS_LABEL[c.status]}${c.attractiveKeywords.length ? ` — Why attractive: ${c.attractiveKeywords.join(", ")}` : ""}${c.notes ? ` — ${c.notes}` : ""}`,
        )
      : ["- None added yet."]),
    "",
    "## 3. Acquisition Requirements",
    `- Industries: ${s.requirements.industries.join(", ") || "—"}`,
    `- Keywords: ${s.requirements.keywords.join(", ") || "—"}`,
    `- Product & Service Tags: ${s.requirements.productTags.join(", ") || "—"}`,
    `- Markets: ${s.requirements.markets.join(", ") || "—"}`,
    `- Company Stage: ${s.requirements.stages.join(", ") || "—"}`,
    `- Company Size: ${s.requirements.companySize || "—"}`,
    `- Strategic Reason: ${s.requirements.strategicReason || "—"}`,
    "",
    "Private — visible only to authorized users in this workspace.",
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}
