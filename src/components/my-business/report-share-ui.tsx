import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { toast } from "sonner";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { listPipeline, shareReport, revokeReportShare, type PipelineRow } from "@/lib/pipeline.functions";
import { getStartupFinancials } from "@/lib/financials.functions";
import { financialsQueryKey, FINANCIALS_STALE_TIME } from "@/hooks/use-has-financials";
import { dayMonth } from "@/components/reports/report-order-bits";

/** Text-only share UI for seller reports: panel, popover and Share/Access window. */

export const sharedWhat = (s: { financials: boolean; valuation: boolean }) =>
  s.financials && s.valuation ? "Financial report, Valuation" : s.financials ? "Financial report" : "Valuation";

const ndaLive = (p: PipelineRow) =>
  !!p.ndaApprovedAt && p.status !== "declined" && (!p.ndaExpiresAt || new Date(p.ndaExpiresAt).getTime() > Date.now());

export function useCompanyShares(startupId: string | undefined) {
  const fn = useServerFn(listPipeline);
  const { data = [] } = useQuery({ queryKey: ["pipeline", "seller"], queryFn: () => fn({ data: { as: "seller" } }), enabled: !!startupId });
  const rows = data.filter((p) => p.startupId === startupId);
  const shared = rows.filter((p) => p.share && ndaLive(p));
  const invite = rows.filter((p) => ndaLive(p) && !p.share);
  const waiting = rows.filter((p) => !p.ndaApprovedAt && p.status !== "declined").length;
  return { shared, invite, waiting };
}

type Opener = (p: PipelineRow, mode: "share" | "manage") => void;

export function SharePanel({ startupId, onClose, onOpenPopover, anchor }: { startupId: string; onClose: () => void; onOpenPopover: () => void; anchor: React.ReactNode }) {
  const { shared, invite } = useCompanyShares(startupId);
  return (
    <section className="mb-4 rounded-[14px] border border-[#E5E7EB] bg-white">
      <div className="flex flex-wrap items-start gap-3 px-5 pb-3.5 pt-[18px]">
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-bold text-[#111827]">Who can see your reports</h2>
          <p className="text-[13px] text-[#6B7280]">Only buyers whose NDA you approved can get access. Nothing is shared until you share it.</p>
        </div>
        <div className="flex items-center gap-1.5">
          {anchor}
          <button type="button" onClick={onClose} aria-label="Close. Share with a buyer stays next to the tabs."
            className="grid h-[34px] w-[34px] place-items-center rounded-[9px] text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]">
            <X className="h-[17px] w-[17px]" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-[18px] gap-y-2.5 px-5 pb-[18px] text-[13px]">
        {shared.length === 0 && <span className="text-[#6B7280]">Not shared with anyone yet.</span>}
        {shared.map((p) => (
          <span key={p.id}><b className="font-semibold text-[#111827]">{p.counterparty.name}</b><span className="text-[#6B7280]"> · {sharedWhat(p.share!)}</span></span>
        ))}
        {invite.length > 0 && (
          <button type="button" onClick={onOpenPopover} className="text-[13px] font-semibold text-[#2563EB] hover:underline">{invite.length} more can be invited</button>
        )}
      </div>
    </section>
  );
}

/** "Share with a buyer" button + its popover. Controlled open state so the panel link can open it too. */
export function ShareButton({ startupId, open, setOpen, panelHidden, onShowOnPage, onOpenWindow, buttonRef }: {
  startupId: string; open: boolean; setOpen: (v: boolean) => void; panelHidden: boolean; onShowOnPage: () => void;
  onOpenWindow: Opener; buttonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const { shared, invite, waiting } = useCompanyShares(startupId);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    boxRef.current?.querySelector<HTMLElement>("button, a")?.focus();
    const onDown = (e: MouseEvent) => {
      if (boxRef.current?.contains(e.target as Node) || buttonRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); buttonRef.current?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, setOpen, buttonRef]);
  const caption = "px-2 pb-1.5 pt-0.5 text-[10.5px] font-bold uppercase tracking-[.07em] text-[#9CA3AF]";
  const row = "flex items-center gap-3 rounded-[10px] px-2 py-[7px] hover:bg-[#FEF3DE]";
  return (
    <div className="relative max-md:w-full">
      <button ref={buttonRef} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}
        className="h-[34px] rounded-[9px] bg-[#111827] px-3.5 text-[13px] font-semibold text-white hover:bg-[#1F2937]">
        Share with a buyer
      </button>
      {open && (
        <div ref={boxRef} role="dialog" aria-label="Share your reports"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[380px] max-w-[calc(100vw-32px)] rounded-[14px] border border-[#E5E7EB] bg-white text-left shadow-[0_18px_40px_rgba(16,24,40,.16)] max-md:fixed max-md:inset-x-4 max-md:top-auto max-md:w-auto max-md:max-w-none">
          <div className="flex items-center justify-between border-b border-[#F0F1F4] px-4 pb-3 pt-3.5">
            <h3 className="text-[15px] font-bold text-[#111827]">Share your reports</h3>
            {panelHidden && <button type="button" onClick={onShowOnPage} className="text-[12.5px] font-semibold text-[#2563EB] hover:underline">Show on page</button>}
          </div>
          <div className="border-b border-[#F0F1F4] px-2 pb-1.5 pt-2.5">
            <div className={caption}>Shared with · {shared.length}</div>
            {shared.length === 0 && <p className="px-2 pb-2 text-[12.5px] text-[#6B7280]">Not shared with anyone yet.</p>}
            {shared.map((p) => (
              <div key={p.id} className={row}>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-[#111827]">{p.counterparty.name}</div>
                  <div className="text-[12px] text-[#6B7280]">{sharedWhat(p.share!)} · {p.reportViewedAt ? `opened ${dayMonth(p.reportViewedAt)}` : "not opened yet"}</div>
                </div>
                <button type="button" data-manage={p.id} onClick={() => onOpenWindow(p, "manage")} className="text-[12.5px] font-semibold text-[#2563EB] hover:underline">Manage</button>
              </div>
            ))}
          </div>
          <div className="px-2 pb-1.5 pt-2.5">
            <div className={caption}>Can invite · NDA approved · {invite.length}</div>
            {invite.length === 0 && <p className="px-2 pb-2 text-[12.5px] text-[#6B7280]">Every buyer with an approved NDA already has access.</p>}
            {invite.map((p) => (
              <div key={p.id} className={row}>
                <div className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[#111827]">{p.counterparty.name}</div>
                <button type="button" data-share={p.id} onClick={() => onOpenWindow(p, "share")}
                  className="h-[30px] rounded-[8px] border border-[#DCDFE5] bg-white px-[11px] text-[12.5px] font-semibold text-[#111827]">Share</button>
              </div>
            ))}
          </div>
          {waiting > 0 && (
            <div className="rounded-b-[14px] border-t border-[#F0F1F4] bg-[#FAFAFB] px-4 pb-3 pt-[11px] text-[12px] text-[#6B7280]">
              {waiting} more {waiting === 1 ? "buyer is" : "buyers are"} waiting for NDA approval.{" "}
              <Link to="/marketplace/pipeline" className="font-semibold text-[#2563EB] hover:underline">Review in Pipeline</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReportCard({ on, ready, shared, name, line, onToggle }: { on: boolean; ready: boolean; shared?: boolean; name: string; line: string; onToggle: () => void }) {
  return (
    <div role="checkbox" aria-checked={ready && on} aria-disabled={!ready} tabIndex={ready ? 0 : -1}
      onClick={() => ready && onToggle()} onKeyDown={(e) => { if (ready && (e.key === " " || e.key === "Enter")) { e.preventDefault(); onToggle(); } }}
      className={`flex items-start gap-3 rounded-[12px] border px-3.5 py-3 ${!ready ? "cursor-not-allowed opacity-50 border-[#E5E7EB]" : on ? "cursor-pointer border-[#111827] hover:bg-[#FEF3DE]" : "cursor-pointer border-[#E5E7EB] hover:bg-[#FEF3DE]"}`}>
      {ready && <input type="checkbox" readOnly tabIndex={-1} checked={on} className="pointer-events-none mt-0.5 h-[17px] w-[17px] accent-[#111827]" />}
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-[#111827]">{name}</div>
        <div className="text-[12.5px] text-[#6B7280]">{ready ? line : "Not available yet"}</div>
      </div>
      {shared && <span className="inline-flex h-[22px] items-center rounded-full bg-[#ECFDF3] px-2 text-[11.5px] font-semibold text-[#15803D]">Shared</span>}
    </div>
  );
}

/** Share window (new buyer) or Access window (existing share), with revoke confirm. */
export function ShareAccessDialog({ p, mode, delivered, onClose, onDone }: {
  p: PipelineRow; mode: "share" | "manage";
  delivered?: { financialsAt: string | null; valuationAt: string | null };
  onClose: () => void; onDone?: (result: "shared" | "saved" | "revoked") => void;
}) {
  const qc = useQueryClient();
  const fShare = useServerFn(shareReport);
  const fRevoke = useServerFn(revokeReportShare);
  const fFin = useServerFn(getStartupFinancials);
  const { data: fin } = useQuery({ queryKey: financialsQueryKey(p.startupId), queryFn: () => fFin({ data: { startupId: p.startupId } }), staleTime: FINANCIALS_STALE_TIME });
  const years = [...(fin?.years ?? [])].sort((a, b) => a - b);
  const fy = years.length ? `FY${years[0]}–${years[years.length - 1]}` : "Statements, ratios and analyst notes";
  const manage = mode === "manage" && !!p.share;
  const init = { f: manage ? p.share!.financials : p.reports.financials, v: manage ? p.share!.valuation : p.reports.valuation, dl: manage ? p.share!.allowDownload : false };
  const [f, setF] = useState(init.f);
  const [v, setV] = useState(init.v);
  const [dl, setDl] = useState(init.dl);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const none = !(f && p.reports.financials) && !(v && p.reports.valuation);
  const changed = f !== init.f || v !== init.v || dl !== init.dl;
  const name = p.counterparty.name;
  const refresh = () => qc.invalidateQueries({ queryKey: ["pipeline"] });

  const run = async (fn: () => Promise<unknown>, msg: string, result: "shared" | "saved" | "revoked") => {
    setBusy(true);
    try { await fn(); await refresh(); toast.success(msg); onClose(); onDone?.(result); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const doShare = () => run(() => fShare({ data: { id: p.id, financials: f, valuation: v, allowDownload: dl } }),
    manage ? `Access for ${name} updated.` : `Shared with ${name}.`, manage ? "saved" : "shared");
  const doRevoke = () => run(() => fRevoke({ data: { id: p.id } }), `Access revoked. ${name} can no longer open your reports.`, "revoked");

  const cap = "mb-2 text-[10.5px] font-bold uppercase tracking-[.07em] text-[#9CA3AF]";
  const sub = manage
    ? `Shared ${dayMonth(p.share!.sharedAt)} · ${p.reportViewedAt ? `opened ${dayMonth(p.reportViewedAt)}` : "not opened yet"}`
    : [p.counterparty.sub, p.reportRequestedAt ? `asked ${dayMonth(p.reportRequestedAt)}` : null].filter(Boolean).join(" · ");
  const outline = "h-9 rounded-[9px] border border-[#DCDFE5] bg-white px-3.5 text-[13px] font-semibold text-[#111827]";
  const dark = "h-9 rounded-[9px] bg-[#111827] px-3.5 text-[13px] font-semibold text-white disabled:opacity-40";

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(17,24,39,.45)]" />
        <DialogPrimitive.Content aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 w-[540px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-[16px] bg-white shadow-[0_30px_70px_rgba(16,24,40,.28)] focus:outline-none">
          <div className="flex items-start gap-3 px-5 pb-3.5 pt-5">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="text-[17px] font-bold text-[#111827]">{manage ? `Access for ${name}` : `Share your reports with ${name}`}</DialogPrimitive.Title>
              {sub && <p className="text-[12.5px] text-[#6B7280]">{sub}</p>}
            </div>
            <DialogPrimitive.Close aria-label="Close" className="grid h-8 w-8 place-items-center rounded-[8px] text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"><X className="h-[17px] w-[17px]" /></DialogPrimitive.Close>
          </div>
          {confirm ? (
            <div className="px-5 pb-5">
              <div className="rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3.5">
                <div className="text-[14px] font-semibold text-[#991B1B]">Revoke access for {name}?</div>
                <p className="text-[12.5px] text-[#7F1D1D]">They can no longer open your reports in PitchSnack.</p>
                {init.dl && <p className="text-[12.5px] text-[#7F1D1D]">PDFs they have already downloaded can't be taken back.</p>}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" autoFocus className={outline} onClick={() => setConfirm(false)}>Keep access</button>
                <button type="button" disabled={busy} onClick={doRevoke} className="h-9 rounded-[9px] bg-[#DC2626] px-3.5 text-[13px] font-semibold text-white hover:bg-[#B91C1C]">Revoke access</button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4 px-5 pb-4">
                <div>
                  <div className={cap}>{manage ? "What they can see" : "What to share"}</div>
                  <div className="space-y-2">
                    <ReportCard on={f} ready={p.reports.financials} shared={manage && p.share!.financials} name="Verified financial report"
                      line={`${fy}${delivered?.financialsAt ? ` · delivered ${dayMonth(delivered.financialsAt)}` : ""}`} onToggle={() => setF(!f)} />
                    <ReportCard on={v} ready={p.reports.valuation} shared={manage && p.share!.valuation} name="Estimated valuation"
                      line={`Valuation range and methods${delivered?.valuationAt ? ` · delivered ${dayMonth(delivered.valuationAt)}` : ""}`} onToggle={() => setV(!v)} />
                  </div>
                </div>
                <div>
                  <div className={cap}>Access</div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[14px] font-semibold text-[#111827]">Allow download (PDF)</span>
                    <button type="button" role="switch" aria-checked={dl} aria-label="Allow download (PDF)" onClick={() => setDl(!dl)}
                      className={`relative h-[22px] w-[38px] rounded-full transition-colors ${dl ? "bg-[#111827]" : "bg-[#D1D5DB]"}`}>
                      <span className={`absolute top-[3px] h-4 w-4 rounded-full bg-white transition-all ${dl ? "left-[19px]" : "left-[3px]"}`} />
                    </button>
                  </div>
                  <p className="mt-1 text-[12.5px] text-[#6B7280]">{dl ? "They can also save a PDF. Their name is watermarked on every page." : "They read it in PitchSnack only, with their name watermarked. You see when they open it."}</p>
                  <p className="mt-2 text-[12.5px] text-[#6B7280]">Access ends when the NDA ends, or when you revoke it.</p>
                  {manage && none && <p className="mt-2 text-[12.5px] font-semibold text-[#B91C1C]">Tick at least one report, or revoke access.</p>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-[#F0F1F4] px-5 py-3.5">
                {manage
                  ? <button type="button" onClick={() => setConfirm(true)} className="text-[13px] font-semibold text-[#B91C1C] hover:underline">Revoke access</button>
                  : <span className="text-[12.5px] text-[#6B7280]">{p.counterparty.person ?? name} gets a notification.</span>}
                <div className="ml-auto flex gap-2">
                  <button type="button" className={outline} onClick={onClose}>Cancel</button>
                  <button type="button" className={dark} disabled={busy || none || (manage && !changed)} onClick={doShare}>{manage ? "Save changes" : "Share report"}</button>
                </div>
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
