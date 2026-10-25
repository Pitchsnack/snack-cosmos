import { useId, useRef } from "react";
import { Eye, LockOpen } from "lucide-react";
import { FolderTab } from "@/components/my-business/my-business-profiles";
import { useTranslation } from "@/i18n/language";
import { cn } from "@/lib/utils";

export type FavView = "private" | "public";

/**
 * Favourites card: with an approved NDA, My Company's folder tabs (Private view
 * left and in front by default, Public view right); otherwise one public card.
 */
export function FavViewCard({ name, hasPrivate, view, open, side, onView, privateBody, publicBody, reserveTabs }: {
  name: string;
  hasPrivate: boolean;
  view: FavView;
  /** This card is the one shown in the panel (orange outline). */
  open: boolean;
  side: "buyer" | "seller" | "advisor";
  onView: (v: FavView) => void;
  privateBody?: React.ReactNode;
  publicBody: React.ReactNode;
  /** Grid: keep 58px above a one-view card so bodies line up. */
  reserveTabs?: boolean;
}) {
  const { t } = useTranslation();
  const bodyId = useId();
  const refs = useRef<Record<FavView, HTMLButtonElement | null>>({ private: null, public: null });
  const strip = "[&>*]:rounded-none [&>*]:border-0 [&>*]:shadow-none [&>*]:ring-0 [&>*:hover]:shadow-none";
  const v = hasPrivate ? view : "public";
  const go = (x: FavView) => { onView(x); requestAnimationFrame(() => refs.current[x]?.focus()); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" && hasPrivate) { e.preventDefault(); go("private"); }
    if (e.key === "ArrowRight") { e.preventDefault(); go("public"); }
  };
  return (
    <div className="@container">
      <div role="tablist" aria-label={`${t("Views of")} ${name}`} onKeyDown={onKey} className="standard-watch-tabs relative z-10 h-[58px]">
        {hasPrivate && <FolderTab side="left" active={v === "private"} open={open} tone="green" compactNarrow
          icon={<LockOpen className="h-4 w-4 shrink-0" />} title={t("Private view")} sub={t("Shared under your NDA")}
          controls={bodyId} tabRef={(el) => { refs.current.private = el; }} onClick={() => onView("private")} />}
        <FolderTab side={hasPrivate ? "right" : "left"} active={v === "public"} open={open} tone="indigo" compactNarrow
          icon={<Eye className="h-4 w-4 shrink-0" />} title={t("Public view")} sub={t(side === "advisor" ? "What everyone sees" : side === "buyer" ? "What every buyer sees" : "What every seller sees")}
          controls={bodyId} tabRef={(el) => { refs.current.public = el; }} onClick={() => onView("public")} />
      </div>
      <div id={bodyId} role="tabpanel" className={cn("overflow-hidden rounded-b-[14px] rounded-t-none border bg-card", open ? "border-accent" : "border-border", strip)}>
        {v === "private" ? privateBody : publicBody}
      </div>
    </div>
  );
}

/** First line of the Favourites panel body: which view this is. */
export function FavViewLine({ view, children }: { view: FavView; children: React.ReactNode }) {
  const { t } = useTranslation();
  const priv = view === "private";
  return (
    <div className={cn("flex flex-wrap items-start gap-2 rounded-[10px] border px-[14px] py-[11px] text-[13.5px]",
      priv ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]" : "border-[#E0E7FF] bg-[#F5F7FF] text-[#312E81]")}>
      {priv ? <LockOpen className="mt-0.5 h-4 w-4 flex-none" /> : <Eye className="mt-0.5 h-4 w-4 flex-none" />}
      <span className={cn("rounded-[6px] px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide", priv ? "bg-[#E8F6EE]" : "bg-[#E0E7FF]")}>{t(priv ? "Private view" : "Public view")}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

/** Second sentence of the Public view line. */
export function publicStatusSentence(t: (s: string) => string, status: "approved" | "requested" | "saved", what: "company" | "investor", requestedOn: string) {
  const pv = <b>{t("Private view")}</b>;
  if (status === "approved") return <>{t("Your NDA is approved, so the")} {pv} {t(what === "company" ? "tab shows the company." : "tab shows the investor.")}</>;
  if (status === "requested") return <>{t("The NDA was requested on")} {requestedOn}. {t("Once it's approved, this card gets a")} {pv} {t("tab, shown first.")}</>;
  return <>{t("Once an NDA is approved, this card gets a")} {pv} {t("tab, shown first.")}</>;
}
