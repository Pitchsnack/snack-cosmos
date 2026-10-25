import {useEffect,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {BadgeCheck,ExternalLink,LockOpen} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {PublicListingCard,useMediaUrl} from '@/components/hidden-profile/public-listing-card';
import {BOX,DealTerms,KV,Section} from '@/components/marketplace/listing-panel';
import {FavViewLine} from '@/components/marketplace/fav-view-card';
import {BuyerVerificationBox} from '@/components/company-verification/buyer-box';
import {VerificationBadge} from '@/components/company-verification/verification-badge';
import type {Favourite} from '@/lib/favourites.functions';
import {useTranslation} from '@/i18n/language';
import {cn} from '@/lib/utils';
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).replace("Sept", "Sep") : "—");
const baht = (n: number | null) => {
  if (n == null) return null;
  const a = Math.abs(n);
  const s = a >= 1e9 ? `฿${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `฿${(a / 1e6).toFixed(1)}M` : `฿${a.toLocaleString("en-US")}`;
  return n < 0 ? `(${s})` : s;
};
const fy = (y: number | null) => (y != null ? String(y).slice(-2) : "25");

function ApprovedBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#BBF7D0] bg-[#ECFDF3] px-2 py-0.5 text-[10.5px] font-bold text-[#15803D]">
      <LockOpen className="h-3 w-3" />{t("NDA approved")}
    </span>
  );
}

export function PrivateListingPanel({ f, code, embedded=false }: { f: Favourite; code: string; embedded?:boolean }) {
  const { t } = useTranslation();
  const p = f.priv;
  const logo = useMediaUrl(p?.logoPath??null);
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [f.id]);
  if(!p)return null;
  const ini = p.companyName.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const web = p.website ? (p.website.startsWith("http") ? p.website : `https://${p.website}`) : null;
  const cell = (k: string, v: React.ReactNode) => (
    <div className="flex gap-3 border-b border-border py-1.5 text-[13px] last:border-0 sm:[&:nth-last-child(2)]:border-0">
      <span className="w-[110px] flex-none text-muted-foreground">{k}</span>
      <span className="min-w-0 flex-1 font-medium">{v ?? "—"}</span>
    </div>
  );
  return (
    <>
      {!embedded&&<div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 pr-12">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-[46px] w-[46px] flex-none place-items-center overflow-hidden rounded-[10px] border border-border bg-card text-[13px] font-bold">
            {logo ? <img src={logo} alt="" className="h-full w-full object-contain" /> : ini}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[18px] font-bold leading-tight">{p.companyName}</div>
            <div className="mt-1 flex min-w-0 items-center gap-2">
              <span className="inline-flex h-[22px] flex-none items-center gap-1 rounded-full border border-[#BBF7D0] bg-[#ECFDF3] px-2 text-[11.5px] font-semibold text-[#15803D]"><BadgeCheck className="h-3.5 w-3.5" />{t("NDA approved")}</span>
              <span className="truncate text-[12.5px] text-[#6A7181]">{code}</span>
              {f.listing.certified && <Button variant="ghost" size="sm" aria-label={t('Company verification report')} onClick={()=>{const box=document.getElementById(`verification-${f.id}`);box?.scrollIntoView({behavior:'smooth',block:'center'});box?.focus();}}><VerificationBadge buyer company={p.companyName} insideControl /></Button>}
            </div>
          </div>
        </div>
        <Button asChild size="sm" className="flex-none"><Link to="/marketplace/pipeline">{t("Open full profile")}</Link></Button>
      </div>
      }
      <div className="space-y-5 overflow-y-auto p-5">
        {!embedded&&<FavViewLine view="private">{t("Shared with you under NDA, approved")} {fmtDate(p.ndaApprovedAt)} {t("and valid until")} {fmtDate(p.ndaValidUntil)}.</FavViewLine>}
        <PublicListingCard l={f.listing} deal={f} wrapMeta badge={<ApprovedBadge />}
          priv={{ name: p.companyName, logoPath: p.logoPath, revenueText: baht(p.revenue), fy: p.fy, employees: p.employees }} />
        {p.description && (
          <Section title={t("Business overview")}>
            <p className={cn("whitespace-pre-line text-[13.5px] text-foreground/80", !more && "line-clamp-2")}>{p.description}</p>
            <button type="button" onClick={() => setMore((m) => !m)} className="text-[12.5px] font-semibold hover:underline">{more ? t("Show less ▴") : t("Show more ▾")}</button>
          </Section>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <DealTerms t={f} />
          <div className={BOX}>
            <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t("Financials")} · FY{fy(p.fy)}</h4>
            <KV rows={[
              [`${t("Revenue")} FY${fy(p.fy)}`, baht(p.revenue)],
              [`${t("Net profit")} FY${fy(p.fy)}`, baht(p.netProfit)],
              [t("Revenue growth"), p.growthPct != null && p.fy != null ? `${p.growthPct >= 0 ? "+" : ""}${p.growthPct.toFixed(1)}% ${t("vs")} FY${fy(p.fy - 1)}` : null],
              [t("Verified by"), f.listing.hasFinancials ? <span className="text-[#16A34A]">✓ PitchSnack {t("analysts")}</span> : null],
            ]} />
          </div>
        </div>
        <div className={BOX}>
          <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t("Company")}</h4>
          <div className="grid gap-x-6 sm:grid-cols-2">
            {cell(t("Legal name"), (p.legalNameEn || p.legalNameTh) ? <>{p.legalNameEn ?? p.legalNameTh}{p.legalNameEn && p.legalNameTh && <div className="text-[12px] font-normal text-[#6A7181]" style={{ fontFamily: "'Noto Sans Thai', 'DM Sans', sans-serif" }}>{p.legalNameTh}</div>}</> : null)}
            {cell(t("Registration no."), p.regNo)}
            {cell(t("Website"), web ? <a href={web} target="_blank" rel="noreferrer" className="inline-flex min-w-0 max-w-full items-center gap-1 break-all text-[#2563EB] hover:underline">{p.website?.replace(/^https?:\/\//, "").replace(/\/$/, "")}<ExternalLink className="h-3 w-3" /></a> : null)}
            {cell(t("Location"), p.location)}
            {cell(t("Founded"), p.founded)}
            {cell(t("Employees"), p.employees)}
          </div>
        </div>
        <BuyerVerificationBox companyId={f.companyId} pipelineId={f.pipelineId} focusId={`verification-${f.id}`} />
      </div>
    </>
  );
}
