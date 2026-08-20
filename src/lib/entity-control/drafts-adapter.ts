/**
 * AI Draft Extraction — session-scoped review queue adapter.
 *
 * BACKEND DRAFT CONTRACT: MISSING. No approved backend contract exists for
 * AI-extracted drafts, so this adapter serves a deterministic, non-persistent
 * queue for the review UX. Review decisions live in memory for the session
 * only and never touch Control or Directory records.
 *
 * Rows are generated per requested page — the full population is never
 * materialised in the browser.
 */
import type {
  DraftListParams,
  DraftRecord,
  DraftReviewStatus,
  DraftSummary,
  EntityKind,
  PagedResult,
} from "./types";

export const DRAFTS_DISCLAIMER =
  "AI Draft Extraction runs on a non-persistent review queue. Approvals and rejections are session-only until the backend draft contract is available.";

export const DRAFT_TOTALS: Record<EntityKind, number> = {
  startup: 128_542,
  investor: 83_317,
};

const SOURCES = ["Crunchbase", "LinkedIn", "Tracxn", "PitchBook", "Website Crawler", "Homepage"];
const COUNTRIES = ["India", "USA", "UK", "Singapore", "Germany", "Canada", "Australia", "Kenya"];
const SECTORS = ["AgriTech", "CleanTech", "HealthTech", "EdTech", "ClimateTech", "WaterTech", "FinTech", "SaaS"];
const STAGES = ["Pre-Seed", "Seed", "Series A", "Series B"];
const INV_TYPES = ["VC Firm", "Angel", "CVC", "Family Office", "Accelerator"];
const CHECKS = ["$250K – $3M", "$500K – $5M", "$1M – $10M", "N/A"];
const START_NAMES = ["AgriSense", "HelioCharge", "MindWave", "EduBridge", "CarbonLoop", "AquaPure Labs", "NovaGrid", "BioKnit", "Loopward", "Terrafy"];
const INV_NAMES = ["Vertex Ventures", "Pioneer Square Labs", "GreenSeed Capital", "NextWave Ventures", "Harbour Point", "Lattice Capital", "Northbeam", "Kite Partners"];

function rand(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
const pick = <T,>(arr: T[], seed: number) => arr[Math.floor(rand(seed) * arr.length)]!;

function statusFor(confidence: number, seed: number): DraftReviewStatus {
  const r = rand(seed + 7);
  if (confidence < 70) return r < 0.35 ? "conflict_detected" : r < 0.6 ? "incomplete" : "needs_review";
  if (confidence < 90) return r < 0.25 ? "duplicate_suspected" : "needs_review";
  return "pending_review";
}

function buildDraft(kind: EntityKind, index: number): DraftRecord {
  const seed = index + (kind === "startup" ? 101 : 907);
  const base = kind === "startup" ? START_NAMES : INV_NAMES;
  const name = `${pick(base, seed)}${index >= base.length ? ` ${Math.floor(index / base.length) + 1}` : ""}`;
  const confidence = 58 + Math.floor(rand(seed + 3) * 42);
  const source = pick(SOURCES, seed + 1);
  const country = pick(COUNTRIES, seed + 2);
  const website = `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}.${kind === "startup" ? "ai" : "vc"}`;
  const extracted = new Date(Date.now() - Math.floor(rand(seed + 5) * 30) * 86_400_000).toISOString();
  const status = statusFor(confidence, seed);

  const summary =
    kind === "startup"
      ? [
          { label: "Sector", value: pick(SECTORS, seed + 4) },
          { label: "Stage", value: pick(STAGES, seed + 6) },
          { label: "Website", value: website },
          { label: "Founded", value: String(2018 + Math.floor(rand(seed + 8) * 8)) },
        ]
      : [
          { label: "Type", value: pick(INV_TYPES, seed + 4) },
          { label: "Check Size", value: pick(CHECKS, seed + 6) },
          { label: "Focus", value: `${pick(SECTORS, seed + 9)}, ${pick(SECTORS, seed + 11)}` },
        ];

  const fields = [
    { label: kind === "startup" ? "Company Name" : "Fund Name", value: name, confidence: Math.min(99, confidence + 6) },
    { label: "Website", value: website, confidence: Math.min(99, confidence + 4) },
    { label: kind === "startup" ? "Industry / Sector" : "Sector Focus", value: pick(SECTORS, seed + 4), confidence },
    { label: kind === "startup" ? "Funding Stage" : "Investor Type", value: kind === "startup" ? pick(STAGES, seed + 6) : pick(INV_TYPES, seed + 4), confidence: Math.max(52, confidence - 12) },
    { label: "HQ", value: country, confidence: Math.max(48, confidence - 18) },
    { label: "Description", value: `${name} — AI-extracted summary pending human validation.`, confidence: Math.max(55, confidence - 9) },
  ];

  const issues: string[] = [];
  if (status === "duplicate_suspected") issues.push("Duplicate candidate: matching website domain");
  if (status === "conflict_detected") issues.push("Conflicting field: HQ differs between sources");
  if (status === "incomplete") issues.push("Missing field: founders / team");
  if (confidence < 70) issues.push("Low-confidence extraction — human validation required");

  return {
    draft_ref: `${kind}-draft-${index}`,
    entity_kind: kind,
    name,
    website,
    source,
    country,
    confidence,
    extracted_at: extracted,
    status,
    summary,
    fields,
    source_url: `https://${source.toLowerCase().replace(/\s+/g, "")}.com/${website}`,
    duplicate_of: status === "duplicate_suspected" ? `${name} (Control record)` : null,
    issues,
  };
}

/* ------------------------------ session store ---------------------------- */

const overrides = new Map<string, DraftReviewStatus>();
const deleted = new Set<string>();
const decidedToday = { approved: 1_842, rejected: 612 };
const listeners = new Set<() => void>();
let version = 0;

export function subscribeDrafts(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export function draftsVersion() {
  return version;
}
function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

export function decideDrafts(refs: string[], status: DraftReviewStatus) {
  refs.forEach((ref) => {
    const prev = overrides.get(ref);
    if (prev !== status) {
      if (status === "approved") decidedToday.approved += 1;
      if (status === "rejected") decidedToday.rejected += 1;
    }
    overrides.set(ref, status);
  });
  emit();
}

/** Removes drafts from the session review queue. */
export function deleteDrafts(refs: string[]) {
  refs.forEach((r) => deleted.add(r));
  emit();
}

export function isDraftDeleted(ref: string) {
  return deleted.has(ref);
}

function withOverride(d: DraftRecord): DraftRecord {
  const o = overrides.get(d.draft_ref);
  return o ? { ...d, status: o } : d;
}

export function getDraft(ref: string): DraftRecord | null {
  const [kind, , idx] = ref.split("-");
  const index = Number(idx);
  if ((kind !== "startup" && kind !== "investor") || Number.isNaN(index)) return null;
  if (deleted.has(ref)) return null;
  return withOverride(buildDraft(kind, index));
}

const bandOf = (c: number) => (c >= 90 ? "high" : c >= 70 ? "medium" : "low");

function matches(d: DraftRecord, p: DraftListParams) {
  if (p.q) {
    const t = p.q.toLowerCase();
    if (![d.name, d.website, d.source, d.country].some((v) => v.toLowerCase().includes(t))) return false;
  }
  if (p.source && d.source !== p.source) return false;
  if (p.status && p.status !== "all" && d.status !== p.status) return false;
  if (p.confidence && p.confidence !== "all" && bandOf(d.confidence) !== p.confidence) return false;
  if (p.extracted && p.extracted !== "any") {
    const days = p.extracted === "24h" ? 1 : p.extracted === "7d" ? 7 : 30;
    if (Date.now() - Date.parse(d.extracted_at) > days * 86_400_000) return false;
  }
  return true;
}

/** Bounded scan window — the full population is never scanned client-side. */
const SCAN_WINDOW = 3_000;

export function listDrafts(p: DraftListParams): PagedResult<DraftRecord> {
  const total = DRAFT_TOTALS[p.kind];
  const filtered = !!(
    p.q ||
    (p.source && p.source !== "") ||
    (p.status && p.status !== "all") ||
    (p.confidence && p.confidence !== "all") ||
    (p.extracted && p.extracted !== "any")
  );

  if (!filtered) {
    const from = (p.page - 1) * p.pageSize;
    const rows: DraftRecord[] = [];
    for (let i = from; i < Math.min(from + p.pageSize, total); i++) {
      const d = buildDraft(p.kind, i);
      if (deleted.has(d.draft_ref)) continue;
      rows.push(withOverride(d));
    }
    return { rows, total: total - deleted.size, page: p.page, pageSize: p.pageSize };
  }

  const hits: DraftRecord[] = [];
  const limit = Math.min(total, SCAN_WINDOW);
  for (let i = 0; i < limit; i++) {
    const d = withOverride(buildDraft(p.kind, i));
    if (deleted.has(d.draft_ref)) continue;
    if (matches(d, p)) hits.push(d);
  }
  const from = (p.page - 1) * p.pageSize;
  return {
    rows: hits.slice(from, from + p.pageSize),
    total: hits.length,
    page: p.page,
    pageSize: p.pageSize,
    approximate: true,
  };
}

export function draftSummary(kind: EntityKind): DraftSummary {
  const total = DRAFT_TOTALS[kind];
  return {
    pending: total,
    approvedToday: decidedToday.approved,
    rejectedToday: decidedToday.rejected,
    needsHumanReview: kind === "startup" ? 9_731 : 5_402,
  };
}

export const DRAFT_SOURCES = SOURCES;
