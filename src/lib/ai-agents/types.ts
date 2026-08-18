/**
 * Find Startups AI Agent — client-safe types.
 *
 * BACKEND AI AGENT CONTRACT: MISSING. Runs, schedules, results and AI Drafts
 * modelled here are session-scoped only (see agent-runtime.ts).
 */

export type AgentId =
  | "startup_research"
  | "investor_research"
  | "find_startups"
  | "startup_investor_search"
  | "company_enrichment";

export interface AgentCatalogueEntry {
  id: AgentId;
  name: string;
  description: string;
  available: boolean;
}

export type RunStatus =
  | "draft"
  | "running"
  | "paused"
  | "waiting_for_user"
  | "completed"
  | "failed"
  | "cancelled";

export type StepState = "done" | "active" | "pending" | "failed";

export interface RunStep {
  label: string;
  state: StepState;
}

export interface SearchCriteria {
  industries: string[];
  productTags: string[];
  marketTags: string[];
  regions: string[];
  countries: string[];
}

export interface SourceEvidence {
  label: string;
  url: string;
}

export interface FieldConflict {
  field: string;
  values: { value: string; source: SourceEvidence }[];
}

export type DuplicateStatus = "none" | "possible";

export interface StartupResult {
  id: string;
  name: string;
  website: string;
  yearFounded?: number;
  country?: string;
  city?: string;
  sources: SourceEvidence[];
  duplicateStatus: DuplicateStatus;
  duplicateOf?: string;
  conflicts: FieldConflict[];
}

export type DraftStatus = "pending_review" | "approved" | "rejected";

export interface AiDraft {
  id: string;
  runId: string;
  result: StartupResult;
  status: DraftStatus;
  createdAt: string;
}

export interface AgentRun {
  id: string;
  agentId: AgentId;
  criteria: SearchCriteria;
  scheduleLabel: string;
  status: RunStatus;
  progress: number;
  steps: RunStep[];
  startedAt: string;
  finishedAt?: string;
  durationMs: number;
  results: StartupResult[];
  draftIds: string[];
  followUps: { at: string; note: string }[];
}

export type Frequency = "daily" | "weekly" | "monthly";
export type ExecutionMode = "auto" | "approval";

export interface AgentSchedule {
  id: string;
  agentId: AgentId;
  criteria: SearchCriteria;
  startDate: string;
  endDate: string;
  frequency: Frequency;
  execution: ExecutionMode;
  createdAt: string;
}

export interface AgentNotification {
  id: string;
  runId: string;
  message: string;
  at: string;
  read: boolean;
}
