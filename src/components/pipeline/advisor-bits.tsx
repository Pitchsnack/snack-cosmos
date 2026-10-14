import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Info, Lock, Search } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { myEngagedAdvisors } from "@/lib/advisor-enquiries.functions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shell, DocHead, Caption, Rows, Reader, Foot, StatusPill, fmtDate } from "@/components/pipeline/pipeline-dialogs";
import { FirmCard } from "@/components/advisor/advisor-firm-card";
import {
  dealAdvisorState, searchAdvisorFirms, inviteAdvisor, withdrawAdvisorInvitation, getAdvisorNda, dealAdvisorProfile,
} from "@/lib/advisor-pipeline.functions";
import { useDebounced } from "@/hooks/use-debounced";

type Side = "seller" | "buyer";
const link = "text-[12.5px] font-semibold text-[#2563EB] hover:underline";

/** Contact M&A row content for the seller or buyer: advisor status text plus actions. */
export function useAdvisorState(dealId: string, enabled: boolean) {
  const f = useServerFn(dealAdvisorState);
  return useQuery({ queryKey: ["pipeline", "advisor", dealId], queryFn: () => f({ data: { dealId } }), enabled, staleTime: 15_000 });
}

export function useAdvisorContactRow(dealId: string, loiDone: boolean, done: boolean, t: (s: string) => string) {
  const q = useAdvisorState(dealId, loiDone);
  const qc = useQueryClient();
  const [dlg, setDlg] = useState<null | "invite" | { nda: Side } | { profile: Side }>(null);
  const withdraw = useServerFn(withdrawAdvisorInvitation);
  if (!loiDone) return { text: t("After the letter of intent is accepted"), action: undefined, dialogs: null };
  const s = q.data;
  const refresh = () => qc.invalidateQueries({ queryKey: ["pipeline"] });
  let text: React.ReactNode = t("Contacts exchanged");
  let action: React.ReactNode = undefined;
  if (s) {
    const parts: React.ReactNode[] = [];
    if (s.mine) parts.push(<span key="m"><b>{s.mine.firm}</b> · {t("your advisor")} · {t("joined")} {fmtDate(s.mine.joinedAt)}</span>);
    else if (s.invitation) parts.push(<span key="i"><b>{t("Invitation sent to")} {s.invitation.firm}</b> · {t("waiting for the advisor")}</span>);
    else if (s.lastDeclined) parts.push(<span key="d">{s.lastDeclined.firm} {t("declined")} · {t("you can invite another advisor")}</span>);
    else if (!done) parts.push(<span key="n"><b>{t("Exchange contacts")}</b> · {t("introduce your M&A advisor")}</span>);
    if (s.other) parts.push(<span key="o" className="block text-[12.5px] text-[#6B7280]">{s.other.firm} · {t("advisor for the other side")}</span>);
    if (parts.length) text = <>{parts}</>;
    action = (
      <>
        {s.mine && <><Button size="sm" variant="outline" onClick={() => setDlg({ nda: s.side })}>{t("Advisor NDA")}</Button><Button size="sm" variant="outline" onClick={() => setDlg({ profile: s.side })}>{t("Advisor profile")}</Button></>}
        {!s.mine && s.invitation && <button type="button" className={link} onClick={async () => {
          try { await withdraw({ data: { id: s.invitation!.id } }); toast.success(t("Invitation withdrawn")); refresh(); } catch (e) { toast.error((e as Error).message); }
        }}>{t("Withdraw invitation")}</button>}
        {!s.mine && !s.invitation && !done && <Button size="sm" onClick={() => setDlg("invite")}>{t("Introduce advisor")}</Button>}
        {s.other && <button type="button" className={link} onClick={() => setDlg({ nda: s.side === "seller" ? "buyer" : "seller" })}>{t("Their advisor NDA")}</button>}
      </>
    );
  }
  const dialogs = (
    <>
      {dlg === "invite" && <InviteAdvisorDialog dealId={dealId} onClose={() => setDlg(null)} onDone={refresh} />}
      {dlg && typeof dlg === "object" && "nda" in dlg && <AdvisorNdaDialog dealId={dealId} side={dlg.nda} onClose={() => setDlg(null)} />}
      {dlg && typeof dlg === "object" && "profile" in dlg && <AdvisorProfileDialog dealId={dealId} side={dlg.profile} onClose={() => setDlg(null)} />}
    </>
  );
  return { text, action, dialogs };
}

function InviteAdvisorDialog({ dealId, onClose, onDone }: { dealId: string; onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);
  const search = useServerFn(searchAdvisorFirms);
  const invite = useServerFn(inviteAdvisor);
  const mineFn = useServerFn(myEngagedAdvisors);
  const stateQ = useAdvisorState(dealId, true);
  const [pick, setPick] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const r = useQuery({ queryKey: ["advisor-search", dealId, dq], queryFn: () => search({ data: { dealId, q: dq } }), enabled: dq.trim().length > 0 });
  const yours = useQuery({ queryKey: ["my-engaged-advisors"], queryFn: () => mineFn(), staleTime: 30_000 });
  const otherFirm = (stateQ.data as any)?.other?.firm as string | undefined;
  const radio = (on: boolean) => <span className={cn("h-4 w-4 shrink-0 rounded-full border-2", on ? "border-[#1E2A4A] bg-[#1E2A4A] shadow-[inset_0_0_0_2px_#fff]" : "border-[#C9CEDA]")} />;
  const rowCls = (on: boolean, off?: boolean) => cn("flex w-full items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left", on ? "border-[#1E2A4A] bg-[#F6F7FB] shadow-[inset_0_0_0_1px_#1E2A4A] dark:bg-muted" : "border-[#DCDFE5] dark:border-border", off && "cursor-not-allowed opacity-50");
  const who = pick?.name ?? "Your advisor";
  return (
    <Shell width={600} onClose={onClose} label="Introduce your advisor">
      <DocHead title="Introduce your advisor" sub="Invite the firm that advises you on this deal" onClose={onClose} />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 pb-4 pt-4">
        <div>
          <div className="mb-2 text-[13.5px] font-semibold">Your advisors</div>
          {(yours.data ?? []).length === 0 ? (
            <div className="flex gap-2 rounded-[10px] border border-[#E7E9EE] bg-[#F6F7F9] p-3 text-[13px] dark:border-border dark:bg-muted/40"><Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>You haven't engaged an advisor yet. <Link to="/marketplace/advisors" className="font-semibold text-[#2563EB] hover:underline" onClick={onClose}>Find one in Browse advisors</Link>, or search all firms below.</span></div>
          ) : (
            <div role="radiogroup" className="space-y-2">
              {(yours.data ?? []).map((f: any) => {
                const off = !!otherFirm && otherFirm === f.name;
                const on = pick?.id === f.id;
                return (
                  <button key={f.id} type="button" role="radio" aria-checked={on} disabled={off} onClick={() => { setPick({ id: f.id, name: f.name }); setQ(""); }} className={rowCls(on, off)}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-[#E0F5F2] text-[12px] font-bold text-[#0F766E]">{f.logoUrl ? <img src={f.logoUrl} alt="" className="h-full w-full bg-white object-contain" /> : f.name.slice(0, 2).toUpperCase()}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold">{f.name}</span>
                      <span className="block truncate text-[12.5px] text-[#6B7280]">{off ? "Advising the other side on this deal" : [f.status === "engaged" ? `Your advisor since ${fmtDate(f.since)}` : "Worked with you", f.service, f.verified ? "✓ Verified advisor" : null].filter(Boolean).join(" · ")}</span></span>
                    {radio(on)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 pt-1 text-[11px] font-bold uppercase tracking-[.06em] text-[#9CA3AF]">Or search all firms<span className="h-px flex-1 bg-[#EEF0F3] dark:bg-border" /></div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search firms by name or ADV ref" className="h-10 pl-9" />
        </div>
        <div className="space-y-2">
          {dq.trim() && r.data?.length === 0 && <p className="text-[13px] text-[#6B7280]">No live firm matches “{dq}”.</p>}
          {dq.trim() && (r.data ?? []).map((f: any) => {
            const on = pick?.id === f.id;
            return (
              <button key={f.id} type="button" role="radio" aria-checked={on} disabled={f.advisesOther} onClick={() => setPick({ id: f.id, name: f.name })} className={rowCls(on, f.advisesOther)}>
                <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-[#E0F5F2] text-[12px] font-bold text-[#0F766E]">{f.logoUrl ? <img src={f.logoUrl} alt="" className="h-full w-full object-cover" /> : f.name.slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold">{f.name}{f.verified && <span className="ml-1.5 text-[11px] font-bold text-[#15803D]">✓ Verified</span>}</span>
                  <span className="block truncate text-[12.5px] text-[#6B7280]">{f.advisesOther ? "Advises the other side" : [f.ref, f.type, f.city].filter(Boolean).join(" · ")}</span></span>
                {radio(on)}
              </button>
            );
          })}
        </div>
        <ul className="space-y-1.5 text-[13px] text-[#374151] dark:text-foreground">
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-[15px] w-[15px] shrink-0 text-[#16A34A]" />{who} sees the deal steps and dates only, never your NDA, reports, figures, letter of intent, private notes or messages.</li>
          <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-[15px] w-[15px] shrink-0 text-[#16A34A]" />To join, {pick ? pick.name : "your advisor"} signs an NDA with you and the other side.</li>
        </ul>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-3.5">
        <span className="text-[13px] text-[#6B7280]"><Link to="/marketplace/advisors" onClick={onClose} className="font-semibold text-[#2563EB] hover:underline">Browse advisors</Link> to compare firms</span>
        <span className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!pick || busy} onClick={async () => {
            if (!pick) return;
            setBusy(true);
            try { await invite({ data: { dealId, firmId: pick.id } }); toast.success(`Invitation sent to ${pick.name}`); onDone(); onClose(); }
            catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
          }}>{busy ? "Sending…" : "Send invitation"}</Button>
        </span>
      </div>
    </Shell>
  );
}

export function AdvisorNdaDialog({ dealId, side, onClose }: { dealId: string; side: Side; onClose: () => void }) {
  const f = useServerFn(getAdvisorNda);
  const q = useQuery({ queryKey: ["advisor-nda", dealId, side], queryFn: () => f({ data: { dealId, side } }) });
  const n = q.data;
  return (
    <Shell width={640} onClose={onClose} label="Advisor NDA">
      <DocHead title="Advisor NDA" sub={n ? `${n.firm} · advising ${n.client}` : "Loading…"} onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        {q.error && <p className="text-[13px] text-destructive">{(q.error as Error).message}</p>}
        {n && <>
          <StatusPill tone={new Date(n.expiresAt) > new Date() ? "green" : "amber"}>{new Date(n.expiresAt) > new Date() ? `✓ Active until ${fmtDate(n.expiresAt)}` : `Ended ${fmtDate(n.expiresAt)}`}</StatusPill>
          <Caption>Parties</Caption>
          <Rows rows={[["Advisor", `${n.firm}${n.firmRef ? ` (${n.firmRef})` : ""}`], ["Seller", n.seller], ["Buyer", n.buyer]]} />
          <Caption>Signature</Caption>
          <Rows rows={[["Signed by the advisor", [n.signer, n.signerTitle, fmtDate(n.signedAt), "e-signature"].filter(Boolean).join(" · ")], ["Term", `2 years · until ${fmtDate(n.expiresAt)}`]]} />
          <Caption>Key terms</Caption>
          <Rows rows={[["Purpose", n.purpose], ["Use of information", "Only for this deal. Nothing goes to anyone else without both sides’ consent."], ["Governing law", "Thailand"]]} />
          <Reader label="NDA" text={n.text} />
        </>}
      </div>
      <Foot><Lock className="h-3.5 w-3.5" />The advisor, the seller and the buyer hold the same signed copy. Stored by PitchSnack.</Foot>
    </Shell>
  );
}

export function AdvisorProfileDialog({ dealId, side, onClose }: { dealId: string; side: Side; onClose: () => void }) {
  const f = useServerFn(dealAdvisorProfile);
  const q = useQuery({ queryKey: ["advisor-profile", dealId, side], queryFn: () => f({ data: { dealId, side } }) });
  return (
    <Shell width={720} onClose={onClose} label="Advisor profile">
      <DocHead title="Advisor profile" sub={q.data ? `Advising ${q.data.client}` : "Loading…"} onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        {q.error && <p className="text-[13px] text-destructive">{(q.error as Error).message}</p>}
        {q.data && <>
          <FirmCard f={q.data.firm} wide />
          <Caption>Contact</Caption>
          <Rows rows={[["Signed the NDA", q.data.signer ? [q.data.signer.name, q.data.signer.title].filter(Boolean).join(" · ") : "—"], ["Email", q.data.firm.email ?? "—"], ["Phone", q.data.firm.phone ?? "—"]]} />
        </>}
      </div>
    </Shell>
  );
}

/** Keeps a value in state that re-reads every few seconds while the tab is visible. */
export function usePollMs() {
  const [ms, setMs] = useState<number | false>(3000);
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const set = () => setMs(document.hidden ? false : m?.matches ? 15000 : 3000);
    set();
    document.addEventListener("visibilitychange", set);
    return () => document.removeEventListener("visibilitychange", set);
  }, []);
  return ms;
}
