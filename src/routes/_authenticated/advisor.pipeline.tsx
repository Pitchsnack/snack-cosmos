import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Shell, DocHead, Caption, Rows, Reader, Foot, fmtDate } from "@/components/pipeline/pipeline-dialogs";
import { AdvisorNdaDialog, usePollMs } from "@/components/pipeline/advisor-bits";
import {
  listAdvisorPipeline, joinAdvisorDeal, declineAdvisorInvitation, advisorDealHistory, advisorOtherProfile, advisorInvitationStatus,
  type AdvInvitation, type AdvDeal,
} from "@/lib/advisor-pipeline.functions";
import { advisorNdaText } from "@/config/advisor-nda";
import { useTranslation } from "@/i18n/language";

export const Route = createFileRoute("/_authenticated/advisor/pipeline")({
  validateSearch: z.object({ invitation: z.string().optional(), deal: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "My Pipeline · Advisor · PitchSnack" },
      { name: "description", content: "Deals you were invited to and deals you work on as an advisor." },
      { property: "og:title", content: "My Pipeline · Advisor · PitchSnack" },
      { property: "og:description", content: "Deals you were invited to and deals you work on as an advisor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdvisorPipelinePage,
});

const STEPS = ["NDA", "Financial & Valuation", "Letter of intent", "Contact M&A", "Legal", "Offer & SPA", "Payment"] as const;
const curStep = (d: AdvDeal) => [d.ndaAt, d.reportAt, d.loiAt, d.joinedAt, d.legalAt, d.spaAt, d.paymentAt].findIndex((x) => !x);
type Filter = "all" | "invitations" | "you" | "client" | "other" | "done";

function AdvisorPipelinePage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const f = useServerFn(listAdvisorPipeline);
  const poll = usePollMs();
  const q = useQuery({ queryKey: ["pipeline", "advisor-list"], queryFn: () => f(), refetchInterval: poll });
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [joining, setJoining] = useState<AdvInvitation | null>(null);
  const status = useServerFn(advisorInvitationStatus);

  // An invitation link opens that invitation, or says why it can't.
  useEffect(() => {
    if (!search.invitation || !q.data) return;
    const inv = q.data.invitations.find((i) => i.id === search.invitation);
    if (inv) { document.getElementById(`inv-${inv.id}`)?.scrollIntoView({ block: "center" }); return; }
    status({ data: { id: search.invitation } }).then((s) => {
      if (s.status === "joined" && s.dealId) { setOpen(new Set([s.dealId])); document.getElementById(`deal-${s.dealId}`)?.scrollIntoView({ block: "center" }); }
      else toast(t(s.status === "withdrawn" ? "This invitation was withdrawn." : s.status === "declined" ? "You declined this invitation." : "This invitation is no longer open."));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.invitation, !!q.data]);

  const data = q.data;
  const deals = data?.deals ?? [];
  const invs = data?.invitations ?? [];
  const counts = useMemo(() => ({
    invitations: invs.length,
    you: deals.filter((d) => !d.paymentAt && d.wait?.who === "you").length,
    client: deals.filter((d) => !d.paymentAt && d.wait?.who === "client").length,
    other: deals.filter((d) => !d.paymentAt && d.wait?.who === "other").length,
    done: deals.filter((d) => d.paymentAt).length,
  }), [deals, invs]);
  const shown = deals.filter((d) => filter === "all" || filter === "invitations" ? filter === "all" : filter === "done" ? !!d.paymentAt : !d.paymentAt && d.wait?.who === filter);
  const chips: [Filter, string, number][] = [["all", "All", invs.length + deals.length], ["invitations", "Invitations", counts.invitations], ["you", "Waiting on you", counts.you], ["client", "Waiting on your client", counts.client], ["other", "Waiting on the other side", counts.other], ["done", "Completed", counts.done]];

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-6">
      <h1 className="text-[26px] font-bold tracking-[-0.01em]">{t("My Pipeline")}</h1>
      <p className="mt-1 text-[14px] text-[#6B7280]">{t("Deals your clients invited you to. You see the steps and dates only — never their NDA, reports, figures, letter of intent, private notes or messages.")}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {chips.map(([k, label, n]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k}
            className={cn("inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
              filter === k ? "border-[#0F766E] bg-[#0F766E] text-white" : "border-[#E5E7EB] bg-card text-[#374151] hover:border-[#C9CED6]")}>
            {t(label)}<span className={cn("rounded-full px-1.5 text-[11.5px]", filter === k ? "bg-white/20" : "bg-[#F3F4F6]")}>{n}</span>
          </button>
        ))}
      </div>
      {q.isLoading && <p className="mt-8 text-[14px] text-[#6B7280]">{t("Loading…")}</p>}
      {q.error && <p className="mt-8 text-[14px] text-destructive">{(q.error as Error).message}</p>}
      {(filter === "all" || filter === "invitations") && invs.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-[#6B7280]">{t("Invitations")}</h2>
          <div className="space-y-3">{invs.map((i) => <InvitationCard key={i.id} i={i} t={t} onJoin={() => setJoining(i)} />)}</div>
        </section>
      )}
      {filter !== "invitations" && (
        <section className="mt-6">
          {filter === "all" && deals.length > 0 && <h2 className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-[#6B7280]">{t("Your deals")}</h2>}
          <div className="space-y-3">
            {shown.map((d) => <DealCard key={d.dealId} d={d} t={t} open={open.has(d.dealId)} onToggle={() => setOpen((s) => { const n = new Set(s); n.has(d.dealId) ? n.delete(d.dealId) : n.add(d.dealId); return n; })} />)}
          </div>
        </section>
      )}
      {data && invs.length + deals.length === 0 && (
        <div className="mt-8 rounded-[14px] border border-dashed border-[#D9DCE2] p-8 text-center text-[14px] text-[#6B7280]">
          {t("No deals yet. When a seller or buyer invites your firm after their letter of intent is signed, the invitation shows here.")}
        </div>
      )}
      {data && filter !== "all" && filter !== "invitations" && shown.length === 0 && <p className="mt-6 text-[14px] text-[#6B7280]">{t("Nothing here right now.")}</p>}
      {joining && data && <JoinDialog i={joining} me={data.me} onClose={() => setJoining(null)} />}
    </div>
  );
}

function ClientChip({ side, t }: { side: "seller" | "buyer"; t: (s: string) => string }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.05em]", side === "seller" ? "bg-[#FEF3C7] text-[#B45309]" : "bg-[#E0E7FF] text-[#4338CA]")}>{t(side === "seller" ? "Seller client" : "Buyer client")}</span>;
}

function InvitationCard({ i, t, onJoin }: { i: AdvInvitation; t: (s: string) => string; onJoin: () => void }) {
  const qc = useQueryClient();
  const decline = useServerFn(declineAdvisorInvitation);
  const [busy, setBusy] = useState(false);
  return (
    <div id={`inv-${i.id}`} className="rounded-[14px] border border-[#99E0D6] bg-card p-5 shadow-[0_4px_14px_rgba(15,118,110,.06)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[16px] font-bold">{i.client.name}</span><ClientChip side={i.side} t={t} />
        <span className="ml-auto text-[12.5px] text-[#6B7280]">{t("Invited")} {fmtDate(i.invitedAt)} · {i.invitedBy}</span>
      </div>
      <div className="mt-1 text-[13px] text-[#6B7280]">{t("Deal with")} {i.other.name}{i.other.sub ? ` · ${i.other.sub}` : ""} · {t("for")} {i.firm.name}</div>
      <div className="mt-3 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
        <div><span className="text-[#6B7280]">{t("NDA")}:</span> {fmtDate(i.ndaAt)}</div>
        <div><span className="text-[#6B7280]">{t("Report shared")}:</span> {fmtDate(i.reportAt)}</div>
        <div><span className="text-[#6B7280]">{t("Letter of intent signed")}:</span> {fmtDate(i.loiAt)}</div>
        <div><span className="text-[#6B7280]">{t("Exclusivity until")}:</span> {fmtDate(i.exclusivityUntil)}</div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={async () => {
          setBusy(true);
          try { await decline({ data: { id: i.id } }); toast.success(`${t("You declined the invitation from")} ${i.client.name}`); qc.invalidateQueries({ queryKey: ["pipeline"] }); }
          catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
        }}>{t("Decline")}</Button>
        <Button size="sm" onClick={onJoin}>{t("Review NDA & join")}</Button>
      </div>
    </div>
  );
}

function JoinDialog({ i, me, onClose }: { i: AdvInvitation; me: { name: string; title: string | null }; onClose: () => void }) {
  const qc = useQueryClient();
  const join = useServerFn(joinAdvisorDeal);
  const [read, setRead] = useState(false);
  const [tick, setTick] = useState(false);
  const [busy, setBusy] = useState(false);
  const now = new Date(); const exp = new Date(now.getTime() + 730 * 86_400_000);
  const seller = i.side === "seller" ? i.client.name : i.other.name;
  const buyer = i.side === "buyer" ? i.client.name : i.other.name;
  const text = advisorNdaText({ firm: i.firm.name, firmRef: null, seller, buyer, client: i.client.name, signer: [me.name, me.title].filter(Boolean).join(", "), signedAt: now, expiresAt: exp });
  const consent = `I have read the advisor NDA and sign it on behalf of ${i.firm.name}, with ${seller} and ${buyer}. I will use what I see only for this deal.`;
  return (
    <Shell width={640} onClose={onClose} label="Advisor NDA">
      <DocHead title="Advisor NDA" sub={`${i.firm.name} · advising ${i.client.name}`} onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        <Caption>Parties</Caption>
        <Rows rows={[["Advisor", i.firm.name], ["Seller", seller], ["Buyer", buyer]]} />
        <Caption>Key terms</Caption>
        <Rows rows={[["Purpose", `Advising ${i.client.name} on this deal`], ["Use of information", "Only for this deal. Nothing goes to anyone else without both sides’ consent."], ["Term", `2 years · until ${fmtDate(exp.toISOString())}`], ["Governing law", "Thailand"]]} />
        <Reader label="NDA" text={text} onRead={() => setRead(true)} />
        <label className={cn("mt-4 flex items-start gap-2.5 text-[13px]", !read && "opacity-50")}>
          <Checkbox checked={tick} disabled={!read} onCheckedChange={(v) => setTick(!!v)} className="mt-0.5" />
          <span>{consent}</span>
        </label>
        {!read && <p className="mt-1.5 text-[12px] text-[#6B7280]">Read the full NDA to the end to sign.</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-[#F0F1F4] px-6 py-3">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!tick || busy} onClick={async () => {
          setBusy(true);
          try {
            const r = await join({ data: { id: i.id, consent } });
            if (r.ok) toast.success(`You joined the deal for ${r.client}${r.alsoDeclined ? ". Your invitation from the other side was declined." : ""}`);
            else toast.error(r.reason === "withdrawn" ? `${r.client} withdrew this invitation.` : `Your firm already advises the other side of this deal.`);
            qc.invalidateQueries({ queryKey: ["pipeline"] }); onClose();
          } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
        }}>{busy ? "Signing…" : "Sign & join"}</Button>
      </div>
      <Foot>Signing sends a copy to {i.client.name} and {i.other.name}.</Foot>
    </Shell>
  );
}

function DealCard({ d, t, open, onToggle }: { d: AdvDeal; t: (s: string) => string; open: boolean; onToggle: () => void }) {
  const cur = curStep(d);
  const [dlg, setDlg] = useState<null | "nda" | "profile" | "history">(null);
  const waitTone = d.wait?.who === "you" ? "text-[#B45309]" : "text-[#6B7280]";
  const waitText = !d.wait ? t("Completed") : d.wait.who === "you" ? `${t("waiting on you")}: ${t(d.wait.what)}` : d.wait.who === "client" ? `${t("waiting on your client")}: ${t(d.wait.what)}` : `${t("waiting on the other side")}: ${t(d.wait.what)}`;
  const rows: [string, string | null, string][] = [
    ["NDA", d.ndaAt, d.ndaAt ? t("Signed between the seller and the buyer") : "—"],
    ["Financial & Valuation", d.reportAt, d.reportAt ? t("Report shared with the buyer") : t("Not shared yet")],
    ["Letter of intent", d.loiAt, d.exclusivityUntil ? `${t("Signed")} · ${t("exclusivity until")} ${fmtDate(d.exclusivityUntil)}` : t("Signed")],
    ["Contact M&A", d.joinedAt, `${t("You joined for")} ${d.client.name}`],
    ["Legal", d.legalAt, d.legalAt ? t("Legal folder shared") : d.legalTask === "legal_questions" ? t("Waiting for the buyer's legal questions") : t("Legal folder not shared yet")],
    ["Offer & SPA", d.spaAt, d.spaAt ? t("SPA draft shared") : t("SPA draft not shared yet")],
    ["Payment", d.paymentAt, d.paymentAt ? t("Completed") : t("Not started")],
  ];
  return (
    <div id={`deal-${d.dealId}`} className={cn("overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-card", open && "shadow-[0_6px_20px_rgba(16,24,40,.06)]")}>
      <div role="button" tabIndex={0} aria-expanded={open} onClick={onToggle}
        onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onToggle(); } }}
        className="flex cursor-pointer items-center gap-3 px-5 pt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0F766E]">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="truncate text-[16px] font-bold">{d.client.name}</span><ClientChip side={d.side} t={t} /></div>
          <div className="truncate text-[12.5px] text-[#6B7280]">{t("Deal with")} {d.other.name} · <span className={cn("font-semibold", waitTone)}>{waitText}</span></div>
        </div>
        <span className="flex items-center gap-2 text-[12.5px] font-semibold text-[#6B7280]">{open ? t("Hide details") : t("Details")}
          <span className="grid h-[30px] w-[30px] place-items-center rounded-[8px] border border-[#E5E7EB]"><ChevronDown className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} /></span>
        </span>
      </div>
      <div className="flex gap-1 px-5 pb-4 pt-3">
        {STEPS.map((s, k) => <div key={s} title={t(s)} className={cn("h-1.5 flex-1 rounded-full", cur === -1 || k < cur ? "bg-[#0F766E]" : k === cur ? "bg-[#5EEAD4]" : "bg-[#E5E7EB]")} />)}
      </div>
      {open && (
        <div className="mx-5 border-t border-[#F0F1F4] pb-3">
          {rows.map(([label, date, text], k) => (
            <div key={label} className="grid min-h-[46px] grid-cols-[150px_90px_1fr] items-center gap-4 border-b border-[#F0F1F4] py-2 text-[13.5px]">
              <div className={cn("font-semibold", date || k === cur ? "text-[#111827]" : "text-[#9CA3AF]")}>{t(label)}</div>
              <div className="text-muted-foreground">{date ? fmtDate(date) : ""}</div>
              <div className="text-[#374151]">{text}</div>
            </div>
          ))}
          <div className="flex flex-wrap justify-end gap-2 pt-3">
            <Button size="sm" variant="outline" onClick={() => setDlg("profile")}>{d.side === "seller" ? t("Buyer profile") : t("Seller profile")}</Button>
            <Button size="sm" variant="outline" onClick={() => setDlg("nda")}>{t("Advisor NDA")}</Button>
            <Button size="sm" variant="outline" onClick={() => setDlg("history")}>{t("History")}</Button>
          </div>
        </div>
      )}
      {dlg === "nda" && <AdvisorNdaDialog dealId={d.dealId} side={d.side} onClose={() => setDlg(null)} />}
      {dlg === "profile" && <OtherProfileDialog d={d} onClose={() => setDlg(null)} />}
      {dlg === "history" && <AdvHistoryDialog d={d} onClose={() => setDlg(null)} />}
    </div>
  );
}

const FIELD_LABEL: Record<string, string> = { summary: "About", about: "About", founded: "Founded", employees: "Company size", website: "Website", address: "Address", trackRecord: "Track record", sectors: "Sectors", size: "Size", ticket: "Ticket size", mandateDealType: "Deal type" };

function OtherProfileDialog({ d, onClose }: { d: AdvDeal; onClose: () => void }) {
  const f = useServerFn(advisorOtherProfile);
  const q = useQuery({ queryKey: ["advisor-other", d.dealId], queryFn: () => f({ data: { dealId: d.dealId } }) });
  const p = q.data;
  return (
    <Shell width={600} onClose={onClose} label="Profile">
      <DocHead title={p?.otherIsBuyer ? "Buyer profile" : "Seller profile"} sub={p ? [p.name, p.sub].filter(Boolean).join(" · ") : "Loading…"} onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        {q.error && <p className="text-[13px] text-destructive">{(q.error as Error).message}</p>}
        {p && <>
          <Caption>Profile</Caption>
          <Rows rows={Object.entries(p.fields).filter(([, v]) => v).map(([k, v]) => [FIELD_LABEL[k] ?? k, v as string])} />
          {p.contact && <><Caption>Contact</Caption><Rows rows={[["Person", p.contact]]} /></>}
        </>}
      </div>
      <Foot>Read only. Shared under your advisor NDA.</Foot>
    </Shell>
  );
}

const EV: Record<string, string> = { advisor_joined: "Advisor joined · advisor NDA signed", legal_shared: "Legal folder shared", spa_shared: "SPA draft shared", payment_shared: "Payment completed" };

function AdvHistoryDialog({ d, onClose }: { d: AdvDeal; onClose: () => void }) {
  const f = useServerFn(advisorDealHistory);
  const q = useQuery({ queryKey: ["advisor-history", d.dealId], queryFn: () => f({ data: { dealId: d.dealId } }) });
  return (
    <Shell width={520} onClose={onClose} label="History">
      <DocHead title="History" sub={`${d.client.name} · since you joined`} onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        {(q.data ?? []).length === 0 && !q.isLoading && <p className="text-[13px] text-[#6B7280]">No changes yet.</p>}
        <Rows rows={(q.data ?? []).map((e) => [fmtDate(e.created_at), EV[e.event] ?? e.event])} />
      </div>
    </Shell>
  );
}
