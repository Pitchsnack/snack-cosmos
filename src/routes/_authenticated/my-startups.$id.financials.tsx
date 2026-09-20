import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { StartupFinancialsPage } from "@/components/financials/financials-page";
import { isUuid } from "@/lib/uuid";
import { StartupNotFound } from "@/components/startups/startup-not-found";

export const Route = createFileRoute("/_authenticated/my-startups/$id/financials")({
  head: () => ({
    meta: [
      { title: "My Startup Financials — SnackPortal2" },
      {
        name: "description",
        content:
          "Track revenue, profitability, balance sheet strength and key financial ratios for your startup.",
      },
      { property: "og:title", content: "My Startup Financials — SnackPortal2" },
      {
        property: "og:description",
        content:
          "Track revenue, profitability, balance sheet strength and key financial ratios for your startup.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: z.object({ tab: z.string().optional() }),
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  if (!isUuid(id)) return <StartupNotFound reason="invalid" workspace="my-startups" />;
  return <StartupFinancialsPage id={id} workspace="my-startups" initialTab={tab} />;
}
