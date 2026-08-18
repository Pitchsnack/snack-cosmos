/**
 * Find Startups AI Agent — session-scoped run engine.
 *
 * BACKEND AI AGENT CONTRACT: MISSING. There is no approved backend contract for
 * AI agent runs, schedules, results, evidence or AI Drafts. This module runs the
 * approved Control UX against a deterministic in-memory engine so the operational
 * flow (background execution, step progress, pause/cancel/restart, duplicate
 * check, AI Draft approval) is fully exercisable.
 *
 * Rules enforced here (never relax without the backend contract):
 *  - AI Drafts are never official Global Startup records.
 *  - Approval always re-runs the duplicate check immediately before creation.
 *  - The duplicate workflow never deletes an existing official Global record.
 *  - No confidence scores are produced.
 */
import type {
  AgentCatalogueEntry,
  AgentNotification,
  AgentRun,
  AgentSchedule,
  AiDraft,
  DraftStatus,
  ExecutionMode,
  Frequency,
  SearchCriteria,
  StartupResult,
} from "./types";

export const AI_AGENT_DISCLAIMER =
  "AI Agent runs, schedules and AI Drafts are session-scoped only. Nothing is persisted and no Global Startup is created until Control approval against the live registry.";

export const AGENT_CATALOGUE: AgentCatalogueEntry[] = [
  {
    id: "startup_research",
    name: "Startup Research",
    description: "Research and enrich startup companies.",
    available: false,
  },
  {
    id: "investor_research",
    name: "Investor Research",
    description: "Research investors and VC firms.",
    available: false,
  },
  {
    id: "find_startups",
    name: "Find Startups",
    description: "Find startups that match your specific criteria.",
    available: true,
  },
  {
    id: "startup_investor_search",
    name: "Startup Investor Search",
    description: "Match startups with relevant investors.",
    available: false,
  },
  {
    id: "company_enrichment",
    name: "Company Enrichment",
    description: "Enrich existing startups with latest data.",
    available: false,
  },
];

export const INDUSTRY_OPTIONS = [
  "FinTech",
  "SaaS",
  "AI / Machine Learning",
  "InsurTech",
  "HealthTech",
  "ClimateTech",
  "AgriTech",
  "EdTech",
];
export const PRODUCT_TAG_OPTIONS = [
  "Payment Solutions",
  "Risk Management",
  "CRM",
  "Analytics",
  "Cybersecurity",
  "Lending",
  "Data Infrastructure",
];
export const MARKET_TAG_OPTIONS = [
  "Digital Banking",
  "SME Solutions",
  "Enterprise",
  "Consumer",
  "B2B",
  "Public Sector",
];
export const REGION_OPTIONS = [
  "Southeast Asia",
  "South Asia",
  "East Asia",
  "Europe",
  "North America",
];
export const COUNTRY_OPTIONS = [
  "Thailand",
  "Singapore",
  "Malaysia",
  "Indonesia",
  "Vietnam",
  "Philippines",
  "India",
  "United Kingdom",
  "United States",
];

export const SOURCE_POLICY = [
  "Preferred authoritative sources (official websites, investor portfolio pages)",
  "Broader public web fallback (news, public business registries)",
];

export const RUN_STEPS = [
  "Validate criteria",
  "Search sources",
  "Check duplicates",
  "Compile startup results",
  "Prepare AI Drafts",
];

/**
 * Stand-in for the official Global Startup registry used by the duplicate check.
 * Read-only: the duplicate workflow may never mutate or delete these records.
 */
const EXISTING_GLOBAL_STARTUPS = [
  "PayGrid",
  "RiskNova",
  "Lendwise",
  "NovaGrid",
  "Terrafy",
];

const FIRST = ["Pay", "Risk", "Lend", "Nova", "Terra", "Bank", "Loop", "Cred", "Fin", "Data", "Kite", "Halo"];
const SECOND = ["grid", "nova", "wise", "flow", "fy", "stack", "ward", "lytics", "peak", "sense"];
const CITIES: Record<string, string> = {
  Thailand: "Bangkok",
  Singapore: "Singapore",
  Malaysia: "Kuala Lumpur",
  Indonesia: "Jakarta",
  Vietnam: "Ho Chi Minh City",
  Philippines: "Manila",
  India: "Bengaluru",
  "United Kingdom": "London",
  "United States": "San Francisco",
};

function rand(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
const pick = <T,>(arr: T[], seed: number) => arr[Math.floor(rand(seed) * arr.length)]!;

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter += 1)}`;

function buildResult(runSeed: number, index: number, criteria: SearchCriteria): StartupResult {
  const seed = runSeed * 31 + index * 7;
  const name = `${pick(FIRST, seed)}${pick(SECOND, seed + 1)}`;
  const domain = `${name.toLowerCase()}.com`;
  const pool = criteria.countries.length ? criteria.countries : COUNTRY_OPTIONS;
  const country = pick(pool, seed + 2);
  const includeYear = rand(seed + 3) > 0.2;
  const includeCity = rand(seed + 4) > 0.25;

  const sources = [
    { label: "Official Website", url: `https://${domain}` },
    rand(seed + 5) > 0.5
      ? { label: "Investor Portfolio Page", url: `https://portfolio.example.com/${name.toLowerCase()}` }
      : { label: "News Article", url: `https://news.example.com/${name.toLowerCase()}` },
    { label: "Public Business Source", url: `https://registry.example.com/${name.toLowerCase()}` },
  ];

  const conflicts =
    rand(seed + 6) > 0.82 && includeYear
      ? [
          {
            field: "Year Founded",
            values: [
              { value: String(2018 + Math.floor(rand(seed + 7) * 4)), source: sources[0]! },
              { value: String(2015 + Math.floor(rand(seed + 8) * 3)), source: sources[2]! },
            ],
          },
        ]
      : [];

  const duplicate = EXISTING_GLOBAL_STARTUPS.find(
    (g) => g.toLowerCase() === name.toLowerCase(),
  );

  return {
    id: nextId("res"),
    name,
    website: `https://${domain}`,
    yearFounded: includeYear ? 2015 + Math.floor(rand(seed + 9) * 10) : undefined,
    country,
    city: includeCity ? CITIES[country] : undefined,
    sources,
    duplicateStatus: duplicate ? "possible" : "none",
    duplicateOf: duplicate,
    conflicts,
  };
}

interface State {
  runs: AgentRun[];
  drafts: AiDraft[];
  schedules: AgentSchedule[];
  notifications: AgentNotification[];
}

const state: State = { runs: [], drafts: [], schedules: [], notifications: [] };

let version = 0;
const listeners = new Set<() => void>();
function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

export function subscribeAgents(listener: () => void) {
  listeners.add(listener);
  ensureTicker();
  return () => {
    listeners.delete(listener);
  };
}
export function getAgentsVersion() {
  return version;
}
export function getRuns() {
  return state.runs;
}
export function getDrafts() {
  return state.drafts;
}
export function getSchedules() {
  return state.schedules;
}
export function getNotifications() {
  return state.notifications;
}
export function getRun(id: string) {
  return state.runs.find((r) => r.id === id);
}

function makeSteps() {
  return RUN_STEPS.map((label, i) => ({
    label,
    state: (i === 0 ? "active" : "pending") as "active" | "pending",
  }));
}

export function summariseCriteria(c: SearchCriteria) {
  const parts: string[] = [];
  if (c.industries.length) parts.push(`Industry: ${c.industries.join(", ")}`);
  if (c.productTags.length) parts.push(`Product: ${c.productTags.join(", ")}`);
  if (c.marketTags.length) parts.push(`Market: ${c.marketTags.join(", ")}`);
  const geo = [...c.regions, ...c.countries];
  if (geo.length) parts.push(`Region: ${geo.join(", ")}`);
  return parts.length ? parts : ["No criteria selected"];
}

export function startRun(criteria: SearchCriteria, scheduleLabel = "One-time run"): AgentRun {
  const run: AgentRun = {
    id: `RUN-${new Date().toISOString().slice(0, 10)}-${String(state.runs.length + 1).padStart(2, "0")}`,
    agentId: "find_startups",
    criteria,
    scheduleLabel,
    status: "running",
    progress: 0,
    steps: makeSteps(),
    startedAt: new Date().toISOString(),
    durationMs: 0,
    results: [],
    draftIds: [],
    followUps: [],
  };
  state.runs = [run, ...state.runs];
  emit();
  ensureTicker();
  return run;
}

export function pauseRun(id: string) {
  const run = getRun(id);
  if (run && run.status === "running") {
    run.status = "paused";
    emit();
  }
}
export function resumeRun(id: string) {
  const run = getRun(id);
  if (run && run.status === "paused") {
    run.status = "running";
    emit();
  }
}
export function cancelRun(id: string) {
  const run = getRun(id);
  if (run && (run.status === "running" || run.status === "paused")) {
    run.status = "cancelled";
    run.finishedAt = new Date().toISOString();
    emit();
  }
}

/** Restart always restarts from the beginning; history stays immutable. */
export function restartRun(id: string) {
  const run = getRun(id);
  if (!run) return;
  startRun(run.criteria, run.scheduleLabel);
}

export function addFollowUp(id: string, note: string) {
  const run = getRun(id);
  if (!run) return;
  run.followUps = [...run.followUps, { at: new Date().toISOString(), note }];
  emit();
}

export function markNotificationsRead() {
  state.notifications = state.notifications.map((n) => ({ ...n, read: true }));
  emit();
}

function completeRun(run: AgentRun) {
  const seed = run.startedAt.length + run.id.length;
  const failed = rand(seed + 41) > 0.92;
  const count = failed ? 0 : 4 + Math.floor(rand(seed + 13) * 5);
  const results = Array.from({ length: count }, (_, i) => buildResult(seed, i, run.criteria));
  run.results = results;
  run.status = failed ? "failed" : "completed";
  run.finishedAt = new Date().toISOString();
  run.steps = run.steps.map((s, i) =>
    failed && i >= 3 ? { ...s, state: "failed" } : { ...s, state: "done" },
  );
  run.progress = 100;

  if (!failed) {
    const drafts: AiDraft[] = results.map((r) => ({
      id: nextId("draft"),
      runId: run.id,
      result: r,
      status: "pending_review" as DraftStatus,
      createdAt: new Date().toISOString(),
    }));
    state.drafts = [...drafts, ...state.drafts];
    run.draftIds = drafts.map((d) => d.id);
  }

  state.notifications = [
    {
      id: nextId("ntf"),
      runId: run.id,
      message: failed
        ? `${run.id} failed. No results were saved.`
        : `${run.id} completed — ${results.length} startups found, ${results.length} AI Drafts ready for review.`,
      at: new Date().toISOString(),
      read: false,
    },
    ...state.notifications,
  ];
}

let ticker: ReturnType<typeof setInterval> | null = null;

/** Runs continue in the background even when the page is left. */
function ensureTicker() {
  if (ticker || typeof window === "undefined") return;
  ticker = setInterval(() => {
    let changed = false;
    for (const run of state.runs) {
      if (run.status !== "running") continue;
      changed = true;
      run.durationMs = Date.now() - new Date(run.startedAt).getTime();
      run.progress = Math.min(100, run.progress + 7 + Math.floor(Math.random() * 6));
      const stepIndex = Math.min(
        RUN_STEPS.length - 1,
        Math.floor((run.progress / 100) * RUN_STEPS.length),
      );
      run.steps = run.steps.map((s, i) => ({
        ...s,
        state: i < stepIndex ? "done" : i === stepIndex ? "active" : "pending",
      }));
      if (run.progress >= 100) completeRun(run);
    }
    if (changed) emit();
  }, 900);
}

// Schedules -----------------------------------------------------------------

export function createSchedule(input: {
  criteria: SearchCriteria;
  startDate: string;
  endDate: string;
  frequency: Frequency;
  execution: ExecutionMode;
}): AgentSchedule {
  const schedule: AgentSchedule = {
    id: nextId("sch"),
    agentId: "find_startups",
    createdAt: new Date().toISOString(),
    ...input,
  };
  state.schedules = [schedule, ...state.schedules];
  emit();
  return schedule;
}

export function deleteSchedule(id: string) {
  state.schedules = state.schedules.filter((s) => s.id !== id);
  emit();
}

export function frequencyLabel(f: Frequency) {
  return f.charAt(0).toUpperCase() + f.slice(1);
}

// Drafts --------------------------------------------------------------------

export function getDraft(id: string) {
  return state.drafts.find((d) => d.id === id);
}

/**
 * Mandatory final duplicate check, always re-run immediately before approval.
 * Never mutates or deletes the existing official Global Startup record.
 */
export function finalDuplicateCheck(draftId: string): { match?: string } {
  const draft = getDraft(draftId);
  if (!draft) return {};
  const name = draft.result.name.toLowerCase();
  const host = draft.result.website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? "";
  const match = EXISTING_GLOBAL_STARTUPS.find(
    (g) => g.toLowerCase() === name || host.startsWith(g.toLowerCase()),
  );
  return { match };
}


export function rejectDraft(id: string) {
  const draft = getDraft(id);
  if (!draft) return;
  draft.status = "rejected";
  state.drafts = [...state.drafts];
  emit();
}

/** Approves the AI Draft into an official Global Startup (session-scoped stand-in). */
export function approveDraft(id: string) {
  const draft = getDraft(id);
  if (!draft) return;
  draft.status = "approved";
  if (!EXISTING_GLOBAL_STARTUPS.includes(draft.result.name)) {
    EXISTING_GLOBAL_STARTUPS.push(draft.result.name);
  }
  state.drafts = [...state.drafts];
  emit();
}

export function existingGlobalStartups() {
  return [...EXISTING_GLOBAL_STARTUPS];
}
