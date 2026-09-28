import { createFileRoute } from "@tanstack/react-router";
import { LockedReportPage } from "@/components/my-business/locked-report-page";

export const Route = createFileRoute("/_authenticated/my-financials")({
  head: () => ({
    meta: [
      { title: "My Financials — PitchSnack" },
      { name: "description", content: "Order your verified financial report, prepared by PitchSnack analysts from your DBD filings." },
      { property: "og:title", content: "My Financials — PitchSnack" },
      { property: "og:description", content: "Order your verified financial report, prepared by PitchSnack analysts from your DBD filings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LockedReportPage kind="financials" />,
});
