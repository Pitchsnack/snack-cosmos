import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { MyReportsPage } from "@/components/my-business/my-reports-page";

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
  validateSearch: (s: Record<string, unknown>) => z.object({ company: z.string().optional(), from: z.string().optional() }).parse({
    company: typeof s.company === "string" ? s.company : undefined,
    from: typeof s.from === "string" ? s.from : undefined,
  }),
  component: Page,
});

function Page() {
  const { company, from } = Route.useSearch();
  return <MyReportsPage kind="financials" company={company} from={from} />;
}

});
