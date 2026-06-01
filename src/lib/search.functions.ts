import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export type SavedSearchDTO = {
  id: string;
  name: string;
  query: Json;
  tenantId: string | null;
  createdAt: string;
};

export const listSavedSearches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SavedSearchDTO[]> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("saved_searches")
      .select("id, search_name, search_query, tenant_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      name: r.search_name as string,
      query: (r.search_query as Record<string, unknown>) ?? {},
      tenantId: (r.tenant_id as string | null) ?? null,
      createdAt: r.created_at as string,
    }));
  });

export const saveSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        name: z.string().min(1).max(255),
        query: z.record(z.string(), z.unknown()).default({}),
        tenantId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("saved_searches").insert({
      user_id: userId,
      tenant_id: data.tenantId ?? null,
      search_name: data.name,
      search_query: data.query,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSavedSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("saved_searches")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
