import { createFileRoute } from "@tanstack/react-router";
import { StartupFinancialsPage } from "@/components/financials/financials-page";
import { isUuid } from "@/lib/uuid";
import { StartupNotFound } from "@/components/startups/startup-not-found";

export const Route = createFileRoute("/_authenticated/startups/$id/financials")({
  head: () => ({
    meta: [
      { title: "Startup Financials — SnackPortal2" },
      {
        name: "description",
        content:
          "Income statement, financial position, cash flow and major financial ratios for this startup.",
      },
      { property: "og:title", content: "Startup Financials — SnackPortal2" },
      {
        property: "og:description",
        content:
          "Income statement, financial position, cash flow and major financial ratios for this startup.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = Route.useParams();
  if (!isUuid(id)) return <StartupNotFound />;
  return <StartupFinancialsPage id={id} workspace="startups" />;
}
