import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronRight, FileText, Info, Lock, LockOpen, MessageSquare, PenLine, Pencil, Send, Target, X } from "lucide-react";
import logoBlack from "@/assets/pitchsnack-black.png";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { EMAIL_ALERTS, alertText, fill, type AlertDef, type AlertLang, type AlertRole } from "@/config/email-alerts";
import { getEmailAlertsAdmin, saveEmailAlert, saveEmailAlertRules, sendTestAlerts, type AlertRules } from "@/lib/email-alerts.functions";

export const Route = createFileRoute("/_authenticated/email-alerts")({
  head: () => ({
    meta: [
      { title: "Email alerts — Pitchsnack Admin" },
      { name: "description", content: "Turn email alerts on or off, edit their wording, set sending rules and see every email sent." },
    ],
  }),
  component: EmailAlertsPage,
});

const SAMPLE = { "listing code name": "Project Nimbus", "buyer code name": "Investor Heron", "buyer company": "Heron Capital", "seller company": "Nimbus Co., Ltd.", "report name": "verified financial report", sender: "Investor Heron", n: 4, date: "3 Oct 2026" };
function tileOf(key: string, role: AlertRole) {
  const G = { bg: "#ECFDF5", fg: "#047857" }, A = { bg: "#FFFBEB", fg: "#B45309" }, R = { bg: "#FEF2F2", fg: "#B91C1C" }, B = { bg: "#EFF6FF", fg: "#1D4ED8" };
  switch (key) {
    case "approved": return { ...G, Icon: Check };
    case "nda_approved": return { ...G, Icon: LockOpen };
    case "changes_requested": return { ...A, Icon: role === "buyer" ? Info : Pencil };
    case "declined": case "nda_declined": return { ...R, Icon: X };
    case "nda_request": return { ...B, Icon: Lock };
    case "financial_report": return { ...(role === "seller" ? A : G), Icon: FileText };
    case "loi": return { bg: "#F5F3FF", fg: "#6D28D9", Icon: PenLine };
    case "criteria_match": return { bg: "#E0F5F2", fg: "#0F766E", Icon: Target };
    default: return { ...B, Icon: MessageSquare };
  }
}
function AlertTile({ k, role, size }: { k: string; role: AlertRole; size: number }) {
  const t = tileOf(k, role);
  return <div className="flex shrink-0 items-center justify-center rounded-[12px]" style={{ width: size, height: size, backgroundColor: t.bg, color: t.fg }}><t.Icon className="h-5 w-5" strokeWidth={2} /></div>;
}
function SubjectChips({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white px-[11px] py-[9px] text-[13px] text-[#374151]">
      {text.split(/(\{[^}]+\})/g).map((part, i) => /^\{.+\}$/.test(part)
        ? <span key={i} className="rounded-[5px] bg-[#EEF0FF] px-[5px] text-[12px] font-medium text-[#4338CA]">{part}</span>
        : <span key={i}>{part}</span>)}
    </div>
  );
}

const GROUPS = ["Approvals", "NDA", "Pipeline", "Matches", "Messages"] as const;

function EmailAlertsPage() {
  const fn = useServerFn(getEmailAlertsAdmin);
  const { data, isLoading, error } = useQuery({ queryKey: ["email-alerts-admin"], queryFn: () => fn() });
  const [tab, setTab] = useState<"templates" | "rules" | "log">("templates");
  const test = useServerFn(sendTestAlerts);
  const testAll = useMutation({
    mutationFn: () => test({ data: {} }),
    onSuccess: (r) => toast.success(`${r.sent} test emails sent to ${r.email}`),
    onError: (e) => toast.error((e as Error).message),
  });

  if (error) return <div className="p-6 text-sm text-destructive">{(error as Error).message}</div>;
  const s = data?.stats;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground">COMMUNICATIONS</div>
          <h1 className="text-3xl font-semibold tracking-tight">Email alerts</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Emails sent to sellers and buyers on approvals, NDAs, pipeline requests, criteria matches and new messages. Only Admin edits them; users can switch email alerts on or off.
          </p>
        </div>
        <Button variant="outline" onClick={() => testAll.mutate()} disabled={testAll.isPending} className="gap-2">
          <Send className="h-4 w-4" />{testAll.isPending ? "Sending…" : "Send all tests to me"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Sent · last 7 days" value={s?.sent ?? "—"} sub={`to ${s?.users ?? 0} users`} />
        <Tile label="Unsubscribed or bouncing" value={s?.suppressed ?? "—"} sub="not delivered" />
        <Tile label="Failed" value={s?.failed ?? "—"} sub="check the address" danger />
        <Tile label="Users with email off" value={s?.emailOff ?? "—"} sub={`of ${s?.totalUsers ?? 0} · in Notifications`} />
      </div>

      <div className="flex gap-6 border-b border-border">
        {([["templates", `Email templates ${EMAIL_ALERTS.length}`], ["rules", "Sending rules"], ["log", "Email log"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("-mb-px border-b-2 px-1 pb-2 text-sm font-medium", tab === k ? "border-[#F6A823] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
      </div>

      {isLoading || !data ? <div className="text-sm text-muted-foreground">Loading…</div>
        : tab === "templates" ? <Templates data={data} />
        : tab === "rules" ? <Rules rules={data.rules} />
        : <Log rows={data.log} />}
    </div>
  );
}

function Tile({ label, value, sub, danger }: { label: string; value: string | number; sub: string; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold", danger && "text-destructive")}>{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

type AdminData = Awaited<ReturnType<typeof getEmailAlertsAdmin>>;

function Templates({ data }: { data: AdminData }) {
  const [key, setKey] = useState(EMAIL_ALERTS[0].key);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const def = EMAIL_ALERTS.find((a) => a.key === key)!;
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="rounded-xl border border-border bg-card p-2">
        {GROUPS.map((g) => (
          <div key={g} className="mb-2">
            <button type="button" onClick={() => setClosed((c) => ({ ...c, [g]: !c[g] }))} className="flex w-full items-center justify-between px-2 py-1.5 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground hover:text-foreground">
              <span className="flex items-center gap-1">{closed[g] ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}{g.toUpperCase()}</span>
              <span className="tabular-nums">{EMAIL_ALERTS.filter((a) => a.group === g).length}</span>
            </button>
            {!closed[g] && EMAIL_ALERTS.filter((a) => a.group === g).map((a) => {
              const on = data.settings[a.key]?.enabled ?? true;
              return (
                <button key={a.key} onClick={() => setKey(a.key)} className={cn("flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm", key === a.key ? "bg-muted font-semibold" : "hover:bg-muted/60")}>
                  <span>
                    <span className={cn("block", !on && "text-muted-foreground line-through")}>{a.name}</span>
                    <span className="mt-0.5 flex items-center gap-3 text-[11.5px] font-normal text-[#6B7280]">
                      <span className="flex items-center gap-1"><span className="h-[7px] w-[7px] rounded-full bg-[#F6A823]" />Seller</span>
                      <span className="flex items-center gap-1"><span className="h-[7px] w-[7px] rounded-full bg-[#4338CA]" />Buyer</span>
                    </span>
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">{data.stats.perAlert[a.key] ?? 0}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <AlertDetail key={def.key} def={def} data={data} />
    </div>
  );
}

function AlertDetail({ def, data }: { def: AlertDef; data: AdminData }) {
  const qc = useQueryClient();
  const save = useServerFn(saveEmailAlert);
  const test = useServerFn(sendTestAlerts);
  const st = data.settings[def.key];
  const [role, setRole] = useState<AlertRole>("seller");
  const [lang, setLang] = useState<AlertLang>("en");
  const [editing, setEditing] = useState(false);
  const [ov, setOv] = useState<any>(st?.overrides ?? {});
  const t = alertText(def, role, lang, ov);
  const ver = def[role];
  const mut = useMutation({
    mutationFn: (v: { enabled?: boolean; overrides?: any }) => save({ data: { key: def.key, ...v } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["email-alerts-admin"] }); toast.success("Saved"); },
    onError: (e) => toast.error((e as Error).message),
  });
  const testOne = useMutation({
    mutationFn: () => test({ data: { key: def.key } }),
    onSuccess: (r) => toast.success(`${r.sent} test emails sent to ${r.email}`),
    onError: (e) => toast.error((e as Error).message),
  });
  const setField = (f: string, val: string) => setOv((o: any) => ({ ...o, [role]: { ...(o[role] ?? {}), [lang]: { ...(o[role]?.[lang] ?? {}), [f]: val } } }));

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-3">
          <AlertTile k={def.key} role={role} size={40} />
          <div>
            <div className="font-semibold">{def.name}</div>
            <div className="text-xs text-muted-foreground">{def.group} · {data.stats.perAlert[def.key] ?? 0} sent in 7 days{!def.wired && " · not sent automatically yet"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">{st?.enabled ?? true ? "On" : "Off"}</span>
          <Switch checked={st?.enabled ?? true} onCheckedChange={(v) => mut.mutate({ enabled: v })} />
          <Button variant="outline" size="sm" onClick={() => testOne.mutate()} disabled={testOne.isPending}>Test</Button>
          {editing
            ? <Button size="sm" onClick={() => { mut.mutate({ overrides: ov }); setEditing(false); }}>Save wording</Button>
            : <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit wording</Button>}
        </div>
      </div>
      <div className="grid gap-4 p-4 xl:grid-cols-[1fr_260px]">
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="inline-flex rounded-lg bg-[#EEF0F4] p-[3px]">
              {(["seller", "buyer"] as const).map((r) => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className={cn("h-[26px] rounded-md px-3 text-[12px] font-semibold", role === r ? (r === "seller" ? "bg-[#F6A823] text-[#0E162F]" : "bg-[#4338CA] text-white") : "text-[#5A6172]")}>
                  {r === "seller" ? "Seller version" : "Buyer version"}
                </button>
              ))}
            </div>
            <Seg value={lang} onChange={(v) => setLang(v as AlertLang)} items={[["en", "EN"], ["th", "TH"]]} />
          </div>
          {editing ? (
            <div className="space-y-2">
              {(["subject", "title", "button"] as const).map((f) => (
                <label key={f} className="block text-xs font-semibold uppercase text-muted-foreground">{f}
                  <Input className="mt-1" value={t[f]} onChange={(e) => setField(f, e.target.value)} />
                </label>
              ))}
              <label className="block text-xs font-semibold uppercase text-muted-foreground">body
                <Textarea className="mt-1" rows={4} value={t.body} onChange={(e) => setField("body", e.target.value)} />
              </label>
              <Button variant="ghost" size="sm" onClick={() => setOv((o: any) => ({ ...o, [role]: { ...(o[role] ?? {}), [lang]: {} } }))}>Reset to default</Button>
            </div>
          ) : (
            <>
              <div><div className="text-[11px] font-semibold text-muted-foreground">SUBJECT</div><div className="mt-1"><SubjectChips text={t.subject} /></div></div>
              <div className="text-[11px] font-semibold text-muted-foreground">PREVIEW</div>
              <div className="rounded-xl bg-muted/50 p-4">
                <div className="mx-auto max-w-[560px] overflow-hidden rounded-[14px] border border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border px-5 py-3">
                    <img src={logoBlack} alt="PitchSnack" style={{ height: 18, width: "auto" }} />
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wider", role === "seller" ? "bg-[#F6A823] text-[#0E162F]" : "bg-[#4338CA] text-primary-foreground")}>{role === "seller" ? "SELLER" : "BUYER"}</span>
                  </div>
                  <div className="space-y-3 p-5">
                    <AlertTile k={def.key} role={role} size={44} />
                    <div className="text-xl font-semibold">{fill(t.title, SAMPLE)}</div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{fill(t.body, SAMPLE)}</p>
                    <span className="inline-block rounded-[9px] bg-[#1E2A4A] px-5 py-3 text-sm font-semibold text-primary-foreground">{t.button}</span>
                    <div className="text-xs text-muted-foreground">Opens {ver.place} in PitchSnack.</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        <dl className="space-y-3 text-sm">
          <Meta k="Sent when" v={ver.sentWhen} />
          <Meta k="Sent to" v={ver.sentTo} />
          <Meta k="Button opens" v={ver.place} />
          <Meta k="Who can change it" v="Admin only. Users can only turn all email alerts off." />
          <Meta k="Placeholders" v={def.placeholders.join(" ")} />
          {def.instant && <Meta k="Quiet hours" v="Ignored — sent at once" />}
        </dl>
      </div>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return <div><dt className="text-xs text-muted-foreground">{k}</dt><dd>{v}</dd></div>;
}

function Seg({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: [string, string][] }) {
  return (
    <div className="inline-flex rounded-lg border border-border p-0.5">
      {items.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} className={cn("rounded-md px-3 py-1 text-xs font-medium", value === k ? "bg-muted text-foreground" : "text-muted-foreground")}>{l}</button>
      ))}
    </div>
  );
}

function Rules({ rules }: { rules: AlertRules }) {
  const [r, setR] = useState(rules);
  const save = useServerFn(saveEmailAlertRules);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => save({ data: r }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["email-alerts-admin"] }); toast.success("Sending rules saved"); },
    onError: (e) => toast.error((e as Error).message),
  });
  const set = <K extends keyof AlertRules>(k: K, v: AlertRules[K]) => setR((x) => ({ ...x, [k]: v }));
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return (
    <div className="max-w-2xl space-y-4">
      <Card title="Quiet hours (Asia/Bangkok)" note="Approval emails are always sent at once.">
        <div className="flex items-center gap-3">
          <Switch checked={r.quietEnabled} onCheckedChange={(v) => set("quietEnabled", v)} />
          <Input type="time" className="w-32" value={r.quietStart} onChange={(e) => set("quietStart", e.target.value)} />
          <span className="text-sm">to</span>
          <Input type="time" className="w-32" value={r.quietEnd} onChange={(e) => set("quietEnd", e.target.value)} />
        </div>
      </Card>
      <Card title="New messages" note="Sent 10 minutes after a message if it is still unread; at most one per conversation per hour.">
        <div className="flex items-center gap-3">
          <Seg value={r.messageMode} onChange={(v) => set("messageMode", v as AlertRules["messageMode"])} items={[["instant", "After 10 minutes"], ["daily", "Daily summary"]]} />
          {r.messageMode === "daily" && <Input type="time" className="w-32" value={r.dailyTime} onChange={(e) => set("dailyTime", e.target.value)} />}
        </div>
      </Card>
      <Card title="Criteria match" note="Sector must always fit. At most 3 match emails per user per week; the rest go into a weekly summary.">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          Needs
          <Input type="number" min={1} max={5} className="w-20" value={r.matchThreshold} onChange={(e) => set("matchThreshold", Number(e.target.value))} />
          of 5 criteria · weekly summary on
          <select className="h-9 rounded-md border border-input bg-background px-2" value={r.weeklyDay} onChange={(e) => set("weeklyDay", Number(e.target.value))}>
            {days.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
          <Input type="time" className="w-32" value={r.weeklyTime} onChange={(e) => set("weeklyTime", e.target.value)} />
        </div>
      </Card>
      <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Save sending rules</Button>
    </div>
  );
}

function Card({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="font-semibold">{title}</div>
      <p className="mb-3 text-xs text-muted-foreground">{note}</p>
      {children}
    </div>
  );
}

function Log({ rows }: { rows: AdminData["log"] }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => rows.filter((r) => !q || `${r.email} ${r.subject} ${r.alert_key}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const pill: Record<string, string> = { sent: "bg-[#DCFCE7] text-[#166534]", test: "bg-muted text-foreground", skipped: "bg-muted text-muted-foreground", suppressed: "bg-[#FEF3DE] text-[#8A4B06]", failed: "bg-destructive/10 text-destructive" };
  return (
    <div className="space-y-3">
      <Input placeholder="Search email, subject or alert" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr className="border-b border-border">
            <th className="p-3">When</th><th className="p-3">Alert</th><th className="p-3">To</th><th className="p-3">Subject</th><th className="p-3">Status</th>
          </tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No emails yet.</td></tr>}
            {list.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-3">{EMAIL_ALERTS.find((a) => a.key === r.alert_key)?.name ?? r.alert_key} · <span className="capitalize text-muted-foreground">{r.role}</span></td>
                <td className="p-3">{r.email ?? "—"}</td>
                <td className="max-w-[320px] truncate p-3" title={r.subject ?? ""}>{r.subject}</td>
                <td className="p-3"><span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", pill[r.status])} title={r.reason ?? ""}>{r.status}</span>{r.reason && <div className="text-[11px] text-muted-foreground">{r.reason}</div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
