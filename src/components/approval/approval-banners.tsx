import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronUp, Clock, Lock, Pencil, Sparkles, TriangleAlert, X } from "lucide-react";
import { getMyApprovalNotice, setApprovalNoticeState, type ApprovalNotice } from "@/lib/approval-notices.functions";
import { approvalDate } from "@/lib/approval-date";
import { useSessionContext } from "@/hooks/use-session-context";
import { useTranslation } from "@/i18n/language";

/**
 * The one-step approval banners: yellow while pending, red when Admin sent
 * changes or declined, green once verified and published. One at a time, on
 * every page of the user's own app; Admin never sees them.
 */

export const APPROVAL_NOTICE_KEY = ["approval-notice"];

export function useApprovalNotice() {
  const fn = useServerFn(getMyApprovalNotice);
  const { data: session } = useSessionContext();
  const isAdmin = session?.user?.accountRole === "admin";
  const q = useQuery({ queryKey: APPROVAL_NOTICE_KEY, queryFn: () => fn(), enabled: !isAdmin, staleTime: 30_000 });
  return { notice: (q.data ?? null) as ApprovalNotice | null, isAdmin };
}

function useNoticePatch(notice: ApprovalNotice | null) {
  const fn = useServerFn(setApprovalNoticeState);
  const qc = useQueryClient();
  return (patch: { yellowFolded?: boolean; redOpen?: boolean; bannerStep?: "ok" | "done"; popupSeen?: boolean }) => {
    if (!notice) return;
    void fn({ data: { itemType: notice.itemType, itemId: notice.itemId, patch } }).then(() => {
      void qc.invalidateQueries({ queryKey: APPROVAL_NOTICE_KEY });
    });
  };
}

/** Per-role "what you can do" rows: [nowLink, nowText, nowSub, lockedName, lockedSub]. */
function rowsFor(role: ApprovalNotice["role"], t: (s: string) => string) {
  if (role === "seller")
    return {
      now: [
        { label: t("Browse investors"), to: "/marketplace/browse", sub: t("Find investors looking for businesses like yours.") },
        { label: t("Add buyers to your watchlist"), to: "/marketplace/favourites", sub: t("Save the ones you like and come back to them.") },
      ],
      later: { label: t("Contact investors"), sub: t("Connect with investors once you’re approved.") },
    };
  if (role === "advisor")
    return {
      now: [
        { label: t("Browse the marketplace"), to: "/marketplace/browse", sub: t("See the sellers and buyers on PitchSnack.") },
        { label: t("Add companies to your watchlist"), to: "/marketplace/favourites", sub: t("Save the ones you like and come back to them.") },
      ],
      later: { label: t("Contact sellers and buyers"), sub: t("Message them once you’re approved.") },
    };
  return {
    now: [
      { label: t("Browse listings"), to: "/marketplace/browse", sub: t("Find businesses for sale across Thailand.") },
      { label: t("Add listings to your watchlist"), to: "/marketplace/favourites", sub: t("Save the ones you like and come back to them.") },
    ],
    later: { label: t("Contact sellers"), sub: t("Request NDAs and message sellers once you’re approved.") },
  };
}

function YellowBanner({ n }: { n: ApprovalNotice }) {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const patch = useNoticePatch(n);
  const open = !n.yellowFolded;
  const rows = rowsFor(n.role, t);
  return (
    <div className="ap-pdb">
      <button type="button" className="ap-pdtog" aria-expanded={open} onClick={() => patch({ yellowFolded: open })}>
        <span className="ap-ui"><Clock className="h-4 w-4" /></span>
        <span className="ap-pdline">
          <b>{t("Your account is pending approval.")}</b> {t("Submitted on")} {approvalDate(n.submittedAt, language)} · {t("PitchSnack reviews your company profile, usually within 1 business day.")}
        </span>
        <span className={`ap-pdc${open ? " up" : ""}`}><ChevronUp className="h-4 w-4" /></span>
      </button>
      {open && (
        <div className="ap-pdw" onClick={(e) => e.stopPropagation()}>
          <p className="ap-pdwh"><Sparkles className="h-[13px] w-[13px]" /><span><b>{t("While you wait")}</b>{t(", here’s what you can do before your account is approved.")}</span></p>
          {rows.now.map((r) => (
            <div className="ap-pdr" key={r.label}>
              <span className="ap-l"><Check className="h-3.5 w-3.5" />{t("Now")}</span>
              <span className="ap-v">
                <button type="button" className="ap-pdlk" onClick={() => navigate({ to: r.to })}>{r.label}</button>
                <small>{r.sub}</small>
              </span>
            </div>
          ))}
          <div className="ap-pdr ap-no">
            <span className="ap-l"><Lock className="h-3.5 w-3.5" />{t("After approval")}</span>
            <span className="ap-v"><b>{rows.later.label}</b><small>{rows.later.sub}</small></span>
          </div>
        </div>
      )}
    </div>
  );
}

function RedBanner({ n }: { n: ApprovalNotice }) {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const patch = useNoticePatch(n);
  const open = n.redOpen;
  const declined = n.state === "declined";
  const myCompany = n.role === "seller" ? "/my-startups?edit=" : "/marketplace/my-company?edit=";
  return (
    <div className="ap-urgb">
      <span className="ap-ui"><TriangleAlert className="h-4 w-4" /></span>
      <p>{t("Some account details need to be updated before we can approve your account.")}</p>
      <button type="button" className="ap-btn ap-sm ap-redline ap-btn" aria-expanded={open} onClick={() => patch({ redOpen: !open })}>
        {open ? t("Hide reasons") : t("Update details")}
      </button>
      {open && (
        <div className="ap-urgx">
          <p className="ap-urgh">
            <b>{declined ? t("Why your account wasn't approved") : t("What to update before we can approve your account")}</b>
            {n.role === "seller" ? t(" · PitchSnack reviewed your listing on") : t(" · PitchSnack reviewed your profile on")} {approvalDate(n.decidedAt, language)}.
          </p>
          {!!n.reasons.length && (
            <ul className="ap-urgl">
              {n.reasons.map((r) => (
                <li key={r}>
                  {declined ? <X className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
                  {r === "Another reason" ? t("Another reason, in the note below") : t(r)}
                </li>
              ))}
            </ul>
          )}
          {n.decisionNote && (
            <div className="ap-urgn">
              <span>{t("Note from PitchSnack")}</span>
              <q>{n.decisionNote}</q>
            </div>
          )}
          <div className="ap-urga">
            <button type="button" className="ap-btn ap-sm ap-navy" onClick={() => navigate({ to: myCompany as never })}>
              <Pencil className="h-3.5 w-3.5" />{t("Edit information")}
            </button>
            <span>{t("Update these details, then register again.")}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function GreenBanner({ n }: { n: ApprovalNotice }) {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const patch = useNoticePatch(n);
  const startRef = useRef<HTMLButtonElement>(null);
  const step2 = n.bannerStep === "ok";
  useEffect(() => { if (step2) startRef.current?.focus(); }, [step2]);
  const rows = rowsFor(n.role, t);
  const line = n.role === "seller"
    ? t("Buyers can find your listing in Browse listings, and you can connect with buyers.")
    : n.role === "advisor"
      ? t("Sellers and buyers can find you in Browse advisors.")
      : t("Sellers can find you in Browse investors, and you can sign NDAs.");
  const whoSees = n.role === "seller" ? t("to reduce duplication and make your listing easier to distinguish. This is what buyers will see.")
    : n.role === "advisor" ? t("to reduce duplication and make your listing easier to distinguish. This is what sellers and buyers will see.")
    : t("to reduce duplication and make your listing easier to distinguish. This is what sellers will see.");
  const changedName = (n.suggestedName ?? "").trim() !== (n.publishedName ?? "").trim();
  const changedHead = (n.suggestedHeadline ?? "").trim() !== (n.publishedHeadline ?? "").trim();
  const adjusted = changedName && changedHead ? t("We adjusted your listing name and headline") : changedName ? t("We adjusted your listing name") : t("We adjusted your headline");
  const start = () => { patch({ bannerStep: "done" }); navigate({ to: "/marketplace/browse" }); };
  return (
    <div className="ap-okb">
      <span className="ap-ui"><Check className="h-4 w-4" /></span>
      <p><b>{t("Your account has been approved.")}</b> {line}</p>
      {step2
        ? <button ref={startRef} type="button" className="ap-btn ap-sm ap-ok" onClick={start}>{t("Start browsing")}</button>
        : <button type="button" className="ap-btn ap-sm ap-ok" onClick={() => patch({ bannerStep: "ok" })}>{t("OK")}</button>}
      {!step2 && n.adminRewrote && (
        <div className="ap-okrw">
          <p className="ap-okrh"><Pencil className="h-[13px] w-[13px]" /><span><b>{adjusted}</b> {whoSees}</span></p>
          {changedName && (
            <div className="ap-okrr">
              <span className="ap-l">{t("Listing name")}</span>
              <span className="ap-v"><b>{n.publishedName}</b><small>{t("You suggested")} “{n.suggestedName}”</small></span>
            </div>
          )}
          {changedHead && (
            <div className="ap-okrr">
              <span className="ap-l">{t("Headline")}</span>
              <span className="ap-v"><b>{n.publishedHeadline}</b><small>{t("You suggested")} “{n.suggestedHeadline}”</small></span>
            </div>
          )}
        </div>
      )}
      {step2 && (
        <div className="ap-okrw ap-okdo">
          <p className="ap-okrh"><Sparkles className="h-[13px] w-[13px]" /><span><b>{t("What you can do now")}</b>{t(" that your account is approved.")}</span></p>
          {rows.now.map((r) => (
            <div className="ap-pdr" key={r.label}>
              <span className="ap-l"><Check className="h-3.5 w-3.5" />{t("Now")}</span>
              <span className="ap-v">
                <button type="button" className="ap-pdlk" onClick={() => navigate({ to: r.to })}>{r.label}</button>
                <small>{r.sub}</small>
              </span>
            </div>
          ))}
          <div className="ap-pdr">
            <span className="ap-l"><Check className="h-3.5 w-3.5" />{t("Now")}</span>
            <span className="ap-v">
              <button type="button" className="ap-pdlk" onClick={() => navigate({ to: "/marketplace/browse" })}>{rows.later.label}</button>
              <small>{n.role === "seller" ? t("Connect with investors and accept NDAs.") : n.role === "advisor" ? t("Message them about their deals.") : t("Request NDAs and message sellers.")}</small>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function ApprovalBanners() {
  const { notice, isAdmin } = useApprovalNotice();
  if (isAdmin || !notice) return null;
  if (notice.state === "changes_requested" || notice.state === "declined") return <RedBanner n={notice} />;
  if (notice.state === "pending") return <YellowBanner n={notice} />;
  if (notice.state === "live" && notice.bannerStep !== "done") return <GreenBanner n={notice} />;
  return null;
}

/** The red sidebar badge: a pulsing "!" on My Company while changes are needed. */
export function ApprovalSidebarBadge() {
  const { notice, isAdmin } = useApprovalNotice();
  const { t } = useTranslation();
  if (isAdmin || !notice) return null;
  if (notice.state !== "changes_requested" && notice.state !== "declined") return null;
  return <span className="ap-urg" role="status" aria-label={t("Needs updating")}>!</span>;
}
