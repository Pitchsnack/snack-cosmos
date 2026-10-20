import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

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
  beforeLoad: ({search}) => {throw redirect({to:'/my-reports',search:{company:search.company,report:'statements'},replace:true});},
});
