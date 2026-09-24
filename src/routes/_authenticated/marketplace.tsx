import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/marketplace")({
  component: MarketplaceLayout,
});

function MarketplaceLayout() {
  return <Outlet />;
}
