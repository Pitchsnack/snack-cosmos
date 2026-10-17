/** Profile handover: server-only helpers. Callers check Control Admin or the owner first. */
import { PARTS, type HandoverKind, type RunBy } from "./handover-parts";

type Sb = any;

export async function svc(): Promise<Sb> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Sb;
}

/** Control workspace + Admin account, both read through the caller's own client. */
export async function requireControlAdmin(ctx: { supabase: Sb; userId: string }) {
  const [{ data: control, error }, { data: me }] = await Promise.all([
    ctx.supabase.rpc("is_control", { _user_id: ctx.userId }),
    ctx.supabase.from("users").select("account_role").eq("id", ctx.userId).maybeSingle(),
  ]);
  if (error || !control || me?.account_role !== "admin") throw new Error("Forbidden");
}

export const TABLE: Record<HandoverKind, string> = { startup: "startups", investor: "investors", firm: "advisor_firms" };
export const ROLE: Record<HandoverKind, "seller" | "buyer" | "advisor"> = { startup: "seller", investor: "buyer", firm: "advisor" };

export type ProfileHead = { id: string; name: string; ref: string; runBy: RunBy; preparedBy: string | null; preparedAt: string | null; ownerRelation: string | null; status: string; liveSince: string | null; createdAt: string };

export async function profileHeads(sb: Sb, kind: HandoverKind, ids: string[]): Promise<Map<string, ProfileHead>> {
  const out = new Map<string, ProfileHead>();
  if (!ids.length) return out;
  if (kind === "startup") {
    const [{ data: s }, { data: hp }] = await Promise.all([
      sb.from("startups").select("id, startup_name, run_by, prepared_by, prepared_at, owner_relation, created_at").in("id", ids),
      sb.from("hidden_profiles").select("startup_id, ref_no, approval_status, published_at").in("startup_id", ids),
    ]);
    const h = new Map<string, any>((hp ?? []).map((r: any) => [r.startup_id, r]));
    for (const r of s ?? []) {
      const x = h.get(r.id);
      out.set(r.id, { id: r.id, name: r.startup_name || x?.ref_no || "New business", ref: x?.ref_no ?? `PS-${r.id.replace(/-/g, "").slice(0, 4).toUpperCase()}`, runBy: r.run_by, preparedBy: r.prepared_by, preparedAt: r.prepared_at, ownerRelation: r.owner_relation, status: x?.approval_status === "live" ? "live" : "draft", liveSince: x?.published_at ?? null, createdAt: r.created_at });
    }
  } else if (kind === "investor") {
    const [{ data: s }, { data: bp }] = await Promise.all([
      sb.from("investors").select("id, investor_name, run_by, prepared_by, prepared_at, owner_relation, created_at").in("id", ids),
      sb.from("buyer_profiles").select("investor_id, ref_no, status, live_since").in("investor_id", ids),
    ]);
    const b = new Map<string, any>((bp ?? []).map((r: any) => [r.investor_id, r]));
    for (const r of s ?? []) {
      const x = b.get(r.id);
      out.set(r.id, { id: r.id, name: r.investor_name || "Investor", ref: x?.ref_no ?? `INV-${r.id.slice(0, 6).toUpperCase()}`, runBy: r.run_by, preparedBy: r.prepared_by, preparedAt: r.prepared_at, ownerRelation: r.owner_relation, status: x?.status === "live" ? "live" : "draft", liveSince: x?.live_since ?? null, createdAt: r.created_at });
    }
  } else {
    const { data: s } = await sb.from("advisor_firms").select("id, name, ref_no, run_by, prepared_by, prepared_at, owner_relation, status, live_since, created_at").in("id", ids);
    for (const r of s ?? []) out.set(r.id, { id: r.id, name: r.name || "Advisor firm", ref: r.ref_no ?? `ADV-${r.id.replace(/-/g, "").slice(0, 4).toUpperCase()}`, runBy: r.run_by, preparedBy: r.prepared_by, preparedAt: r.prepared_at, ownerRelation: r.owner_relation, status: r.status === "live" ? "live" : "draft", liveSince: r.live_since, createdAt: r.created_at });
  }
  return out;
}

/** The non-Admin owner account of a profile, if any. */
export async function ownerOf(sb: Sb, kind: HandoverKind, id: string): Promise<{ id: string; email: string; first_name: string | null; last_name: string | null; created_at: string } | null> {
  let ids: string[] = [];
  if (kind === "startup") ids = ((await sb.from("startup_users").select("user_id").eq("startup_id", id)).data ?? []).map((r: any) => r.user_id);
  else if (kind === "investor") ids = ((await sb.from("buyer_profiles").select("user_id").eq("investor_id", id)).data ?? []).map((r: any) => r.user_id);
  else { const { data } = await sb.from("advisor_firms").select("owner_user_id").eq("id", id).maybeSingle(); if (data?.owner_user_id) ids = [data.owner_user_id]; }
  if (!ids.length) return null;
  const { data: us } = await sb.from("users").select("id, email, first_name, last_name, account_role, created_at").in("id", ids);
  return (us ?? []).find((u: any) => u.account_role !== "admin") ?? null;
}

/** What the email already owns (brief section 5: one company per account). */
export async function emailCheck(sb: Sb, kind: HandoverKind, email: string): Promise<
  { state: "new" } | { state: "account"; since: string } | { state: "owns"; name: string; ref: string } | { state: "other_role"; role: string }
> {
  const { data: u } = await sb.from("users").select("id, account_role, created_at").ilike("email", email.trim()).maybeSingle();
  if (!u) return { state: "new" };
  const want = ROLE[kind];
  if (u.account_role && u.account_role !== want) return { state: "other_role", role: u.account_role };
  let pid: string | null = null;
  if (kind === "startup") pid = ((await sb.from("startup_users").select("startup_id").eq("user_id", u.id).limit(1)).data ?? [])[0]?.startup_id ?? null;
  else if (kind === "investor") pid = (await sb.from("buyer_profiles").select("investor_id").eq("user_id", u.id).maybeSingle()).data?.investor_id ?? null;
  else pid = ((await sb.from("advisor_firms").select("id").eq("owner_user_id", u.id).limit(1)).data ?? [])[0]?.id ?? null;
  if (pid) { const h = (await profileHeads(sb, kind, [pid])).get(pid); return { state: "owns", name: h?.name ?? "a profile", ref: h?.ref ?? "" }; }
  return { state: "account", since: u.created_at };
}

const str = (v: unknown): string => (v == null ? "" : Array.isArray(v) || typeof v === "object" ? JSON.stringify(v) : String(v));

/** Current values per part/field, used for the prepared snapshot and the owner's changes. */
export async function snapshot(sb: Sb, kind: HandoverKind, id: string): Promise<Record<string, Record<string, string | string[]>>> {
  const rows: Record<string, any> = {};
  const lists: Record<string, string[]> = {};
  if (kind === "startup") {
    const [s, hp, media, founders] = await Promise.all([
      sb.from("startups").select("*").eq("id", id).maybeSingle(),
      sb.from("hidden_profiles").select("*").eq("startup_id", id).maybeSingle(),
      sb.from("startup_media").select("*").eq("startup_id", id),
      sb.from("startup_founders").select("full_name").eq("startup_id", id),
    ]);
    rows.s = s.data ?? {}; rows.hp = hp.data ?? {};
    lists.media = (media.data ?? []).map((m: any) => m.caption || m.storage_path || m.image_url || m.id).map(String);
    lists.founders = (founders.data ?? []).map((m: any) => m.full_name).filter(Boolean);
  } else if (kind === "investor") {
    const [i, bp] = await Promise.all([
      sb.from("investors").select("*").eq("id", id).maybeSingle(),
      sb.from("buyer_profiles").select("*").eq("investor_id", id).maybeSingle(),
    ]);
    rows.i = i.data ?? {}; rows.bp = bp.data ?? {};
  } else {
    const [af, team, cr, docs] = await Promise.all([
      sb.from("advisor_firms").select("*").eq("id", id).maybeSingle(),
      sb.from("advisor_firm_team").select("name").eq("firm_id", id),
      sb.from("advisor_firm_credentials").select("name").eq("firm_id", id),
      sb.from("advisor_firm_documents").select("name").eq("firm_id", id),
    ]);
    rows.af = af.data ?? {};
    lists.team = (team.data ?? []).map((r: any) => r.name).filter(Boolean);
    lists.credentials = (cr.data ?? []).map((r: any) => r.name).filter(Boolean);
    lists.documents = (docs.data ?? []).map((r: any) => r.name).filter(Boolean);
  }
  const out: Record<string, Record<string, string | string[]>> = {};
  for (const p of PARTS[kind]) {
    out[p.key] = {};
    for (const fl of p.fields) {
      if (fl.list) out[p.key][fl.label] = lists[fl.src] ?? [];
      else { const [t, c] = fl.src.split("."); out[p.key][fl.label] = str(rows[t]?.[c]); }
    }
  }
  return out;
}

export type FieldChange = { part: string; field: string; old: string | null; new: string | null };

export function diff(before: Record<string, Record<string, any>> | null, after: Record<string, Record<string, any>>): FieldChange[] {
  if (!before) return [];
  const out: FieldChange[] = [];
  for (const [part, fields] of Object.entries(after)) {
    for (const [field, v] of Object.entries(fields)) {
      const o = before[part]?.[field];
      if (Array.isArray(v)) {
        const ov: string[] = Array.isArray(o) ? o : [];
        for (const x of v.filter((x) => !ov.includes(x))) out.push({ part, field, old: null, new: `Added ${x}` });
        for (const x of ov.filter((x) => !v.includes(x))) out.push({ part, field, old: `Removed ${x}`, new: null });
      } else if ((o ?? "") !== (v ?? "")) out.push({ part, field, old: o || null, new: v || null });
    }
  }
  return out;
}

export async function logEvent(sb: Sb, kind: HandoverKind, id: string, event: string, detail: string | null, actor: string | null) {
  await sb.from("profile_handover_events").insert({ kind, profile_id: id, event, detail, actor });
}

/** Active (open) invitation: not accepted, not cancelled. */
export async function openInvitation(sb: Sb, kind: HandoverKind, id: string) {
  const { data } = await sb.from("profile_invitations").select("*").eq("kind", kind).eq("profile_id", id).is("accepted_at", null).is("cancelled_at", null).maybeSingle();
  return data as any | null;
}

/** Owner's handover row (accepted, not closed), or null. */
export async function ownerHandover(sb: Sb, kind: HandoverKind, id: string, userId: string) {
  const { data } = await sb.from("profile_invitations").select("*").eq("kind", kind).eq("profile_id", id).eq("accepted_user_id", userId).not("accepted_at", "is", null).is("closed_at", null).order("accepted_at", { ascending: false }).limit(1).maybeSingle();
  return data as any | null;
}

/** Approved / verified state that ends the owner's check (brief 9: the box goes away). */
export async function decided(sb: Sb, kind: HandoverKind, id: string): Promise<boolean> {
  if (kind === "startup") return (await sb.from("hidden_profiles").select("approval_status").eq("startup_id", id).maybeSingle()).data?.approval_status === "live";
  if (kind === "investor") return (await sb.from("investor_profile_verifications").select("status").eq("investor_id", id).maybeSingle()).data?.status === "verified";
  return (await sb.from("advisor_firms").select("advisor_verification").eq("id", id).maybeSingle()).data?.advisor_verification === "verified";
}

/** Moves the profile to the user's account. Runs once per invitation (the accepted_at update is the lock). */
export async function claimInvitation(sb: Sb, inv: any, user: { id: string; email: string; first_name?: string | null; last_name?: string | null }) {
  const kind = inv.kind as HandoverKind;
  if (inv.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) throw new Error("This invitation works with its own email only.");
  const chk = await emailCheck(sb, kind, user.email);
  if (chk.state === "owns") throw new Error(`This account already owns ${chk.name}.`);
  if (chk.state === "other_role") throw new Error("This email has another kind of PitchSnack account.");
  const now = new Date().toISOString();
  const { data: took } = await sb.from("profile_invitations").update({ accepted_at: now, accepted_user_id: user.id })
    .eq("id", inv.id).is("accepted_at", null).is("cancelled_at", null).gt("expires_at", now).select("id").maybeSingle();
  if (!took) throw new Error("This invitation can't be used any more.");
  try { return await finishClaim(sb, inv, user, kind, now); }
  catch (e) {
    // Release the lock so the owner can simply try again; the account is kept.
    await sb.from("profile_invitations").update({ accepted_at: null, accepted_user_id: null }).eq("id", inv.id);
    throw e instanceof Error ? e : new Error("Couldn't finish. Try again.");
  }
}

async function finishClaim(sb: Sb, inv: any, user: { id: string; email: string }, kind: HandoverKind, now: string) {
  const role = ROLE[kind];
  const { data: u } = await sb.from("users").select("account_role, first_name, last_name, signup_done_at").eq("id", user.id).maybeSingle();
  await sb.from("users").update({
    ...(u?.account_role ? {} : { account_role: role }),
    ...(u?.first_name ? {} : { first_name: inv.first_name }),
    ...(u?.last_name ? {} : { last_name: inv.last_name }),
    ...(u?.signup_done_at ? {} : { signup_done_at: now }),
    ...(kind === "firm" ? { advisor_view: true } : {}),
    status: "Active",
  }).eq("id", user.id);
  await sb.from("signup_answers").upsert({
    user_id: user.id, role, first_answer: inv.owner_relation || "handover", first_name: inv.first_name, last_name: inv.last_name,
    profile_id: inv.profile_id, done_at: now, terms_accepted_at: now, ...(kind === "investor" && inv.owner_relation ? { buyer_relation: inv.owner_relation } : {}),
  }, { onConflict: "user_id", ignoreDuplicates: true });
  if (kind === "startup") {
    const { data: st } = await sb.from("startups").select("tenant_id").eq("id", inv.profile_id).maybeSingle();
    const { data: ut } = await sb.from("user_tenants").select("id").eq("user_id", user.id).eq("tenant_id", st.tenant_id).maybeSingle();
    if (!ut) await sb.from("user_tenants").insert({ user_id: user.id, tenant_id: st.tenant_id, is_default: true, workspace_type: "TENANT", created_by: user.id });
    const { data: su } = await sb.from("startup_users").select("id").eq("startup_id", inv.profile_id).eq("user_id", user.id).maybeSingle();
    if (!su) { const { error } = await sb.from("startup_users").insert({ startup_id: inv.profile_id, tenant_id: st.tenant_id, user_id: user.id, role: "Founder" }); if (error) throw new Error(error.message); }
    // Admin preparers stop being members, so the profile is the owner's alone.
    const admins = ((await sb.from("users").select("id").eq("account_role", "admin")).data ?? []).map((r: any) => r.id);
    if (admins.length) await sb.from("startup_users").delete().eq("startup_id", inv.profile_id).in("user_id", admins);
    await sb.from("startup_ownership").update({ seller_relation: inv.owner_relation }).eq("startup_id", inv.profile_id);
  } else if (kind === "investor") {
    const admins = ((await sb.from("users").select("id").eq("account_role", "admin")).data ?? []).map((r: any) => r.id);
    if (admins.length) await sb.from("buyer_profiles").update({ investor_id: null }).eq("investor_id", inv.profile_id).in("user_id", admins);
    const { data: bp } = await sb.from("buyer_profiles").select("user_id").eq("user_id", user.id).maybeSingle();
    if (bp) await sb.from("buyer_profiles").update({ investor_id: inv.profile_id, buyer_relation: inv.owner_relation }).eq("user_id", user.id);
    else await sb.from("buyer_profiles").insert({ user_id: user.id, code_name: "", investor_id: inv.profile_id, buyer_relation: inv.owner_relation });
  } else {
    await sb.from("advisor_firms").update({ owner_user_id: user.id }).eq("id", inv.profile_id);
  }
  await sb.from(TABLE[kind]).update({ run_by: "owner", owner_relation: inv.owner_relation }).eq("id", inv.profile_id);
  await sb.from("managed_clients").update({ ended_at: now }).eq("kind", kind).eq("profile_id", inv.profile_id).is("ended_at", null);
  const snap = await snapshot(sb, kind, inv.profile_id);
  await sb.from("profile_invitations").update({ prepared_snapshot: snap }).eq("id", inv.id);
  await logEvent(sb, kind, inv.profile_id, "accepted", `${inv.first_name} ${inv.last_name} became the owner`, user.id);
  return { kind, profileId: inv.profile_id as string };
}
