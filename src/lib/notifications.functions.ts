import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NotificationDTO = {
  id: string;
  tenantId: string | null;
  type: string;
  title: string;
  message: string | null;
  isRead: boolean;
  createdAt: string;
};

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ notifications: NotificationDTO[]; unread: number }> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("notifications")
      .select("id, tenant_id, notification_type, title, message, is_read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = (data ?? []).map((r) => ({
      id: r.id as string,
      tenantId: (r.tenant_id as string | null) ?? null,
      type: r.notification_type as string,
      title: r.title as string,
      message: (r.message as string | null) ?? null,
      isRead: !!r.is_read,
      createdAt: r.created_at as string,
    }));
    return { notifications: rows, unread: rows.filter((r) => !r.isRead).length };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid(), isRead: z.boolean().default(true) }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: data.isRead })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        type: z.string().min(1).max(100),
        title: z.string().min(1).max(255),
        message: z.string().max(2000).optional(),
        tenantId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      tenant_id: data.tenantId ?? null,
      notification_type: data.type,
      title: data.title,
      message: data.message ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
