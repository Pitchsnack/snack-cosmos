import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, Eye, Lock, UserCheck, UserPlus, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { useDebounced } from "@/hooks/use-debounced";
import {
  ownershipList, ownershipCounts, ownershipDetail, checkInviteEmail, sendProfileInvite, cancelProfileInvite,
  startManaging, stopManaging, publishManaged, handoverReview, type OwnershipRow,
} from "@/lib/profile-handover.functions";
import { KIND_WORD, PARTS, RELATIONS, DEFAULT_TEAM, relationLabel, type HandoverKind, type RunBy } from "@/lib/handover-parts";
import "@/styles/handover.css";

/* --------------------------------- data ---------------------------------- */

/** Admin directories: ownership per id. Empty for anyone who isn't a Control Admin. */
export function useOwnershipMap(kind: HandoverKind, ids: string[], enabled = true) {
  const fn = useServerFn(ownershipList);
  const list = useMemo(() => [...new Set(ids)].sort(), [ids.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = useQuery({
    queryKey: ["ownership", kind, list],
    queryFn: () => fn({ data: { kind, ids: list } }),
    enabled: enabled && list.length > 0, staleTime: 30_000, retry: false,
  });
  return useMemo(() => new Map<string, OwnershipRow>((q.data ?? []).map((r) => [r.id, r])), [q.data]);
}

export function useOwnershipCounts(kind: HandoverKind, enabled = true) {
  const fn = useServerFn(ownershipCounts);
  return useQuery({ queryKey: ["ownership-counts", kind], queryFn: () => fn({ data: { kind } }), enabled, staleTime: 30_000, retry: false }).data;
}

export type RunByFilter = "all" | "owner" | "pitchsnack" | "none";
export const RUN_BY_OPTIONS: { value: RunByFilter; label: string }[] = [
  { value: "all", label: "All" }, { value: "owner", label: "The owner" },
  { value: "pitchsnack", label: "Managed by PitchSnack" }, { value: "none", label: "Not handed over yet" },
];
export const runByMatches = (f: RunByFilter, r: OwnershipRow | undefined) => f === "all" || (r?.runBy ?? "none") === f;

export function HeaderCounts({ kind, enabled = true }: { kind: HandoverKind; enabled?: boolean }) {
  const c = useOwnershipCounts(kind, enabled);
  if (!c) return null;
  return <span>{c.total} {KIND_WORD[kind].plural} · {c.prepared} prepared for clients · {c.managed} managed by PitchSnack</span>;
}

export function RunBySelect({ value, onChange }: { value: RunByFilter; onChange: (v: RunByFilter) => void }) {
  return (
    <label className="ho-runby">
      <span>Run by</span>
      <select value={value} onChange={(e) => onChange(e.target.value as RunByFilter)} aria-label="Run by">
        {RUN_BY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/* --------------------------------- badge --------------------------------- */

export function HatIcon({ width = 16, fill = "#010101" }: { width?: number; fill?: string }) {
  return (
    <svg viewBox="65.1 6.6 40.54 29.93" width={width} height={Math.round(width * 0.74)} aria-hidden="true" fill={fill}>
      <path d="M85.89,6.78c-2.59.6-4.42,1.58-6.45,3.4-.62.56-3.29,3.89-3.44,4.31-.03.08.76.56,1.74,1.09,1.91.98,8.8,4.52,13.59,6.98,1.58.81,3.77,1.94,4.87,2.5,1.45.76,2.02,1,2.09.86.37-.6,1.15-2.37,1.49-3.39.75-2.23.64-4.93-.25-6.78-.54-1.09-.96-1.31-2.5-1.31-2.41-.01-3.64-.35-4.11-1.14-.13-.22-.31-.96-.43-1.62-.48-3-.69-3.64-1.37-4.32-.35-.35-.67-.52-1.15-.63-.89-.18-3.17-.16-4.07.05Z" />
      <path d="M65.84,10.46c-.42.22-.82,1.4-.72,2.07.42,2.59,6.22,8.09,13.9,13.22,4.31,2.88,10.09,6.11,13.68,7.67.54.24,1.3.56,1.68.73,1.41.64,4.38,1.64,6.05,2.03.62.14,1.61.3,2.23.34,1.3.09,1.88-.13,2.59-.94.64-.72.5-1.4-.43-2.19-.79-.65-3.46-1.68-6.41-2.46-2.07-.54-2.03-.52-2.03-.65,0-.07.18-.51.39-.98.22-.47.39-.92.39-.98,0-.05-.79-.51-1.73-1-.96-.48-2.45-1.24-3.31-1.69-.86-.45-2.87-1.48-4.45-2.29-1.58-.81-3.59-1.85-4.45-2.29-6.29-3.26-8.34-4.35-8.87-4.47-.21-.05-1.46-1.25-2.33-2.21-2.51-2.77-4.35-4.44-5.48-4.96-.76-.35-1.03-.38-1.53-.1Z" />
    </svg>
  );
}

const BADGE: Record<RunBy, string> = { pitchsnack: "Managed by", owner: "Owner", none: "Not assigned" };

export function OwnershipBadge({ runBy, onClick }: { runBy: RunBy | undefined; onClick?: () => void }) {
  if (!runBy) return null;
  const inner = (
    <>
      {runBy === "pitchsnack" ? null : <span className="ho-dot" style={{ background: runBy === "owner" ? "#16A34A" : "#9CA3AF" }} />}
      <span>{BADGE[runBy]}</span>
      {runBy === "pitchsnack" && <HatIcon />}
    </>
  );
  if (!onClick) return <span className="ho-badge" data-run-by={runBy}>{inner}</span>;
  return (
    <button type="button" className="ho-badge ho-badge-btn" title="Ownership" aria-label={`Ownership: ${BADGE[runBy]}`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}>{inner}</button>
  );
}

/** Chips that stay next to the badge (brief 3.1 KEEP). */
export function OwnershipChips({ row }: { row: OwnershipRow | undefined }) {
  if (!row) return null;
  return (
    <>
      {row.runBy === "none" && <span className="ho-chip ho-chip-blue">Prepared by PitchSnack</span>}
      {row.invited && <span className="ho-chip ho-chip-blue">Invited</span>}
    </>
  );
}

export const menuStatus = (r: OwnershipRow | undefined) =>
  !r ? "" : r.runBy === "owner" ? "Owner" : r.runBy === "pitchsnack" ? "Managed" : r.invited ? "Invited" : "Not assigned";

/* -------------------------------- dialogs -------------------------------- */

type Step = "ownership" | "invite" | "manage";

function Shell({ open, onClose, title, sub, children, footer }: {
  open: boolean; onClose: () => void; title: string; sub?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ho-backdrop" />
        <DialogPrimitive.Content className="ho-dialog" aria-describedby={undefined}>
          <div className="ho-head">
            <span className="ho-dlg-ico"><UserCheck size={20} /></span>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="ho-title">{title}</DialogPrimitive.Title>
              {sub && <div className="ho-sub">{sub}</div>}
            </div>
            <DialogPrimitive.Close className="ho-x" title="Close" aria-label="Close"><X size={18} /></DialogPrimitive.Close>
          </div>
          <div className="ho-body">{children}</div>
          {footer && <div className="ho-foot">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }) : "—";
const fmtTime = (d: string) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]!.toUpperCase()).join("") || "PS";
const TEAM_DOES = {
  startup: ["edits, publishing, NDA approvals and buyer messages", "Approves NDA requests and answers buyers", "approve NDA requests and answer buyers' messages"],
  investor: ["edits, publishing, NDA requests and seller messages", "Sends NDA requests and answers sellers", "send NDA requests and answer sellers' messages"],
  firm: ["edits, publishing, and seller and buyer messages", "Answers sellers and buyers", "answer sellers' and buyers' messages"],
} as const;
const WHO = { startup: "Who the seller is", investor: "Who the buyer is", firm: "The owner's job title" } as const;
const relationHint = (kind: HandoverKind, v: string | null | undefined) =>
  kind === "firm" || !v ? null : RELATIONS[kind].find((r) => r.value === v)?.hint ?? null;

/** Grey note at the bottom of the pop-up (reference look). */
function AdminNote({ managed }: { managed: boolean }) {
  return (
    <div className="ho-note">
      {managed ? <Lock size={16} /> : <Eye size={16} />}
      <span>{managed ? <b>Only Admin sees this box.</b> : <><b>Only Admin sees this.</b> Sellers and buyers see the profile like any other.</>}</span>
    </div>
  );
}

/** ⋮ › Ownership and the badge button open this. */
export function OwnershipDialog({ kind, id, open, onClose }: { kind: HandoverKind; id: string; open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>("ownership");
  const [prefill, setPrefill] = useState<Partial<InviteForm> | null>(null);
  useEffect(() => { if (open) { setStep("ownership"); setPrefill(null); } }, [open]);
  const fn = useServerFn(ownershipDetail);
  const q = useQuery({ queryKey: ["ownership-detail", kind, id], queryFn: () => fn({ data: { kind, id } }), enabled: open });
  const d = q.data;
  const close = () => onClose();
  if (!open) return null;
  if (step === "invite") return <InviteDialog kind={kind} id={id} name={d?.head.name ?? ""} managed={d?.head.runBy === "pitchsnack"} prefill={prefill} onBack={() => setStep("ownership")} onClose={close} onSent={() => setStep("ownership")} />;
  if (step === "manage") return <ManageDialog kind={kind} id={id} name={d?.head.name ?? ""} current={d?.managed ?? null} onBack={() => setStep("ownership")} onClose={close} onDone={() => setStep("ownership")} />;
  return (
    <Shell open onClose={close} title="Ownership" sub={d ? `${d.head.name} · ${d.head.ref}` : "Loading…"}>
      {!d ? <div className="ho-muted">Loading…</div> : (
        <OwnershipBody kind={kind} id={id} d={d}
          onInvite={(p) => { setPrefill(p ?? null); setStep("invite"); }} onManage={() => setStep("manage")} />
      )}
    </Shell>
  );
}

type Detail = Awaited<ReturnType<typeof ownershipDetail>>;

function OwnershipBody({ kind, id, d, onInvite, onManage }: { kind: HandoverKind; id: string; d: Detail; onInvite: (p?: Partial<InviteForm>) => void; onManage: () => void }) {
  const qc = useQueryClient();
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["ownership-detail", kind, id] }); void qc.invalidateQueries({ queryKey: ["ownership"] }); void qc.invalidateQueries({ queryKey: ["ownership-counts"] }); };
  const cancel = useServerFn(cancelProfileInvite);
  const stop = useServerFn(stopManaging);
  const publish = useServerFn(publishManaged);
  const resend = useServerFn(sendProfileInvite);
  const m = useMutation({ mutationFn: (f: () => Promise<unknown>) => f(), onSuccess: refresh, onError: (e: Error) => toast.error(e.message) });
  const inv = d.invitation;
  const W = KIND_WORD[kind];
  const rel = relationLabel(kind, d.head.ownerRelation ?? inv?.owner_relation);
  const who = (
    <div className="ho-who">
      <div className="ho-who-r">
        <span className="ho-label ho-label-grey">{WHO[kind]}</span>
        <span className="ho-who-v">{rel ?? <span className="ho-muted">Not set yet</span>}</span>
      </div>
      <p>{relationHint(kind, d.head.ownerRelation ?? inv?.owner_relation) ? `“${relationHint(kind, d.head.ownerRelation ?? inv?.owner_relation)}” · ` : ""}set in the invitation; the owner can change it</p>
    </div>
  );
  const fromInv = inv ? { firstName: inv.first_name, lastName: inv.last_name, email: inv.email, relation: inv.owner_relation ?? "", language: inv.language as "th" | "en", sentBy: inv.sent_by } : undefined;

  // Owner
  if (d.head.runBy === "owner" && (!inv || inv.submitted_at || !inv.accepted_at)) {
    const o = d.owner;
    const nm = o ? [o.first_name, o.last_name].filter(Boolean).join(" ") || o.email : "Owner";
    return (
      <>
        <div className="ho-label">Handover to the owner · done</div>
        {inv?.submitted_at && <Steps d={d} />}
        <div className="ho-person">
          <span className="ho-ini">{initials(nm)}</span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{nm}</div>
            <div className="ho-muted">Owner since {fmtDate(inv?.accepted_at ?? o?.created_at)} · {o?.email ? `${o.email} · ` : ""}{rel ?? "—"}</div>
          </div>
          {o && <Link to="/users" search={{ selected: o.id } as never} className="ho-btn">Open in Users ↗</Link>}
        </div>
        <div className="ho-hr" />
        {who}
        <AdminNote managed={false} />
      </>
    );
  }

  // Handover in progress (invited / expired / accepted)
  if (inv && (!inv.accepted_at || !inv.submitted_at)) {
    const accepted = !!inv.accepted_at;
    return (
      <>
        <div className="ho-label">Handover to the owner</div>
        <Steps d={d} />
        {accepted ? (
          <>
            <div className="ho-person">
              <span className="ho-ini">{initials(`${inv.first_name} ${inv.last_name}`)}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{inv.first_name} {inv.last_name}</div>
                <div className="ho-muted">Owner since {fmtDate(inv.accepted_at)} · {inv.email} · {rel ?? "—"}</div>
              </div>
              {d.owner && <Link to="/users" search={{ selected: d.owner.id } as never} className="ho-btn">Open in Users ↗</Link>}
            </div>
            <p className="ho-p">The owner is checking the profile. It comes to Approvals when they submit it.</p>
          </>
        ) : inv.expired ? (
          <>
            <p className="ho-p">The invitation expired on {fmtDate(inv.expires_at)}. {inv.first_name} {inv.last_name} ({inv.email}) didn't accept it within 7 days, so the link no longer works.</p>
            <div className="ho-btns">
              <button className="ho-btn" disabled={m.isPending} onClick={() => fromInv && m.mutate(() => resend({ data: { kind, id, ...fromInv, note: inv.note ?? undefined } }).then(() => toast.success(`Invitation sent to ${inv.email}.`)))}>Send a new invitation</button>
              <button className="ho-btn" onClick={() => onInvite(fromInv)}>Change email</button>
            </div>
          </>
        ) : (
          <>
            <div className="ho-person">
              <span className="ho-ini">{initials(`${inv.first_name} ${inv.last_name}`)}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{inv.first_name} {inv.last_name} <span className="ho-tag">Invited · {inv.hasAccount ? "signs in to accept" : "not signed up yet"}</span></div>
                <div className="ho-muted">{inv.email}</div>
              </div>
            </div>
            <p className="ho-p ho-muted" style={{ fontSize: 13 }}>Sent on {fmtDate(inv.sent_at)} by {inv.createdByName ?? "Admin"}, sent by {inv.sent_by} · email in {inv.language === "th" ? "Thai" : "English"} · the link works once and expires on {fmtDate(inv.expires_at)}. During the soft launch it also lets them past the access page.{d.head.runBy === "pitchsnack" ? " PitchSnack keeps managing it until they accept." : ""}</p>
            <div className="ho-btns">
              <button className="ho-btn" disabled={m.isPending} onClick={() => fromInv && m.mutate(() => resend({ data: { kind, id, ...fromInv, note: inv.note ?? undefined } }).then(() => toast.success(`Invitation sent to ${inv.email}.`)))}>Resend</button>
              <button className="ho-btn" onClick={() => onInvite(fromInv)}>Change email</button>
              <button className="ho-btn ho-btn-danger" disabled={m.isPending} onClick={() => m.mutate(() => cancel({ data: { kind, id } }).then(() => toast.success("Invitation cancelled.")))}>Cancel invitation</button>
            </div>
          </>
        )}
        <div className="ho-hr" />
        {who}
        <AdminNote managed={false} />
      </>
    );
  }

  // Managed
  if (d.head.runBy === "pitchsnack") {
    const c = d.managed;
    const noDetails = !c || (!c.first_name.trim() && !c.last_name.trim() && !c.email && !c.phone);
    const cn2 = noDetails ? "Client not added yet" : `${c!.first_name} ${c!.last_name}`;
    const team = c?.managed_by ?? DEFAULT_TEAM;
    const live = d.head.status === "live";
    const agreed = !!c?.agreed_in_writing;
    const clientRel = relationLabel(kind, c?.owner_relation);
    return (
      <>
        <div className="ho-label ho-label-mg">Managed by PitchSnack</div>
        <div className="ho-person">
          <span className="ho-ini">{initials(noDetails ? "CN" : cn2)}</span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{cn2} <span className="ho-tag">Client · doesn't sign in</span></div>
            <div className="ho-muted">{noDetails ? "Add the client's name and email or phone." : [c?.email, c?.phone, clientRel].filter(Boolean).join(" · ") || "No contact details yet"}</div>
          </div>
          <button className={cn("ho-btn", noDetails && "ho-btn-navy")} onClick={onManage}>Edit details</button>
        </div>
        <div className="ho-person">
          <span className="ho-ini ho-ini-navy">{initials(team)}</span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{team} <span className="ho-tag ho-tag-navy"><HatIcon width={14} fill="#fff" /> Runs it for PitchSnack</span></div>
            <div className="ho-muted" style={agreed ? undefined : { color: "#B45309" }}>Since {fmtDate(c?.since ?? d.head.preparedAt)} · {agreed ? "the client agreed in writing" : "written agreement not confirmed yet"}</div>
          </div>
        </div>
        <ul className="ho-ticks">
          <li><Check size={14} /> Edits the profile in Admin, as today.</li>
          <li><Check size={14} /> Publishes it to {W.place}, and keeps it up to date.</li>
          <li><Check size={14} /> {TEAM_DOES[kind][1]}. Nothing goes to the client's inbox.</li>
        </ul>
        {live ? (
          <>
            <p className="ho-p">Live in {W.place} since {fmtDate(d.head.liveSince)}.</p>
            {d.stats && (
              <div className="ho-figs">
                {kind === "startup" && <><div><b>{d.stats.a}</b><span>NDA requests approved</span></div><div><b>{d.stats.b}</b><span>Profile views</span></div></>}
                {kind === "investor" && <><div><b>{d.stats.a}</b><span>NDA requests sent</span></div><div><b>{d.stats.b}</b><span>Messages from sellers</span></div></>}
                {kind === "firm" && <><div><b>{d.stats.a}</b><span>Profile views this week</span></div><div><b>{d.stats.b}</b><span>Messages</span></div></>}
              </div>
            )}
            <div className="ho-btns"><button className="ho-btn" onClick={() => onInvite(c ? { firstName: c.first_name, lastName: c.last_name, email: c.email ?? "", relation: c.owner_relation ?? "" } : undefined)}>Invite the client to take over</button></div>
          </>
        ) : (
          <>
            <p className="ho-p">Draft · nobody outside PitchSnack sees it until the team publishes it.</p>
            <div className="ho-btns">
              <button className="ho-btn ho-btn-navy" disabled={m.isPending} onClick={() => m.mutate(() => publish({ data: { kind, id } }).then(() => toast.success(`Published to ${W.place}.`)))}>Publish to {W.place}</button>
              <button className="ho-btn" onClick={() => onInvite(c ? { firstName: c.first_name, lastName: c.last_name, email: c.email ?? "", relation: c.owner_relation ?? "" } : undefined)}>Invite the client to take over</button>
              <button className="ho-btn ho-btn-danger" disabled={m.isPending} onClick={() => m.mutate(() => stop({ data: { kind, id } }).then(() => toast.success("PitchSnack no longer manages it.")))}>Stop managing</button>
            </div>
          </>
        )}
        <div className="ho-hr" />
        <div className="ho-who">
          <div className="ho-who-r">
            <span className="ho-label ho-label-grey">{kind === "firm" ? "The client's job title" : "Who the client is"}</span>
            <span className="ho-who-v">{clientRel ?? <span className="ho-muted" style={{ fontSize: 13, fontWeight: 400 }}>Not set yet · add it in Edit details</span>}</span>
          </div>
          {clientRel && <p>{relationHint(kind, c?.owner_relation) ? `“${relationHint(kind, c?.owner_relation)}” · ` : ""}set when PitchSnack took it on</p>}
        </div>
        <AdminNote managed />
      </>
    );
  }

  // Not assigned
  const parts = PARTS[kind];
  const views = [...new Set(parts.map((p) => p.view))];
  return (
    <>
      <div className="ho-label">Transfer of ownership</div>
      <div className="ho-options">
        <div className="ho-option" onClick={() => onInvite()}>
          <div className="ho-opt-title"><span className="ho-opt-tile"><UserPlus size={18} /></span> Invite the owner</div>
          <p>The transferee receives an email, accepts the invitation, reviews the profile, and manages it from their own account.</p>
          <button className="ho-btn" onClick={(e) => { e.stopPropagation(); onInvite(); }}><UserPlus size={16} /> Invite owner</button>
        </div>
        <div className="ho-option mg" onClick={onManage}>
          <div className="ho-opt-title"><span className="ho-hat-tile"><HatIcon width={20} fill="#fff" /></span> Managed by PitchSnack</div>
          <p>PitchSnack manages the profile on the client's behalf, including {TEAM_DOES[kind][0]}. The account can be transferred to the client later.</p>
          <button className="ho-btn" onClick={(e) => { e.stopPropagation(); onManage(); }}><HatIcon width={18} /> Manage for the client</button>
        </div>
      </div>
      <p className="ho-p"><b>No owner yet.</b> Prepared by {d.preparedByName ?? "PitchSnack"} on {fmtDate(d.head.preparedAt ?? d.head.createdAt)}. Only Admin can see it.</p>
      {views.map((v) => (
        <div key={v} className="ho-partrow">
          <span className={cn("ho-vl", v === "public" ? "ho-vl-pub" : "ho-vl-priv")}>{v === "public" ? "Public view" : v === "private" ? "Private view" : "Open to sellers and buyers"}</span>
          <div className="ho-chips">{parts.filter((p) => p.view === v).map((p) => <span key={p.key} className="ho-partchip">✓ {p.en}</span>)}</div>
        </div>
      ))}
      {who}
      <AdminNote managed={false} />
    </>
  );
}

function Steps({ d }: { d: Detail }) {
  const inv = d.invitation;
  const items: { label: string; date: string; done: boolean }[] = [
    { label: "Prepared", date: fmtDate(d.head.preparedAt ?? d.head.createdAt), done: true },
    { label: "Invited", date: inv ? fmtDate(inv.sent_at) : "Not yet", done: !!inv },
    inv?.expired && !inv.accepted_at
      ? { label: "Invite expired", date: fmtDate(inv.expires_at), done: false }
      : { label: "Accepted", date: inv?.accepted_at ? fmtDate(inv.accepted_at) : "Not yet", done: !!inv?.accepted_at },
    { label: "Submitted", date: inv?.submitted_at ? fmtDate(inv.submitted_at) : "Not yet", done: !!inv?.submitted_at },
  ];
  return (
    <ol className="ho-steps">
      {items.map((s, k) => (
        <li key={k} className={cn("ho-st", s.done && "done")}>
          <i>{s.done ? "✓" : k + 1}</i>
          <span>{s.label}<small>{s.date}</small></span>
        </li>
      ))}
    </ol>
  );
}

/* ----------------------------- invite dialog ----------------------------- */

type InviteForm = { firstName: string; lastName: string; email: string; relation: string; language: "th" | "en"; sentBy: string; note: string };

function RelationPicker({ kind, value, onChange, label }: { kind: HandoverKind; value: string; onChange: (v: string) => void; label?: string }) {
  if (kind === "firm") {
    return (
      <label className="ho-field">
        <span>{label ?? "Their job title"}</span>
        <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={120} />
        <small>Shown with their name in the firm's team. They can change it.</small>
      </label>
    );
  }
  return (
    <div className="ho-field">
      <span>Who are they?</span>
      <div className="ho-rel" role="radiogroup">
        {RELATIONS[kind].map((r) => (
          <button key={r.value} type="button" role="radio" aria-checked={value === r.value} className={cn("ho-relopt", value === r.value && "on")} onClick={() => onChange(r.value)}>
            <b>{r.en}</b>{r.hint && <small>{r.hint}</small>}
          </button>
        ))}
      </div>
    </div>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Pre-filled personal note in the invite dialog; Admin can edit or clear it. */
const DEFAULT_NOTE: Record<HandoverKind, Record<"th" | "en", string>> = {
  startup: {
    en: "As we discussed, here is your company profile. Please check it and tell me if anything needs changing.",
    th: "ตามที่คุยกันไว้ นี่คือโปรไฟล์ธุรกิจของท่าน กรุณาตรวจสอบและบอกได้เลยหากมีส่วนใดต้องแก้ไข",
  },
  investor: {
    en: "As we discussed, here is your investor profile. Please check it and tell me if anything needs changing.",
    th: "ตามที่คุยกันไว้ นี่คือโปรไฟล์นักลงทุนของท่าน กรุณาตรวจสอบและบอกได้เลยหากมีส่วนใดต้องแก้ไข",
  },
  firm: {
    en: "As we discussed, here is your firm profile. Please check it and tell me if anything needs changing.",
    th: "ตามที่คุยกันไว้ นี่คือโปรไฟล์บริษัทของท่าน กรุณาตรวจสอบและบอกได้เลยหากมีส่วนใดต้องแก้ไข",
  },
};

function InviteDialog({ kind, id, name, managed, prefill, onBack, onClose, onSent }: {
  kind: HandoverKind; id: string; name: string; managed: boolean; prefill: Partial<InviteForm> | null; onBack: () => void; onClose: () => void; onSent: () => void;
}) {
  const noteDefault = (lang: "th" | "en") => DEFAULT_NOTE[kind][lang];
  const [f, setF] = useState<InviteForm>({ firstName: "", lastName: "", email: "", relation: "", language: "th", sentBy: DEFAULT_TEAM, ...prefill, note: prefill?.note ?? DEFAULT_NOTE[kind].th });
  // Switching the email language swaps the note only while it is still untouched (empty or the other default).
  const setLang = (lang: "th" | "en") =>
    setF((x) => {
      if (x.language === lang) return x;
      const other = lang === "th" ? "en" : "th";
      const note = x.note.trim() === "" || x.note === noteDefault(other) ? noteDefault(lang) : x.note;
      return { ...x, language: lang, note };
    });
  const set = <K extends keyof InviteForm>(k: K, v: InviteForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const email = useDebounced(f.email.trim(), 500);
  const check = useServerFn(checkInviteEmail);
  const chk = useQuery({ queryKey: ["invite-email", kind, email], queryFn: () => check({ data: { kind, email } }), enabled: EMAIL.test(email), retry: false });
  const send = useServerFn(sendProfileInvite);
  const qc = useQueryClient();
  const W = { startup: ["company", "seller"], investor: ["investor profile", "buyer"], firm: ["firm profile", "advisor"] }[kind];
  const blocked = chk.data?.state === "owns" || chk.data?.state === "other_role";
  const ready = f.firstName.trim() && f.lastName.trim() && EMAIL.test(f.email.trim()) && f.relation.trim() && !blocked;
  const m = useMutation({
    mutationFn: () => send({ data: { kind, id, email: f.email.trim(), firstName: f.firstName, lastName: f.lastName, relation: f.relation, language: f.language, sentBy: f.sentBy, note: f.note || undefined } }),
    onSuccess: (r) => {
      toast.success(`Invitation sent to ${r.email}.`);
      void qc.invalidateQueries({ queryKey: ["ownership-detail", kind, id] }); void qc.invalidateQueries({ queryKey: ["ownership"] });
      onSent();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Shell open onClose={onClose} title="Invite the owner"
      sub={<>The invitee receives a personal link. Once accepted, they take ownership of the profile and can review it before publishing.{managed ? " Until then, PitchSnack keeps managing it." : ""}</>}
      footer={<>
        <button className="ho-btn" onClick={onBack}>‹ Back</button>
        <span className="flex-1" />
        <button className="ho-btn" onClick={onClose}>Cancel</button>
        <button className="ho-btn ho-btn-navy" disabled={!ready || m.isPending} onClick={() => m.mutate()}>{m.isPending ? "Sending…" : "Send invitation"}</button>
      </>}>
      <div className="ho-grid2">
        <label className="ho-field"><span>First name</span><input value={f.firstName} onChange={(e) => set("firstName", e.target.value)} maxLength={80} /></label>
        <label className="ho-field"><span>Last name</span><input value={f.lastName} onChange={(e) => set("lastName", e.target.value)} maxLength={80} /></label>
      </div>
      <label className="ho-field">
        <span>Work email</span>
        <input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} maxLength={255} />
        <small>The account is created with this email and it can't be changed.</small>
      </label>
      {chk.data?.state === "account" && <p className="ho-note-blue">{email} already has a PitchSnack {W[1]} account (since {fmtDate(chk.data.since)}), with no {W[0]} yet. They sign in to accept, and {name} joins that account.</p>}
      {chk.data?.state === "owns" && <p className="ho-note-red">{email} already owns {chk.data.name} ({chk.data.ref}). Each account holds one {W[0]}, so invite another email.</p>}
      {chk.data?.state === "other_role" && <p className="ho-note-red">{email} already has a PitchSnack {chk.data.role} account, so invite another email.</p>}
      <RelationPicker kind={kind} value={f.relation} onChange={(v) => set("relation", v)} />
      <div className="ho-field">
        <span className="flex items-center justify-between gap-2">Email language <small className="!m-0">Choose sign-up language.</small></span>
        <div className="ho-seg">
          <button type="button" className={cn(f.language === "th" && "on")} onClick={() => setLang("th")}>ไทย</button>
          <button type="button" className={cn(f.language === "en" && "on")} onClick={() => setLang("en")}>English</button>
        </div>
      </div>
      <label className="ho-field"><span>Sent by</span><input value={f.sentBy} onChange={(e) => set("sentBy", e.target.value)} maxLength={80} /></label>
      <label className="ho-field"><span>Personal note (optional)</span><textarea rows={3} value={f.note} onChange={(e) => set("note", e.target.value)} maxLength={1000} /></label>
      <p className="ho-info">ⓘ The email doesn't name the {kind === "firm" ? "firm" : "company"} or show any figures. The link works once, expires in 7 days and, during the soft launch, lets them past the access page without a code.</p>
    </Shell>
  );
}

/* ----------------------------- manage dialog ----------------------------- */

function ManageDialog({ kind, id, name, current, onBack, onClose, onDone }: {
  kind: HandoverKind; id: string; name: string; current: Detail["managed"]; onBack: () => void; onClose: () => void; onDone: () => void;
}) {
  const [f, setF] = useState({
    firstName: current?.first_name ?? "", lastName: current?.last_name ?? "", email: current?.email ?? "", phone: current?.phone ?? "",
    relation: current?.owner_relation ?? "", managedBy: current?.managed_by ?? DEFAULT_TEAM, agreed: !!current,
  });
  const [tried, setTried] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const start = useServerFn(startManaging);
  const qc = useQueryClient();
  const noContact = !f.email.trim() && !f.phone.trim();
  const badEmail = !!f.email.trim() && !EMAIL.test(f.email.trim());
  const ok = f.firstName.trim() && f.lastName.trim() && !noContact && !badEmail && f.relation.trim() && f.agreed;
  const m = useMutation({
    mutationFn: () => start({ data: { kind, id, firstName: f.firstName, lastName: f.lastName, email: f.email.trim(), phone: f.phone.trim(), relation: f.relation, managedBy: f.managedBy, agreed: true } }),
    onSuccess: (r) => {
      toast.success(r.edited ? "Details saved." : `PitchSnack now manages ${name}. Nothing was sent to the client.`);
      void qc.invalidateQueries({ queryKey: ["ownership-detail", kind, id] }); void qc.invalidateQueries({ queryKey: ["ownership"] }); void qc.invalidateQueries({ queryKey: ["ownership-counts"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const first = f.firstName.trim() || "The client";
  return (
    <Shell open onClose={onClose} title={current ? "Managed by PitchSnack" : "Let PitchSnack manage it"}
      sub={`Our team runs ${name} for the client, who never signs in: we edit it, publish it and ${TEAM_DOES[kind][2]} for them. You can invite them to take over later.`}
      footer={<>
        <button className="ho-btn" onClick={onBack}>‹ Back</button>
        <span className="flex-1" />
        <button className="ho-btn" onClick={onClose}>Cancel</button>
        <button className="ho-btn ho-btn-navy" disabled={m.isPending} onClick={() => { setTried(true); if (ok) m.mutate(); }}>
          {current ? "Save details" : <><HatIcon width={14} fill="#fff" /> Start managing</>}
        </button>
      </>}>
      <div className="ho-grid2">
        <label className="ho-field"><span>Client's first name</span><input value={f.firstName} onChange={(e) => set("firstName", e.target.value)} /></label>
        <label className="ho-field"><span>Last name</span><input value={f.lastName} onChange={(e) => set("lastName", e.target.value)} /></label>
        <label className="ho-field"><span>Email</span><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></label>
        <label className="ho-field"><span>Phone</span><input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></label>
      </div>
      <small className="ho-muted">For your team, to reach the client. Nothing is sent to them, and no account is made.</small>
      {tried && noContact && <p className="ho-note-red">Add the client's email or phone, so the team can reach them.</p>}
      {tried && badEmail && <p className="ho-note-red">Enter a valid email.</p>}
      <RelationPicker kind={kind} value={f.relation} onChange={(v) => set("relation", v)} label="The client's job title" />
      <label className="ho-field"><span>Managed by</span><input value={f.managedBy} onChange={(e) => set("managedBy", e.target.value)} /></label>
      <label className="ho-check">
        <input type="checkbox" checked={f.agreed} onChange={(e) => set("agreed", e.target.checked)} />
        <span>{first} has agreed in writing that PitchSnack runs this profile for them and answers on their behalf.</span>
      </label>
      {tried && !f.agreed && <p className="ho-note-red">Confirm the client's written agreement to go on.</p>}
    </Shell>
  );
}

/* -------------------- directory panel after the owner submits -------------------- */

export function HandoverPanelBox({ kind, id, approvalsHref }: { kind: HandoverKind; id: string; approvalsHref: string }) {
  const fn = useServerFn(ownershipDetail);
  const q = useQuery({ queryKey: ["ownership-detail", kind, id], queryFn: () => fn({ data: { kind, id } }), retry: false, staleTime: 30_000 });
  const d = q.data;
  if (!d?.invitation?.submitted_at) return null;
  const changed = new Set(d.changes.map((c: any) => c.part));
  const m = d.parts.length - changed.size;
  const label = (k: string) => { const p = d.parts.find((x) => x.key === k); return p ? (p.view === "open" ? p.en : `${p.view === "public" ? "Public" : "Private"} view › ${p.en}`) : k; };
  return (
    <div className="ho-panelbox">
      <a href={approvalsHref} className="ho-btn ho-btn-navy inline-flex">Review in Approvals</a>
      <div className="ho-label mt-3">Changed by the owner before submitting</div>
      <ul className="ho-changes">
        {d.changes.map((c: any, k: number) => (
          <li key={k}><span className="ho-muted">{label(c.part)}</span> <span>{c.field} {c.new_value?.startsWith("Added") || c.old_value?.startsWith("Removed") ? (c.new_value ?? c.old_value) : <><s>{c.old_value ?? "—"}</s> → <b>{c.new_value ?? "—"}</b></>}</span></li>
        ))}
        <li><span className="ho-muted">The other {m} parts</span> <span>Checked as PitchSnack prepared them</span></li>
      </ul>
      <div className="ho-label mt-3">History</div>
      <ul className="ho-history">
        {d.events.map((e: any, k: number) => <li key={k}><span>{eventLabel(e.event)}{e.detail ? ` · ${e.detail}` : ""}</span><span className="ho-muted">{fmtTime(e.created_at)}</span></li>)}
      </ul>
    </div>
  );
}

export function eventLabel(e: string) {
  return ({ invited: "Invitation sent", opened: "Invitation opened", accepted: "Invitation accepted", checked: "Checked", submitted: "Submitted", managed: "Managed by PitchSnack", published: "Published", stopped_managing: "Stopped managing", invite_cancelled: "Invitation cancelled", approved: "Approved", verified: "Verified", changes_requested: "Changes requested", prepared: "Prepared" } as Record<string, string>)[e] ?? e;
}

/** ⋮ menu label with the small grey status on the right. */
export function OwnershipMenuLabel({ row }: { row: OwnershipRow | undefined }) {
  return <span className="flex w-full items-center justify-between gap-4"><span className="flex items-center"><UserCheck className="mr-2 h-4 w-4 shrink-0" />Ownership</span><span className="text-[11px] text-muted-foreground">{menuStatus(row)}</span></span>;
}

/* ------------------- directory context: cards, panels, menus ------------------- */

type DirCtx = { kind: HandoverKind; map: Map<string, OwnershipRow>; open: (id: string) => void };
const OwnershipDirCtx = createContext<DirCtx | null>(null);

/** Wraps an Admin directory: cards, panels and ⋮ menus inside show ownership. */
export function OwnershipProvider({ kind, ids, enabled, children }: { kind: HandoverKind; ids: string[]; enabled: boolean; children: ReactNode }) {
  const map = useOwnershipMap(kind, ids, enabled);
  const [openId, setOpenId] = useState<string | null>(null);
  const value = useMemo(() => ({ kind, map, open: setOpenId }), [kind, map]);
  if (!enabled) return <>{children}</>;
  return (
    <OwnershipDirCtx.Provider value={value}>
      {children}
      {openId && <OwnershipDialog kind={kind} id={openId} open onClose={() => setOpenId(null)} />}
    </OwnershipDirCtx.Provider>
  );
}
export const useOwnershipDir = () => useContext(OwnershipDirCtx);

export function OwnershipCardSlot({ id }: { id: string }) {
  const c = useOwnershipDir();
  const r = c?.map.get(id);
  if (!r) return null;
  return <span className="inline-flex items-center gap-1"><OwnershipChips row={r} /><OwnershipBadge runBy={r.runBy} /></span>;
}

export function OwnershipPanelSlot({ id }: { id: string }) {
  const c = useOwnershipDir();
  const r = c?.map.get(id);
  if (!c || !r) return null;
  const href = c.kind === "startup" ? "/approvals?tab=listings" : c.kind === "investor" ? "/approvals?tab=buyers" : `/approvals?tab=advisors&adv=${id}`;
  return (
    <>
      {r.handedOver && <HandoverPanelBox kind={c.kind} id={id} approvalsHref={href} />}
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5"><OwnershipBadge runBy={r.runBy} onClick={() => c.open(id)} /><OwnershipChips row={r} /></div>
    </>
  );
}

export function OwnershipMenuItem({ id }: { id: string }) {
  const c = useOwnershipDir();
  if (!c) return null;
  return <DropdownMenuItem onSelect={() => c.open(id)}><OwnershipMenuLabel row={c.map.get(id)} /></DropdownMenuItem>;
}

/* ------------------------- Approvals: handed-over box ------------------------- */


/** Approvals review: shows who prepared it, who took it over and what the owner changed. Nothing for ordinary sign-ups. */
export function HandoverReviewBox({ kind, id }: { kind: HandoverKind; id: string | null | undefined }) {
  const fn = useServerFn(handoverReview);
  const q = useQuery({ queryKey: ["handover-review", kind, id], queryFn: () => fn({ data: { kind, id: id! } }), enabled: !!id, retry: false, staleTime: 30_000 });
  const d = q.data;
  if (!d) return null;
  const label = (k: string) => { const p = d.parts.find((x) => x.key === k); return p ? (p.view === "open" ? p.en : `${p.view === "public" ? "Public" : "Private"} view › ${p.en}`) : k; };
  const unchanged = d.parts.length - new Set(d.changes.map((c: any) => c.part)).size;
  return (
    <div className="ho-panelbox mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="ho-chip">Handed over</span>
        <span className="text-[13px]">Prepared by {d.preparedBy} · {fmtTime(d.preparedAt)}. {d.owner}{d.ownerRelation ? ` (${relationLabel(kind, d.ownerRelation)})` : ""} accepted {fmtTime(d.acceptedAt)}{d.submittedAt ? ` and submitted ${fmtTime(d.submittedAt)}` : ""}.</span>
      </div>
      <div className="ho-label mt-3">Changed by the owner before submitting</div>
      <ul className="ho-changes">
        {d.changes.map((c: any, k: number) => (
          <li key={k}><span className="ho-muted">{label(c.part)}</span> <span>{c.field} <s>{c.old_value ?? "—"}</s> → <b>{c.new_value ?? "—"}</b></span></li>
        ))}
        <li><span className="ho-muted">The other {unchanged} parts</span> <span>Checked as PitchSnack prepared them</span></li>
      </ul>
    </div>
  );
}
