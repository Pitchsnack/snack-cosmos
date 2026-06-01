import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface WorkspaceMetricsDTO {
  tenants: number | null;
  users: number | null;
  startups: number | null;
  investors: number | null;
  unreadNotifications: number;
  recentSecurityEvents: Array<{
    id: string;
    eventType: string;
    createdAt: string;
    tenantId: string | null;
  }>;
  recentNotifications: Array<{
    id: string;
    title: string;
    type: string;
    createdAt: string;
    isRead: boolean;
  }>;
}

export const getWorkspaceMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkspaceMetricsDTO> => {
    const { supabase, userId } = context;

    const [tenants, users, notifications, unreadAgg, security] = await Promise.all([
      supabase.from("tenants").select("id", { count: "exact", head: true }),
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase
        .from("notifications")
        .select("id,title,notification_type,created_at,is_read")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false),
      supabase
        .from("security_events")
        .select("id,event_type,created_at,tenant_id")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    return {
      tenants: tenants.count ?? null,
      users: users.count ?? null,
      startups: null,
      investors: null,
      unreadNotifications: unreadAgg.count ?? 0,
      recentSecurityEvents: (security.data ?? []).map((r) => ({
        id: r.id as string,
        eventType: r.event_type as string,
        createdAt: r.created_at as string,
        tenantId: (r.tenant_id as string | null) ?? null,
      })),
      recentNotifications: (notifications.data ?? []).map((r) => ({
        id: r.id as string,
        title: r.title as string,
        type: r.notification_type as string,
        createdAt: r.created_at as string,
        isRead: !!r.is_read,
      })),
    };
  });
