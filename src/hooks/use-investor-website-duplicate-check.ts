import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listInvestors } from "@/lib/investors.functions";
import { investorStartupLinksAdapter } from "@/adapters/investorStartupLinksAdapter";
import type { DuplicateCandidate } from "@/adapters/investor-startup-links-types";
import { normalizeWebsite, websiteSearchTerm } from "@/hooks/use-website-duplicate-check";

/**
 * Company URL duplicate check for investors — same P-18 duplicate-detection
 * path used by startups (`investorStartupLinksAdapter`), applied to the
 * investor directory. Exact website host matches surface first.
 */
export function useInvestorWebsiteDuplicateCheck(excludeId?: string) {
  const fn = useServerFn(listInvestors);
  const [checking, setChecking] = useState(false);
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [typedValue, setTypedValue] = useState("");

  const close = useCallback(() => setCandidates([]), []);

  const check = useCallback(
    async (url: string) => {
      const host = normalizeWebsite(url);
      const term = websiteSearchTerm(url);
      if (!host || !term) return;
      setChecking(true);
      try {
        const rows = ((await fn({ data: { search: term } })) ?? []).filter(
          (r) => r.id !== excludeId,
        );

        const exact = rows.filter(
          (r) => r.website_url && normalizeWebsite(r.website_url) === host,
        );
        const byName = investorStartupLinksAdapter.checkInvestorDuplicates(
          term,
          rows.map((r) => ({
            id: r.id,
            investor_name: r.investor_name,
            investor_type: r.investor_type,
          })),
        ).candidates;

        const merged: DuplicateCandidate[] = [
          ...exact.map((r) => ({
            id: r.id,
            name: r.investor_name,
            subtitle: r.website_url,
            matchKind: "exact" as const,
          })),
          ...byName.filter((c) => !exact.some((e) => e.id === c.id)),
        ];

        setTypedValue(url.trim());
        setCandidates(merged);
      } catch {
        // Duplicate check is advisory — never block the form on failure.
        setCandidates([]);
      } finally {
        setChecking(false);
      }
    },
    [fn, excludeId],
  );

  return { check, checking, candidates, typedValue, close, open: candidates.length > 0 };
}
