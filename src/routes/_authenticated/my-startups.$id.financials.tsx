import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { StartupFinancialsPage } from "@/components/financials/financials-page";
import { isUuid } from "@/lib/uuid";
import { StartupNotFound } from "@/components/startups/startup-not-found";

export const Route = createFileRoute("/_authenticated/my-startups/$id/financials")({
  head: () => ({
    meta: [
      { title: "My Startup Financials — PitchSnack" },
      {
        name: "description",
        content:
          "View your company’s filed income statements, balance sheets and cash flow. Financial ratios are in P&L analysis.",
      },
      { property: "og:title", content: "My Startup Financials — PitchSnack" },
      {
        property: "og:description",
        content:
          "View your company’s filed income statements, balance sheets and cash flow. Financial ratios are in P&L analysis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: z.object({ tab: z.string().optional(), edit: z.literal("startup").optional() }),
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = Route.useParams();
  const { tab, edit } = Route.useSearch();
  if (!isUuid(id)) return <StartupNotFound reason="invalid" workspace="my-startups" />;
  return <StartupFinancialsPage id={id} workspace="my-startups" initialTab={tab} initialProfileEdit={edit === "startup"} />;
}
