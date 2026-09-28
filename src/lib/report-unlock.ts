import { useCallback, useEffect, useState } from "react";

export type ReportKind = "financials" | "valuation";

const key = (kind: ReportKind, companyId: string) => `ps.unlockedReports.${kind}.${companyId}`;

export function isReportUnlocked(kind: ReportKind, companyId: string | undefined) {
  if (!companyId || typeof window === "undefined") return false;
  return window.localStorage.getItem(key(kind, companyId)) === "1";
}

export function unlockReport(kind: ReportKind, companyId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(kind, companyId), "1");
}

/** Tracks whether this company's report has been paid for (browser-local until checkout exists). */
export function useReportUnlock(kind: ReportKind, companyId: string | undefined) {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    setUnlocked(isReportUnlocked(kind, companyId));
  }, [kind, companyId]);

  const unlock = useCallback(() => {
    if (!companyId) return;
    unlockReport(kind, companyId);
    setUnlocked(true);
  }, [kind, companyId]);

  return { unlocked, unlock };
}
