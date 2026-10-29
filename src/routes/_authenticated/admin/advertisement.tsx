import { createFileRoute } from "@tanstack/react-router";
import { AdminAdvertisementPage } from "@/components/businesses-wanted/bw-admin";

export const Route = createFileRoute("/_authenticated/admin/advertisement")({
  head: () => ({
    meta: [
      { title: "Advertisement approvals — PitchSnack Admin" },
      { name: "description", content: "Check, post, send back, extend and reopen buy orders in Businesses Wanted, and see their applicants." },
      { property: "og:title", content: "Advertisement approvals — PitchSnack Admin" },
      { property: "og:description", content: "Check and post buy orders in Businesses Wanted." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminAdvertisementPage,
});
