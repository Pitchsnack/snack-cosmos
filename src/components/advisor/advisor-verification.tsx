import { AlertCircle, Check, CircleDashed, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminFirm } from "@/lib/advisor-admin.functions";

/** Verification chip, status pill and box shared by Advisors Directory and Approvals › Advisors. */

export type VState = AdminFirm["v"]["state"];
const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

/** Business days since a date (0 = today). */
export function businessDays(d?: string | null) {
  if (!d) return 0;
  let n = 0;
  const c = new Date(d); c.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(0, 0, 0, 0);
  while (c < end) { c.setDate(c.getDate() + 1); const w = c.getDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}
export const waitWords = (d?: string | null) => { const n = businessDays(d); return n === 0 ? "today" : `waiting ${n} day${n === 1 ? "" : "s"}`; };

const CHIP: Record<string, [typeof Check, string, string]> = {
  unverified: [CircleDashed, "Not verified yet", "text-[#4B5563] bg-[#F3F4F6] border-[#E5E7EB]"],
  first_check: [Clock, "Pending verification", "text-[#1D4ED8] bg-[#EFF6FF] border-[#BFDBFE]"],
  re_check: [Clock, "Pending re-check", "text-[#1D4ED8] bg-[#EFF6FF] border-[#BFDBFE]"],
  verified: [Check, "Verified advisor", "text-[#15803D] bg-[#ECFDF3] border-[#BBF7D0]"],
  more_info: [AlertCircle, "More info needed", "text-[#8A5A06] bg-[#FFF4E0] border-[#F3D9A6]"],
  declined: [X, "Declined", "text-[#B91C1C] bg-[#FEF2F2] border-[#FECACA]"],
};
export const chipKey = (v: Pick<AdminFirm["v"], "state" | "reason">) => (v.state === "pending" ? v.reason ?? "first_check" : v.state);

export function VerificationChip({ v }: { v: Pick<AdminFirm["v"], "state" | "reason"> }) {
  const [I, text, cls] = CHIP[chipKey(v)]!;
  return (
    <span className={cn("inline-flex h-[22px] items-center gap-[5px] whitespace-nowrap rounded-full border px-2 text-[11px] font-semibold", cls)}>
      <I className="h-3 w-3" strokeWidth={2.4} />{text}
    </span>
  );
}

export function FirmStatusPill({ status }: { status: string }) {
  const cls = status === "live" ? "text-[#166534] bg-[#E8F6EE]" : status === "paused" ? "text-[#4B5563] bg-[#F3F4F6]" : "text-[#92400E] bg-[#FEF3C7]";
  return <span className={cn("inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold", cls)}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status === "live" ? "Live" : status === "paused" ? "Paused" : "Draft"}</span>;
}

const list = (a: string[]) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);

/** One sentence describing what changed since the last Verify. */
export function recheckSentence(f: AdminFirm) {
  const snap = f.v.snapshot ?? {};
  const parts: string[] = [];
  if ((snap.legal_name ?? null) !== (f.legalName ?? null)) parts.push("changed its legal name");
  if ((snap.registration_no ?? null) !== (f.registrationNo ?? null)) parts.push("changed its registration number");
  const sc = new Map<string, any>((snap.credentials ?? []).map((c: any) => [c.id, c]));
  const sd = new Map<string, any>((snap.documents ?? []).map((d: any) => [d.id, d]));
  const addC = f.credentials.filter((c) => !sc.has(c.id)).length, chC = f.credentials.filter((c) => sc.has(c.id) && (sc.get(c.id).name !== c.name || (sc.get(c.id).note ?? null) !== (c.note ?? null))).length;
  const rmC = [...sc.keys()].filter((id) => !f.credentials.some((c) => c.id === id)).length;
  const addD = f.documents.filter((d) => !sd.has(d.id)).length, rmD = [...sd.keys()].filter((id) => !f.documents.some((d) => d.id === id)).length;
  const added = [addC && (addC === 1 ? "a licence" : `${addC} licences`), addD && (addD === 1 ? "a document" : `${addD} documents`)].filter(Boolean) as string[];
  if (added.length) parts.push(`added ${list(added)}`);
  if (chC) parts.push(chC === 1 ? "changed a licence" : `changed ${chC} licences`);
  const rem = [rmC && (rmC === 1 ? "a licence" : `${rmC} licences`), rmD && (rmD === 1 ? "a document" : `${rmD} documents`)].filter(Boolean) as string[];
  if (rem.length) parts.push(`removed ${list(rem)}`);
  return parts.length ? `The firm ${list(parts)}.` : "The firm changed its details.";
}

const BOX: Record<string, string> = {
  unverified: "bg-[#F9FAFB] border-[#E5E7EB] text-[#374151]",
  first_check: "bg-[#EFF6FF] border-[#BFDBFE] text-[#1E3A8A]",
  re_check: "bg-[#F5F3FF] border-[#DDD6FE] text-[#4C1D95]",
  verified: "bg-[#F3FCF6] border-[#BBF7D0] text-[#14532D]",
  more_info: "bg-[#FFF4E0] border-[#F3D9A6] text-[#5A3A07]",
  declined: "bg-[#FEF2F2] border-[#FECACA] text-[#7F1D1D]",
};

export function VerificationBox({ f }: { f: AdminFirm }) {
  const k = chipKey(f.v);
  const [I] = CHIP[k]!;
  const by = (n: string | null) => (n ? `, by ${n}` : "");
  const pendingCreds = f.credentials.filter((c) => c.status === "pending").map((c) => c.name);
  let body: React.ReactNode;
  if (k === "unverified") body = <><b>Not verified yet.</b> {f.setupDone ? "The firm saved its setup." : `The firm hasn't saved its setup (${f.answered} of 11 answered).`} It joins Approvals › Advisors when it does, or when you use ⋮ › Send to verification.</>;
  else if (k === "first_check") body = <><b>Pending verification since {day(f.v.requestedAt)}</b> (first check, {waitWords(f.v.requestedAt)}). {f.status === "live" ? "It's already Live: verification doesn't hold back publishing." : f.status === "paused" ? "It stays unpublished until the firm publishes it again." : "It's still a Draft."}</>;
  else if (k === "re_check") body = <><b>Re-check since {day(f.v.requestedAt)}.</b> {recheckSentence(f)} It keeps its Verified advisor badge while it waits (verified {day(f.v.verifiedAt)}{f.v.verifiedBy ? ` by ${f.v.verifiedBy}` : ""}).</>;
  else if (k === "verified") body = <><b>Verified by PitchSnack on {day(f.v.verifiedAt)}</b>{by(f.v.verifiedBy)}.{pendingCreds.length > 0 && <> {list(pendingCreds)} {pendingCreds.length === 1 ? "is" : "are"} still waiting for a check.</>}</>;
  else if (k === "more_info") body = <><b>More info needed since {day(f.v.moreInfoAt)}.</b> {f.v.moreInfoBy ?? "Admin"} asked: “{f.v.moreInfoNote}” Fields to fix: {f.v.moreInfoFields.join(", ")}. When the firm saves any of them, it comes back to Approvals for a check.{f.v.verifiedAt && " It keeps its Verified advisor badge meanwhile."}</>;
  else body = <><b>Declined on {day(f.v.declinedAt)}</b>{f.v.declinedBy ? ` by ${f.v.declinedBy}` : ""}{f.v.declineReason && f.v.declineReason !== "Another reason" ? `: ${f.v.declineReason.charAt(0).toLowerCase()}${f.v.declineReason.slice(1)}` : ""}.{f.v.declineNote && <> “{f.v.declineNote}”</>} The firm is unpublished. Use ⋮ › Reopen verification to check it again.</>;
  return (
    <div className={cn("flex gap-2.5 rounded-[12px] border px-3.5 py-3 text-[13px] leading-relaxed", BOX[k])}>
      <I className="mt-0.5 h-4 w-4 shrink-0" /><div>{body}</div>
    </div>
  );
}

/** What the firm sees on My Company while more info is asked, or after a decline. */
export function FirmNotice({ state, note, fields, reason }: { state: "more_info" | "declined"; note: string | null; fields: string[]; reason?: string | null }) {
  if (state === "more_info") return (
    <div className={cn("rounded-[12px] border px-3.5 py-3 text-[13px] leading-relaxed", BOX.more_info)}>
      <b>PitchSnack needs more information to verify your firm.</b>
      {note && <p className="mt-1">{note}</p>}
      <p className="mt-1">Fix: {fields.length ? fields.join(", ") : "—"}. Saving them sends your firm back for a check.</p>
    </div>
  );
  return (
    <div className={cn("rounded-[12px] border px-3.5 py-3 text-[13px] leading-relaxed", BOX.declined)}>
      <b>{reason && reason !== "Another reason" ? `PitchSnack couldn't verify your firm: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}.` : "PitchSnack couldn't verify your firm."}</b>
      {note && <p className="mt-1">{note}</p>}
      <p className="mt-1">Your firm is unpublished. Write to support@pitchsnack.com if you think this is a mistake.</p>
    </div>
  );
}

/** Licence / document marks. */
export function CredMark({ status }: { status: "pending" | "verified" | "rejected" }) {
  if (status === "verified") return <span className="text-[12px] font-semibold text-[#15803D]">✓ Verified</span>;
  if (status === "rejected") return <span className="inline-flex h-5 items-center rounded-full border border-[#FECACA] bg-[#FEF2F2] px-2 text-[11px] font-semibold text-[#B91C1C]">Can't verify</span>;
  return <span className="text-[12px] text-[#6B7280]">Pending check</span>;
}
export function DocMark({ checked }: { checked: boolean }) {
  return checked ? <span className="text-[12px] font-semibold text-[#15803D]">✓ Checked</span>
    : <span className="inline-flex h-5 items-center rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-2 text-[11px] font-semibold text-[#6B7280]">Not checked yet</span>;
}
