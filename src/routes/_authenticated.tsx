import { FreePlanBars } from "@/components/free-plan-bars";
import { ApprovalBanners } from "@/components/approval/approval-banners";
import { ApprovedPopup } from "@/components/approval/approved-popup";
import { Outlet, createFileRoute, isRedirect, redirect } from "@tanstack/react-router";
import { getSignupState } from "@/lib/signup.functions";

let checkedUser: string | null = null;
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { RoutePendingSkeleton } from "@/components/skeletons/route-pending-skeleton";
import { GlobalPipelineReviewAlert } from "@/components/pipeline/review-alert-host";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Use getSession() (reads local storage, no network) instead of getUser()
    // so sidebar navigation doesn't hit /auth/v1/user on every click.
    // Server-side functions still validate the JWT via requireSupabaseAuth.
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
    // A pending sign-up (company not yet confirmed with "Yes") is never treated as signed in.
    const uid = data.session.user.id;
    if (checkedUser !== uid) {
      try {
        const st = await getSignupState();
        if (st.answers && !st.answers.done_at) throw redirect({ to: "/signup" });
        checkedUser = uid;
      } catch (e) {
        if (isRedirect(e)) throw e;
      }
    }
  },
  component: AuthenticatedLayout,
  pendingMs: 1500,
  pendingMinMs: 0,
  pendingComponent: PendingShell,
});

function AuthenticatedLayout() {
  return (
    <AppSidebar>
      <GlobalPipelineReviewAlert />
      <FreePlanBars />
      <ApprovalBanners />
      <ApprovedPopup />
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
