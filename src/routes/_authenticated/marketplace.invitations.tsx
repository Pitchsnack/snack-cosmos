import { createFileRoute, Navigate } from "@tanstack/react-router";
import { BuyerInvitationsPage } from "@/components/marketplace/buyer-invitations";
import { usePersona } from "@/hooks/use-marketplace";

export const Route = createFileRoute("/_authenticated/marketplace/invitations")({
  validateSearch: (s: Record<string, unknown>): { open?: string } => (typeof s.open === "string" ? { open: s.open } : {}),
  head: () => ({
    meta: [
      { title: "Invitations — PitchSnack" },
      { name: "description", content: "Sellers who invited you to view their anonymous listing. Open one to see the details and request an NDA." },
      { property: "og:title", content: "Invitations — PitchSnack" },
      { property: "og:description", content: "Sellers who invited you to view their anonymous listing. Open one to see the details and request an NDA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitationsRoute,
});

function InvitationsRoute() {
  const { persona } = usePersona();
  const { open } = Route.useSearch();
  if (persona === "buyer") return <BuyerInvitationsPage openId={open} />;
  return <Navigate to="/marketplace/browse" replace />;
}
