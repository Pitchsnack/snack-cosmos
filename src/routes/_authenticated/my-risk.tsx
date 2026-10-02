import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { MyReportsPage } from "@/components/my-business/my-reports-page";

export const Route = createFileRoute("/_authenticated/my-risk")({
  head: () => ({
    meta: [
      { title: "Company Risk — PitchSnack" },
      { name: "description", content: "How safe your cash and debt look to buyers: liquidity, short-term and long-term debt." },
      { property: "og:title", content: "Company Risk — PitchSnack" },
      { property: "og:description", content: "How safe your cash and debt look to buyers: liquidity, short-term and long-term debt." },
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
  return <MyReportsPage kind="risk" company={company} from={from} />;
}
