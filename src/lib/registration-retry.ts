import { REG_CHANGES } from "@/lib/thai-reg";
import type { RegCompany } from "@/lib/signup-reg.functions";

export type HeldRegistration = {
  status?: unknown;
  reg?: unknown;
  company?: unknown;
  raw?: unknown;
};

export type CachedSignupRetry = {
  status: "found" | "not_found";
  reg: string;
  changes: number;
  company: RegCompany | null;
  raw: unknown;
};

/** Reuse a result already fetched in this sign-up; the retry still consumes one correction. */
export function cachedSignupRetry(held: HeldRegistration | null | undefined, requestedReg: string, changes: number): CachedSignupRetry | null {
  if (changes >= REG_CHANGES || !held || held.reg !== requestedReg) return null;
  if (held.status === "not_found") return { status: "not_found", reg: requestedReg, changes: changes + 1, company: null, raw: null };
  if (held.status !== "rejected" || !held.company || typeof held.company !== "object") return null;
  return { status: "found", reg: requestedReg, changes: changes + 1, company: held.company as RegCompany, raw: held.raw ?? null };
}

export type AddAttemptForRetry = { reg_no: string; result: string; held?: unknown };
export type AddCheckPlan =
  | { status: "limit"; why: "changes" }
  | { status: "lookup"; changesLeft: number }
  | { status: "cached_not_found"; changesLeft: number }
  | { status: "cached_found"; changesLeft: number; company: RegCompany; held: { company: RegCompany; raw: unknown } };

/**
 * Plans one + Add check from its own attempt history. Repeated numbers use the held result and
 * still consume a correction; only an uncached number reaches the external lookup.
 */
export function planAddCheck(attempts: AddAttemptForRetry[], reg: string): AddCheckPlan {
  if (attempts.length >= 1 + REG_CHANGES) return { status: "limit", why: "changes" };
  const changesLeft = Math.max(0, 1 + REG_CHANGES - (attempts.length + 1));
  const previous = [...attempts].reverse().find((a) => a.reg_no === reg && (a.result === "no" || a.result === "not_found"));
  if (previous?.result === "not_found") return { status: "cached_not_found", changesLeft };
  const held = previous?.held && typeof previous.held === "object" ? previous.held as { company?: unknown; raw?: unknown } : null;
  if (previous?.result === "no" && held?.company && typeof held.company === "object") {
    const company = held.company as RegCompany;
    return { status: "cached_found", changesLeft, company, held: { company, raw: held.raw ?? null } };
  }
  return { status: "lookup", changesLeft };
}
