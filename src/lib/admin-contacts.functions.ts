import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const contactNoteSchema = z.object({ contactId: z.string().uuid(), body: z.string().trim().min(1).max(4000) });
export type AdminContactNote = { id: string; body: string; createdAt: string; author: string };

export const listAdminContacts = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { requireHelpAdmin } = await import("./admin-help.server");
  await requireHelpAdmin(context);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { loadAdminContacts } = await import("./admin-contacts.server");
  return loadAdminContacts(supabaseAdmin);
});

export const getAdminContactCards = createServerFn({method: 'GET'}).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({contactId: z.string().uuid()}).parse(d))
  .handler(async ({context, data}) => {
    const {requireHelpAdmin} = await import('./admin-help.server');
    await requireHelpAdmin(context);
    const {supabaseAdmin} = await import('@/integrations/supabase/client.server');
    const {loadAdminContacts} = await import('./admin-contacts.server');
    const contact = (await loadAdminContacts(supabaseAdmin)).find(c => c.id === data.contactId);
    if (!contact) throw new Error('Contact not found');
    const {loadAdminContactCards} = await import('./admin-contact-cards.server');
    return loadAdminContactCards(supabaseAdmin, contact);
  });

export const listAdminContactNotes = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ contactId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<AdminContactNote[]> => {
    const { requireHelpAdmin } = await import("./admin-help.server");
    await requireHelpAdmin(context);
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const notes: { id: string; body: string; created_at: string; author_user_id: string }[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: rows, error } = await sb.from("admin_contact_notes").select("id,body,created_at,author_user_id").eq("contact_user_id", data.contactId).order("created_at", { ascending: false }).order("id").range(offset, offset + 999);
      if (error) throw new Error("Unable to load notes");
      notes.push(...(rows ?? []));
      if ((rows ?? []).length < 1000) break;
    }
    const authorIds = [...new Set(notes.map(n => n.author_user_id))];
    const { data: authors, error } = authorIds.length ? await sb.from("users").select("id,first_name,last_name").in("id", authorIds) : { data: [], error: null };
    if (error) throw new Error("Unable to load notes");
    const names = new Map((authors ?? []).map(a => [a.id, [a.first_name, a.last_name].filter(Boolean).join(" ")]));
    return notes.map(n => ({ id: n.id, body: n.body, createdAt: n.created_at, author: names.get(n.author_user_id) || "Admin" }));
  });

export const addAdminContactNote = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => contactNoteSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { requireHelpAdmin } = await import("./admin-help.server");
    await requireHelpAdmin(context);
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: target, error: targetError } = await sb.from("users").select("id,account_role").eq("id", data.contactId).in("account_role", ["buyer", "seller", "advisor"]).maybeSingle();
    if (targetError || !target) throw new Error("Contact not found");
    const { error } = await sb.from("admin_contact_notes").insert({ contact_user_id: target.id, author_user_id: context.userId, body: data.body });
    if (error) throw new Error("Unable to save note");
    return { ok: true };
  });