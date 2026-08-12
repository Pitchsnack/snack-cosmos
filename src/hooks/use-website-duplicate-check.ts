import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listStartups } from "@/lib/startups.functions";
import { investorStartupLinksAdapter } from "@/adapters/investorStartupLinksAdapter";
import type { DuplicateCandidate } from "@/adapters/investor-startup-links-types";

/** Hostname without protocol, www. or trailing slash — comparison key. */
export function normalizeWebsite(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return "";
  const noProto = t.replace(/^https?:\/\//, "");
  const host = noProto.split("/")[0].replace(/^www\./, "");
  return host;
}

/** Root label of the domain, used as the P-18 search term ("acme.com" → "acme"). */
export function websiteSearchTerm(raw: string): string {
  const host = normalizeWebsite(raw);
  if (!host) return "";
  const labels = host.split(".").filter(Boolean);
  return labels.length > 1 ? labels[0] : host;
}

/**
 * Company URL duplicate check reusing the existing P-18 duplicate-detection
 * path (`investorStartupLinksAdapter.checkStartupDuplicates`). The URL host is
 * reduced to its root label and matched against existing startups; an exact
 * website_url host match is always surfaced first.
 */
export function useWebsiteDuplicateCheck(excludeId?: string) {
  const fn = useServerFn(listStartups);
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
        const res = await fn({ data: { search: term, pageSize: 50 } });
        const rows = (res?.items ?? []).filter((r) => r.id !== excludeId);

        const exact = rows.filter(
          (r) => r.website_url && normalizeWebsite(r.website_url) === host,
        );
        const byName = investorStartupLinksAdapter.checkStartupDuplicates(
          term,
          rows.map((r) => ({ id: r.id, startup_name: r.startup_name, industry: r.industry })),
        ).candidates;

        const merged: DuplicateCandidate[] = [
          ...exact.map((r) => ({
            id: r.id,
            name: r.startup_name,
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
