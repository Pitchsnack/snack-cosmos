import { useTranslation } from "@/i18n/language";
import { Link } from "@tanstack/react-router";
import { LockOpen, Users } from "lucide-react";
import { InvestorDetailPanel, Section, type InvestorDetail } from "@/components/investors/investor-detail-panel";
import type { SellerFavourite } from "@/lib/investor-browse.functions";

/** Seller's view of a buyer after an approved NDA: the Investors Directory card with the seller's options. */
export function PrivateInvestorPanel({ f, hideHeader = false }: { f: SellerFavourite; hideHeader?: boolean }) {
  const { t, language } = useTranslation();
  const p = f.priv;
  if (!p) return null;
  const th = language === "th";
  const d = (v: string) => new Date(v).toLocaleDateString(th ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).replace("Sept", "Sep");
  const dot = <i className="mx-[7px] not-italic text-[#C3C8D1]" aria-hidden>·</i>;
  const ndaLine = (
    <span className="inline">
      <LockOpen className="mr-2 inline h-[15px] w-[15px] -translate-y-px align-middle text-[#15803D]" aria-hidden />
      <b className="font-semibold text-[#15803D]">{th ? "อนุมัติ NDA แล้ว" : "NDA approved"}</b> {d(p.ndaApprovedAt)}
      {dot}{th ? "มีผลถึง" : "valid until"} {d(p.ndaValidUntil)}
      {f.refNo && <>{dot}{f.refNo}</>}
    </span>
  );
  const data = { id: f.id, ...p, ticket_size: null, status: null, visibility: null, portfolio_investors: [] } as unknown as InvestorDetail;
  return (
    <InvestorDetailPanel
      id={f.id}
      showEdit={false}
      onSelectStartup={() => {}}
      buyer={{
        data,
        seller: {
          ndaLine,
          hideHeader,
          revenueTitle: th ? "รายได้ขั้นต่ำของกิจการเป้าหมาย" : "Min. target revenue",
          aumTitle: th ? "มูลค่าสินทรัพย์ภายใต้การบริหาร" : "AUM",
          ticketTitle: th ? "ขนาดการลงทุนต่อดีล" : "Ticket size",
          action: <Link to="/marketplace/pipeline" className="whitespace-nowrap text-[14px] font-semibold text-[#2563EB] hover:underline">{t("Open in Pipeline")}</Link>,
        },
        afterPortfolio: p.people.length ? (
          <Section icon={Users} title={t("Decision makers")}>
            <div className="space-y-2">
              {p.people.map((m, k) => (
                <div key={k} className="flex flex-wrap gap-3 text-sm">
                  <div className="flex-1"><b>{m.name}</b><div>{m.role}</div></div>
                  <div className="break-all">{m.email}<br />{m.phone}</div>
                </div>
              ))}
            </div>
          </Section>
        ) : undefined,
      }}
    />
  );
}
