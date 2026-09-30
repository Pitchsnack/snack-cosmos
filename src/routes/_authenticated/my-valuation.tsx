import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { MyReportsPage } from "@/components/my-business/my-reports-page";

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
  validateSearch: (s: Record<string, unknown>) => z.object({ company: z.string().optional(), from: z.string().optional() }).parse({
    company: typeof s.company === "string" ? s.company : undefined,
    from: typeof s.from === "string" ? s.from : undefined,
  }),
  component: Page,
});

function Page() {
  const { company, from } = Route.useSearch();
  return <MyReportsPage kind="valuation" company={company} from={from} />;
}
