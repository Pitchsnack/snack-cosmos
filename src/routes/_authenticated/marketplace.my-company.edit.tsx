import { createFileRoute } from "@tanstack/react-router";
import { BuyerInvestorEdit } from "@/components/my-business/buyer-investor-edit";

export const Route = createFileRoute("/_authenticated/marketplace/my-company/edit")({
  head: () => ({
    meta: [
      { title: "Edit investor profile — PitchSnack" },
      { name: "description", content: "Edit your firm's investor record: the same details Admin sees in Investors Directory." },
      { property: "og:title", content: "Edit investor profile — PitchSnack" },
      { property: "og:description", content: "Update your firm's investor profile on PitchSnack." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BuyerInvestorEdit,
});
