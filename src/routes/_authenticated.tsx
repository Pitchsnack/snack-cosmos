import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { RoutePendingSkeleton } from "@/components/skeletons/route-pending-skeleton";
import { PublicHome } from "@/components/public-site/public-home";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Use getSession() (reads local storage, no network) instead of getUser()
    // so sidebar navigation doesn't hit /auth/v1/user on every click.
    // Server-side functions still validate the JWT via requireSupabaseAuth.
    const { data, error } = await supabase.auth.getSession();
    // Visitors who aren't signed in see the public homepage at "/".
    if ((error || !data.session) && location.pathname === "/") return { guestHome: true };
    if (error || !data.session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  component: AuthenticatedLayout,
  pendingMs: 150,
  pendingMinMs: 0,
  pendingComponent: PendingShell,
});

function AuthenticatedLayout() {
  const { guestHome } = Route.useRouteContext() as { guestHome?: boolean };
  if (guestHome) return <PublicHome />;
  return (
    <AppSidebar>
      <Outlet />
    </AppSidebar>
  );
}

function PendingShell() {
  return (
    <AppSidebar>
      <RoutePendingSkeleton />
    </AppSidebar>
  );
}
