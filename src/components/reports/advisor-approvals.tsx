import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertCircle, Check, ChevronLeft, ExternalLink, FileText, Send, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listAdminAdvisorFirms, decideAdvisor, markAdvisorItem, assignAdvisorReview, saveAdvisorChecklist, checkAdvisorDbd,
  ADV_FIELDS, ADV_REASONS, type AdminFirm,
} from "@/lib/advisor-admin.functions";
import { CredMark, FirmNotice, businessDays } from "@/components/advisor/advisor-verification";
import { initials } from "@/lib/advisor-firm";
import { cn } from "@/lib/utils";

/** Admin › Approvals › Advisors: queue, review, and the three decisions. */

export function useAdvisorQueue() {
  const fn = useServerFn(listAdminAdvisorFirms);
  const q = useQuery({ queryKey: ["approvals", "advisors"], queryFn: () => fn(), staleTime: 30_000 });
  const firms = q.data?.firms ?? [];
  const byAge = (a: AdminFirm, b: AdminFirm) => +new Date(a.v.requestedAt ?? 0) - +new Date(b.v.requestedAt ?? 0);
  const pending = firms.filter((f) => f.v.state === "pending").sort(byAge);
  const moreInfo = firms.filter((f) => f.v.state === "more_info").sort((a, b) => +new Date(a.v.moreInfoAt ?? 0) - +new Date(b.v.moreInfoAt ?? 0));
  return { ...q, me: q.data?.me, pending, rows: [...pending, ...moreInfo] };
}

const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
function Wait({ f }: { f: AdminFirm }) {
  if (f.v.state === "more_info") return <span className="text-[12px] text-muted-foreground">sent back {day(f.v.moreInfoAt)}</span>;
  const n = businessDays(f.v.requestedAt);
  return <span className={cn("text-[12px]", n > 1 ? "font-semibold text-[#B45309]" : "text-muted-foreground")}>{n === 0 ? "today" : `waiting ${n} day${n === 1 ? "" : "s"}`}</span>;
}
function Tile({ f, size = 34 }: { f: AdminFirm; size?: number }) {
  return f.logoUrl ? <img src={f.logoUrl} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-lg border border-border bg-white object-contain p-0.5" />
    : <span style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-lg bg-[#0F766E] text-[12px] font-bold text-white">{initials(f.name)}</span>;
}
function ReqChip({ f }: { f: AdminFirm }) {
  const [t, c] = f.v.state === "more_info" ? ["More info sent", "text-[#8A5A06] bg-[#FFF4E0] border-[#F3D9A6]"] : f.v.reason === "re_check" ? ["Re-check", "text-[#6D28D9] bg-[#F5F3FF] border-[#DDD6FE]"] : ["Waiting", "text-[#1D4ED8] bg-[#EFF6FF] border-[#BFDBFE]"];
  return <span className={cn("inline-flex h-[22px] items-center rounded-full border px-2 text-[11px] font-semibold", c)}>{t}</span>;
}
const regOk = (f: AdminFirm) => !!f.v.dbd.name && sameName(f.v.dbd.name, f.legalName);
const sameName = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase().replace(/[^a-z0-9ก-๙]/g, "") === b.toLowerCase().replace(/[^a-z0-9ก-๙]/g, "");

export function AdvisorApprovals({ openId, onOpen }: { openId?: string; onOpen: (id?: string) => void }) {
  const q = useAdvisorQueue();
  const qc = useQueryClient();
  const assign = useServerFn(assignAdvisorReview);
  const all = q.data?.firms ?? [];
  const open = openId ? all.find((f) => f.id === openId) : undefined;
  const doAssign = async (id: string) => { await assign({ data: { id } }); qc.invalidateQueries({ queryKey: ["approvals"] }); qc.invalidateQueries({ queryKey: ["advisors-admin"] }); };
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (open) return <Review f={open} me={q.me} onBack={() => onOpen(undefined)} onAssign={() => doAssign(open.id)} />;
  return (
    <div className="space-y-2">
      <div><h2 className="text-[15px] font-semibold">Advisor verifications</h2>
        <p className="text-[13px] text-muted-foreground">Oldest first. A firm joins when it saves its setup for the first time, and again as a Re-check when a verified firm changes its legal name, registration number, licences or documents.</p></div>
      <div className="overflow-x-auto rounded-[14px] border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>{["Firm", "Owner", "Submitted", "Checks", "Assignee", "Status", ""].map((h, i) => <th key={i} className="p-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {q.rows.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No advisor firms are waiting. New firms show here when they save their setup.</td></tr> : q.rows.map((f) => {
              const vc = f.credentials.filter((c) => c.status === "verified").length, dc = f.documents.filter((d) => d.checkedAt).length;
              return (
                <tr key={f.id} tabIndex={0} onClick={() => onOpen(f.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(f.id)} className="cursor-pointer border-t border-border hover:bg-muted/30">
                  <td className="p-3"><div className="flex items-center gap-2.5"><Tile f={f} /><div><div className="text-[13.5px] font-semibold">{f.name}</div><div className="text-[12px] text-muted-foreground">{f.ref} · {f.firmType || "—"}</div></div></div></td>
                  <td className="p-3">{f.ownerName ?? <span className="text-[#9CA3AF]">No owner yet</span>}</td>
                  <td className="p-3"><div>{day(f.v.requestedAt)}</div><Wait f={f} /></td>
                  <td className="p-3 text-[12px] leading-5">
                    {f.v.dbd.name && !regOk(f) ? <div className="font-semibold text-[#8A5A06]">! Registration</div> : <div><span className="text-[#15803D]">✓</span> Registration</div>}
                    <div>{f.credentials.length ? `Licences ${vc} of ${f.credentials.length}` : "Licences none added"}</div>
                    <div>Documents {dc} of {f.documents.length}</div>
                  </td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    {f.v.assignedId ? <span className="inline-flex items-center gap-1.5 text-[12px]"><span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-muted text-[10px] font-bold">{initials(f.v.assignedName ?? "?")}</span>{f.v.assignedId === q.me ? "You" : f.v.assignedName}</span>
                      : <button type="button" className="text-[12.5px] font-semibold text-[#2563EB] hover:underline" onClick={() => doAssign(f.id)}>Assign to me</button>}
                  </td>
                  <td className="p-3"><ReqChip f={f} /></td>
                  <td className="p-3"><Button size="sm" variant="outline" className="h-[30px]">Review ›</Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Box({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return <div className="rounded-[12px] border border-[#E5E7EB] bg-card p-4"><div className="mb-2 flex items-center justify-between"><h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{title}</h3>{right}</div>{children}</div>;
}
function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return <dl className="grid grid-cols-[130px_1fr] gap-y-1.5 text-[13px]">{rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words">{v || "—"}</dd></div>)}</dl>;
}
const CHECKLIST = ["The registration matches the legal name and address", "Each regulated service has a fitting licence", "The documents open and can be read", "The website, email and phone reach the firm"];

function Review({ f, me, onBack, onAssign }: { f: AdminFirm; me?: string; onBack: () => void; onAssign: () => void }) {
  const qc = useQueryClient();
  const mark = useServerFn(markAdvisorItem);
  const saveCl = useServerFn(saveAdvisorChecklist);
  const dbd = useServerFn(checkAdvisorDbd);
  const [dlg, setDlg] = useState<null | "verify" | "more" | "decline">(null);
  const [dbdState, setDbdState] = useState<string | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["approvals"] }); qc.invalidateQueries({ queryKey: ["advisors-admin"] }); };
  useEffect(() => {
    if (f.v.dbd.checkedAt || (f.country && f.country !== "Thailand")) return;
    dbd({ data: { id: f.id } }).then((r) => { setDbdState(r.status); refresh(); }).catch(() => setDbdState("unavailable"));
  }, [f.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const doMark = async (kind: "credential" | "document", id: string, status: "pending" | "verified" | "rejected" | "checked" | "unchecked") => {
    try { await mark({ data: { kind, id, status } }); refresh(); } catch (e) { toast.error((e as Error).message); }
  };
  const snap = f.v.snapshot ?? {};
  const isRe = f.v.reason === "re_check" && !!f.v.verifiedAt;
  const sc = new Map<string, any>((snap.credentials ?? []).map((c: any) => [c.id, c]));
  const sd = new Map<string, any>((snap.documents ?? []).map((d: any) => [d.id, d]));
  const changes = useMemo(() => {
    if (!isRe) return [] as [string, React.ReactNode][];
    const out: [string, React.ReactNode][] = [];
    const ch = (label: string, a: any, b: any) => { if ((a ?? null) !== (b ?? null)) out.push([label, <><s className="text-[#9CA3AF]">{a || "—"}</s> {b || "—"}</>]); };
    ch("Legal name", snap.legal_name, f.legalName); ch("Registration no.", snap.registration_no, f.registrationNo);
    for (const c of f.credentials) {
      const o = sc.get(c.id);
      if (!o) out.push(["Licence", <span className="font-semibold text-[#6D28D9]">+ {c.name}</span>]);
      else if (o.name !== c.name || (o.note ?? null) !== (c.note ?? null)) out.push(["Licence", <><s className="text-[#9CA3AF]">{o.name}{o.note ? ` · ${o.note}` : ""}</s> {c.name}{c.note ? ` · ${c.note}` : ""}</>]);
    }
    for (const [id, o] of sc) if (!f.credentials.some((c) => c.id === id)) out.push(["Licence", <s className="text-[#9CA3AF]">− {o.name}</s>]);
    for (const d of f.documents) if (!sd.has(d.id)) out.push(["Document", <span className="font-semibold text-[#6D28D9]">+ {d.name}</span>]);
    for (const [id, o] of sd) if (!f.documents.some((d) => d.id === id)) out.push(["Document", <s className="text-[#9CA3AF]">− {o.name}</s>]);
    return out;
  }, [f, isRe]); // eslint-disable-line react-hooks/exhaustive-deps
  const New = () => <span className="ml-1.5 rounded bg-[#F5F3FF] px-1.5 py-px text-[10px] font-bold text-[#6D28D9]">New</span>;
  const emailDomain = (f.email ?? "").split("@")[1]?.toLowerCase() ?? "";
  const siteDomain = (f.website ?? "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]!.toLowerCase();
  const webOk = !!emailDomain && !!siteDomain && (emailDomain === siteDomain || emailDomain.endsWith(`.${siteDomain}`));
  const abroad = !!f.country && f.country !== "Thailand";
  const regTone = abroad || !f.v.dbd.name ? "amber" : regOk(f) ? "green" : "amber";
  const vc = f.credentials.filter((c) => c.status === "verified").length, dc = f.documents.filter((d) => d.checkedAt).length;

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" />Advisor verifications</button>
      <div className="rounded-[14px] border border-border bg-card p-5">
        <div className="flex flex-wrap items-start gap-3">
          <Tile f={f} size={48} />
          <div className="min-w-0 flex-1">
            <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">{f.name}
              {f.v.state === "more_info" ? <ReqChip f={f} /> : <span className={cn("inline-flex h-[22px] items-center rounded-full border px-2 text-[11px] font-semibold", isRe ? "text-[#6D28D9] bg-[#F5F3FF] border-[#DDD6FE]" : "text-[#1D4ED8] bg-[#EFF6FF] border-[#BFDBFE]")}>{isRe ? "Re-check" : "First check"}</span>}
            </h2>
            <p className="text-[13px] text-[#6B7280]">
              {f.ref} · submitted {day(f.v.requestedAt)}{f.ownerName ? ` by ${f.ownerName}` : ""} · <Wait f={f} /> · {f.v.assignedId ? (f.v.assignedId === me ? "assigned to you" : `assigned to ${f.v.assignedName}`) : <button type="button" className="font-semibold text-[#2563EB] hover:underline" onClick={onAssign}>Assign to me</button>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-[#FECACA] text-[#B91C1C] hover:bg-[#FEF2F2]" onClick={() => setDlg("decline")}><X className="mr-1.5 h-4 w-4" />Decline</Button>
            <Button variant="outline" onClick={() => setDlg("more")}><Send className="mr-1.5 h-4 w-4" />Request more info</Button>
            <Button className="bg-[#192957] text-white hover:bg-[#192957]/90" onClick={() => setDlg("verify")}><Check className="mr-1.5 h-4 w-4" />Verify advisor</Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#E0E7FF] bg-[#F8FAFF] px-3.5 py-2.5 text-[13px]">
          <span>The full profile is in Advisors Directory, with the card sellers and buyers see.</span>
          <Link to="/advisors" search={{ view: "split", selected: f.id }} className="inline-flex items-center gap-1 font-semibold text-[#1D4ED8]">Open in Advisors Directory<ExternalLink className="h-3.5 w-3.5" /></Link>
        </div>
        <div className="mt-4 grid gap-3.5 lg:grid-cols-[1fr_1.08fr]">
          <div className="space-y-3.5">
            <Box title="Firm"><KV rows={[["Firm type", f.firmType], ["City", f.city], ["Status", f.status[0]!.toUpperCase() + f.status.slice(1)], ["Website", f.website], ["Email", f.email], ["Phone", f.phone]]} /></Box>
            <Box title="Company"><KV rows={[["Legal name", <span className={cn(f.v.dbd.name && !sameName(f.v.dbd.name, f.legalName) && "text-[#8A5A06]")}>{f.legalName}</span>], ["Thai name", f.thaiName], ["Registration no.", f.registrationNo], ["Founded", f.yearFounded], ["Business address", f.address]]} /></Box>
            <Box title={`Team · ${f.team.length}`}>{f.team.length ? <ul className="space-y-1 text-[13px]">{f.team.map((t, i) => <li key={i}><b className="font-medium">{t.name}</b><span className="text-muted-foreground">{[t.role, t.email].filter(Boolean).map((x) => ` · ${x}`).join("")}</span></li>)}</ul> : <p className="text-[13px] text-muted-foreground">—</p>}</Box>
            <Box title={`Services and fees · ${f.services.length}`}><ul className="space-y-1 text-[13px]">{f.services.map((sv) => <li key={sv} className="flex justify-between gap-2"><span>{sv}</span><span className="text-muted-foreground">{f.fees.find((x) => x.service === sv)?.fee || "—"}</span></li>)}</ul></Box>
          </div>
          <div className="space-y-3.5">
            {f.v.state === "more_info" && (
              <div className="rounded-[12px] border border-[#F3D9A6] bg-[#FFF4E0] px-3.5 py-3 text-[13px] text-[#5A3A07]">More info requested on {day(f.v.moreInfoAt)}{f.v.moreInfoBy ? ` by ${f.v.moreInfoBy}` : ""}: “{f.v.moreInfoNote}” Fields to fix: {f.v.moreInfoFields.join(", ")}. Waiting for the firm to save them. You can still decide now.</div>
            )}
            {isRe && (
              <Box title="What changed since the last check" right={<span className="text-[12px] text-muted-foreground">verified {day(f.v.verifiedAt)}</span>}>
                {changes.length ? <div className="divide-y divide-border text-[13px]">{changes.map(([k, v], i) => <div key={i} className="grid grid-cols-[110px_1fr] gap-2 py-1.5"><span className="text-muted-foreground">{k}</span><span>{v}</span></div>)}</div> : <p className="text-[13px] text-muted-foreground">No change found.</p>}
                <p className="mt-2 text-[12px] text-muted-foreground">{f.name} keeps its Verified advisor badge while this check waits.</p>
              </Box>
            )}
            <Box title="Checks">
              <div className="grid gap-2 sm:grid-cols-2">
                <Check2 tone={regTone} title="Company registration">
                  {abroad ? "Not in Thailand: check by hand."
                    : f.v.dbd.name ? (regOk(f) ? <>Found in the DBD registry: <b>{f.v.dbd.name}</b>{f.v.dbd.status ? ` · ${f.v.dbd.status}` : ""}{f.v.dbd.registeredOn ? ` · registered ${day(f.v.dbd.registeredOn)}` : ""}{f.v.dbd.capital ? ` · capital ฿${Number(f.v.dbd.capital).toLocaleString()}` : ""}. The name matches.</>
                      : <>The DBD registry has <b>{f.v.dbd.name}</b> for {f.registrationNo}. The legal name given is {f.legalName || "—"}. Check by hand.</>)
                    : dbdState === "unavailable" ? "The DBD registry couldn't be reached. Check by hand."
                    : dbdState || f.v.dbd.checkedAt ? `No company with ${f.registrationNo || "that number"} in the DBD registry. Check by hand.` : "Checking the DBD registry…"}
                </Check2>
                <Check2 tone={webOk ? "green" : "amber"} title="Website and email">
                  {webOk ? `${f.email} matches the website ${f.website}.` : `The email's domain, ${emailDomain || "—"}, isn't the website's (${f.website || "—"}). Check that they belong to the same firm.`}
                </Check2>
              </div>
            </Box>
            <Box title={`Licences and credentials · ${vc} of ${f.credentials.length} verified`}>
              {f.credentials.length === 0 ? <p className="text-[13px] text-muted-foreground">The firm hasn't added a licence or credential. Ask for one with Request more info if its services need one.</p> : (
                <ul className="divide-y divide-border">{f.credentials.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2.5 py-2 text-[13px]">
                    <span className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-muted"><ShieldCheck className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1"><b className="font-medium">{c.name}</b>{isRe && !sc.has(c.id) && <New />}{c.note && <span className="block text-[12px] text-muted-foreground">{c.note}</span>}</span>
                    {c.status === "pending" ? <><Button size="sm" variant="outline" className="h-8" onClick={() => doMark("credential", c.id, "verified")}><Check className="mr-1 h-3.5 w-3.5" />Mark verified</Button><Button size="sm" variant="outline" className="h-8 border-[#FECACA] text-[#B91C1C]" onClick={() => doMark("credential", c.id, "rejected")}>Can't verify</Button></>
                      : <><CredMark status={c.status} /><button type="button" className="text-[12px] font-semibold text-[#2563EB] hover:underline" onClick={() => doMark("credential", c.id, "pending")}>Undo</button></>}
                  </li>))}</ul>
              )}
            </Box>
            <Box title={`Documents · ${dc} of ${f.documents.length} checked`}>
              {f.documents.length === 0 ? <p className="text-[13px] text-muted-foreground">No documents added.</p> : (
                <ul className="divide-y divide-border">{f.documents.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-2.5 py-2 text-[13px]">
                    <span className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-muted"><FileText className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1"><b className="font-medium">{d.name}</b>{isRe && !sd.has(d.id) && <New />}{d.type && <span className="block text-[12px] text-muted-foreground">{d.type}</span>}</span>
                    {d.url && <Button size="sm" variant="outline" className="h-8" asChild><a href={d.url} target="_blank" rel="noreferrer">View</a></Button>}
                    {d.checkedAt ? <><span className="text-[12px] font-semibold text-[#15803D]">✓ Checked</span><button type="button" className="text-[12px] font-semibold text-[#2563EB] hover:underline" onClick={() => doMark("document", d.id, "unchecked")}>Undo</button></>
                      : <Button size="sm" variant="outline" className="h-8" onClick={() => doMark("document", d.id, "checked")}><Check className="mr-1 h-3.5 w-3.5" />Mark checked</Button>}
                  </li>))}</ul>
              )}
            </Box>
            <Box title="Reviewer checklist">
              <div className="space-y-2">{CHECKLIST.map((c) => (
                <label key={c} className="flex items-start gap-2 text-[13px]">
                  <Checkbox checked={f.v.checklist.includes(c)} onCheckedChange={async (on) => {
                    const ticks = on ? [...f.v.checklist, c] : f.v.checklist.filter((x) => x !== c);
                    await saveCl({ data: { id: f.id, ticks } }); refresh();
                  }} className="mt-0.5" />{c}
                </label>))}</div>
            </Box>
          </div>
        </div>
      </div>
      {dlg && <DecisionDialog kind={dlg} f={f} regWarn={regTone === "amber"} onClose={() => setDlg(null)} onDone={() => { setDlg(null); refresh(); onBack(); }} />}
    </div>
  );
}

function Check2({ tone, title, children }: { tone: "green" | "amber"; title: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-[10px] border p-3 text-[12.5px]", tone === "green" ? "border-[#BBF7D0] bg-[#F3FCF6]" : "border-[#F3D9A6] bg-[#FFF9EC]")}>
      <b className="mb-1 flex items-center gap-2 text-[13px]">
        <span className={cn("grid h-[22px] w-[22px] place-items-center rounded-full text-[12px] font-bold", tone === "green" ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#FDECC8] text-[#8A5A06]")}>{tone === "green" ? "✓" : "!"}</span>{title}
      </b>{children}
    </div>
  );
}

function Err({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-medium text-[#B42318]"><AlertCircle className="h-[15px] w-[15px]" />{children}</p>;
}

function DecisionDialog({ kind, f, regWarn, onClose, onDone }: { kind: "verify" | "more" | "decline"; f: AdminFirm; regWarn: boolean; onClose: () => void; onDone: () => void }) {
  const decide = useServerFn(decideAdvisor);
  const [note, setNote] = useState(kind === "more" ? f.v.moreInfoNote ?? "" : "");
  const [fields, setFields] = useState<string[]>(kind === "more" ? f.v.moreInfoFields : []);
  const [reason, setReason] = useState<string>("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const owner = f.ownerName;
  const rejected = f.credentials.filter((c) => c.status === "rejected").map((c) => c.name);
  const waiting = f.credentials.filter((c) => c.status === "pending").map((c) => c.name);
  const other = reason === "Another reason";
  const errs = kind === "more" ? { note: !note.trim() && "Write what the firm should fix.", fields: !fields.length && "Pick at least one field to fix." }
    : kind === "decline" ? { reason: !reason && "Choose a reason.", note: other && !note.trim() && "Write the reason in the note." } : {};
  const run = async () => {
    setTried(true);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    try {
      await decide({ data: { id: f.id, action: kind === "verify" ? "verify" : kind === "more" ? "more_info" : "decline", note: note.trim() || undefined, fields: kind === "more" ? (fields as never) : undefined, reason: kind === "decline" ? (reason as never) : undefined } });
      toast.success(kind === "verify" ? `${f.name} is verified.${owner ? ` ${owner} gets an email.` : ""}`
        : kind === "more" ? `Request sent. ${f.name} sees your note on My Company${owner ? `, and ${owner} gets an email.` : "."}`
        : `${f.name} is declined and unpublished.${owner ? ` ${owner} gets an email.` : ""}`);
      onDone();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const title = kind === "verify" ? `Verify ${f.name}?` : kind === "more" ? `Request more info from ${f.name}` : `Decline ${f.name}?`;
  const line = kind === "verify" ? [f.ref, f.firmType, f.city].filter(Boolean).join(" · ")
    : kind === "more" ? (owner ? `The firm sees your note and the fields on its My Company, and ${owner} gets an email.` : "The firm sees your note and the fields on its My Company. It has no owner yet, so no email is sent.")
    : "The firm loses any badge and is unpublished, so sellers and buyers can't find it.";
  const amber = "rounded-[10px] border border-[#F3D9A6] bg-[#FFF9EC] px-3 py-2 text-[13px] text-[#5A3A07]";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden rounded-[16px] p-0 sm:max-w-[580px]">
        <div className="flex items-start gap-3 px-5 pb-3 pt-5">
          <Tile f={f} size={40} />
          <div><DialogTitle className="text-[18px]" style={{ fontFamily: '"Space Grotesk", system-ui, sans-serif' }}>{title}</DialogTitle><DialogDescription className="text-[13px] text-[#6B7280]">{line}</DialogDescription></div>
        </div>
        <div className="space-y-3 px-5 pb-5">
          {kind === "verify" && <>
            <ul className="list-disc space-y-1 pl-5 text-[13px]">
              <li>{f.name} gets the <b>Verified advisor</b> badge on its card and profile, with “Verified by PitchSnack on {day(new Date().toISOString())}.”</li>
              <li>Credentials you marked verified show ✓ Verified.</li>
              <li>{owner ? `${owner} gets an email, and the decision goes in the approval log.` : "The firm has no owner yet, so no email is sent. The decision goes in the approval log."}</li>
            </ul>
            {rejected.length > 0 && <p className={amber}><b>{rejected.length === 1 ? "1 credential couldn't be verified:" : `${rejected.length} credentials couldn't be verified:`}</b> {rejected.join(", ")}. Sellers and buyers won't see {rejected.length === 1 ? "it" : "them"}.</p>}
            {waiting.length > 0 && <p className={amber}><b>{waiting.length === 1 ? "1 credential isn't verified yet:" : `${waiting.length} credentials aren't verified yet:`}</b> {waiting.join(", ")}. {waiting.length === 1 ? "It shows" : "They show"} as “still waiting for a check” on the firm's profile.</p>}
            {regWarn && <p className={amber}><b>The registration check has a warning.</b> Check it by hand before you verify.</p>}
          </>}
          {kind === "more" && <>
            <div><label className="text-[13px] font-medium">Note to the firm</label>
              <Textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Say what's missing and how to fix it" rows={3} className={cn("mt-1", tried && errs.note && "border-[#B42318]")} />
              {tried && errs.note && <Err>{errs.note}</Err>}</div>
            <div><label className="text-[13px] font-medium">Fields to fix</label>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">{ADV_FIELDS.map((x) => <label key={x} className="flex items-center gap-2 text-[13px]"><Checkbox checked={fields.includes(x)} onCheckedChange={(on) => setFields((p) => on ? [...p, x] : p.filter((y) => y !== x))} />{x}</label>)}</div>
              {tried && errs.fields && <Err>{errs.fields}</Err>}</div>
            <div className="rounded-[10px] border border-dashed border-[#D1D5DB] bg-[#FAFAFB] p-3"><p className="mb-2 text-[12px] font-semibold text-muted-foreground">What {f.name} sees on My Company</p><FirmNotice state="more_info" note={note} fields={fields} /></div>
          </>}
          {kind === "decline" && <>
            <div><label className="text-[13px] font-medium">Reason</label>
              <Select value={reason} onValueChange={setReason}><SelectTrigger autoFocus className={cn("mt-1", tried && errs.reason && "border-[#B42318]")}><SelectValue placeholder="Choose a reason" /></SelectTrigger>
                <SelectContent>{ADV_REASONS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
              {tried && errs.reason && <Err>{errs.reason}</Err>}</div>
            <div><label className="text-[13px] font-medium">Note to the firm {!other && <span className="font-normal text-[#9CA3AF]">optional</span>}</label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={other ? "Write the reason" : "Explain what you found"} rows={3} className={cn("mt-1", tried && errs.note && "border-[#B42318]")} />
              {tried && errs.note && <Err>{errs.note}</Err>}</div>
            <div className="rounded-[10px] border border-dashed border-[#D1D5DB] bg-[#FAFAFB] p-3"><FirmNotice state="declined" note={note || null} fields={[]} reason={reason || null} /></div>
            <p className="text-[13px] text-muted-foreground">{owner ? `${owner} gets an email. You can reopen the firm from Advisors Directory (⋮ › Reopen verification).` : "The firm has no owner yet, so no email is sent. You can reopen the firm from Advisors Directory (⋮ › Reopen verification)."}</p>
          </>}
        </div>
        <div className="flex justify-end gap-2 border-t border-border bg-[#FAFAFB] px-5 py-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy} onClick={run} className={kind === "decline" ? "bg-[#B91C1C] text-white hover:bg-[#B91C1C]/90" : "bg-[#192957] text-white hover:bg-[#192957]/90"}>
            {kind === "verify" ? "Verify advisor" : kind === "more" ? "Send request" : "Decline firm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
