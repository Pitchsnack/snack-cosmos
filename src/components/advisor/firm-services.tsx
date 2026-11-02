import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { tr, useTranslation } from "@/i18n/language";
import { serviceOf, type FeeDetail } from "@/lib/advisor-firm";
import { panelFeeLines } from "@/lib/advisor-panel-fee";

/** Shared presentation only; callers retain their fee projection and action permissions. */
export function FirmServices({ services, fee, detail, action, onAddFee }: {
  services: string[]; fee: (service: string) => string | undefined;
  detail?: (service: string) => FeeDetail | undefined;
  action?: (service: string) => ReactNode; onAddFee?: () => void;
}) {
  const { language } = useTranslation();
  return <div className="advisor-services advisor-hover-box">{services.map(service => {
    const def = serviceOf(service);
    const words = fee(service);
    const lines = panelFeeLines(detail?.(service), words, language === "th");
    return <div className="advisor-service-row" key={service}>
      <span className="advisor-service-icon"><def.icon size={16} /></span>
      <div className="advisor-service-name"><strong>{tr(service)}</strong><span>{tr(def.line)}</span></div>
      <div className="advisor-service-fee">
        {lines ? <strong>{lines.map((line, i) => <span className="advisor-fee-line" key={i}>{line}</span>)}</strong>
          : words ? <strong>{words === "Request a Price Quote" ? tr(words) : words}</strong>
          : onAddFee ? <span>{tr("Not set yet")} · <Button variant="unstyled" onClick={onAddFee} className="advisor-text-action">{tr("Add a fee")}</Button></span>
          : <strong>{tr("Request a Price Quote")}</strong>}
        {action && <div className="advisor-service-action">{action(service)}</div>}
      </div>
    </div>;
  })}</div>;
}