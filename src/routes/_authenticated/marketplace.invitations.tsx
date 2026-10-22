import { createFileRoute, Navigate } from "@tanstack/react-router";
import { SellerInvitationsPage } from "@/components/marketplace/seller-invitations";
import { BuyerInvitationsPage } from "@/components/marketplace/buyer-invitations";
import { usePersona } from "@/hooks/use-marketplace";

export const Route = createFileRoute("/_authenticated/marketplace/invitations")({
  validateSearch: (s: Record<string, unknown>): { open?: string } => (typeof s.open === "string" ? { open: s.open } : {}),
  head: () => ({
    meta: [
      { title: "Invitations — PitchSnack" },
      { name: "description", content: "Your invitations on PitchSnack: see who invited you or whom you invited, and answer NDA requests." },
      { property: "og:title", content: "Invitations — PitchSnack" },
      { property: "og:description", content: "Your invitations on PitchSnack: see who invited you or whom you invited, and answer NDA requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitationsRoute,
});

function InvitationsRoute() {
  const { persona } = usePersona();
  const { open } = Route.useSearch();
  if (persona === "buyer") return <Navigate to="/marketplace/pipeline/invitations" search={{open}} replace />;
  if (persona === "seller") return <Navigate to="/marketplace/pipeline/invitations" search={{open}} replace />;
  return <Navigate to="/marketplace/browse" replace />;
}
