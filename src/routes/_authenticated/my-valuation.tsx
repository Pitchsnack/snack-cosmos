import { createFileRoute } from "@tanstack/react-router";
import { LockedReportPage } from "@/components/my-business/locked-report-page";

export const Route = createFileRoute("/_authenticated/my-valuation")({
  head: () => ({
    meta: [
      { title: "Company Valuation — PitchSnack" },
      { name: "description", content: "Order an independent estimated valuation of your business from PitchSnack." },
      { property: "og:title", content: "Company Valuation — PitchSnack" },
      { property: "og:description", content: "Order an independent estimated valuation of your business from PitchSnack." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <LockedReportPage kind="valuation" />,
});
