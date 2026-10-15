import { createFileRoute } from "@tanstack/react-router";
import { MessagesPage } from "@/components/messages/messages-page";
import { adminHelpSummaries } from "@/lib/admin-help.functions";

const description = "PitchSnack Control Help desk conversations with sellers, buyers and advisors.";
export const Route = createFileRoute("/_authenticated/admin/messages")({
  beforeLoad: async () => { await adminHelpSummaries(); },
  head: () => ({ meta: [
    { title: "Admin Messages — PitchSnack" },
    { name: "description", content: description },
    { property: "og:title", content: "Admin Messages — PitchSnack" },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <MessagesPage adminView />,
});