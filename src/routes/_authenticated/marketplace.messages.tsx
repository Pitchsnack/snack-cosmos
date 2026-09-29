import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUp, ChevronLeft, FileText, GitBranch, Lock, Paperclip, Search, X } from "lucide-react";
import { toast } from "sonner";
import { usePersona } from "@/hooks/use-marketplace";
import { listPipeline, type PipelineRow } from "@/lib/pipeline.functions";
import {
  threadSummaries, threadMessages, markThreadRead, sendMessage, messageUploadUrl, messageFileUrl,
  type MsgFile, type ThreadMessage,
} from "@/lib/messages.functions";
import { STEPS, currentStep, stepDates, waitState } from "@/lib/pipeline-state";
import { NdaDialog, LoiDialog, ReportViewer, InvestorProfile, SellerProfile } from "@/components/pipeline/pipeline-dialogs";
import { cn } from "@/lib/utils";
import { useBump } from "@/hooks/use-bump";

export const Route = createFileRoute("/_authenticated/marketplace/messages")({
  head: () => ({
    meta: [
      { title: "Messages — PitchSnack" },
      { name: "description", content: "Messages with buyers, sellers and your PitchSnack advisor, one conversation per approved NDA." },
      { property: "og:title", content: "Messages — PitchSnack" },
      { property: "og:description", content: "Messages with buyers, sellers and your PitchSnack advisor, one conversation per approved NDA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagesPage,
});

type Conv = { key: string; name: string; person: string | null; sub: string; codeName: string | null; p: PipelineRow | null; unread: number; last: { body: string; mine: boolean; at: string } | null };
type Dialog = null | "nda" | "loi" | "report" | "profile";

const ADVISOR = "PitchSnack Help";

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

function MessagesPage() {
  const { persona } = usePersona();
  const seller = persona === "seller";
  const pFn = useServerFn(listPipeline);
  const tFn = useServerFn(threadSummaries);
  const { data: rows = [] } = useQuery({ queryKey: ["pipeline", persona], queryFn: () => pFn({ data: { as: persona } }) });
  const { data: sums = [] } = useQuery({ queryKey: ["messages", "threads", persona], queryFn: () => tFn({ data: { as: persona } }), refetchInterval: 2500, refetchIntervalInBackground: true });

  const [sel, setSel] = useState<string | null>(null);
  const selKey = sel;
  const convs: Conv[] = useMemo(() => {
    const sm = Object.fromEntries(sums.map((s) => [s.key, s]));
    const deals = rows.filter((p) => p.ndaApprovedAt).map((p): Conv => {
      const key = `p:${p.id}`;
      return {
        key, p,
        name: seller ? p.parties.buyerOrg : p.parties.sellerCompany,
        person: seller ? p.parties.buyerName : p.parties.sellerName,
        sub: p.counterparty.sub,
        codeName: p.parties.codeName,
        unread: key === selKey ? 0 : sm[key]?.unread ?? 0,
        last: sm[key]?.last ?? null,
      };
    });
    const adv = sums.find((s) => s.key.startsWith("a:"));
    const all = adv ? [...deals, { key: adv.key, p: null, name: ADVISOR, person: null, sub: "PitchSnack M&A advisor", codeName: null, unread: adv.key === selKey ? 0 : adv.unread, last: adv.last }] : deals;
    const t = (c: Conv) => c.last?.at ?? c.p?.ndaApprovedAt ?? "0";
    return all.sort((a, b) => t(b).localeCompare(t(a)));
  }, [rows, sums, seller, selKey]);

  const [q, setQ] = useState("");
  const [mobileChat, setMobileChat] = useState(false);
  const [panel, setPanel] = useState(false);
  useEffect(() => setPanel(false), [persona]);
  useEffect(() => {
    if (!sel && convs.length) setSel(convs[0].key);
  }, [convs, sel]);

  const shown = convs.filter((c) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [c.name, c.person, c.codeName, c.last?.body].some((x) => x?.toLowerCase().includes(s));
  });
  const current = convs.find((c) => c.key === sel) ?? null;

  // Card fills the window below the title with a 24px gap at the bottom.
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

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 pt-6 md:px-8">
      <h1 className="text-[30px] font-bold leading-tight">Messages</h1>
      <div ref={card} style={{ height: cardH ?? undefined }} className="relative mt-5 flex h-[calc(100vh-260px)] min-h-[520px] overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white">
        {/* List */}
        <div className={cn("flex w-full shrink-0 flex-col border-r border-[#F0F1F4] min-[760px]:w-[300px]", mobileChat && "max-[759px]:hidden")}>
          <label className="flex h-14 shrink-0 items-center gap-2 border-b border-[#F0F1F4] px-5">
            <Search className="h-4 w-4 text-[#9CA3AF]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search conversations" className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-[#9CA3AF]" />
          </label>
          <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {shown.length === 0 && <div className="py-8 text-center text-[13px] text-[#9CA3AF]">{convs.length ? "No conversations match." : "No conversations yet."}</div>}
            {shown.map((c) => (
              <button
                key={c.key}
                onClick={() => { setSel(c.key); setMobileChat(true); }}
                className={cn("block w-full rounded-[10px] py-[11px] pb-3 pl-[14px] pr-3 text-left", c.key === sel ? "bg-[#F2F3F6]" : "hover:bg-[#F7F8FA]")}
              >
                <div className="flex items-center">
                  <span className={cn("min-w-0 truncate text-[14px] text-[#111827]", c.unread ? "font-bold" : "font-medium")}>{c.name}</span>
                  <RowCount n={c.unread} />
                  <span className="ml-auto shrink-0 pl-2 text-[11.5px] text-[#9CA3AF]">{c.last ? listTime(c.last.at) : ""}</span>
                </div>
                <div className={cn("mt-0.5 truncate text-[13px]", c.unread ? "text-[#374151]" : "text-[#6B7280]")}>
                  {c.last ? `${c.last.mine ? "You: " : ""}${c.last.body}` : c.p ? "NDA approved. Say hello." : "Ask your advisor anything."}
                </div>
              </button>
            ))}
          </div>
        </div>
        {/* Chat + panel */}
        {current ? (
          <Chat key={current.key} c={current} seller={seller} panel={panel && !!current.p} setPanel={setPanel} onBack={() => setMobileChat(false)} hiddenMobile={!mobileChat} />
        ) : (
          <div className="hidden flex-1 place-items-center text-[13px] text-[#9CA3AF] min-[760px]:grid">Select a conversation</div>
        )}
      </div>
    </div>
  );
}

type Item =
  | { kind: "day"; id: string; label: string }
  | { kind: "event"; id: string; text: string; link: string; open: Dialog }
  | { kind: "group"; id: string; mine: boolean; msgs: ThreadMessage[] };

function Chat({ c, seller, panel, setPanel, onBack, hiddenMobile }: { c: Conv; seller: boolean; panel: boolean; setPanel: (b: boolean) => void; onBack: () => void; hiddenMobile: boolean }) {
  const qc = useQueryClient();
  const mFn = useServerFn(threadMessages);
  const readFn = useServerFn(markThreadRead);
  const sendFn = useServerFn(sendMessage);
  const upFn = useServerFn(messageUploadUrl);
  const urlFn = useServerFn(messageFileUrl);
  const { data } = useQuery({ queryKey: ["messages", "thread", c.key], queryFn: () => mFn({ data: { key: c.key } }), refetchInterval: 2500 });
  const [dialog, setDialog] = useState<Dialog>(null);
  const pipeBtn = useRef<HTMLButtonElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const msgs: ThreadMessage[] = (data?.messages ?? []) as ThreadMessage[];
  const lastIn = [...msgs].reverse().find((m) => !m.mine)?.at;
  // Opening (and new incoming messages while open) marks the thread read.
  useEffect(() => {
    if (!data) return;
    const key = ["messages", "threads"];
    qc.setQueriesData({ queryKey: key }, (old: any) => Array.isArray(old) ? old.map((t: any) => (t.key === c.key ? { ...t, unread: 0 } : t)) : old);
    readFn({ data: { key: c.key } }).then(() => qc.invalidateQueries({ queryKey: key }));
  }, [c.key, lastIn, !!data]);

  const items = useMemo(() => {
    const ev: { at: string; text: string; link: string; open: Dialog }[] = [];
    const p = c.p;
    if (p?.ndaApprovedAt) ev.push({ at: p.ndaApprovedAt, text: seller ? "You approved the NDA" : "NDA approved", link: "View NDA", open: "nda" });
    if (p?.reportSharedAt) ev.push({ at: p.reportSharedAt, text: seller ? "You shared the financial report" : "Financial report shared", link: "View report", open: "report" });
    if (p?.loiSentAt) ev.push({ at: p.loiSentAt, text: seller ? "Letter of intent received" : "Letter of intent sent", link: seller ? "Review LOI" : "View LOI", open: "loi" });
    const all = [...ev.map((e) => ({ t: "e" as const, at: e.at, e })), ...msgs.map((m) => ({ t: "m" as const, at: m.at, m }))].sort((a, b) => a.at.localeCompare(b.at));
    const out: Item[] = [];
    let lastDay = "";
    for (const x of all) {
      const d = new Date(x.at);
      if (d.toDateString() !== lastDay) {
        lastDay = d.toDateString();
        out.push({ kind: "day", id: `d${lastDay}`, label: dayLabel(d) });
      }
      if (x.t === "e") out.push({ kind: "event", id: `e${x.e.open}`, ...x.e });
      else {
        const prev = out[out.length - 1];
        if (prev?.kind === "group" && prev.mine === x.m.mine) prev.msgs.push(x.m);
        else out.push({ kind: "group", id: x.m.id, mine: x.m.mine, msgs: [x.m] });
      }
    }
    return out;
  }, [msgs, c.p, seller]);
  const myLast = [...msgs].reverse().find((m) => m.mine);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length, msgs.length, panel]);

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !dialog) { setPanel(false); pipeBtn.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, dialog]);

  const openFile = async (f: MsgFile) => {
    try {
      const { url } = await urlFn({ data: { key: c.key, path: f.path } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const send = async (body: string, files: File[]) => {
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
    await sendFn({ data: { key: c.key, body, files: uploaded } });
    await qc.invalidateQueries({ queryKey: ["messages"] });
  };

  const person = c.person ?? c.name;
  const p = c.p;
  const step = p ? currentStep(p) : 0;
  const bubbleMine = seller ? "bg-[#FEF3DE] text-[#3A2606]" : "bg-[#EEF0FF] text-[#1E1B4B]";
  const files = msgs.flatMap((m) => m.files.map((f) => ({ ...f, at: m.at }))).reverse();

  return (
    <div className={cn("flex min-w-0 flex-1", hiddenMobile && "max-[759px]:hidden")}>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-[#F0F1F4] px-7">
          <button onClick={onBack} className="-ml-2 flex items-center text-[13px] font-medium text-[#2563EB] min-[760px]:hidden"><ChevronLeft className="h-4 w-4" />Messages</button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold text-[#111827]">{c.name}</div>
            <div className="truncate text-[12.5px] text-[#6B7280]">{p ? `${person} · ${STEPS[Math.min(step, 6)]}` : "PitchSnack M&A advisor"}</div>
          </div>
          {p && (
            <button
              ref={pipeBtn}
              aria-expanded={panel}
              onClick={() => setPanel(!panel)}
              className={cn("inline-flex h-[30px] items-center gap-1.5 rounded-lg px-[9px] text-[13px] font-medium", panel ? "bg-[#F2F3F6] text-[#111827]" : "text-[#6B7280] hover:bg-[#F7F8FA] hover:text-[#111827]")}
            >
              <GitBranch className="h-[15px] w-[15px]" /> Pipeline
            </button>
          )}
        </div>
        <div ref={scroller} className="flex-1 overflow-y-auto px-7 pb-5 pt-3">
          {items.map((it) => {
            if (it.kind === "day") return <div key={it.id} className="py-3 text-center text-[11.5px] font-medium text-[#9CA3AF]">{it.label}</div>;
            if (it.kind === "event")
              return (
                <div key={it.id} className="py-1.5 text-center text-[12px] text-[#9CA3AF]">
                  {it.text} · <button onClick={() => setDialog(it.open)} className="font-medium text-[#2563EB] hover:underline">{it.link}</button>
                </div>
              );
            const last = it.msgs[it.msgs.length - 1];
            const status = it.mine && myLast && last.id === myLast.id ? (data?.otherReadAt && data.otherReadAt >= myLast.at ? " · Seen" : " · Sent") : "";
            return (
              <div key={it.id} className={cn("my-2 flex flex-col gap-1", it.mine ? "items-end" : "items-start")}>
                {it.msgs.map((m) => (
                  <div key={m.id} className={cn("max-w-[64%] whitespace-pre-wrap break-words rounded-[18px] px-3.5 py-[9px] text-[13.5px] leading-[1.5]", it.mine ? bubbleMine : "bg-[#F3F4F6] text-[#1F2937]")}>
                    {m.body}
                    {m.files.map((f) => (
                      <button key={f.path} onClick={() => openFile(f)} className={cn("flex w-full min-w-[200px] items-center gap-2 rounded-xl bg-white px-[11px] py-2 text-left", m.body && "mt-1.5")}>
                        <FileText className="h-4 w-4 shrink-0 text-[#6B7280]" />
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[#1F2937]">{f.name}</span>
                        <span className="shrink-0 text-[11.5px] text-[#9CA3AF]">{kb(f.size)}</span>
                      </button>
                    ))}
                  </div>
                ))}
                <div className="text-[11px] text-[#9CA3AF]">{hm(last.at)}{status}</div>
              </div>
            );
          })}
        </div>
        {data?.closed ? (
          <div className="px-6 pb-5 pt-2.5 text-center text-[13px] text-[#9CA3AF]">This conversation is closed because the NDA ended.</div>
        ) : (
          <Composer person={person} seller={seller} onSend={send} />
        )}
      </div>

      {p && (
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
              <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-[11px] text-[15px] font-bold text-white", seller ? "bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9]" : "bg-gradient-to-br from-[#fb923c] to-[#ea580c]")}>{initials(c.name)}</div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold leading-tight text-[#111827]">{c.name}</div>
                <div className="mt-0.5 text-[12px] text-[#6B7280]">{c.sub || "—"}</div>
                {p.counterparty.verified && <span className="mt-1.5 inline-flex rounded-full border border-[#BBF7D0] bg-[#ECFDF3] px-2 py-0.5 text-[11px] font-semibold text-[#15803D]">✓ {seller ? "Verified buyer" : "Verified seller"}</span>}
              </div>
              <button aria-label="Close deal panel" onClick={() => { setPanel(false); pipeBtn.current?.focus(); }} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-4 w-4" /></button>
            </div>

            <Cap>Deal</Cap>
            <div className="text-[13px] font-semibold text-[#111827]">{[p.parties.codeName, `PS-${p.hiddenProfileId.slice(0, 4).toUpperCase()}`].filter(Boolean).join(" · ")}</div>
            <div className="mt-0.5 text-[12px] text-[#6B7280]">{step >= 7 ? "Completed" : `Step ${step + 1} of 7 · ${STEPS[step]}`}</div>
            <div className="mt-3 flex items-center">
              {stepDates(p).map((d, i) => (
                <div key={i} className="flex flex-1 items-center last:flex-none">
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", d ? "bg-[#16A34A]" : i === step ? "bg-[#F59E0B] shadow-[0_0_0_3px_rgba(245,158,11,.22)]" : "border border-[#D1D5DB] bg-white")} />
                  {i < 6 && <span className={cn("h-0.5 flex-1", d ? "bg-[#16A34A]" : "bg-[#E5E7EB]")} />}
                </div>
              ))}
            </div>
            {(() => {
              const w = waitState(p, seller);
              return <div className={cn("mt-2.5 text-[12.5px] font-semibold", w.onYou ? "text-[#B45309]" : "text-[#6B7280]")}>{w.onYou ? `Waiting on you: ${w.what}` : p.paymentAt ? "Deal completed" : `Waiting on ${seller ? "the buyer" : "the seller"}: ${w.what}`}</div>;
            })()}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] font-semibold text-[#2563EB]">
              <button onClick={() => setDialog("profile")} className="hover:underline">{seller ? "Investor profile" : "Seller profile"}</button>
              <button onClick={() => setDialog("nda")} className="hover:underline">View NDA</button>
              <a href={`/marketplace/pipeline?deal=${p.id}`} className="hover:underline">Open in Pipeline</a>
            </div>

            <Cap>People</Cap>
            <div className="divide-y divide-[#F0F1F4]">
              <PersonRow name={person} role={seller ? p.counterparty.sub || "Buyer" : "Owner"} />
              <PersonRow name={data?.me.name ?? "Me"} role={[data?.me.role, seller ? p.parties.sellerCompany : data?.me.company].filter(Boolean).join(" · ") || (seller ? "Seller" : "Buyer")} you seller={seller} />
            </div>

            <Cap>Shared files</Cap>
            {files.length === 0 ? (
              <div className="text-[12.5px] text-[#9CA3AF]">No files yet.</div>
            ) : (
              <div className="space-y-1">
                {files.map((f) => {
                  const e = ext(f.name);
                  const tone = e === "PDF" ? "bg-[#FEE2E2] text-[#B91C1C]" : /XLS|CSV/.test(e) ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#F3F4F6] text-[#6B7280]";
                  return (
                    <button key={f.path} onClick={() => openFile(f)} className="flex w-full items-center gap-2.5 rounded-lg py-1.5 text-left hover:bg-[#F7F8FA]">
                      <span className={cn("grid h-[30px] w-[30px] shrink-0 place-items-center rounded-md text-[9px] font-bold", tone)}>{e.slice(0, 4)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-[#111827]">{f.name}</span>
                        <span className="block text-[11.5px] text-[#6B7280]">{e} · {kb(f.size)} · {listTime(f.at)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-[22px] flex gap-2 rounded-[10px] border border-[#EEF0F3] bg-[#F8F9FB] p-3 text-[11.5px] text-[#6B7280]">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Messages are confidential under your NDA and stored by PitchSnack. NDA, report and letter of intent events come from Pipeline.</span>
            </div>
          </div>
        </aside>
      )}

      {p && dialog === "nda" && <NdaDialog p={p} seller={seller} onClose={() => setDialog(null)} />}
      {p && dialog === "loi" && <LoiDialog p={p} seller={seller} onClose={() => setDialog(null)} />}
      {p && dialog === "report" && <ReportViewer p={p} seller={seller} onClose={() => setDialog(null)} />}
      {p && dialog === "profile" && seller && <InvestorProfile p={p} onClose={() => setDialog(null)} onNda={() => setDialog("nda")} onLoi={() => setDialog("loi")} />}
      {p && dialog === "profile" && !seller && (
        <SellerProfile p={p} onClose={() => setDialog(null)} onNda={() => setDialog("nda")} onLoi={() => setDialog("loi")} onReport={() => setDialog("report")} onAsk={() => setDialog(null)} />
      )}
    </div>
  );
}

function Cap({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 mt-[22px] text-[10.5px] font-bold uppercase tracking-[.07em] text-[#9CA3AF]">{children}</div>;
}

function PersonRow({ name, role, you, seller }: { name: string; role: string; you?: boolean; seller?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 py-2">
      <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-[#F3F4F6] text-[11px] font-bold text-[#374151]">{initials(name)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-[#111827]">{name}</span>
        <span className="block truncate text-[11.5px] text-[#6B7280]">{role}</span>
      </span>
      {you && <span className={cn("rounded px-1.5 py-0.5 text-[10.5px] font-bold", seller ? "bg-[#FEF3DE] text-[#3A2606]" : "bg-[#EEF0FF] text-[#1E1B4B]")}>You</span>}
    </div>
  );
}

function Composer({ person, seller, onSend }: { person: string; seller: boolean; onSend: (body: string, files: File[]) => Promise<void> }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const empty = !text.trim() && !files.length;

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  const submit = async () => {
    if (empty || busy) return;
    setBusy(true);
    try {
      await onSend(text, files);
      setText("");
      setFiles([]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-6 pb-5 pt-2.5">
      <div className="rounded-2xl border border-[#E5E7EB] p-1.5 focus-within:border-[#C7CBD4]">
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1.5 pb-1.5 pt-1">
            {files.map((f, i) => (
              <span key={i} className="inline-flex max-w-[240px] items-center gap-1 rounded-lg bg-[#F3F4F6] px-2 py-1 text-[12px]">
                <FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{f.name}</span>
                <button aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-1">
          <button aria-label="Attach file" onClick={() => picker.current?.click()} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6]"><Paperclip className="h-4 w-4" /></button>
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
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={`Message ${person}`}
            className="max-h-[120px] min-h-8 flex-1 resize-none bg-transparent py-1.5 text-[13.5px] outline-none placeholder:text-[#9CA3AF]"
          />
          <button
            aria-label="Send"
            disabled={empty || busy}
            onClick={submit}
            className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", empty ? "bg-[#E5E7EB] text-white" : seller ? "bg-[#F6A823] text-[#0E162F]" : "bg-[#4338CA] text-white")}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
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
