import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Lock, LockOpen, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PublicListingCard } from "@/components/hidden-profile/public-listing-card";
import { useMyVerification } from "@/components/marketplace/buyer-verification";
import { myNdaStatuses, requestNda } from "@/lib/pipeline.functions";
import { mySavedListingIds, toggleSavedListing } from "@/lib/favourites.functions";
import type { PublicListing } from "@/lib/public-listing";
import { useTranslation } from "@/i18n/language";
import { cn } from "@/lib/utils";

export type Teaser = {
  id: string;
  listing: PublicListing;
  dealType?: string | null;
  askingPrice?: number | null;
  stakePct?: number | null;
};

/** Refresh everything that depends on a listing's saved / NDA state. */
export function useInvalidateListings() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["marketplace-teasers"] });
    qc.invalidateQueries({ queryKey: ["favourites"] });
    qc.invalidateQueries({ queryKey: ["saved-listings"] });
    qc.invalidateQueries({ queryKey: ["pipeline"] });
  };
}

/** Saved listings are stored per buyer on the server (they feed Favourites). */
export function useSavedListings() {
  const { t } = useTranslation();
  const list = useServerFn(mySavedListingIds);
  const toggleFn = useServerFn(toggleSavedListing);
  const invalidate = useInvalidateListings();
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["saved-listings"], queryFn: () => list() });
  const ids = new Set(data);
  const toggle = async (id: string) => {
    const saved = !ids.has(id);
    qc.setQueryData<string[]>(["saved-listings"], (prev = []) => (saved ? [...prev, id] : prev.filter((x) => x !== id)));
    try {
      await toggleFn({ data: { id, saved } });
      toast.success(saved ? t("Added to Favourites.") : t("Removed from Favourites."));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      invalidate();
    }
  };
  return { ids, toggle };
}

/** Star = Add to Favourites. With an NDA the star is filled and fixed. */
export function SaveButton({ saved, onClick, square, nda }: { saved: boolean; onClick: () => void; square?: boolean; nda?: boolean }) {
  const { t } = useTranslation();
  const on = saved || !!nda;
  const tip = nda ? t("In Favourites because of your NDA") : saved ? t("Remove from Favourites") : t("Add to Favourites");
  const star = <Star className={cn("h-4 w-4", on ? "fill-[#F59E0B] text-[#D97706]" : "text-[#4B5563]")} />;
  if (square) {
    const cls = cn("inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border bg-white", on ? "border-[#FDE68A]" : "border-[#E5E7EB]");
    if (nda) return <span className={cls} title={tip} aria-label={tip} onClick={(e) => e.stopPropagation()}>{star}</span>;
    return (
      <button type="button" aria-label={tip} aria-pressed={saved} title={tip} className={cls}
        onClick={(e) => { e.stopPropagation(); onClick(); }}>{star}</button>
    );
  }
  return (
    <button type="button" aria-pressed={saved} title={tip}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn("inline-flex h-[34px] items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors",
        saved ? "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]" : "border-border bg-background text-foreground hover:bg-muted")}>
      {star}{saved ? t("In Favourites") : t("Add to Favourites")}
    </button>
  );
}

export function NdaApprovedBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[#BBF7D0] bg-[#ECFDF3] px-2 py-0.5 text-[10.5px] font-bold text-[#15803D]">
      <LockOpen className="h-3 w-3" />{t("NDA approved")}
    </span>
  );
}

export function useNdaStatuses() {
  const fn = useServerFn(myNdaStatuses);
  return useQuery({ queryKey: ["pipeline", "nda-statuses"], queryFn: () => fn() });
}

export function NdaButton({ className, listingId, onRequested }: { className?: string; listingId: string; onRequested?: (id: string) => void }) {
  const { t } = useTranslation();
  const { data } = useMyVerification();
  const { data: statuses } = useNdaStatuses();
  const req = useServerFn(requestNda);
  const invalidate = useInvalidateListings();
  const [busy, setBusy] = useState(false);
  const st = statuses?.[listingId];
  const locked = !data?.verified;
  if (st && st !== "declined") {
    return (
      <span className={cn("inline-flex h-[34px] items-center rounded-md border px-3 text-sm font-medium text-muted-foreground", className)}>
        {st === "requested" ? t("NDA requested") : t("NDA approved")}
      </span>
    );
  }
  return (
    <button
      type="button"
      title={locked ? t("Submit for verification on My Profile first") : undefined}
      disabled={locked || busy}
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        try {
          await req({ data: { listingId } });
          if (onRequested) onRequested(listingId);
          else toast.success("NDA request sent to the seller.");
          invalidate();
        } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
      }}
      className={cn("h-[34px] rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60", className)}
    >
      {locked ? t("Available after verification") : t("Request NDA")}
    </button>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {children}
    </section>
  );
}

export function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-1.5 text-[13px] last:border-0">
      <span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v}</span>
    </div>
  );
}

export function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  const shown = rows.filter(([, v]) => v != null && v !== "");
  return <>{shown.map(([k, v]) => <Row key={k} k={k} v={v} />)}</>;
}

export const BOX = "rounded-[12px] border border-border px-[14px] py-3";

export function DealTerms({ t }: { t: Teaser }) {
  const { t: tr } = useTranslation();
  const x = t as Teaser & { reason?: string | null; ndaCount?: number | null; loiCount?: number | null };
  const interest = x.ndaCount != null || x.loiCount != null
    ? [x.ndaCount != null && `${x.ndaCount} NDAs`, x.loiCount != null && `${x.loiCount} LOIs`].filter(Boolean).join(" · ")
    : null;
  return (
    <div className={BOX}>
      <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{tr("Deal terms")}</h4>
      <KV rows={[
        [tr("Stake offered"), t.stakePct != null ? `${t.stakePct}%` : null],
        [tr("Asking price"), t.askingPrice == null ? tr("On request") : `฿${t.askingPrice}M`],
        [tr("Deal type"), t.dealType ?? null],
        [tr("Reason"), x.reason ?? null],
        [tr("Buyer interest"), interest],
      ]} />
    </div>
  );
}

const STEPS = ["Request NDA", "Seller approves", "Full access", "Exchange contact"];

/** Right panel body for anonymous listings — public read model only. */
export function ListingDetail({ t, requested, approved, onRequested }: { t: Teaser; requested?: boolean; approved?: boolean; onRequested?: (id: string) => void }) {
  const { t: tr } = useTranslation();
  const l = t.listing;
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [t.id]);
  return (
    <div className="space-y-5">
      <PublicListingCard l={l} deal={t} badge={approved ? <NdaApprovedBadge /> : requested ? <NdaRequestedBadge /> : undefined} />
      {l.description && (
        <Section title={tr("Business overview")}>
          <p className={cn("text-[13.5px] text-foreground/80", !more && "line-clamp-3")}>{l.description}</p>
          <button type="button" onClick={() => setMore((m) => !m)} className="text-[12.5px] font-semibold hover:underline">{more ? tr("Show less ▴") : tr("Show more ▾")}</button>
        </Section>
      )}
      {approved ? <div className="grid gap-3 sm:grid-cols-2"><DealTerms t={t} /></div> : <LowerPanel t={t} requested={requested} onRequested={onRequested} />}
    </div>
  );
}

export function NdaRequestedBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2 py-0.5 text-[10.5px] font-bold text-[#B45309]">
      <Clock className="h-3 w-3" />{t("NDA requested")}
    </span>
  );
}

type NdaStatus = "none" | "requested" | "approved" | "exchanged";

function LowerPanel({ t, requested, onRequested }: { t: Teaser; requested?: boolean; onRequested?: (id: string) => void }) {
  const { t: tr, language } = useTranslation();
  const l = t.listing;
  const x = t as Teaser & { growthBand?: string | null; ebitdaMargin?: string | null; netCash?: string | null; ndaStatus?: NdaStatus };
  const { data: ndaMap } = useNdaStatuses();
  const raw = ndaMap?.[t.id];
  const status: NdaStatus = requested ? "requested" : ((raw && raw !== "declined" ? raw : undefined) as NdaStatus | undefined) ?? x.ndaStatus ?? "none";
  const unlockList = ([
    "Company name & logo",
    "website & contacts",
    (l as { people?: string[] }).people?.length !== 0 && "founder names",
    l.hasFinancials && "exact financials FY23–25",
    "valuation report",
    "data room",
  ].filter(Boolean) as string[]).map((u) => tr(u));
  // Thai has no letter case, so only English chips get the capital.
  const chipLabel = (u: string) => (language === "th" ? u : u.charAt(0).toUpperCase() + u.slice(1));
  const step = { none: 0, requested: 1, approved: 2, exchanged: 3 }[status];
  const subs = [status === "none" ? tr("You are here") : "", status === "requested" ? tr("waiting for the seller") : tr("usually 2 days"), tr("identity, financials, data room"), tr("talk directly")];
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <DealTerms t={t} />
        <div className={BOX}>
          <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{tr("Financials · ranges before NDA")}</h4>
          <KV rows={[
            [tr("Revenue FY25"), l.revenueBand],
            [tr("Growth"), x.growthBand ?? null],
            [tr("EBITDA margin"), x.ebitdaMargin ?? null],
            [tr("Net cash"), x.netCash ?? null],
            [tr("Verified by"), l.hasFinancials
              ? <span className="text-[#16A34A]">{tr("✓ PitchSnack analysts")}</span>
              : <span className="font-normal text-muted-foreground">{tr("Seller-provided, not verified")}</span>],
          ]} />
        </div>
      </div>

      {status === "requested" ? (
        <div className={BOX}>
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{tr("Shown after the seller approves")}</h4>
          <div className="flex flex-wrap gap-1.5">
            {unlockList.map((u) => (
              <span key={u} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-semibold text-foreground/70"><Lock className="h-3 w-3" />{chipLabel(u)}</span>
            ))}
          </div>
        </div>
      ) : status === "approved" || status === "exchanged" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#86EFAC] bg-[#F0FDF4] px-[14px] py-3">
          <div className="text-sm font-bold text-[#166534]">{tr("NDA approved · full profile unlocked")}</div>
          <Button size="sm">{tr("Open full profile")}</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#FCD34D] bg-[#FFFBEB] px-[14px] py-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-[#78350F]">{tr("Request the NDA to unlock")}</div>
            <p className="mt-0.5 text-[12.5px] text-[#92400E]">{unlockList.join(" · ")}</p>
          </div>
          <NdaButton listingId={t.id} onRequested={onRequested} />
        </div>
      )}

      <section>
        <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{tr("How it works")}</h4>
        <ol className="relative grid grid-cols-4">
          <span className="absolute left-[12.5%] right-[12.5%] top-[7px] h-[2px] bg-[#E5E7EB]" />
          {STEPS.map((s, i) => (
            <li key={s} className="relative flex flex-col items-center text-center">
              <span className={cn(
                "h-4 w-4 rounded-full",
                i < step && "bg-[#9CA3AF]",
                i === step && "bg-[#6D28D9] ring-4 ring-[#6D28D9]/20",
                i > step && "border-2 border-[#D1D5DB] bg-card",
              )} />
              <span className={cn("mt-2 text-[12.5px]", i === step ? "font-bold" : "text-foreground/80")}>{tr(s)}</span>
              {subs[i] && <span className="text-[11px] text-muted-foreground">{subs[i]}</span>}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
