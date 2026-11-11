import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { StartupFinancialsPage } from "@/components/financials/financials-page";
import { isUuid } from "@/lib/uuid";
import { StartupNotFound } from "@/components/startups/startup-not-found";

export const Route = createFileRoute("/_authenticated/startups/$id/financials")({
  head: () => ({
    meta: [
      { title: "Startup Financials — PitchSnack" },
      {
        name: "description",
        content:
          "Income statement, balance sheet and cash flow for this company. Financial ratios are in P&L analysis.",
      },
      { property: "og:title", content: "Startup Financials — PitchSnack" },
      {
        property: "og:description",
        content:
          "Income statement, balance sheet and cash flow for this company. Financial ratios are in P&L analysis.",
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
  if (!isUuid(id)) return <StartupNotFound reason="invalid" workspace="startups" />;
  return <StartupFinancialsPage id={id} workspace="startups" initialTab={tab} />;
}
