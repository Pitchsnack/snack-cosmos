import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, Search } from "lucide-react";
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
  const [busy, setBusy] = useState<string | null>(null);
  const r = useQuery({ queryKey: ["advisor-search", dealId, dq], queryFn: () => search({ data: { dealId, q: dq } }), enabled: dq.trim().length > 0 });
  return (
    <Shell width={560} onClose={onClose} label="Introduce advisor">
      <DocHead title="Introduce advisor" sub="Invite a live firm on PitchSnack to work on this deal for you" onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Firm name or ADV reference" className="h-10 pl-9" />
        </div>
        <div className="mt-3 space-y-2">
          {!dq.trim() && <p className="text-[13px] text-[#6B7280]">Type a firm name to search.</p>}
          {dq.trim() && r.data?.length === 0 && <p className="text-[13px] text-[#6B7280]">No live firm matches “{dq}”.</p>}
          {(r.data ?? []).map((f: any) => (
            <div key={f.id} className="flex items-center gap-3 rounded-[12px] border border-[#E5E7EB] p-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-[#E0F5F2] text-[13px] font-bold text-[#0F766E]">
                {f.logoUrl ? <img src={f.logoUrl} alt="" className="h-full w-full object-cover" /> : f.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">{f.name}{f.verified && <span className="ml-1.5 text-[11px] font-bold text-[#15803D]">✓ Verified</span>}</div>
                <div className="truncate text-[12.5px] text-[#6B7280]">{[f.ref, f.type, f.city].filter(Boolean).join(" · ")}</div>
              </div>
              {f.advisesOther
                ? <span className="text-[12px] text-[#6B7280]">Advises the other side</span>
                : <Button size="sm" disabled={!!busy} onClick={async () => {
                    setBusy(f.id);
                    try { await invite({ data: { dealId, firmId: f.id } }); toast.success(`Invitation sent to ${f.name}`); onDone(); onClose(); }
                    catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
                  }}>{busy === f.id ? "Sending…" : "Invite"}</Button>}
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12.5px] leading-relaxed text-[#6B7280]">The advisor sees the deal steps and dates only. They never see your NDA, reports, figures, letter of intent, private notes or messages. They sign an NDA with both sides before joining.</p>
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

function AdvisorProfileDialog({ dealId, side, onClose }: { dealId: string; side: Side; onClose: () => void }) {
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
