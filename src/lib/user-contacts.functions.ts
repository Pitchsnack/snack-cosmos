import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Personal address book (Contacts page). Each user sees only their own rows (RLS). */

export const CONTACT_TYPES = ["PitchSnack Connection", "My Contact"] as const;
export const CONTACT_STATUSES = ["Active", "Warm", "Cold", "Follow-Up Due", "Do Not Contact"] as const;
export const CONTACT_SOURCES = ["PitchSnack Connection", "My Contact", "Imported", "Referral", "Introduction", "Name Card"] as const;

const opt = (n: number) => z.string().trim().max(n).optional().nullable().transform((v) => (v ? v : null));

const contactInput = z.object({
  fullName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")).transform((v) => (v ? v : null)),
  phone: opt(40),
  position: opt(120),
  department: opt(120),
  company: opt(160),
  website: opt(255),
  location: opt(160),
  contactType: z.enum(CONTACT_TYPES).default("My Contact"),
  status: z.enum(CONTACT_STATUSES).default("Active"),
  source: z.enum(CONTACT_SOURCES).default("My Contact"),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  notes: opt(1000),
  event: opt(160),
});
export type UserContactInput = z.input<typeof contactInput>;

export type UserContact = {
  id: string; fullName: string; email: string | null; phone: string | null; position: string | null;
  department: string | null; company: string | null; website: string | null; location: string | null;
  contactType: (typeof CONTACT_TYPES)[number]; status: (typeof CONTACT_STATUSES)[number];
  source: (typeof CONTACT_SOURCES)[number]; tags: string[]; notes: string | null;
  lastContactedAt: string | null; nextAction: string | null; nextActionAt: string | null;
  createdAt: string; updatedAt: string;
};

const toRow = (d: z.output<typeof contactInput>) => ({
  full_name: d.fullName, email: d.email, phone: d.phone, position: d.position, department: d.department,
  company: d.company, website: d.website, location: d.location, contact_type: d.contactType,
  status: d.status, source: d.source, tags: d.tags, notes: d.notes, event: d.event,
});
const fromRow = (r: any): UserContact => ({
  id: r.id, fullName: r.full_name, email: r.email, phone: r.phone, position: r.position,
  department: r.department, company: r.company, website: r.website, location: r.location,
  contactType: r.contact_type, status: r.status, source: r.source, tags: r.tags ?? [], notes: r.notes,
  lastContactedAt: r.last_contacted_at, nextAction: r.next_action, nextActionAt: r.next_action_at,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const listUserContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("user_contacts").select("*")
      .eq("owner_user_id", context.userId).order("updated_at", { ascending: false }).limit(1000);
    if (error) throw new Error("Could not load contacts");
    return (data ?? []).map(fromRow);
  });

export const createUserContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: UserContactInput) => contactInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("user_contacts")
      .insert({ ...toRow(data), owner_user_id: context.userId }).select("*").single();
    if (error) throw new Error("Could not save contact");
    return fromRow(row);
  });

export const updateUserContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status?: string }) =>
    z.object({ id: z.string().uuid(), status: z.enum(CONTACT_STATUSES) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_contacts").update({ status: data.status })
      .eq("id", data.id).eq("owner_user_id", context.userId);
    if (error) throw new Error("Could not update contact");
    return { ok: true };
  });

export const deleteUserContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_contacts").delete()
      .eq("id", data.id).eq("owner_user_id", context.userId);
    if (error) throw new Error("Could not delete contact");
    return { ok: true };
  });
