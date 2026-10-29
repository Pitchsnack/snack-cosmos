import { createFileRoute } from "@tanstack/react-router";
import { PaidReportsPage } from "@/components/paid-reports/paid-reports-page";

const description = "Reports clients have paid for, and companies whose reports are ready before anyone orders. Get the company's DBD data, then authorise the seller.";
export const Route = createFileRoute("/_authenticated/admin/paid-reports")({
  head: () => ({ meta: [
    { title: "Paid reports — PitchSnack Admin" },
    { name: "description", content: description },
    { property: "og:title", content: "Paid reports — PitchSnack Admin" },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: PaidReportsPage,
});
