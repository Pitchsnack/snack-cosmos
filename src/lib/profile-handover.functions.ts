import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PARTS, teamName, type HandoverKind, type RunBy } from "./handover-parts";

/**
 * Profile handover (Admin › Ownership, invitation accept, owner check, Approvals box).
 * Admin actions check Control + Admin; owner actions check the accepted invitation.
 */

const Kind = z.enum(["startup", "investor", "firm"]);
const Id = z.string().uuid();
const H = () => import("./profile-handover.server");

export type OwnershipRow = { id: string; runBy: RunBy; invited: boolean; handedOver: boolean };

export const ownershipList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: Kind, ids: z.array(Id).max(500) }).parse(d))
  .handler(async ({ data, context }): Promise<OwnershipRow[]> => {
    const h = await H(); await h.requireControlAdmin(context);
    if (!data.ids.length) return [];
    const sb = await h.svc();
    const [{ data: rows }, { data: invs }] = await Promise.all([
      sb.from(h.TABLE[data.kind]).select("id, run_by").in("id", data.ids),
      sb.from("profile_invitations").select("profile_id, accepted_at, cancelled_at, expires_at, closed_at").eq("kind", data.kind).in("profile_id", data.ids),
    ]);
    const now = Date.now();
    return (rows ?? []).map((r: any) => {
      const mine = (invs ?? []).filter((i: any) => i.profile_id === r.id);
      return {
        id: r.id, runBy: r.run_by,
        invited: mine.some((i: any) => !i.accepted_at && !i.cancelled_at && Date.parse(i.expires_at) > now),
        handedOver: mine.some((i: any) => i.accepted_at),
      };
    });
  });

export const ownershipCounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: Kind }).parse(d))
  .handler(async ({ data, context }) => {
    const h = await H(); await h.requireControlAdmin(context);
    const sb = await h.svc();
    const t = h.TABLE[data.kind];
    const c = async (q: any) => (await q).count ?? 0;
    const [total, prepared, managed] = await Promise.all([
      c(sb.from(t).select("id", { count: "exact", head: true })),
      c(sb.from(t).select("id", { count: "exact", head: true }).not("prepared_by", "is", null)),
      c(sb.from(t).select("id", { count: "exact", head: true }).eq("run_by", "pitchsnack")),
    ]);
    return { total, prepared, managed };
  });

export const ownershipDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: Kind, id: Id }).parse(d))
  .handler(async ({ data, context }) => {
    const h = await H(); await h.requireControlAdmin(context);
    const sb = await h.svc();
    const head = (await h.profileHeads(sb, data.kind, [data.id])).get(data.id);
    if (!head) throw new Error("Profile not found");
    const [{ data: invs }, { data: mc }, { data: ev }, owner, { data: checks }, { data: changes }] = await Promise.all([
      sb.from("profile_invitations").select("id, email, first_name, last_name, owner_relation, language, sent_by, note, sent_at, expires_at, opened_at, accepted_at, cancelled_at, submitted_at, created_by").eq("kind", data.kind).eq("profile_id", data.id).order("sent_at", { ascending: false }),
      sb.from("managed_clients").select("*").eq("kind", data.kind).eq("profile_id", data.id).is("ended_at", null).maybeSingle(),
      sb.from("profile_handover_events").select("event, detail, created_at").eq("kind", data.kind).eq("profile_id", data.id).order("created_at", { ascending: false }),
      h.ownerOf(sb, data.kind, data.id),
      sb.from("profile_part_checks").select("part, changed, checked_at").eq("kind", data.kind).eq("profile_id", data.id),
      sb.from("profile_field_changes").select("part, field, old_value, new_value, created_at").eq("kind", data.kind).eq("profile_id", data.id).order("created_at"),
    ]);
    const nameIds = [...new Set([head.preparedBy, ...(invs ?? []).map((i: any) => i.created_by)].filter(Boolean))];
    const { data: people } = nameIds.length ? await sb.from("users").select("id, first_name, last_name, email").in("id", nameIds) : { data: [] };
    const nm = (id: string | null) => { const p = (people ?? []).find((x: any) => x.id === id); return p ? ([p.first_name, p.last_name].filter(Boolean).join(" ") || p.email) : null; };
    const open = (invs ?? []).find((i: any) => !i.accepted_at && !i.cancelled_at) ?? null;
    const accepted = (invs ?? []).find((i: any) => i.accepted_at) ?? null;
    const latest = open ?? accepted ?? null;
    let hasAccount = false;
    if (open) hasAccount = (await h.emailCheck(sb, data.kind, open.email)).state !== "new";
    // Live figures for a managed profile.
    let stats: { a: number; a2: number; b: number; b2: number } | null = null;
    if (head.runBy === "pitchsnack" && head.status === "live") {
      if (data.kind === "startup") {
        const { data: hp } = await sb.from("hidden_profiles").select("views, ndas_approved").eq("startup_id", data.id).maybeSingle();
        stats = { a: hp?.ndas_approved ?? 0, a2: 0, b: hp?.views ?? 0, b2: 0 };
      } else if (data.kind === "firm") {
        const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        const { count } = await sb.from("firm_profile_views").select("user_id", { count: "exact", head: true }).eq("firm_profile_id", data.id).gte("day", since);
        stats = { a: count ?? 0, a2: 0, b: 0, b2: 0 };
      } else stats = { a: 0, a2: 0, b: 0, b2: 0 };
    }
    return {
      head, preparedByName: nm(head.preparedBy),
      invitation: latest ? { ...latest, createdByName: nm(latest.created_by), hasAccount, expired: !latest.accepted_at && Date.parse(latest.expires_at) < Date.now() } : null,
      managed: mc ?? null, owner, events: ev ?? [], checks: checks ?? [], changes: changes ?? [], stats,
      parts: PARTS[data.kind].map((p) => ({ key: p.key, view: p.view, en: p.en })),
    };
  });

export const checkInviteEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: Kind, email: z.string().trim().email().max(255) }).parse(d))
  .handler(async ({ data, context }) => {
    const h = await H(); await h.requireControlAdmin(context);
    return h.emailCheck(await h.svc(), data.kind, data.email);
  });

const InviteInput = z.object({
  kind: Kind, id: Id,
  email: z.string().trim().email().max(255),
  firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80),
  relation: z.string().trim().min(1).max(120),
  language: z.enum(["th", "en"]), sentBy: z.string().max(80).optional(), note: z.string().max(1000).optional(),
});

export const sendProfileInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InviteInput.parse(d))
  .handler(async ({ data, context }) => {
    const h = await H(); await h.requireControlAdmin(context);
    const sb = await h.svc();
    const chk = await h.emailCheck(sb, data.kind, data.email);
    if (chk.state === "owns" || chk.state === "other_role") throw new Error("This email can't take this profile. Invite another email.");
    if ((await sb.from(h.TABLE[data.kind]).select("run_by").eq("id", data.id).maybeSingle()).data?.run_by === "owner") throw new Error("This profile already has an owner.");
    const now = new Date().toISOString();
    // One active invitation per profile: a new one cancels the old token.
    await sb.from("profile_invitations").update({ cancelled_at: now }).eq("kind", data.kind).eq("profile_id", data.id).is("accepted_at", null).is("cancelled_at", null);
    const sentBy = teamName(data.sentBy);
    const { data: inv, error } = await sb.from("profile_invitations").insert({
      kind: data.kind, profile_id: data.id, email: data.email.toLowerCase(), first_name: data.firstName, last_name: data.lastName,
      owner_relation: data.relation, language: data.language, sent_by: sentBy, note: data.note?.trim() || null, created_by: context.userId,
    }).select("*").single();
    if (error) throw new Error(error.message);
    await sb.from(h.TABLE[data.kind]).update({ owner_relation: data.relation }).eq("id", data.id);
    await h.logEvent(sb, data.kind, data.id, "invited", `Invitation sent to ${data.email} (by ${sentBy})`, context.userId);
    const base = { user_id: null, role: ({ startup: "seller", investor: "buyer", firm: "advisor" } as const)[data.kind], alert_key: "Profile invitation", email: inv.email, subject: "Profile invitation", ref_key: `profile-invitation:${inv.id}` };
    try {
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      const r = await sendTemplateEmail("profile-invitation", inv.email, {
        templateData: { kind: data.kind, lang: data.language, email: inv.email, sentBy, note: inv.note, expires: inv.expires_at, url: `https://pitchsnack.com/handover/${inv.token}` },
        idempotencyKey: `profile-invitation:${inv.id}`,
      });
      await sb.from("email_alert_log").insert({ ...base, status: r.sent ? "sent" : "suppressed" }).then(() => null, () => null);
    } catch (e) {
      await sb.from("email_alert_log").insert({ ...base, status: "failed", reason: (e instanceof Error ? e.message : "Send failed").slice(0, 300) }).then(() => null, () => null);
      throw new Error("The invitation was saved but the email didn't send. Try Resend.");
    }
    return { ok: true, email: inv.email };
  });

export const cancelProfileInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: Kind, id: Id }).parse(d))
  .handler(async ({ data, context }) => {
    const h = await H(); await h.requireControlAdmin(context);
    const sb = await h.svc();
    await sb.from("profile_invitations").update({ cancelled_at: new Date().toISOString() }).eq("kind", data.kind).eq("profile_id", data.id).is("accepted_at", null).is("cancelled_at", null);
    await h.logEvent(sb, data.kind, data.id, "invite_cancelled", null, context.userId);
    return { ok: true };
  });

export const startManaging = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    kind: Kind, id: Id,
    firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(255).optional().or(z.literal("")), phone: z.string().trim().max(40).optional(),
    relation: z.string().trim().min(1).max(120), managedBy: z.string().max(80).optional(), agreed: z.literal(true),
  }).refine((d) => !!(d.email || d.phone), "Add the client's email or phone, so the team can reach them.").parse(d))
  .handler(async ({ data, context }) => {
    const h = await H(); await h.requireControlAdmin(context);
    const sb = await h.svc();
    const by = teamName(data.managedBy);
    const row = { first_name: data.firstName, last_name: data.lastName, email: data.email || null, phone: data.phone || null, owner_relation: data.relation, managed_by: by, agreed_in_writing: true, confirmed_by: context.userId };
    const { data: cur } = await sb.from("managed_clients").select("id").eq("kind", data.kind).eq("profile_id", data.id).is("ended_at", null).maybeSingle();
    if (cur) await sb.from("managed_clients").update(row).eq("id", cur.id);
    else {
      const { data: t } = await sb.from(h.TABLE[data.kind]).select("run_by").eq("id", data.id).maybeSingle();
      if (t?.run_by === "owner") throw new Error("This profile already has an owner.");
      await sb.from("managed_clients").insert({ ...row, kind: data.kind, profile_id: data.id });
      await h.logEvent(sb, data.kind, data.id, "managed", `Managed by PitchSnack · ${by} confirmed the client's written agreement`, context.userId);
    }
    await sb.from(h.TABLE[data.kind]).update({ run_by: "pitchsnack", owner_relation: data.relation }).eq("id", data.id);
    return { ok: true, edited: !!cur };
  });

export const stopManaging = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: Kind, id: Id }).parse(d))
  .handler(async ({ data, context }) => {
    const h = await H(); await h.requireControlAdmin(context);
    const sb = await h.svc();
    await sb.from("managed_clients").update({ ended_at: new Date().toISOString() }).eq("kind", data.kind).eq("profile_id", data.id).is("ended_at", null);
    await sb.from(h.TABLE[data.kind]).update({ run_by: "none" }).eq("id", data.id);
    await h.logEvent(sb, data.kind, data.id, "stopped_managing", null, context.userId);
    return { ok: true };
  });

/** The team publishes a managed profile itself: no Approvals step. */
export const publishManaged = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: Kind, id: Id }).parse(d))
  .handler(async ({ data, context }) => {
    const h = await H(); await h.requireControlAdmin(context);
    const sb = await h.svc();
    const { data: t } = await sb.from(h.TABLE[data.kind]).select("run_by").eq("id", data.id).maybeSingle();
    if (t?.run_by !== "pitchsnack") throw new Error("Only a managed profile is published from here.");
    const now = new Date().toISOString();
    if (data.kind === "startup") {
      const { data: hp } = await sb.from("hidden_profiles").select("*").eq("startup_id", data.id).maybeSingle();
      if (!hp) throw new Error("Create the Listed view first.");
      const { pickDraft } = await import("./hidden-profile");
      const cover = hp.pending_cover ?? hp.cover_image_url ?? null;
      const { error } = await sb.from("hidden_profiles").update({
        approval_status: "live", status: "live", live: { ...pickDraft(hp), cover_image_url: cover }, cover_image_url: cover,
        has_unpublished_changes: false, published_at: hp.published_at ?? now, published_by: context.userId, decided_at: now,
      }).eq("id", hp.id);
      if (error) throw new Error(error.message);
      await sb.from("startups").update({ visibility: "Tenant" }).eq("id", data.id).eq("visibility", "Private");
    } else if (data.kind === "investor") {
      const { data: bp } = await sb.from("buyer_profiles").select("user_id, live_since").eq("investor_id", data.id).maybeSingle();
      if (!bp) throw new Error("Open the profile in My Company once to set up its buyer listing first.");
      const { error } = await sb.from("buyer_profiles").update({ status: "live", approval_status: "approved", live_since: bp.live_since ?? now, decided_at: now, decided_by: context.userId }).eq("user_id", bp.user_id);
      if (error) throw new Error(error.message);
    } else {
      const { data: f } = await sb.from("advisor_firms").select("live_since").eq("id", data.id).maybeSingle();
      const { error } = await sb.from("advisor_firms").update({ status: "live", live_since: f?.live_since ?? now }).eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    await h.logEvent(sb, data.kind, data.id, "published", null, context.userId);
    return { ok: true };
  });

/* ------------------------------ accept page ------------------------------ */

/** Public: what the accept page may show. Never names the company or any figures. */
export const invitationInfo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().regex(/^[a-f0-9]{48}$/) }).parse(d))
  .handler(async ({ data }) => {
    const h = await H(); const sb = await h.svc();
    const { data: inv } = await sb.from("profile_invitations").select("*").eq("token", data.token).maybeSingle();
    if (!inv || inv.cancelled_at) return { state: "invalid" as const };
    if (inv.accepted_at) return { state: "used" as const, kind: inv.kind as HandoverKind, language: inv.language as "th" | "en" };
    if (Date.parse(inv.expires_at) < Date.now()) return { state: "expired" as const, kind: inv.kind as HandoverKind, expires: inv.expires_at, language: inv.language as "th" | "en" };
    if (!inv.opened_at) {
      await sb.from("profile_invitations").update({ opened_at: new Date().toISOString() }).eq("id", inv.id);
      await h.logEvent(sb, inv.kind, inv.profile_id, "opened", null, null);
    }
    const hasAccount = (await sb.from("users").select("id").ilike("email", inv.email).maybeSingle()).data != null;
    return {
      state: "open" as const, kind: inv.kind as HandoverKind, email: inv.email, firstName: inv.first_name, lastName: inv.last_name,
      relation: inv.owner_relation as string | null, sentBy: inv.sent_by as string, expires: inv.expires_at as string, language: inv.language as "th" | "en", hasAccount,
    };
  });

/** Public: new account from the link. The link proves the email, so no email code. */
export const acceptAsNewAccount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: z.string().regex(/^[a-f0-9]{48}$/), password: z.string().min(8).max(72),
    firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), news: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const h = await H(); const sb = await h.svc();
    const { data: inv } = await sb.from("profile_invitations").select("*").eq("token", data.token).maybeSingle();
    if (!inv || inv.cancelled_at || inv.accepted_at || Date.parse(inv.expires_at) < Date.now()) throw new Error("This invitation can't be used any more.");
    if ((await sb.from("users").select("id").ilike("email", inv.email).maybeSingle()).data) throw new Error("This email already has an account. Sign in to accept.");
    const { data: made, error } = await sb.auth.admin.createUser({ email: inv.email, password: data.password, email_confirm: true, user_metadata: { first_name: data.firstName, last_name: data.lastName } });
    if (error || !made?.user) throw new Error(error?.message ?? "Couldn't create the account.");
    // The auth trigger makes the users row; wait for it briefly.
    for (let i = 0; i < 10; i++) { if ((await sb.from("users").select("id").eq("id", made.user.id).maybeSingle()).data) break; await new Promise((r) => setTimeout(r, 200)); }
    await sb.from("users").update({ first_name: data.firstName, last_name: data.lastName }).eq("id", made.user.id);
    const r = await h.claimInvitation(sb, inv, { id: made.user.id, email: inv.email });
    if (data.news) await sb.from("signup_answers").update({ news_opt_in: true }).eq("user_id", made.user.id);
    return { ...r, email: inv.email };
  });

/** Signed in: accept with the account of the invited email. */
export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().regex(/^[a-f0-9]{48}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const h = await H(); const sb = await h.svc();
    const { data: inv } = await sb.from("profile_invitations").select("*").eq("token", data.token).maybeSingle();
    if (!inv || inv.cancelled_at || Date.parse(inv.expires_at) < Date.now()) throw new Error("This invitation can't be used any more.");
    if (inv.accepted_at) {
      if (inv.accepted_user_id === context.userId) return { kind: inv.kind as HandoverKind, profileId: inv.profile_id as string };
      throw new Error("This invitation has already been used.");
    }
    const { data: au } = await sb.auth.admin.getUserById(context.userId);
    const email = au?.user?.email ?? "";
    return h.claimInvitation(sb, inv, { id: context.userId, email });
  });

/* ------------------------------ owner check ------------------------------ */

export const myHandover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: Kind, id: Id }).parse(d))
  .handler(async ({ data, context }) => {
    const h = await H(); const sb = await h.svc();
    const inv = await h.ownerHandover(sb, data.kind, data.id, context.userId);
    if (!inv) return null;
    if (inv.submitted_at && (await h.decided(sb, data.kind, data.id))) {
      await sb.from("profile_invitations").update({ closed_at: new Date().toISOString() }).eq("id", inv.id);
      return null;
    }
    const now = await h.snapshot(sb, data.kind, data.id);
    const changes = h.diff(inv.prepared_snapshot, now);
    const { data: checks } = await sb.from("profile_part_checks").select("part, checked_at").eq("kind", data.kind).eq("profile_id", data.id);
    const changedParts = new Set(changes.map((c) => c.part));
    const { data: prep } = await sb.from(h.TABLE[data.kind]).select("prepared_by, prepared_at").eq("id", data.id).maybeSingle();
    let preparedBy = "PitchSnack";
    if (prep?.prepared_by) { const { data: p } = await sb.from("users").select("first_name, last_name").eq("id", prep.prepared_by).maybeSingle(); preparedBy = [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "PitchSnack"; }
    let review: { status: string; at: string | null } | null = null;
    if (data.kind === "startup") { const { data: hp } = await sb.from("hidden_profiles").select("approval_status, submitted_at, decision_note").eq("startup_id", data.id).maybeSingle(); review = { status: hp?.approval_status ?? "draft", at: hp?.submitted_at ?? null }; }
    else if (data.kind === "investor") { const { data: v } = await sb.from("investor_profile_verifications").select("status, submitted_at").eq("investor_id", data.id).maybeSingle(); review = { status: v?.status ?? "none", at: v?.submitted_at ?? null }; }
    else { const { data: f } = await sb.from("advisor_firms").select("advisor_verification, verification_requested_at, status").eq("id", data.id).maybeSingle(); review = { status: f?.advisor_verification ?? "unverified", at: f?.verification_requested_at ?? null }; }
    return {
      preparedBy, preparedAt: prep?.prepared_at ?? inv.sent_at, submittedAt: inv.submitted_at as string | null, review,
      parts: PARTS[data.kind].map((p) => {
        const c = (checks ?? []).find((x: any) => x.part === p.key);
        const ch = changes.find((x) => x.part === p.key);
        const changed = changedParts.has(p.key);
        return { key: p.key, view: p.view, checked: changed || !!c, changedField: ch?.field ?? null, summary: summaryOf(now[p.key]) };
      }),
    };
  });

function summaryOf(fields: Record<string, string | string[]> | undefined) {
  if (!fields) return "";
  const vals = Object.values(fields).map((v) => (Array.isArray(v) ? v.join(", ") : v)).filter((v) => v && v !== "[]" && v !== "{}");
  const s = vals.map((v) => v.replace(/^\[|\]$/g, "").replace(/"/g, "")).join(" · ");
  return s.length > 90 ? `${s.slice(0, 88)}…` : s;
}

export const setPartCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: Kind, id: Id, part: z.string().max(30), checked: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const h = await H(); const sb = await h.svc();
    if (!(await h.ownerHandover(sb, data.kind, data.id, context.userId))) throw new Error("Forbidden");
    if (!PARTS[data.kind].some((p) => p.key === data.part)) throw new Error("Unknown part");
    if (data.checked) await sb.from("profile_part_checks").upsert({ kind: data.kind, profile_id: data.id, part: data.part, checked_by: context.userId, checked_at: new Date().toISOString() });
    else await sb.from("profile_part_checks").delete().eq("kind", data.kind).eq("profile_id", data.id).eq("part", data.part);
    return { ok: true };
  });

export const submitHandover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: Kind, id: Id, declared: z.literal(true) }).parse(d))
  .handler(async ({ data, context }) => {
    const h = await H(); const sb = await h.svc();
    const inv = await h.ownerHandover(sb, data.kind, data.id, context.userId);
    if (!inv) throw new Error("Forbidden");
    const now = await h.snapshot(sb, data.kind, data.id);
    const changes = h.diff(inv.prepared_snapshot, now);
    const changed = new Set(changes.map((c) => c.part));
    const { data: checks } = await sb.from("profile_part_checks").select("part").eq("kind", data.kind).eq("profile_id", data.id);
    const done = new Set([...(checks ?? []).map((c: any) => c.part), ...changed]);
    const left = PARTS[data.kind].filter((p) => !done.has(p.key));
    if (left.length) throw new Error(`Check all parts first · ${left.length} left.`);
    const at = new Date().toISOString();
    // Record what the owner changed, for the directory panel and Approvals.
    await sb.from("profile_field_changes").delete().eq("kind", data.kind).eq("profile_id", data.id);
    if (changes.length) await sb.from("profile_field_changes").insert(changes.map((c) => ({ kind: data.kind, profile_id: data.id, part: c.part, field: c.field, old_value: c.old, new_value: c.new, changed_by: context.userId })));
    for (const p of PARTS[data.kind]) await sb.from("profile_part_checks").upsert({ kind: data.kind, profile_id: data.id, part: p.key, changed: changed.has(p.key), checked_by: context.userId, checked_at: at });
    const n = PARTS[data.kind].length;
    await h.logEvent(sb, data.kind, data.id, "checked", `Checked ${n} of ${n} parts · changed ${changed.size}`, context.userId);
    if (data.kind === "firm") {
      const { error } = await sb.from("advisor_firms").update({ advisor_verification: "pending", verification_reason: "first_check", verification_requested_at: at }).eq("id", data.id).eq("owner_user_id", context.userId);
      if (error) throw new Error(error.message);
    } else if (data.kind === "investor") {
      const { data: iv } = await sb.from("investors").select("investor_name, investor_type, registration_no, website_url, linkedin_url").eq("id", data.id).maybeSingle();
      const { data: au } = await sb.auth.admin.getUserById(context.userId);
      const { data: cur } = await sb.from("investor_profile_verifications").select("id, submitted_at").eq("investor_id", data.id).maybeSingle();
      const { data: v, error } = await sb.from("investor_profile_verifications").upsert({
        investor_id: data.id, user_id: context.userId, company_name: iv?.investor_name || "Investor", buyer_type: iv?.investor_type ?? null,
        registration_no: iv?.registration_no ?? null, work_email: au?.user?.email ?? inv.email, website: iv?.website_url ?? null, linkedin: iv?.linkedin_url ?? null,
        status: "pending", submitted_at: at, updated_at: at,
      }, { onConflict: "investor_id" }).select("id").single();
      if (error) throw new Error(error.message);
      await sb.from("approval_events").insert({ item_type: "buyer", item_id: v.id, subject_user_id: context.userId, action: cur?.submitted_at ? "resubmit" : "submit", actor_id: context.userId });
    }
    // Sellers: the client then calls the existing submitListing (it builds the snapshot and version).
    await sb.from("profile_invitations").update({ submitted_at: at }).eq("id", inv.id);
    await h.logEvent(sb, data.kind, data.id, "submitted", null, context.userId);
    return { ok: true };
  });

/* --------------------------- Approvals / panel --------------------------- */

export const handoverReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: Kind, id: Id }).parse(d))
  .handler(async ({ data, context }) => {
    const h = await H(); await h.requireControlAdmin(context);
    const sb = await h.svc();
    const { data: inv } = await sb.from("profile_invitations").select("*").eq("kind", data.kind).eq("profile_id", data.id).not("accepted_at", "is", null).order("accepted_at", { ascending: false }).limit(1).maybeSingle();
    if (!inv) return null;
    const [{ data: ev }, { data: ch }, { data: prep }] = await Promise.all([
      sb.from("profile_handover_events").select("event, detail, created_at").eq("kind", data.kind).eq("profile_id", data.id).order("created_at", { ascending: false }),
      sb.from("profile_field_changes").select("part, field, old_value, new_value").eq("kind", data.kind).eq("profile_id", data.id).order("created_at"),
      sb.from(h.TABLE[data.kind]).select("prepared_by, prepared_at, owner_relation").eq("id", data.id).maybeSingle(),
    ]);
    let preparedBy = "PitchSnack";
    if (prep?.prepared_by) { const { data: p } = await sb.from("users").select("first_name, last_name").eq("id", prep.prepared_by).maybeSingle(); preparedBy = [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "PitchSnack"; }
    return {
      owner: `${inv.first_name} ${inv.last_name}`, ownerRelation: prep?.owner_relation ?? inv.owner_relation, sentBy: inv.sent_by,
      preparedBy, preparedAt: prep?.prepared_at ?? inv.sent_at, sentAt: inv.sent_at, acceptedAt: inv.accepted_at, submittedAt: inv.submitted_at,
      changes: ch ?? [], events: ev ?? [], parts: PARTS[data.kind].map((p) => ({ key: p.key, view: p.view, en: p.en })),
    };
  });
