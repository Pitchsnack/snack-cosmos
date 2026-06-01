import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface WorkspacePreferencesDTO {
  sidebarCollapsed: boolean;
  defaultLandingPage: string;
  theme: "light" | "dark" | "system";
  itemsPerPage: number;
}

const DEFAULTS: WorkspacePreferencesDTO = {
  sidebarCollapsed: false,
  defaultLandingPage: "/dashboard",
  theme: "system",
  itemsPerPage: 25,
};

export const getPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkspacePreferencesDTO> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("workspace_preferences")
      .select("sidebar_collapsed, default_landing_page, theme, items_per_page")
      .eq("user_id", userId)
      .is("tenant_id", null)
      .maybeSingle();
    if (!data) return DEFAULTS;
    return {
      sidebarCollapsed: !!data.sidebar_collapsed,
      defaultLandingPage: data.default_landing_page ?? "/dashboard",
      theme: (data.theme as WorkspacePreferencesDTO["theme"]) ?? "system",
      itemsPerPage: data.items_per_page ?? 25,
    };
  });

export const updatePreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        sidebarCollapsed: z.boolean().optional(),
        defaultLandingPage: z.string().min(1).max(255).optional(),
        theme: z.enum(["light", "dark", "system"]).optional(),
        itemsPerPage: z.number().int().min(5).max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = {};
    if (data.sidebarCollapsed !== undefined) patch.sidebar_collapsed = data.sidebarCollapsed;
    if (data.defaultLandingPage !== undefined) patch.default_landing_page = data.defaultLandingPage;
    if (data.theme !== undefined) patch.theme = data.theme;
    if (data.itemsPerPage !== undefined) patch.items_per_page = data.itemsPerPage;

    const { error } = await supabase
      .from("workspace_preferences")
      .upsert(
        { user_id: userId, tenant_id: null, ...patch },
        { onConflict: "user_id,tenant_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface NotificationPreferencesDTO {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  systemEnabled: boolean;
}

export const getNotificationPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotificationPreferencesDTO> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("notification_preferences")
      .select("email_enabled, in_app_enabled, system_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      emailEnabled: data?.email_enabled ?? true,
      inAppEnabled: data?.in_app_enabled ?? true,
      systemEnabled: data?.system_enabled ?? true,
    };
  });

export const updateNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        emailEnabled: z.boolean().optional(),
        inAppEnabled: z.boolean().optional(),
        systemEnabled: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notification_preferences")
      .upsert(
        {
          user_id: userId,
          ...(data.emailEnabled !== undefined ? { email_enabled: data.emailEnabled } : {}),
          ...(data.inAppEnabled !== undefined ? { in_app_enabled: data.inAppEnabled } : {}),
          ...(data.systemEnabled !== undefined ? { system_enabled: data.systemEnabled } : {}),
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
