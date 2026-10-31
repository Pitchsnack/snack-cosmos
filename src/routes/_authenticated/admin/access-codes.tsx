import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Plus, ShieldCheck, Globe, TriangleAlert, ChevronRight, ChevronDown, Copy, Ticket, StickyNote, CalendarPlus, UserPlus, Power, RefreshCw, X, Check, Minus, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { getAccessCodes, setSoftLaunchGate, newAccessCode, createAccessCode, updateAccessCode, sendAccessInvitation } from '@/lib/access-codes.functions';
import { codeStatus, daysLeft, dateEn, bkkToday, addDays, inviteCopy, inviteText, type AccessCode, type CodeRole, type CodeStatus } from '@/lib/access-codes';

export const Route = createFileRoute('/_authenticated/admin/access-codes')({
  head: () => ({ meta: [
    { title: 'Access codes — PitchSnack Admin' },
    { name: 'description', content: 'Manage soft-launch access codes, free plans and the website gate.' },
    { property: 'og:title', content: 'Access codes — PitchSnack Admin' },
    { property: 'og:description', content: 'Manage soft-launch access codes, free plans and the website gate.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: AccessCodesPage,
});

type Plan = { role: string; key: string; name: string; status: string; price_type: string; sort: number };
const ROLE_LABEL: Record<CodeRole, string> = { seller: 'Seller', buyer: 'Buyer', advisor: 'Advisor', any: 'Any role' };
const ROLE_COL: Record<CodeRole, string> = {
  seller: 'bg-[#FEF3DE] text-[#8A4B06]', buyer: 'bg-[#EEF0FF] text-[#4338CA]', advisor: 'bg-[#E0F5F2] text-[#0F766E]', any: 'bg-[#E6E9F2] text-[#192957]',
};
const mono = { fontFamily: "'IBM Plex Mono', Menlo, Consolas, monospace" };
const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const personName = (u: any) => (u ? [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email : 'an admin');

function usualPlan(plans: Plan[], usual: Record<string, string>, role: string): Plan | undefined {
  const live = plans.filter((p) => p.role === role && p.status === 'live' && p.price_type !== 'free');
  return live.find((p) => p.key === usual[role]) ?? live[0];
}
function planName(c: Pick<AccessCode, 'role' | 'free_plan'>, plans: Plan[]) {
  if (!c.free_plan) return null;
  if (c.role === 'any') return 'usual';
  return plans.find((p) => p.role === c.role && p.key === c.free_plan)?.name ?? c.free_plan;
}

function Pill({ s, c }: { s: CodeStatus; c: AccessCode }) {
  const d = daysLeft(c) ?? 0;
  const [t, cls] = s === 'active' ? ['Active', 'text-[#15803D] bg-[#E7F6EC]'] : s === 'ending' ? [d === 0 ? 'Ends today' : d === 1 ? 'Ends tomorrow' : `Ends in ${d} days`, 'text-[#8A5A06] bg-[#FFF4E0]'] : [s === 'ended' ? 'Ended' : 'Switched off', 'text-[#6B7280] bg-[#EEF0F3]'];
  return <span className={`inline-flex h-[21px] items-center gap-1.5 rounded-full px-2 text-[10.5px] font-bold uppercase tracking-[.04em] ${cls}`}><span className="size-1.5 rounded-full bg-current" />{t}</span>;
}
function Stepper({ value, set, min, max, label, disabled }: { value: number; set: (n: number) => void; min: number; max: number; label: string; disabled?: boolean }) {
  return <div className={`inline-flex h-[34px] items-stretch overflow-hidden rounded-lg border border-[#DCDFE5] bg-white ${disabled ? 'opacity-40' : ''}`} role="group" aria-label={label}>
    <button type="button" className="w-8 grid place-items-center hover:bg-[#F6F7F9] disabled:cursor-not-allowed" disabled={disabled || value <= min} onClick={() => set(value - 1)} aria-label="Less"><Minus className="size-3.5" /></button>
    <span className="w-[52px] grid place-items-center border-x border-[#DCDFE5] text-[13.5px] tabular-nums">{value}</span>
    <button type="button" className="w-8 grid place-items-center hover:bg-[#F6F7F9] disabled:cursor-not-allowed" disabled={disabled || value >= max} onClick={() => set(value + 1)} aria-label="More"><Plus className="size-3.5" /></button>
  </div>;
}

function AccessCodesPage() {
  const qc = useQueryClient();
  const fetchAll = useServerFn(getAccessCodes);
  const q = useQuery({ queryKey: ['access-codes'], queryFn: () => fetchAll() });
  const gateFn = useServerFn(setSoftLaunchGate);
  const updFn = useServerFn(updateAccessCode);
  const [filter, setFilter] = useState<'all' | 'active' | 'ending' | 'gone'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [askGate, setAskGate] = useState(false);
  const [askOff, setAskOff] = useState(false);
  useEffect(() => setAskOff(false), [open]);
  type SortKey = 'client' | 'role' | 'accounts' | 'until' | 'visit' | 'status';
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const d = q.data as any;
  const codes: AccessCode[] = d?.codes ?? [];
  const plans: Plan[] = d?.plans ?? [];
  const usual = (d?.settings?.usual_free_plans ?? {}) as Record<string, string>;
  const admins = new Map<string, any>((d?.admins ?? []).map((a: any) => [a.id, a]));
  const accounts = (d?.accounts ?? []) as any[];
  const devices = (d?.devices ?? []) as any[];
  const statuses = useMemo(() => new Map(codes.map((c) => [c.id, codeStatus(c)])), [codes]);
  const count = (f: typeof filter) => codes.filter((c) => { const s = statuses.get(c.id)!; return f === 'all' || (f === 'active' && (s === 'active' || s === 'ending')) || (f === 'ending' && s === 'ending') || (f === 'gone' && (s === 'ended' || s === 'off')); }).length;
  const filtered = codes.filter((c) => { const s = statuses.get(c.id)!; return filter === 'all' || (filter === 'active' && (s === 'active' || s === 'ending')) || (filter === 'ending' && s === 'ending') || (filter === 'gone' && (s === 'ended' || s === 'off')); });
  const sortVal = (c: AccessCode): string | number => {
    switch (sortKey) {
      case 'client': return c.client_name.toLowerCase();
      case 'role': return c.role;
      case 'accounts': return accounts.filter((a) => a.access_code_id === c.id).length;
      case 'until': return c.ends_on ?? '9999-12-31';
      case 'visit': return devices.filter((x) => x.code_id === c.id).map((x) => x.last_seen_at).sort().pop() ?? '';
      case 'status': return ['active', 'ending', 'ended', 'off'].indexOf(statuses.get(c.id)!);
      default: return 0;
    }
  };
  const shown = sortKey ? [...filtered].sort((a, b) => { const x = sortVal(a), y = sortVal(b); return (x < y ? -1 : x > y ? 1 : 0) * (sortDir === 'asc' ? 1 : -1); }) : filtered;
  const toggleSort = (k: SortKey) => { if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); else { setSortKey(k); setSortDir(k === 'visit' || k === 'accounts' ? 'desc' : 'asc'); } };
  const SortHead = ({ k, label }: { k: SortKey; label: string }) => <button type="button" onClick={() => toggleSort(k)} className={`inline-flex items-center gap-1 text-left uppercase tracking-[.06em] hover:text-[#111827] ${sortKey === k ? 'text-[#111827]' : ''}`}>{label}{sortKey === k ? (sortDir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}</button>;
  const totalVisits = devices.reduce((n, x) => n + (x.visits ?? 0), 0);
  const firstDate = codes.length ? codes[codes.length - 1].created_at : null;
  const gateOn = !!d?.settings?.gate_on;
  const reload = () => qc.invalidateQueries({ queryKey: ['access-codes'] });

  async function gate(on: boolean) {
    try { await gateFn({ data: { on } }); setAskGate(false); toast.success(on ? 'Gate on. Visitors see the access page again.' : 'Gate off. The website is open to everyone, with no ribbon.'); reload(); }
    catch (e: any) { toast.error(e.message); }
  }
  async function act(c: AccessCode, action: 'extend' | 'more' | 'off' | 'on') {
    try {
      const r = await updFn({ data: { id: c.id, action } }) as AccessCode;
      toast.success(action === 'extend' ? `${c.code} now works until ${dateEn(r.ends_on!)}.` : action === 'more' ? `${c.client_name} can now make ${r.max_accounts} accounts.` : action === 'off' ? `${c.code} is switched off.` : r.ends_on ? `${c.code} works again until ${dateEn(r.ends_on)}.` : `${c.code} works again.`);
      setAskOff(false); reload();
    } catch (e: any) { toast.error(e.message); }
  }
  const sendInvFn = useServerFn(sendAccessInvitation);
  const invite = (c: AccessCode) => {
    const pn = planName(c, plans);
    return { client: c.client_name, code: c.code, role: c.role, max: c.max_accounts, endsOn: c.ends_on, planName: pn, months: c.free_months };
  };

  return <div className="mx-auto max-w-[1180px] space-y-4 p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.08em] text-muted-foreground"><KeyRound className="size-3.5" />Control</div>
        <h1 className="mt-1 text-2xl font-bold text-foreground">Access codes</h1>
        <p className="mt-1 max-w-[760px] text-sm text-muted-foreground">Who can open the website during the soft launch. Each client gets one code: it opens the public pages, lets their people create accounts, and gives those accounts a plan free for a set time.</p>
      </div>
      <Button className="bg-[#192957] text-white hover:bg-[#13204a]" onClick={() => setDrawer(true)}><Plus className="size-4" />New code</Button>
    </div>

    <div className={`rounded-[14px] border bg-white px-[18px] py-[14px] ${gateOn ? 'border-[#CFE3D6]' : 'border-[#DCDFE5]'}`}>
      <div className="flex items-center gap-[14px]">
        <div className={`grid size-11 shrink-0 place-items-center rounded-xl ${gateOn ? 'bg-[#E7F6EC] text-[#15803D]' : 'bg-[#EEF0F3] text-[#6B7280]'}`}>{gateOn ? <ShieldCheck className="size-[21px]" /> : <Globe className="size-[21px]" />}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5"><span className="text-[15.5px] font-bold text-[#111827]">Soft launch gate</span>
            <span className={`inline-flex h-[21px] items-center gap-1.5 rounded-full px-2 text-[10.5px] font-bold uppercase tracking-[.04em] ${gateOn ? 'bg-[#E7F6EC] text-[#15803D]' : 'bg-[#EEF0F3] text-[#6B7280]'}`}><span className="size-1.5 rounded-full bg-current" />{gateOn ? `On since ${dateEn(d.settings.changed_at)}` : 'Off · the website is public'}</span></div>
          <p className="mt-1 text-[13px] leading-[1.5] text-[#6B7280]">{gateOn ? 'Visitors need a code to open the public pages and to sign up. Sign-in and everything inside the app work as usual, and search engines are asked not to list the site.' : 'Everyone can open the website and sign up without a code. Turn the gate on again to bring the access page back; the codes below are kept.'}</p>
        </div>
        <label className="flex items-center gap-2 text-[13px] font-semibold text-[#374151]"><Switch checked={gateOn} disabled={!d} onCheckedChange={(v) => (v ? gate(true) : setAskGate(true))} className="data-[state=checked]:bg-[#16A34A]" aria-label="Soft launch gate" />{gateOn ? 'On' : 'Off'}</label>
      </div>
      {askGate && <div className="mt-2.5 flex flex-wrap items-center gap-3 rounded-xl border border-[#F3C4C6] bg-[#FEF3F2] px-[14px] py-[11px] text-[13px] text-[#7A271A]">
        <TriangleAlert className="size-[18px] text-[#B42318]" /><span className="flex-1"><b>Turn the gate off?</b> The website opens to everyone and anyone can sign up without a code. Do this at the public launch.</span>
        <Button variant="outline" size="sm" onClick={() => setAskGate(false)}>Keep it on</Button>
        <Button size="sm" className="bg-[#B42318] text-white hover:bg-[#912018]" onClick={() => gate(false)}>Turn off the gate</Button>
      </div>}
    </div>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-1.5">{([['all', 'All'], ['active', 'Active'], ['ending', 'Ending soon'], ['gone', 'Ended or off']] as const).map(([k, l]) =>
        <Button key={k} size="sm" variant={filter === k ? 'default' : 'outline'} onClick={() => setFilter(k)}>{l} <span className="tabular-nums opacity-70">{count(k)}</span></Button>)}</div>
      <div className="flex gap-[18px] text-[12.5px] text-[#6B7280]"><span><b className="font-semibold tabular-nums text-[#111827]">{accounts.length}</b> accounts made with codes</span>{firstDate && <span><b className="font-semibold tabular-nums text-[#111827]">{totalVisits}</b> visits since {dateEn(firstDate)}</span>}</div>
    </div>

    <div className="overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white">
      <div className="hidden md:grid grid-cols-[1fr_112px_124px_100px_112px_112px_132px_16px] gap-3 bg-[#FAFAFB] px-4 py-[9px] text-[10.5px] font-bold uppercase tracking-[.06em] text-[#9CA3AF]"><SortHead k="client" label="Client" /><span>Code</span><SortHead k="role" label="Role · free plan" /><SortHead k="accounts" label="Accounts" /><SortHead k="until" label="Works until" /><SortHead k="visit" label="Last visit" /><SortHead k="status" label="Status" /><span /></div>
      {q.isLoading && <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>}
      {q.error && <p className="px-4 py-6 text-sm text-destructive">{(q.error as Error).message}</p>}
      {d && !shown.length && <p className="px-4 py-6 text-sm text-muted-foreground">No codes here yet.</p>}
      {shown.map((c) => {
        const s = statuses.get(c.id)!; const gone = s === 'ended' || s === 'off'; const isOpen = open === c.id;
        const used = accounts.filter((a) => a.access_code_id === c.id); const full = used.length >= c.max_accounts;
        const pn = planName(c, plans); const dl = daysLeft(c);
        const devs = devices.filter((x) => x.code_id === c.id); const visits = devs.reduce((n, x) => n + x.visits, 0);
        const last = devs.map((x) => x.last_seen_at).sort().pop();
        return <div key={c.id} className="border-t border-[#F0F1F4] first:border-t-0">
          <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.id)} className={`grid w-full grid-cols-[1fr_auto] md:grid-cols-[1fr_112px_124px_100px_112px_112px_132px_16px] items-center gap-3 px-4 py-3 text-left text-[13px] hover:bg-[#FAFAFB] ${isOpen ? 'bg-[#F7F8FC]' : fresh === c.id ? 'bg-[#F2F4FF]' : ''}`}>
            <span className="flex min-w-0 items-center gap-[11px]"><span className={`grid size-[34px] shrink-0 place-items-center rounded-[9px] text-xs font-bold ${ROLE_COL[c.role]}`}>{initials(c.client_name)}</span>
              <span className="min-w-0"><span className={`block truncate text-[13.5px] font-semibold ${gone ? 'text-[#6B7280]' : 'text-[#111827]'}`}>{c.client_name}</span><span className="block truncate text-xs text-[#6B7280]">{c.invite_email ?? 'No invitation email'}</span></span></span>
            <span className={`hidden md:block text-[12.5px] font-medium tracking-[.04em] ${gone ? 'text-[#6B7280]' : ''}`} style={mono}>{c.code}</span>
            <span className="hidden md:block min-w-0"><span className={`inline-flex h-5 items-center rounded-full px-2 text-[10.5px] font-bold uppercase tracking-[.05em] ${ROLE_COL[c.role]}`}>{ROLE_LABEL[c.role]}</span>
              <span className={`mt-1 block truncate text-[11.5px] leading-[1.3] ${pn ? 'text-[#4B5563]' : 'text-[#9CA3AF]'}`}>{pn === 'usual' ? `Usual plans · ${c.free_months} mo` : pn ? `${pn} · ${c.free_months} mo` : 'No free plan'}</span></span>
            <span className="hidden md:block"><span className="tabular-nums">{used.length} of {c.max_accounts}</span>{full && <span className="ml-1 text-[11px] font-bold text-[#B45309]">Full</span>}
              <span className="mt-[5px] block h-1.5 overflow-hidden rounded-full bg-[#EEF0F4]"><span className={`block h-full rounded-full ${full ? 'bg-[#D97706]' : 'bg-[#192957]'}`} style={{ width: `${Math.min(100, (used.length / c.max_accounts) * 100)}%` }} /></span></span>
            <span className="hidden md:block">{s === 'off' ? <><span className="font-medium">Off</span><span className="block text-[11.5px] text-[#6B7280]">since {dateEn(c.switched_off_at!)}</span></> : c.ends_on ? <><span className="font-medium tabular-nums">{dateEn(c.ends_on)}</span><span className="block text-[11.5px] text-[#6B7280]">{dl! < 0 ? 'Ended' : dl === 0 ? 'today' : dl === 1 ? 'in 1 day' : `in ${dl} days`}</span></> : <span className="text-[#6B7280]">No end date</span>}</span>
            <span className="hidden md:block">{last ? <><span className="font-medium">{whenText(last).split(", ")[0]}</span><span className="block text-[11.5px] text-[#6B7280]">{whenText(last).split(", ").slice(1).join(", ")}</span></> : <span className="text-[#6B7280]">Not opened yet</span>}</span>
            <span className="hidden md:block"><Pill s={s} c={c} /></span>
            {isOpen ? <ChevronDown className="size-4 text-[#9CA3AF]" /> : <ChevronRight className="size-4 text-[#9CA3AF]" />}
          </button>
          {isOpen && <div className="border-t border-[#EEF0F3] bg-[#FCFCFD]">
            <div className="grid md:grid-cols-[1.15fr_1.2fr_1fr] divide-y md:divide-y-0 md:divide-x divide-[#EEF0F3]">
              <div className="px-4 py-[14px]">
                <Cap>Invitation</Cap>
                <div className="flex items-center gap-2.5"><span className="text-[19px] font-semibold tracking-[.08em]" style={mono}>{c.code}</span><Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(c.code); toast.success(`Copied ${c.code}.`); }}><Copy className="size-3.5" />Copy</Button></div>
                <p className="mt-1 text-[12.5px] leading-[1.55] text-[#4B5563]">{c.invite_sent_at ? <>Emailed to <b>{c.invite_email}</b> on {dateEn(c.invite_sent_at)} by {personName(admins.get(c.invite_sent_by!))}.</> : 'Not emailed. Copy the invitation to send it yourself, for example on LINE.'}</p>
                <FreeBox role={c.role} pn={pn} months={c.free_months} plans={plans} usual={usual} />
                <div className="mt-2.5 flex gap-1.5"><Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(inviteCopy(invite(c))); toast.success('Invitation copied, in Thai and English.'); }}>Copy invitation</Button>
                  {c.invite_email && <Button size="sm" variant="outline" className={c.invite_sent_at ? '' : 'border-[#D97706] bg-[#D97706] text-white hover:bg-[#B45309] hover:text-white'} onClick={async () => { try { await sendInvFn({ data: { id: c.id } }); toast.success(`Invitation emailed to ${c.invite_email}.`); reload(); } catch (e: any) { toast.error(e.message); } }}>{c.invite_sent_at ? 'Send again' : 'Email invitation'}</Button>}</div>
              </div>
              <div className="px-4 py-[14px]">
                <Cap>Accounts · {used.length} of {c.max_accounts}</Cap>
                {!used.length ? <p className="text-[12.5px] text-[#6B7280]">No accounts yet.{!gone && ' Nobody has signed up with this code.'}</p> :
                  used.map((u) => { const sub = (d.subs as any[]).find((x) => x.user_id === u.id); const joined = dateEn(u.created_at);
                    const line = sub?.source === 'access_code' && sub.status === 'active' && sub.term_end ? [`Joined ${joined} · free until ${dateEn(sub.term_end)}`, 'text-[#1D4ED8]'] : sub?.access_code_id && sub.source !== 'access_code' ? [`Joined ${joined} · now on ${sub.plans?.name ?? 'a plan'}`, 'text-[#15803D]'] : sub?.source === 'access_code' && sub.term_end ? [`Joined ${joined} · free plan ended ${dateEn(sub.term_end)}`, 'text-[#6B7280]'] : [`Joined ${joined}`, 'text-[#6B7280]'];
                    return <div key={u.id} className="flex items-center gap-[9px] border-t border-[#F2F3F6] py-[7px] first:border-t-0"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#E6E9F2] text-[11px] font-semibold text-[#192957]">{initials(personName(u))}</span>
                      <span className="min-w-0"><span className="block text-[12.5px] font-semibold text-[#111827]">{personName(u)}</span><span className="block truncate text-[11.5px] text-[#6B7280]">{u.email}</span><span className={`block truncate text-[11.5px] ${line[1]}`}>{line[0]}</span></span></div>; })}
              </div>
              <div className="px-4 py-[14px]">
                <Cap>Activity</Cap>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-[5px] text-[12.5px]">
                  <dt className="text-[#6B7280]">Visits</dt><dd className="font-semibold tabular-nums">{visits}</dd>
                  <dt className="text-[#6B7280]">Devices</dt><dd className="font-semibold tabular-nums">{devs.length}</dd>
                  <dt className="text-[#6B7280]">Last visit</dt><dd className="font-semibold">{last ? whenText(last) : 'Not opened yet'}</dd>
                  <dt className="text-[#6B7280]">Made</dt><dd className="font-semibold">{dateEn(c.created_at)} · {personName(admins.get(c.created_by))}</dd>
                </dl>
                {c.note && <div className="mt-2.5 flex gap-2 rounded-[9px] bg-[#F6F7F9] px-2.5 py-2 text-xs leading-[1.5] text-[#4B5563]"><StickyNote className="mt-0.5 size-3.5 shrink-0 text-[#9CA3AF]" />{c.note}</div>}
              </div>
            </div>
            {!gone ? (askOff ? <div className="flex flex-wrap items-center gap-2 border-t border-[#F3C4C6] bg-[#FEF3F2] px-4 py-2.5 text-[12.5px] text-[#7A271A]"><span className="flex-1"><b>Switch off {c.code}?</b> {c.client_name} can’t open the website or sign up with it any more.{used.length ? (used.length === 1 ? ' Their 1 account keeps working.' : ` Their ${used.length} accounts keep working.`) : ''}</span>
              <Button size="sm" variant="outline" onClick={() => setAskOff(false)}>Cancel</Button><Button size="sm" className="bg-[#B42318] text-white hover:bg-[#912018]" onClick={() => act(c, 'off')}>Switch off</Button></div>
              : <div className="flex flex-wrap gap-2 border-t border-[#EEF0F3] bg-white px-4 py-2.5">
                <Button size="sm" variant="outline" onClick={() => act(c, 'extend')}><CalendarPlus className="size-3.5" />{c.ends_on ? 'Extend 30 days' : 'Set an end date'}</Button>
                <Button size="sm" variant="outline" disabled={c.max_accounts >= 50} onClick={() => act(c, 'more')}><UserPlus className="size-3.5" />Allow 1 more account</Button>
                <Button size="sm" variant="outline" className="ml-auto text-[#B42318] hover:border-[#F3C4C6] hover:bg-[#FEF3F2] hover:text-[#B42318]" onClick={() => setAskOff(true)}><Power className="size-3.5" />Switch off</Button></div>)
              : <div className="flex flex-wrap items-center gap-2 border-t border-[#EEF0F3] bg-white px-4 py-2.5 text-[12.5px] text-[#6B7280]"><span className="flex-1">{s === 'off' ? `Switched off on ${dateEn(c.switched_off_at!)} by ${personName(admins.get(c.switched_off_by!))}.` : `Ended on ${dateEn(c.ends_on!)}.`} Nobody new can come in with this code.</span>
                <Button size="sm" variant="outline" onClick={() => act(c, 'on')}><RefreshCw className="size-3.5" />{s === 'off' ? 'Switch on again' : 'Reopen for 30 days'}</Button></div>}
          </div>}
        </div>;
      })}
    </div>
    {drawer && d && <NewCodeDrawer plans={plans} usual={usual} onClose={() => setDrawer(false)} onMade={(c) => { setDrawer(false); setFilter('all'); setOpen(c.id); setFresh(c.id); reload(); }} />}
  </div>;
}

function whenText(iso: string) {
  const t = new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
  return bkkToday(new Date(iso)) === bkkToday() ? `Today, ${t}` : `${dateEn(bkkToday(new Date(iso)))}, ${t}`;
}
function Cap({ children }: { children: React.ReactNode }) { return <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[.07em] text-[#9CA3AF]">{children}</div>; }
function FreeBox({ role, pn, months, plans, usual }: { role: CodeRole; pn: string | null; months: number; plans: Plan[]; usual: Record<string, string> }) {
  const mo = months === 1 ? '1 month' : `${months} months`;
  if (!pn) return <div className="mt-2 flex gap-[7px] rounded-[9px] border border-[#E5E7EB] bg-[#F6F7F9] px-2.5 py-2 text-[12.5px] leading-[1.5] text-[#4B5563]"><Ticket className="mt-0.5 size-3.5 shrink-0 text-[#9CA3AF]" /><span><b className="text-[#111827]">No free plan.</b> Accounts start as new users do.</span></div>;
  const u = (r: string) => usualPlan(plans, usual, r)?.name ?? '—';
  return <div className="mt-2 flex gap-[7px] rounded-[9px] border border-[#DBE7FB] bg-[#F5F9FF] px-2.5 py-2 text-[12.5px] leading-[1.5] text-[#1E3A5F]"><Ticket className="mt-0.5 size-3.5 shrink-0 text-[#2563EB]" />
    <span><b className="text-[#111827]">{role === 'any' ? `Each role’s usual plan (sellers ${u('seller')}, buyers ${u('buyer')}, advisors ${u('advisor')})` : pn}</b> free for {mo}, from the day each account is made. Then they choose a plan.</span></div>;
}

function NewCodeDrawer({ plans, usual, onClose, onMade }: { plans: Plan[]; usual: Record<string, string>; onClose: () => void; onMade: (c: AccessCode) => void }) {
  const makeFn = useServerFn(newAccessCode); const createFn = useServerFn(createAccessCode);
  const [client, setClient] = useState(''); const [email, setEmail] = useState(''); const [role, setRole] = useState<CodeRole>('seller');
  const [plan, setPlan] = useState<string>(() => usualPlan(plans, usual, 'seller')?.key ?? ''); const [months, setMonths] = useState(3);
  const [max, setMax] = useState(3); const [ends, setEnds] = useState<string>(addDays(bkkToday(), 30)); const [chip, setChip] = useState<string | null>('30');
  const [code, setCode] = useState(''); const [note, setNote] = useState(''); const [lang, setLang] = useState<'th' | 'en'>('th');
  const [errs, setErrs] = useState<{ client?: string; email?: string }>({}); const [busy, setBusy] = useState(false);
  const another = () => makeFn().then((r) => setCode(r.code)).catch((e) => toast.error(e.message));
  useEffect(() => { another(); const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  const options = role === 'any' ? [['usual', 'Each role’s usual plan']] : plans.filter((p) => p.role === role && p.status === 'live' && p.price_type !== 'free').map((p) => [p.key, p.key === usualPlan(plans, usual, role)?.key ? `${p.name} · usual plan` : p.name]);
  function pickRole(r: CodeRole) { setRole(r); if (plan !== '') setPlan(r === 'any' ? 'usual' : usualPlan(plans, usual, r)?.key ?? ''); }
  const u = (r: string) => usualPlan(plans, usual, r)?.name ?? '—';
  const pn = plan === '' ? null : role === 'any' ? 'usual' : plans.find((p) => p.role === role && p.key === plan)?.name ?? null;
  const emailOk = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  async function save() {
    const e: typeof errs = {}; if (!client.trim()) e.client = 'Enter the client’s name.'; if (!emailOk) e.email = 'Enter an address like name@company.co.th, or leave it empty.';
    setErrs(e); if (Object.keys(e).length || !code) return;
    setBusy(true);
    try {
      const r = await createFn({ data: { code, client: client.trim(), email: email.trim() || null, role, freePlan: plan || null, months, max, endsOn: chip === 'none' ? null : ends || null, note: note.trim() || null } }) as AccessCode;
      toast.success(`${r.code} created. Copy the invitation from its row.`); onMade(r);
    } catch (x: any) { toast.error(x.message); } finally { setBusy(false); }
  }
  const field = 'h-9 rounded-lg border-[#DCDFE5] text-[13.5px]';
  return <div className="fixed inset-x-0 bottom-0 top-14 z-50">
    <div className="absolute inset-0 bg-[rgba(21,26,40,.32)]" onClick={onClose} />
    <div role="dialog" aria-modal="true" aria-labelledby="nc-title" className="absolute right-0 top-0 flex h-full w-full max-w-[500px] flex-col border-l border-[#DCDFE5] bg-white shadow-[-24px_0_48px_-24px_rgba(16,24,40,.4)]">
      <div className="flex items-start justify-between border-b border-[#EEF0F3] px-5 pb-[14px] pt-[18px]"><div><h2 id="nc-title" className="text-xl font-bold text-[#111827]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>New access code</h2><p className="text-[12.5px] text-[#6B7280]">One code for one client. It opens the website and sign-up for their people.</p></div>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}><X className="size-4" /></Button></div>
      <div className="flex-1 space-y-[14px] overflow-y-auto px-5 pb-5 pt-4">
        <F label="Client" hint="Shown in the website ribbon and on the sign-up page." err={errs.client}><Input className={field} value={client} onChange={(e) => setClient(e.target.value)} placeholder="Company or client name" aria-invalid={!!errs.client} /></F>
        <F label="Invitation email · optional" err={errs.email}><Input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.co.th" aria-invalid={!!errs.email} /></F>
        <F label="Role" hint="Picked for them on the sign-up page. They can change it."><div className="inline-flex rounded-md border border-border">{(['seller', 'buyer', 'advisor', 'any'] as CodeRole[]).map((r) => <Button key={r} size="sm" type="button" variant={role === r ? 'default' : 'ghost'} onClick={() => pickRole(r)}>{ROLE_LABEL[r]}</Button>)}</div></F>
        <F label="Free plan">
          <div className={`space-y-2.5 rounded-xl border p-3 ${plan === '' ? 'border-[#E5E7EB] bg-[#FAFAFB]' : 'border-[#DBE7FB] bg-[#F8FBFF]'}`}>
            <div className="flex items-center gap-3">
              <div className="relative flex-1"><select aria-label="Free plan" value={plan} onChange={(e) => setPlan(e.target.value)} className="h-9 w-full appearance-none rounded-lg border border-[#DCDFE5] bg-white pl-2.5 pr-[30px] text-[13.5px] text-[#151A28] focus:outline-none focus:ring-2 focus:ring-[#192957]/30">
                {options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}<option value="">No free plan</option></select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#6B7280]" /></div>
              <Stepper value={months} set={setMonths} min={1} max={12} label="Months free" disabled={plan === ''} /><span className="text-[13px] text-[#4B5563]">months</span>
            </div>
            <p className="text-xs leading-[1.45] text-[#6B7280]">{plan === '' ? 'Accounts start as new users do: sellers on Entry, buyers and advisors with no plan.' : role === 'any' ? `Sellers get ${u('seller')}, buyers ${u('buyer')}, advisors ${u('advisor')}, from the day each account is made.` : 'From the day each account is made. Someone who picks another role at sign-up gets that role’s usual plan.'}</p>
          </div>
        </F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Accounts" hint="People from this client who can sign up."><Stepper value={max} set={setMax} min={1} max={50} label="Accounts" /></F>
          <F label="Works until"><Input className={field} type="date" min={addDays(bkkToday(), 1)} value={chip === 'none' ? '' : ends} disabled={chip === 'none'} onChange={(e) => { setEnds(e.target.value); setChip(null); }} />
            <div className="mt-1.5 flex flex-wrap gap-1">{([['14', '14 days'], ['30', '30 days'], ['60', '60 days'], ['none', 'No end date']] as const).map(([k, l]) => <button type="button" key={k} onClick={() => { setChip(k); if (k !== 'none') setEnds(addDays(bkkToday(), Number(k))); }} className={`h-[26px] rounded-full border px-[9px] text-xs font-semibold ${chip === k ? 'border-[#192957] bg-[#F1F4FA] text-[#192957]' : 'border-[#DCDFE5] text-[#4B5563]'}`}>{l}</button>)}</div></F>
        </div>
        <F label="Code" hint="Made by PitchSnack, with no 0, O, 1, I or L, so it can’t be misread."><div className="flex items-center justify-between rounded-[10px] border border-dashed border-[#C9CFD9] bg-[#F9FAFB] px-3 py-2.5"><span className="text-xl font-semibold tracking-[.09em]" style={mono}>{code || '…'}</span><Button size="sm" variant="outline" type="button" onClick={another}><RefreshCw className="size-3.5" />Make another</Button></div></F>
        <F label="Note · only admins see it"><Textarea className="min-h-16" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Met at the SME Expo" /></F>
        <F label="Invitation" hint="One email with both languages, Thai first. Emailing it from here comes in a later step; copy it from the code’s row for now.">
          <div className="overflow-hidden rounded-xl border border-[#E5E7EB]"><div className="flex items-center justify-between bg-[#F6F7F9] py-2 pl-3 pr-2.5 text-xs text-[#6B7280]">Preview<div className="inline-flex rounded-md border border-border bg-white">{(['th', 'en'] as const).map((l) => <Button key={l} type="button" size="sm" variant={lang === l ? 'default' : 'ghost'} onClick={() => setLang(l)}>{l === 'th' ? 'ไทย' : 'English'}</Button>)}</div></div>
            <div className="space-y-1 px-[14px] py-3 text-[12.5px] leading-[1.65]" style={{ fontFamily: "'IBM Plex Sans Thai Looped', sans-serif" }} lang={lang}>{inviteText({ client: client.trim() || '{client}', code: code || 'PS-XXXX-XXXX', role, max, endsOn: chip === 'none' ? null : ends || null, planName: pn, months }, lang).map((l, i) => <p key={i} className={i === 0 ? 'font-semibold' : ''}>{l}</p>)}</div></div>
        </F>
      </div>
      <div className="flex justify-end gap-2 border-t border-[#EEF0F3] bg-[#FAFAFB] px-5 py-3"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy || !code} className="bg-[#192957] text-white hover:bg-[#13204a]" onClick={save}><Check className="size-4" />Create code</Button></div>
    </div>
  </div>;
}
function F({ label, hint, err, children }: { label: string; hint?: string; err?: string; children: React.ReactNode }) {
  return <div><div className="mb-1 text-[12.5px] font-semibold text-[#374151]">{label}</div>{children}{err ? <p className="mt-1 text-xs text-[#B42318]">{err}</p> : hint && <p className="mt-1 text-xs text-[#6B7280]">{hint}</p>}</div>;
}
