import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ArrowUp, Check, ChevronLeft, Copy, FileText, GitBranch, Lock, Paperclip, Search, Users, X } from "lucide-react";
import { toast } from "sonner";
import { usePersona } from "@/hooks/use-marketplace";
import { listPipeline, type PipelineRow } from "@/lib/pipeline.functions";
import { listAdvisorPipeline, type AdvDeal } from "@/lib/advisor-pipeline.functions";
import {
  threadSummaries, threadMessages, markThreadRead, sendMessage, messageUploadUrl, messageFileUrl,
  type MsgFile, type ThreadMessage, type DaMeta, type Member, type Role,
} from "@/lib/messages.functions";
import { STEPS, currentStep, stepDates, waitState } from "@/lib/pipeline-state";
import { NdaDialog, LoiDialog, ReportViewer, InvestorProfile, SellerProfile } from "@/components/pipeline/pipeline-dialogs";
import { AdvisorNdaDialog, AdvisorProfileDialog } from "@/components/pipeline/advisor-bits";
import { cn } from "@/lib/utils";
import { useBump } from "@/hooks/use-bump";
import { tr, useTranslation } from "@/i18n/language";
import { Button } from "@/components/ui/button";
import { adminHelpSummaries, setHelpDone, type HelpProfile } from "@/lib/admin-help.functions";
import { HatMark } from "./hat-mark";
import { DialogTitle } from "@/components/ui/dialog";
import { draftKey, saveDraft, useChatDrafts, type ChatDraft } from "./chat-drafts";
import { tf } from "@/components/advisor-browse/enquiry-dialogs";
import { EnquiryCardView, EnquiryHeaderActions, ProposalCardView, enqStatusLabel } from "@/components/advisor-browse/enquiry-chat";
import type { EnqMeta, EnquiryThread } from "@/lib/messages.functions";

/**
 * Marketplace › Messages for every tab (seller, buyer, advisor). Seller–buyer
 * conversations ('p:'), PitchSnack Help ('a:') and deal-advisor conversations
 * ('c:'), with who is who in every chat. Access is checked on the server.
 */
type Side = "seller" | "buyer";
type Conv = {
  profile?: HelpProfile; done?: { by: string; at: string } | null; key: string; kind: "p" | "a" | "c" | "e"; enq?: EnqMeta | null; name: string; person: string | null; sub: string; codeName: string | null;
  p: PipelineRow | null; adv: AdvDeal | null; meta: DaMeta | null;
  who: { label: string; dot: string } | null;
  unread: number; last: { body: string; mine: boolean; at: string; from: string | null } | null; startAt: string | null;
};
type Dialog = null | "nda" | "loi" | "report" | "profile" | "advProfile" | { advNda: { dealId: string; side: Side } };

const DOT: Record<Role, string> = { seller: "#F6A823", buyer: "#4338CA", advisor: "#0F766E" };
const TAG: Record<Role, string> = { seller: "bg-[#FEF3DE] text-[#8A4B06]", buyer: "bg-[#EEF0FF] text-[#4338CA]", advisor: "bg-[#E0F5F2] text-[#0F766E]" };
const TEXT: Record<Role, string> = { seller: "text-[#8A4B06]", buyer: "text-[#4338CA]", advisor: "text-[#0F766E]" };
const BUBBLE: Record<Role, string> = { seller: "bg-[#FEF3DE] text-[#3A2606]", buyer: "bg-[#EEF0FF] text-[#1E1B4B]", advisor: "bg-[#E0F5F2] text-[#134E4A]" };
const SEND: Record<Role, string> = { seller: "bg-[#F6A823] text-[#0E162F]", buyer: "bg-[#4338CA] text-white", advisor: "bg-[#0F766E] text-white" };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function initials(s: string) {
  return s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}
function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}
function listTime(s: string) {
  const d = new Date(s), now = new Date();
  if (sameDay(d, now)) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return "Yesterday";
  if (now.getTime() - d.getTime() < 6 * 86_400_000) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }).replace("Sept", "Sep");
}
function dayLabel(d: Date) {
  const now = new Date();
  if (sameDay(d, now)) return "Today";
  if (now.getTime() - d.getTime() < 6 * 86_400_000) return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "").replace("Sept", "Sep");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }).replace("Sept", "Sep");
}
const hm = (s: string) => new Date(s).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const ext = (n: string) => (n.split(".").pop() ?? "").toUpperCase();

/** The relation label of a deal-advisor conversation, for the reader. */
function relation(m: DaMeta, as: Role): string {
  if (as === "advisor") return m.withSide === m.clientSide ? "Your client" : cap(m.withSide);
  return m.clientSide === as ? "Your advisor" : m.clientSide === "seller" ? "Seller’s advisor" : "Buyer’s advisor";
}
function advDates(d: AdvDeal) {
  return [d.ndaAt, d.reportAt, d.loiAt, d.joinedAt, d.legalAt, d.spaAt, d.paymentAt];
}

export function MessagesPage({ adminView = false }: { adminView?: boolean }) {
  const { language } = useTranslation();
  const { persona } = usePersona();
  const as = persona as Role;
  const pFn = useServerFn(listPipeline);
  const aFn = useServerFn(listAdvisorPipeline);
  const tFn = useServerFn(threadSummaries);
  const hFn = useServerFn(adminHelpSummaries);
  const { data: helpSums = [], error: helpError, isPending: helpPending } = useQuery({ queryKey: ["messages", "admin-help"], queryFn: () => hFn(), enabled: adminView, refetchInterval: 5000 });
  const { data: rows = [] } = useQuery({ queryKey: ["pipeline", persona], queryFn: () => pFn({ data: { as: persona as Side } }), enabled: !adminView && as !== "advisor" });
  const { data: advData } = useQuery({ queryKey: ["advisor-pipeline"], queryFn: () => aFn(), enabled: !adminView && as === "advisor" });
  const { data: sums = [] } = useQuery({ queryKey: ["messages", "threads", persona], queryFn: () => tFn({ data: { as } }), enabled: !adminView, refetchInterval: 2500, refetchIntervalInBackground: true });

  const [sel, setSel] = useState<string | null>(null);
  const convs: Conv[] = useMemo(() => {
    if (adminView) return helpSums.map((s): Conv => ({ key: s.key, kind: "a", profile: s.profile, done: s.done, p: null, adv: null, meta: null, name: s.profile.name, person: null, sub: s.profile.company, codeName: null, who: { label: `${tr(cap(s.profile.role))} · ${s.profile.company}`, dot: DOT[s.profile.role] }, unread: s.unread, last: s.last, startAt: null }));
    const sm = Object.fromEntries(sums.map((s) => [s.key, s]));
    const out: Conv[] = [];
    if (as !== "advisor") {
      for (const p of rows.filter((r) => r.ndaApprovedAt)) {
        const key = `p:${p.id}`;
        out.push({
          key, kind: "p", p, adv: null, meta: null,
          name: as === "seller" ? p.parties.buyerOrg : p.parties.sellerCompany,
          person: as === "seller" ? p.parties.buyerName : p.parties.sellerName,
          sub: p.counterparty.sub, codeName: p.parties.codeName,
          who: as === "seller" ? { label: "Buyer", dot: DOT.buyer } : { label: "Seller", dot: DOT.seller },
          unread: key === sel ? 0 : sm[key]?.unread ?? 0, last: sm[key]?.last ?? null, startAt: p.ndaApprovedAt,
        });
      }
    }
    for (const s of sums) {
      const e = s.enq;
      if (!e) continue;
      const firm = e.isFirm;
      out.push({
        key: s.key, kind: "e", enq: e, meta: null, p: null, adv: null,
        name: firm ? e.clientCompany : e.firm.name, person: null, sub: firm ? "" : e.firm.sub, codeName: null,
        who: { label: [firm ? (e.clientSide === "seller" ? "Seller" : "Buyer") : tr("Advisor"), enqStatusLabel(e.status, firm, e.isNew), firm ? e.service : tr(e.service), ...(firm && e.toFirm ? [tr("to {firm}").replace("{firm}", e.toFirm)] : [])].join(" · "), dot: firm ? DOT[e.clientSide] : DOT.advisor },
        unread: s.key === sel ? 0 : s.unread, last: s.last, startAt: null,
      });
    }
    for (const s of sums) {
      const m = s.meta;
      if (!m) continue;
      const rel = relation(m, as);
      out.push({
        key: s.key, kind: "c", meta: m,
        p: as === "advisor" ? null : rows.find((r) => r.id === m.dealId) ?? null,
        adv: as === "advisor" ? advData?.deals.find((d) => d.dealId === m.dealId) ?? null : null,
        name: m.other, person: null, sub: as === "advisor" ? "" : m.firm.sub, codeName: m.codeName,
        who: { label: rel, dot: as === "advisor" ? DOT[m.withSide] : DOT.advisor },
        unread: s.key === sel ? 0 : s.unread, last: s.last, startAt: m.joinedAt,
      });
    }
    const t = (c: Conv) => c.last?.at ?? c.startAt ?? "0";
    out.sort((a, b) => t(b).localeCompare(t(a)));
    const help = sums.find((s) => s.key.startsWith("a:"));
    if (help) out.unshift({ key: help.key, kind: "a", p: null, adv: null, meta: null, who: null, name: tr("Help desk"), person: null, sub: "", codeName: null, unread: help.key === sel ? 0 : help.unread, last: help.last, startAt: null });
    return out;
  }, [rows, advData, sums, as, sel, adminView, helpSums, language]);

  const [q, setQ] = useState("");
  const [mobileChat, setMobileChat] = useState(false);
  const [panel, setPanel] = useState(false);
  useEffect(() => { setPanel(false); setSel(null); }, [persona]);
  const [wanted, setWanted] = useState<string | null>(() => typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("thread"));
  useEffect(() => {
    if (wanted && convs.some((c) => c.key === wanted)) { setSel(wanted); setMobileChat(true); setWanted(null); return; }
    if (!sel && convs.length && !wanted) setSel(convs[0].key);
  }, [convs, sel, wanted]);

  const [tab, setTab] = useState<"open" | "done">("open");
  const doneN = adminView ? convs.filter((c) => c.done).length : 0;
  const shown = convs.filter((c) => {
    if (adminView && (tab === "done") !== !!c.done) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [c.name, c.sub, c.person, c.codeName, c.who?.label, c.last?.body].some((x) => x?.toLowerCase().includes(s));
  });
  const current = convs.find((c) => c.key === sel) ?? null;

  const card = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState<number | null>(null);
  useEffect(() => {
    const fit = () => {
      const el = card.current;
      if (el) setCardH(Math.max(520, window.innerHeight - el.getBoundingClientRect().top - window.scrollY - 24));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const preview = (c: Conv) => {
    if (c.last) return `${c.last.mine ? "You: " : c.last.from ? `${c.last.from}: ` : ""}${c.last.body}`;
    if (c.kind === "c" && c.meta) {
      if (as === "advisor") return "You joined the deal";
      return c.meta.clientSide === as ? `${c.meta.firm.name} joined as your advisor` : `${c.meta.firm.name} joined for ${c.meta.clientSide === "seller" ? c.meta.sellerOrg : c.meta.buyerOrg}`;
    }
    if (c.kind === "e") return c.enq?.isFirm ? "New enquiry" : tr("Enquiry sent");
    return c.p ? "NDA approved. Say hello." : "Ask your advisor anything.";
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 pt-6 md:px-8">
      <h1 className="text-[30px] font-bold leading-tight">{adminView ? tr("Messages") : "Messages"}</h1>
      {adminView && helpError && <p role="alert" className="text-destructive">{tr("Unable to open Help desk messages.")}</p>}
      <div ref={card} style={{ height: cardH ?? undefined }} className={cn(adminView && "admin-messages", "relative mt-5 flex h-[calc(100vh-260px)] min-h-[520px] overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white")}>
        <div className={cn("flex w-full shrink-0 flex-col border-r border-[#F0F1F4] min-[760px]:w-[300px]", mobileChat && "max-[759px]:hidden")}>
          <label className="flex h-14 shrink-0 items-center gap-2 border-b border-[#F0F1F4] px-5">
            <Search className="h-4 w-4 text-[#9CA3AF]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={adminView ? tr("Search name, company or message") : "Search"} aria-label="Search conversations" className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-[#9CA3AF]" />
          </label>
          {adminView && (
            <div role="tablist" className="flex shrink-0 gap-5 border-b border-[#F0F1F4] px-5">
              {(["open", "done"] as const).map((t) => (
                <Button key={t} variant="unstyled" size="unstyled" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                  className={cn("-mb-px border-b-2 py-2.5 text-[13px]", tab === t ? "border-[#F6A823] font-semibold text-[#111827] dark:text-foreground" : "border-transparent text-[#6B7280]")}>
                  {t === "open" ? tr("Open") : language === "th" ? tr("Done conversations") : "Done"} {t === "open" ? convs.length - doneN : doneN}
                </Button>
              ))}
            </div>
          )}
          <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {shown.length === 0 && <div className="py-8 text-center text-[13px] text-[#9CA3AF]">{adminView ? (helpPending ? tr("Loading…") : tr(convs.length ? "No conversations match." : "No messages yet.")) : convs.length ? "No conversations match." : "No conversations yet."}</div>}
            {shown.map((c) => c.kind === "a" && !adminView ? (
              <div key={c.key}>
                <Button variant="unstyled" size="unstyled"
                  onClick={() => { setSel(c.key); setMobileChat(true); if (!adminView) setPanel(false); }}
                  aria-label={c.last ? (c.unread ? `${tr("Help desk")}, ${tr("new message")}, ${listTime(c.last.at)}` : `${tr("Help desk")}, ${listTime(c.last.at)}`) : tr("Help desk")}
                  className={cn("flex h-11 w-full items-center rounded-[10px] pl-[14px] pr-3 text-left hover:bg-[#F2F3F6] dark:hover:bg-white/5", c.key === sel && "bg-[#F2F3F6] dark:bg-white/5")}
                >
                  <HatMark width={18} />
                  <span className="ml-2 whitespace-nowrap text-[14px] font-medium text-[#374151] dark:text-[#E5E7EB]">{tr("Help desk")}</span>
                  {c.unread > 0 && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[#2563EB] dark:bg-[#3B82F6]" />}
                  <span className={cn("shrink-0 text-[12px] text-[#9CA3AF]", c.unread > 0 ? "ml-2" : "ml-auto pl-2")}>{c.last ? listTime(c.last.at) : ""}</span>
                </Button>
                <div className="mx-2 my-[5px] h-px bg-[#F0F1F4] dark:bg-white/10" />
              </div>
            ) : (
              <Button variant="unstyled" size="unstyled"
                key={c.key}
                onClick={() => { setSel(c.key); setMobileChat(true); if (!adminView) setPanel(false); }}
                className={cn("block h-auto w-full rounded-[10px] py-[11px] pb-3 pl-[14px] pr-3 text-left", adminView ? c.key === sel ? "bg-secondary text-secondary-foreground" : "hover:bg-secondary" : c.key === sel ? "bg-[#F2F3F6]" : "hover:bg-[#F7F8FA]")}
              >
                <div className="flex items-center">
                  <span className={cn("min-w-0 truncate text-[14px] text-[#111827]", c.unread ? "font-bold" : "font-medium")}>{c.name}</span>
                  <RowCount n={c.unread} />
                  <span className="ml-auto shrink-0 pl-2 text-[11.5px] text-[#9CA3AF]">{c.last ? listTime(c.last.at) : c.kind === "c" && c.startAt ? listTime(c.startAt) : ""}</span>
                </div>
                {c.who && (
                  <div className="my-[3px] flex items-center gap-1.5 text-[12px] leading-4 text-[#6B7280]">
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", adminView && c.profile && `help-${c.profile.role}`)} style={adminView ? undefined : { background: c.who.dot }} />
                    <span className="truncate">{[c.who.label, c.codeName].filter(Boolean).join(" · ")}</span>
                  </div>
                )}
                <div className={cn("mt-0.5 truncate text-[13px]", c.unread ? "text-[#374151]" : "text-[#6B7280]")}>{preview(c)}</div>
              </Button>
            ))}
          </div>
        </div>
        {current ? (
          <Chat key={current.key} c={current} as={adminView ? "seller" : as} adminView={adminView} panel={panel && (adminView || !!current.p || !!current.adv || current.kind === "c")} setPanel={setPanel} onBack={() => setMobileChat(false)} hiddenMobile={!mobileChat} />
        ) : (
          <div className="hidden flex-1 place-items-center text-[13px] text-[#9CA3AF] min-[760px]:grid">Select a conversation</div>
        )}
      </div>
    </div>
  );
}

/** The same Messages chat, with no conversation-navigation controls. */
export function LockedDealChat({ p, as, onClose }: { p: PipelineRow; as: Side; onClose: () => void }) {
  const c: Conv = { key: `p:${p.id}`, kind: 'p', p, adv: null, meta: null,
    name: as === 'seller' ? p.parties.buyerOrg : p.parties.sellerCompany,
    person: as === 'seller' ? p.parties.buyerName : p.parties.sellerName,
    sub: p.counterparty.sub, codeName: p.parties.codeName, who: null,
    unread: 0, last: null, startAt: p.ndaApprovedAt };
  return <Chat c={c} as={as} panel={false} setPanel={() => {}} onBack={() => {}} hiddenMobile={false} popupClose={onClose} />;
}

type Item =
  | { kind: "day"; id: string; label: string }
  | { kind: "event"; id: string; text: string; link: string | null; open: Dialog }
  | { kind: "group"; id: string; sender: string; mine: boolean; msgs: ThreadMessage[] }
  | { kind: "card"; id: string; card: { t: "q"; x: EnquiryThread["enquiries"][number] } | { t: "r"; x: EnquiryThread["proposals"][number] } };

function Chat({ c, as, adminView = false, panel, setPanel, onBack, hiddenMobile, popupClose }: { c: Conv; as: Role; adminView?: boolean; panel: boolean; setPanel: (b: boolean) => void; onBack: () => void; hiddenMobile: boolean; popupClose?: () => void }) {
  const popup = !!popupClose;
  const drafts = useChatDrafts();
  const draftId = draftKey(as === "buyer" ? "buyer" : "seller", c.p?.id ?? c.key);
  const [contact, setContact] = useState<Member | null>(null);
  const contactOpener = useRef<HTMLElement | null>(null);
  const atEnd = useRef(true);
  const openContact = (m: Member, trigger: HTMLElement) => { contactOpener.current = trigger; setContact(m); };
  const dismissContact = () => { setContact(null); contactOpener.current?.focus(); };
  const qc = useQueryClient();
  const mFn = useServerFn(threadMessages);
  const readFn = useServerFn(markThreadRead);
  const sendFn = useServerFn(sendMessage);
  const upFn = useServerFn(messageUploadUrl);
  const urlFn = useServerFn(messageFileUrl);
  const { data, error, isPending } = useQuery({ queryKey: ["messages", "thread", c.key], queryFn: () => mFn({ data: { key: c.key } }), refetchInterval: adminView ? 5000 : 2500 });
  const profile = adminView ? ((data as any)?.adminProfile as HelpProfile | null) ?? c.profile : null;
  const [dialog, setDialog] = useState<Dialog>(null);
  const [people, setPeople] = useState(false);
  const pipeBtn = useRef<HTMLButtonElement>(null);
  const peopleBtn = useRef<HTMLButtonElement>(null);
  const peopleBox = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const seller = as === "seller";
  const isC = c.kind === "c";
  const isE = c.kind === "e";
  const enq = ((data as any)?.enquiry ?? null) as EnquiryThread | null;

  const msgs: ThreadMessage[] = (data?.messages ?? []) as ThreadMessage[];
  const members: Member[] = (data?.members ?? []) as Member[];
  const myRole = (data?.myRole ?? as) as Role;
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));
  const sameSide = (id: string) => byId[id] ? byId[id].role === myRole : id === undefined;
  const others = members.filter((m) => m.role !== myRole).sort((a, b) => Number(b.main) - Number(a.main) || a.name.localeCompare(b.name));
  const mine = members.filter((m) => m.role === myRole).sort((a, b) => (a.id === (data as any)?.meId ? -1 : 0) - (b.id === (data as any)?.meId ? -1 : 0) || a.name.localeCompare(b.name));
  const lastIn = [...msgs].reverse().find((m) => !m.mine)?.at;

  useEffect(() => {
    if (!data) return;
    const key = ["messages", "threads"];
    qc.setQueriesData({ queryKey: key }, (old: any) => Array.isArray(old) ? old.map((t: any) => (t.key === c.key ? { ...t, unread: 0 } : t)) : old);
    readFn({ data: { key: c.key } }).then(() => qc.invalidateQueries({ queryKey: ["messages"] })).catch((e) => toast.error((e as Error).message));
  }, [c.key, lastIn, !!data]);

  const items = useMemo(() => {
    const ev: { id: string; at: string; text: string; link: string | null; open: Dialog }[] = [];
    const p = c.p;
    if (c.kind === "p" && p) {
      if (p.ndaApprovedAt) ev.push({ id: "nda", at: p.ndaApprovedAt, text: seller ? "You approved the NDA" : "NDA approved", link: "View NDA", open: "nda" });
      if (p.reportSharedAt) ev.push({ id: "rep", at: p.reportSharedAt, text: seller ? "You shared the financial report" : "Financial report shared", link: "View report", open: "report" });
      if (p.loiSentAt) ev.push({ id: "loi", at: p.loiSentAt, text: seller ? "Letter of intent received" : "Letter of intent sent", link: seller ? "Review LOI" : "View LOI", open: "loi" });
    }
    for (const e of data?.events ?? []) ev.push({ id: e.id, at: e.at, text: e.text, link: e.link, open: e.nda ? { advNda: e.nda } : null, green: (e as any).green, tpl: (e as any).tpl, vars: (e as any).vars } as any);
    const cards = enq ? [
      ...enq.enquiries.map((x) => ({ t: "q" as const, at: x.at, id: `q${x.id}`, x })),
      ...enq.proposals.map((x) => ({ t: "r" as const, at: x.sentAt, id: `r${x.id}`, x })),
    ] : [];
    const all = [...ev.map((e) => ({ t: "e" as const, at: e.at, e })), ...msgs.map((m) => ({ t: "m" as const, at: m.at, m })), ...cards].sort((a, b) => a.at.localeCompare(b.at));
    const out: Item[] = [];
    let lastDay = "";
    for (const x of all) {
      const d = new Date(x.at);
      if (d.toDateString() !== lastDay) {
        lastDay = d.toDateString();
        out.push({ kind: "day", id: `d${lastDay}`, label: dayLabel(d) });
      }
      if (x.t === "e") out.push({ kind: "event", ...x.e });
      else if (x.t === "q" || x.t === "r") out.push({ kind: "card", id: x.id, card: x } as any);
      else {
        const prev = out[out.length - 1];
        if (prev?.kind === "group" && prev.sender === x.m.senderId) prev.msgs.push(x.m);
        else out.push({ kind: "group", id: x.m.id, sender: x.m.senderId, mine: x.m.mine, msgs: [x.m] });
      }
    }
    return out;
  }, [msgs, c.p, c.kind, seller, data?.events, enq]);
  // Sent / Seen go under the latest group from my side (me or a colleague).
  const ourLast = [...msgs].reverse().find((m) => m.mine || (members.length > 0 && sameSide(m.senderId)));

  useEffect(() => {
    const el = scroller.current;
    if (el && (!popup || atEnd.current)) el.scrollTop = el.scrollHeight;
  }, [items.length, msgs.length, panel]);

  useEffect(() => {
    if (!panel && !people && !contact) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || dialog) return;
      if (contact) { e.preventDefault(); e.stopImmediatePropagation(); dismissContact(); return; }
      if (people) { e.preventDefault(); e.stopImmediatePropagation(); setPeople(false); peopleBtn.current?.focus(); return; }
      setPanel(false); pipeBtn.current?.focus();
    };
    const onDown = (e: MouseEvent) => {
      if (people && !peopleBox.current?.contains(e.target as Node) && !peopleBtn.current?.contains(e.target as Node)) setPeople(false);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onDown);
    return () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("mousedown", onDown); };
  }, [panel, people, dialog, contact]);

  const openFile = async (f: MsgFile) => {
    try {
      const { url } = await urlFn({ data: { key: c.key, path: f.path } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const send = async (body: string, files: File[]) => {
    atEnd.current = true;
    const uploaded: MsgFile[] = [];
    for (const f of files) {
      const { path, token } = await upFn({ data: { key: c.key, name: f.name, size: f.size } });
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/upload/sign/message-files/${path.split("/").map(encodeURIComponent).join("/")}?token=${token}`, {
        method: "PUT",
        headers: { "content-type": f.type || "application/octet-stream", "x-upsert": "false" },
        body: f,
      });
      if (!res.ok) throw new Error(`Could not upload ${f.name}`);
      uploaded.push({ path, name: f.name, size: f.size, type: f.type });
    }
    const tKey = ["messages", "thread", c.key];
    qc.setQueryData(tKey, (old: any) => old ? {
      ...old,
      messages: [...old.messages, { id: `tmp-${Date.now()}`, senderId: old.meId, mine: true, body, files: uploaded, at: new Date().toISOString() }],
    } : old);
    await sendFn({ data: { key: c.key, body, files: uploaded } });
    await qc.invalidateQueries({ queryKey: ["messages"] });
  };

  const p = c.p, adv = c.adv, meta = c.meta;
  const dates = adv ? advDates(adv) : p ? stepDates(p) : null;
  const step = dates ? (() => { const i = dates.findIndex((x) => !x); return i === -1 ? 7 : i; })() : p ? currentStep(p) : 0;
  const otherRole: Role | null = c.kind === "a" ? null : isE ? (c.enq?.isFirm ? c.enq.clientSide : "advisor") : isC ? (as === "advisor" ? meta?.withSide ?? "advisor" : "advisor") : seller ? "buyer" : "seller";
  const placeholder = adminView && profile ? tr("Reply to {first name}").replace("{first name}", profile.first) : c.kind === "a" ? `${tr("Message")} ${tr("Help desk")}` : others.length >= 2 ? `${tr("Message")} ${c.name}` : `${tr("Message")} ${others[0]?.name ?? c.person ?? c.name}`;
  const files = msgs.flatMap((m) => m.files.map((f) => ({ ...f, at: m.at }))).reverse();
  const hasPanel = !popup && (adminView || (c.kind !== "a" && !isE));
  const pipeHref = as === "advisor" ? `/advisor/pipeline?deal=${meta?.dealId}` : `/marketplace/pipeline?deal=${meta?.dealId ?? p?.id}`;
  const shownNames = others.slice(0, 3);

  const line2 = adminView && profile ? <span>{tr(cap(profile.role))} · {profile.company}</span> : c.kind === "a" ? (
    <span>{tr("PitchSnack team · we usually reply within 1 business day")}</span>
  ) : (
    <>
      {shownNames.map((m, i) => (
        <span key={m.id}>
          {i > 0 && <span className="text-[#9CA3AF]">, </span>}
          <Button variant="unstyled" size="unstyled" onClick={e => openContact(m, e.currentTarget)} className="font-semibold text-link hover:underline">{m.name}</Button>
        </span>
      ))}
      {others.length > 3 && <span className="text-[#9CA3AF]"> +{others.length - 3}</span>}
      {!others.length && (c.person ?? "")}
      {isC && meta && <> · {relation(meta, as)}</>}
      {isE && c.enq ? <> · {enqStatusLabel(c.enq.status, c.enq.isFirm, c.enq.isNew)} · {c.enq.isFirm ? c.enq.service : tr(c.enq.service)}{c.enq.isFirm && c.enq.toFirm ? <> · {tr("to {firm}").replace("{firm}", c.enq.toFirm)}</> : null}</> : step < 7 ? <> · {STEPS[step]}</> : <> · Completed</>}
    </>
  );

  const waitText = () => {
    if (adv) {
      if (adv.paymentAt) return { onYou: false, text: "Deal completed" };
      if (!adv.wait) return { onYou: false, text: "" };
      return adv.wait.who === "you" ? { onYou: true, text: `Waiting on you: ${adv.wait.what}` } : { onYou: false, text: `Waiting on ${adv.wait.who === "client" ? adv.client.name : adv.side === "seller" ? "the buyer" : "the seller"}: ${adv.wait.what}` };
    }
    if (p) {
      const w = waitState(p, seller);
      return { onYou: w.onYou, text: w.onYou ? `Waiting on you: ${w.what}` : p.paymentAt ? "Deal completed" : `Waiting on ${seller ? "the buyer" : "the seller"}: ${w.what}` };
    }
    return { onYou: false, text: "" };
  };

  return (
    <div data-chat-popup={popup || undefined} data-chat-role={as} className={cn("relative flex min-h-0 min-w-0 flex-1", hiddenMobile && "max-[759px]:hidden")}>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className={cn("chat-header flex h-16 shrink-0 items-center gap-3 border-b border-[#F0F1F4] px-7", popup && "pipeline-chat-header")}>
          {popup && <span className="pipeline-chat-tile" data-side={as === "seller" ? "buyer" : "seller"}>{c.p?.counterparty.logoUrl ? <img src={c.p.counterparty.logoUrl} alt="" /> : initials(c.name)}</span>}
          {!popup && <Button variant="unstyled" size="unstyled" onClick={onBack} className="-ml-2 flex items-center text-[13px] font-medium text-[#2563EB] min-[760px]:hidden"><ChevronLeft className="h-4 w-4" />Messages</Button>}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {c.kind === "a" && !adminView && <HatMark width={20} />}
              {popup ? <DialogTitle id="pipeline-chat-title" className="pipeline-chat-name">{c.name}</DialogTitle> : <span className="truncate text-[15px] font-semibold text-[#111827]">{c.name}</span>}
              {otherRole && <RoleTag role={otherRole} />}
            </div>
            <div className="truncate text-[12.5px] text-[#6B7280]">{line2}</div>
          </div>
          {c.kind !== "a" && !adminView && (
            <Button variant="unstyled" size="unstyled"
              ref={peopleBtn}
              aria-expanded={people}
              aria-controls="people-in-chat"
              onClick={() => setPeople(!people)}
              className={cn("inline-flex h-[30px] items-center gap-1.5 rounded-lg px-[9px] text-[13px] font-medium", people ? "bg-[#F2F3F6] text-[#111827]" : "text-[#6B7280] hover:bg-[#F7F8FA] hover:text-[#111827]")}
            >
              <Users className="h-[15px] w-[15px]" /> {members.length}<span className="max-[759px]:hidden"> {tr(members.length === 1 ? "person" : "people")}</span>
            </Button>
          )}
          {isE && enq && <EnquiryHeaderActions t={enq} />}
          {adminView && profile && <DoneButton c={c} first={profile.first} />}
          {hasPanel && (
            <Button variant="unstyled" size="unstyled"
              ref={pipeBtn}
              aria-expanded={panel}
              onClick={() => setPanel(!panel)}
              className={cn("inline-flex h-[30px] items-center gap-1.5 rounded-lg px-[9px] text-[13px] font-medium", panel ? "bg-[#F2F3F6] text-[#111827]" : "text-[#6B7280] hover:bg-[#F7F8FA] hover:text-[#111827]")}
            >
              {adminView ? <Users className="h-[15px] w-[15px]" /> : <GitBranch className="h-[15px] w-[15px]" />} {adminView ? tr("Profile") : "Pipeline"}
            </Button>
          )}
          {popupClose && <Button variant="ghost" size="icon" className="pbox-x shrink-0" aria-label={tr("Close")} title={tr("Close")} onClick={popupClose}><X size={18} /></Button>}
        </div>
        {people && (
          <div ref={peopleBox} id="people-in-chat" role="dialog" aria-label={tr("People in this chat")} className="absolute right-7 top-[60px] z-20 w-[300px] max-w-[calc(100%-32px)] rounded-xl border border-[#E5E7EB] bg-white px-4 pb-3 pt-0.5 shadow-[0_12px_32px_rgba(16,24,40,.14)]">
            <div className="mb-1 mt-3 text-[10.5px] font-bold uppercase tracking-[.07em] text-[#9CA3AF]">{tr("People in this chat")} · {members.length}</div>
            <PeopleRows others={others} mine={mine} meId={data?.meId} as={as} onContact={openContact} />
            <div className="mt-1 flex items-center gap-1.5 border-t border-[#F0F1F4] pt-2.5 text-[11.5px] text-[#6B7280]"><Lock className="h-3 w-3" />{tr("Only these people can read this chat.")}</div>
          </div>
        )}
        {contact && <div className="chat-contact" role="dialog" aria-label={contact.name}>
          <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><b>{contact.name}</b><p>{[contact.title, contact.org].filter(Boolean).join(' · ')}</p><RoleTag role={contact.role} /></div><Button variant="ghost" size="icon" className="pbox-x" aria-label={tr('Close')} onClick={dismissContact}><X size={18} /></Button></div>
        </div>}
        <div ref={scroller} className="chat-scroll min-h-0 flex-1 overflow-y-auto px-7 pb-5 pt-3" onScroll={e => { const el = e.currentTarget; atEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48; }}>
          {isPending && <p>{tr('Loading…')}</p>}
          {error && <p role="alert" className="text-destructive">{tr('Private profile unavailable.')}</p>}
          {items.map((it) => {
            if (it.kind === "day") return <div key={it.id} className="py-3 text-center text-[11.5px] font-medium text-[#9CA3AF]">{tr(it.label)}</div>;
            if (it.kind === "card" && enq)
              return it.card.t === "q"
                ? <EnquiryCardView key={it.id} t={enq} card={it.card.x} seen={!!it.card.x.readAt} />
                : <ProposalCardView key={it.id} t={enq} p={it.card.x} me={enq.me} />;
            if (it.kind === "card") return null;
            if (it.kind === "event" && isE)
              return (
                <div key={it.id} className="py-1.5 text-center">
                  <span className={cn("inline-block rounded-full px-3 py-1 text-[12px] font-medium", (it as any).green ? "bg-[#E9F6EE] text-[#15803D] dark:bg-green-950/50 dark:text-green-300" : "bg-[#F1F2F5] text-[#4B5563] dark:bg-muted dark:text-muted-foreground")}>{(it as any).tpl ? tf((it as any).tpl, (it as any).vars) : it.text}</span>
                </div>
              );
            if (it.kind === "event")
              return (
                <div key={it.id} className="py-1.5 text-center text-[12px] text-[#9CA3AF]">
                  {tr(it.text)}{it.link && <> · <Button variant="unstyled" size="unstyled" onClick={() => setDialog(it.open)} className="font-medium text-[#2563EB] hover:underline">{tr(it.link)}</Button></>}
                </div>
              );
            const last = it.msgs[it.msgs.length - 1];
            const ours = it.mine || (members.length > 0 && sameSide(it.sender));
            const status = ourLast && last.id === ourLast.id ? (data?.otherReadAt && data.otherReadAt >= ourLast.at ? " · Seen" : " · Sent") : "";
            const who = byId[it.sender];
            if (ours)
              return (
                <div key={it.id} className="my-2 flex flex-col items-end gap-1">
                  {!it.mine && who && <div className="px-1 text-[12px] leading-[18px] text-[#6B7280]"><span className="font-semibold text-[#111827]">{who.name}</span>{who.title && ` · ${who.title}`}</div>}
                  {it.msgs.map((m) => <Bubble key={m.id} m={m} cls={BUBBLE[as]} onFile={openFile} />)}
                  <div className="flex flex-wrap items-center gap-1 text-[11px] text-[#9CA3AF]">{adminView && <>{profile?.advisor ? profile.advisor : <><HatMark width={13} />{tr("Help desk")}</>} · </>}{hm(last.at)}{adminView && <> · {(data as any)?.adminNames?.[last.senderId] || "—"}</>}{status.replace("Seen", tr("Seen")).replace("Sent", tr("Sent"))}</div>
                </div>
              );
            const help = c.kind === "a" && !adminView;
            const team = !help && !!who?.team;
            const name = help ? (data as any)?.helpAdvisor || tr("Help desk") : team ? tr("PitchSnack team") : who?.name ?? c.name;
            return (
              <div key={it.id} className="my-2 flex max-w-[70%] gap-2.5">
                <span className={cn("mt-0 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10.5px] font-bold", adminView && profile ? `help-initials help-${profile.role}` : help || team ? "bg-[#F3F4F6] dark:bg-[#2A3142]" : who ? TAG[who.role] : "bg-[#F3F4F6] text-[#374151]")}>{(help && !(data as any)?.helpAdvisor) || team ? <HatMark width={16} /> : initials(name)}</span>
                <div className="flex min-w-0 flex-col items-start gap-1">
                  <div className="flex flex-wrap items-center gap-x-1.5 px-1 text-[12px] leading-[18px]">
                    <span className="font-semibold text-[#111827]">{name}</span>
                    {!help && who && <RoleTag role={who.role} />}
                    {!help && who?.title && <span className="text-[#6B7280]">· {who.title}</span>}
                  </div>
                  {it.msgs.map((m) => <Bubble key={m.id} m={m} cls="bg-[#F3F4F6] text-[#1F2937]" onFile={openFile} />)}
                  <div className="text-[11px] text-[#9CA3AF]">{hm(last.at)}</div>
                </div>
              </div>
            );
          })}
          {adminView && c.done && (
            <div className="py-2 text-center">
              <span className="inline-block rounded-full border border-[#D1FADF] bg-[#F6FEF9] px-3 py-1 text-[11.5px] text-[#15803D]">✓ {tr("Marked as done by {admin} · {time}").replace("{admin}", c.done.by).replace("{time}", `${new Date(c.done.at).toLocaleDateString(undefined, { weekday: "short" })} ${hm(c.done.at)}`)}</span>
            </div>
          )}
        </div>
        {data?.closed && isE ? (
          <div className="px-6 pb-5 pt-2.5 text-center text-[13px] text-[#9CA3AF]">{enq?.closedTpl ? tf(enq.closedTpl, enq.closedVars) : ""}</div>
        ) : data?.closed ? (
          <div className="px-6 pb-5 pt-2.5 text-center text-[13px] text-[#9CA3AF]">{data.endedNote ? tr("This conversation is closed because {organisation} withdrew from the deal on {date}.").replace("{organisation}", data.endedNote.org).replace("{date}", data.endedNote.date) : isC ? "This conversation is closed because the advisor NDA ended." : tr("This conversation is closed because the NDA ended.")}</div>
        ) : (
          <>
            {adminView && profile && <div className="px-6 pt-2 text-[12px] text-muted-foreground">{profile.advisor ? tr("Replying as {advisor}, {first name}’s advisor").replace("{advisor}", profile.advisor).replace("{first name}", profile.first) : <span className="inline-flex flex-wrap items-center gap-1">{tr("Replying as")} <HatMark width={13} /><b>{tr("Help desk")}</b> · {tr("{first name} won’t see your name").replace("{first name}", profile.first)}</span>}</div>}
            {data && <Composer placeholder={placeholder} as={as} onSend={send} autoFocus={popup} draft={popup ? drafts?.get(draftId) : undefined} onDraft={popup && drafts ? d => saveDraft(drafts, draftId, d) : undefined} />}
            {c.kind === 'p' && <div className="chat-confidential"><Lock size={12} /><span>{tr("Messages are confidential under your NDA and stored by PitchSnack. Advisors on this deal can’t read them.")}</span></div>}
          </>
        )}
      </div>

      {adminView && profile && panel && <HelpProfilePanel profile={profile} files={files} onFile={openFile} onClose={() => { setPanel(false); pipeBtn.current?.focus(); }} />}
      {hasPanel && !adminView && (
        <aside
          aria-label="Deal panel"
          className={cn(
            "shrink-0 overflow-hidden border-[#F0F1F4] bg-white transition-[width] duration-200 motion-reduce:transition-none",
            "max-[1099px]:absolute max-[1099px]:inset-y-0 max-[1099px]:right-0 max-[1099px]:z-10",
            panel ? "w-[288px] border-l max-[1099px]:shadow-[-12px_0_32px_rgba(16,24,40,.12)]" : "w-0",
          )}
        >
          <div className="h-full w-[288px] overflow-y-auto p-5">
            <div className="flex items-start gap-3">
              <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-[11px] text-[15px] font-bold text-white", otherRole === "advisor" ? "bg-[#0F766E]" : otherRole === "buyer" ? "bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9]" : "bg-gradient-to-br from-[#fb923c] to-[#ea580c]")}>{initials(c.name)}</div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold leading-tight text-[#111827]">{c.name}</div>
                <div className="mt-0.5 text-[12px] text-[#6B7280]">{(isC && as !== "advisor" ? meta?.firm.sub : isC ? adv?.other.sub && meta?.withSide !== meta?.clientSide ? adv.other.sub : "" : c.sub) || "—"}</div>
                {isC && meta ? (
                  as === "advisor" && meta.withSide !== meta.clientSide ? (
                    <span className="mt-1.5 inline-flex rounded-full border border-[#BBF7D0] bg-[#ECFDF3] px-2 py-0.5 text-[11px] font-semibold text-[#15803D]">✓ Verified {meta.withSide}</span>
                  ) : (
                    <span className={cn("mt-1.5 inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold", TAG[as === "advisor" ? meta.clientSide : "advisor"])}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: DOT[as === "advisor" ? meta.clientSide : "advisor"] }} />
                      {as === "advisor" ? `Your ${meta.clientSide} client` : relation(meta, as)}
                    </span>
                  )
                ) : (
                  p?.counterparty.verified && <span className="mt-1.5 inline-flex rounded-full border border-[#BBF7D0] bg-[#ECFDF3] px-2 py-0.5 text-[11px] font-semibold text-[#15803D]">✓ {seller ? "Verified buyer" : "Verified seller"}</span>
                )}
              </div>
              <Button variant="unstyled" size="unstyled" aria-label="Close deal panel" onClick={() => { setPanel(false); pipeBtn.current?.focus(); }} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-4 w-4" /></Button>
            </div>

            <Cap>Deal</Cap>
            <div className="text-[13px] font-semibold text-[#111827]">{meta ? [meta.codeName, meta.ref].filter(Boolean).join(" · ") : p ? [p.parties.codeName, `PS-${p.hiddenProfileId.slice(0, 4).toUpperCase()}`].filter(Boolean).join(" · ") : ""}</div>
            {isC && meta && (
              <div className="mt-2 divide-y divide-[#F0F1F4] border-y border-[#F0F1F4]">
                {(["seller", "buyer"] as Side[]).map((s) => {
                  const tag = as === "advisor" ? (meta.clientSide === s ? " · Your client" : "") : as === s ? " · You" : "";
                  return (
                    <div key={s} className="pb-[7px] pt-1.5">
                      <div className="text-[11.5px] text-[#6B7280]">{cap(s)}{tag && <span className={cn("font-semibold", TEXT[as])}>{tag}</span>}</div>
                      <div className="truncate text-[13px] font-semibold text-[#111827]">{s === "seller" ? meta.sellerOrg : meta.buyerOrg}</div>
                    </div>
                  );
                })}
              </div>
            )}
            {dates && (
              <>
                <div className={cn("text-[12px] text-[#6B7280]", isC ? "mt-2.5" : "mt-0.5")}>{step >= 7 ? "Completed" : `Step ${step + 1} of 7 · ${STEPS[step]}`}</div>
                <div className="mt-3 flex items-center">
                  {dates.map((d, i) => (
                    <div key={i} className="flex flex-1 items-center last:flex-none">
                      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", d ? "bg-[#16A34A]" : i === step ? "bg-[#F59E0B] shadow-[0_0_0_3px_rgba(245,158,11,.22)]" : "border border-[#D1D5DB] bg-white")} />
                      {i < 6 && <span className={cn("h-0.5 flex-1", d ? "bg-[#16A34A]" : "bg-[#E5E7EB]")} />}
                    </div>
                  ))}
                </div>
                {(() => { const w = waitText(); return w.text ? <div className={cn("mt-2.5 text-[12.5px] font-semibold", w.onYou ? "text-[#B45309]" : "text-[#6B7280]")}>{w.text}</div> : null; })()}
              </>
            )}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] font-semibold text-[#2563EB]">
              {isC && meta ? (
                <>
                  {as !== "advisor" && <Button variant="unstyled" size="unstyled" onClick={() => setDialog("advProfile")} className="hover:underline">Advisor profile</Button>}
                  <Button variant="unstyled" size="unstyled" onClick={() => setDialog({ advNda: { dealId: meta.dealId, side: meta.clientSide } })} className="hover:underline">{as === "advisor" ? "View your NDA" : "View advisor NDA"}</Button>
                </>
              ) : (
                <>
                  <Button variant="unstyled" size="unstyled" onClick={() => setDialog("profile")} className="hover:underline">{seller ? "Investor profile" : "Seller profile"}</Button>
                  <Button variant="unstyled" size="unstyled" onClick={() => setDialog("nda")} className="hover:underline">View NDA</Button>
                </>
              )}
              <a href={pipeHref} className="hover:underline">Open in Pipeline</a>
            </div>

            <Cap>People</Cap>
            <PeopleRows others={others} mine={mine} meId={data?.meId} as={as} onContact={openContact} />

            <Cap>Shared files</Cap>
            {files.length === 0 ? (
              <div className="text-[12.5px] text-[#9CA3AF]">No files yet.</div>
            ) : (
              <div className="space-y-1">
                {files.map((f) => {
                  const e = ext(f.name);
                  const tone = e === "PDF" ? "bg-[#FEE2E2] text-[#B91C1C]" : /XLS|CSV/.test(e) ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#F3F4F6] text-[#6B7280]";
                  return (
                    <Button variant="unstyled" size="unstyled" key={f.path} onClick={() => openFile(f)} className="flex w-full items-center gap-2.5 rounded-lg py-1.5 text-left hover:bg-[#F7F8FA]">
                      <span className={cn("grid h-[30px] w-[30px] shrink-0 place-items-center rounded-md text-[9px] font-bold", tone)}>{e.slice(0, 4)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-[#111827]">{f.name}</span>
                        <span className="block text-[11.5px] text-[#6B7280]">{e} · {kb(f.size)} · {listTime(f.at)}</span>
                      </span>
                    </Button>
                  );
                })}
              </div>
            )}

            <div className="mt-[22px] flex gap-2 rounded-[10px] border border-[#EEF0F3] bg-[#F8F9FB] p-3 text-[11.5px] text-[#6B7280]">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{isC ? `Only you and ${c.name} can read these messages. They’re confidential under the advisor NDA and stored by PitchSnack.` : "Messages are confidential under your NDA and stored by PitchSnack. Advisors on this deal can’t read them."}</span>
            </div>
          </div>
        </aside>
      )}

      {dialog && typeof dialog === "object" && <AdvisorNdaDialog dealId={dialog.advNda.dealId} side={dialog.advNda.side} onClose={() => setDialog(null)} />}
      {dialog === "advProfile" && meta && <AdvisorProfileDialog dealId={meta.dealId} side={meta.clientSide} onClose={() => setDialog(null)} />}
      {c.kind === "p" && p && dialog === "nda" && <NdaDialog p={p} seller={seller} onClose={() => setDialog(null)} />}
      {c.kind === "p" && p && dialog === "loi" && <LoiDialog p={p} seller={seller} onClose={() => setDialog(null)} />}
      {c.kind === "p" && p && dialog === "report" && <ReportViewer p={p} seller={seller} onClose={() => setDialog(null)} />}
      {c.kind === "p" && p && dialog === "profile" && seller && <InvestorProfile p={p} onClose={() => setDialog(null)} onNda={() => setDialog("nda")} onLoi={() => setDialog("loi")} />}
      {c.kind === "p" && p && dialog === "profile" && !seller && (
        <SellerProfile p={p} onClose={() => setDialog(null)} onNda={() => setDialog("nda")} onLoi={() => setDialog("loi")} onReport={() => setDialog("report")} onAsk={() => setDialog(null)} />
      )}
    </div>
  );
}

function Bubble({ m, cls, onFile }: { m: ThreadMessage; cls: string; onFile: (f: MsgFile) => void }) {
  return (
    <div className={cn("max-w-full whitespace-pre-wrap break-words rounded-[18px] px-3.5 py-[9px] text-[13.5px] leading-[1.5]", cls)}>
      {m.body}
      {m.files.map((f) => (
        <Button variant="unstyled" size="unstyled" key={f.path} onClick={() => onFile(f)} className={cn("flex w-full min-w-[200px] items-center gap-2 rounded-xl bg-white px-[11px] py-2 text-left", m.body && "mt-1.5")}>
          <FileText className="h-4 w-4 shrink-0 text-[#6B7280]" />
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[#1F2937]">{f.name}</span>
          <span className="shrink-0 text-[11.5px] text-[#9CA3AF]">{kb(f.size)}</span>
        </Button>
      ))}
    </div>
  );
}

function RoleTag({ role }: { role: Role }) {
  return <span className={cn("inline-flex h-4 shrink-0 items-center rounded-full px-1.5 text-[9.5px] font-bold uppercase tracking-[.06em]", TAG[role])}>{tr(cap(role))}</span>;
}

function PeopleRows({ others, mine, meId, as, onContact }: { others: Member[]; mine: Member[]; meId?: string; as: Role; onContact?: (m: Member, trigger: HTMLElement) => void }) {
  const me = mine.find((m) => m.id === meId);
  const rest = mine.filter((m) => m.id !== meId);
  const list = [...others.map((m) => ({ m, other: true })), ...(me ? [{ m: me, other: false }] : []), ...rest.map((m) => ({ m, other: false }))];
  if (!list.length) return <div className="text-[12.5px] text-[#9CA3AF]">—</div>;
  return (
    <div className="divide-y divide-[#F0F1F4]">
      {list.map(({ m, other }) => (
        <div key={m.id} className="flex items-center gap-2.5 py-2">
          <span className={cn("grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[11px] font-bold", m.team ? "bg-[#F3F4F6] dark:bg-[#2A3142]" : TAG[m.role])}>{m.team ? <HatMark width={16} /> : initials(m.name)}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5"><span className="truncate text-[13px] font-semibold text-[#111827]">{onContact && !m.team ? <Button variant="unstyled" size="unstyled" onClick={e => onContact(m, e.currentTarget)} className="text-link">{m.name}</Button> : m.team ? tr("PitchSnack team") : m.name}</span>{other && <RoleTag role={m.role} />}</span>
            <span className="block truncate text-[11.5px] text-[#6B7280]">{[m.title, m.org].filter(Boolean).join(" · ")}</span>
          </span>
          {m.id === meId && <span className={cn("rounded px-1.5 py-0.5 text-[10.5px] font-bold", TAG[as])}>{tr("You")}</span>}
        </div>
      ))}
    </div>
  );
}

function Cap({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 mt-[22px] text-[10.5px] font-bold uppercase tracking-[.07em] text-[#9CA3AF]">{children}</div>;
}

function Composer({ placeholder, as, onSend, autoFocus=false, draft, onDraft }: { placeholder: string; as: Role; onSend: (body: string, files: File[]) => Promise<void>; autoFocus?: boolean; draft?: ChatDraft; onDraft?: (d: ChatDraft) => void }) {
  const [text, setText] = useState(draft?.text ?? "");
  const [files, setFiles] = useState<File[]>(draft?.files ?? []);
  const [busy, setBusy] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const empty = !text.trim() && !files.length;
  useEffect(() => { onDraft?.({ text, files }); }, [text, files]);
  useEffect(() => { if (autoFocus) ta.current?.focus(); }, [autoFocus]);

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  const submit = async () => {
    if (empty || busy) return;
    setBusy(true);
    const body = text, picked = files;
    setText("");
    setFiles([]);
    try {
      await onSend(body, picked);
    } catch (e) {
      setText(body);
      setFiles(picked);
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="chat-composer shrink-0 px-6 pb-5 pt-2.5">
      <div className="rounded-2xl border border-[#E5E7EB] p-1.5 focus-within:border-[#C7CBD4]">
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1.5 pb-1.5 pt-1">
            {files.map((f, i) => (
              <span key={i} className="inline-flex max-w-[240px] items-center gap-1 rounded-lg bg-[#F3F4F6] px-2 py-1 text-[12px]">
                <FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{f.name}</span>
                <Button variant="unstyled" size="unstyled" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-1">
          <Button variant="unstyled" size="unstyled" aria-label={tr("Attach file")} onClick={() => picker.current?.click()} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6]"><Paperclip className="h-4 w-4" /></Button>
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              const big = picked.filter((f) => f.size > 25 * 1024 * 1024);
              if (big.length) toast.error(`${big[0].name} is over 25 MB`);
              setFiles([...files, ...picked.filter((f) => f.size <= 25 * 1024 * 1024)]);
              e.target.value = "";
            }}
          />
          <textarea
            ref={ta}
            aria-label={placeholder}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            className="max-h-[120px] min-h-8 flex-1 resize-none bg-transparent py-1.5 text-[13.5px] outline-none placeholder:text-[#9CA3AF]"
          />
          <Button variant="unstyled" size="unstyled"
            aria-label={tr("Send")}
            disabled={empty || busy}
            onClick={submit}
            className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", empty ? "bg-[#E5E7EB] text-white" : SEND[as])}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function RowCount({ n }: { n: number }) {
  const bump = useBump(n);
  if (!n) return null;
  return <span key={bump} className={cn("ml-2 grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-[#F6A823] px-1.5 text-[10.5px] font-bold text-[#0E162F]", bump && "mkt-bump")}>{n > 9 ? "9+" : n}</span>;
}

function HelpProfilePanel({ profile: p, files, onFile, onClose }: { profile: HelpProfile; files: (MsgFile & { at: string })[]; onFile: (f: MsgFile) => void; onClose: () => void }) {
  const copy = async (value: string) => { try { await navigator.clipboard.writeText(value); toast.success(tr("Copied")); } catch { toast.error(tr("Could not copy")); } };
  return <aside aria-label="User profile panel" className="w-[288px] max-w-full shrink-0 overflow-y-auto border-l border-border bg-card max-[1099px]:absolute max-[1099px]:inset-y-0 max-[1099px]:right-0 max-[1099px]:z-10 max-[1099px]:shadow-xl">
    <div className="flex min-h-full flex-col p-5">
      <div className="flex items-start gap-3">
        <span className={cn("help-initials grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[15px] font-bold", `help-${p.role}`)}>{initials(p.name)}</span>
        <div className="min-w-0 flex-1"><div className="break-words text-[15px] font-bold">{p.name}</div><div className="mt-0.5 break-words text-[12px] text-muted-foreground">{tr(cap(p.role))} · {p.company}</div></div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={tr("Close profile panel")} onClick={onClose}><X /></Button>
      </div>
      {([ ["Email", p.email], ["Phone", p.phone] ] as const).map(([label, value]) => <div key={label} className="mt-5"><div className="text-[11px] text-muted-foreground">{tr(label)}</div><div className="flex items-center gap-2"><span className="min-w-0 flex-1 break-all text-[12.5px]">{value || "—"}</span>{value && <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title={tr("Copy") + " " + tr(label)} aria-label={tr("Copy") + " " + tr(label)} onClick={() => copy(value)}><Copy /></Button>}</div></div>)}
      <div className="mt-4 text-[12.5px]"><div className="text-[11px] text-muted-foreground">{tr("Joined")}</div>{new Date(p.joined).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
      <Cap>{tr("PitchSnack status")}</Cap><div className="space-y-2">{p.statuses.map((s, i) => <div key={i} className="text-[12.5px]"><span className="block break-words text-muted-foreground">{tr(s.label)}</span><span>{tr(s.value)}</span></div>)}</div>
      <Cap>{tr("Shared files")}</Cap>{files.length ? files.map((f) => <Button variant="ghost" key={f.path} className="h-auto w-full justify-start px-0 py-2 text-left" onClick={() => onFile(f)}><FileText /><span className="min-w-0"><span className="block truncate text-[12.5px]">{f.name}</span><span className="block text-[11px] text-muted-foreground">{kb(f.size)} · {listTime(f.at)}</span></span></Button>) : <p className="text-[12.5px] text-muted-foreground">{tr("No files yet.")}</p>}
      <div className="mt-6 flex gap-2 border-t border-border pt-4 text-[11.5px] text-muted-foreground"><Lock className="h-3.5 w-3.5 shrink-0" /><span>{tr("Only PitchSnack admins see this conversation. {first name} sees your replies as Help desk.").replace("{first name}", p.first)}</span></div>
      <Button variant="link" asChild className="mt-auto justify-start px-0 pt-5 text-[12.5px] font-semibold text-link"><Link to="/users" search={{ edit: p.id }}>{tr("Open in Users")}</Link></Button>
    </div>
  </aside>;
}

function DoneButton({ c, first }: { c: Conv; first: string }) {
  const qc = useQueryClient();
  const fn = useServerFn(setHelpDone);
  const [busy, setBusy] = useState(false);
  const done = !!c.done;
  const go = async () => {
    setBusy(true);
    try {
      await fn({ data: { key: c.key, done: !done } });
      await qc.invalidateQueries({ queryKey: ["messages", "admin-help"] });
      if (!done) toast.success(tr("Marked as done. It opens again if {first name} writes back.").replace("{first name}", first));
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const label = done ? tr("Reopen") : tr("Mark as done");
  return (
    <Button variant="unstyled" size="unstyled" disabled={busy} onClick={go} title={label} aria-label={label}
      className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-[13px] font-medium text-[#374151] hover:border-[#BBF7D0] hover:bg-[#F6FEF9] hover:text-[#15803D] dark:bg-transparent dark:text-foreground">
      {done ? label : <><Check className="h-[15px] w-[15px]" /><span className="max-[759px]:hidden">{label}</span></>}
    </Button>
  );
}
