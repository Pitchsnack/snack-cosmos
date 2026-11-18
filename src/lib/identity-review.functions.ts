import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { IdentityReviewKind } from "./identity-review";

type Ctx = { supabase: any; userId: string };
async function assertAdmin(context: Ctx) {
  const [{ data: control, error: controlError }, { data: role, error: roleError }] = await Promise.all([
    context.supabase.rpc("is_control", { _user_id: context.userId }),
    context.supabase.rpc("account_role_of", { _uid: context.userId }),
  ]);
  if (controlError) throw new Error(controlError.message);
  if (roleError) throw new Error(roleError.message);
  if (!control || role !== "admin") throw new Error("Admin only");
}
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
const Item = z.object({ kind: z.enum(["seller", "buyer"]), id: z.string().uuid() });

export const getIdentityReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Item.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { captureIdentityBaseline, loadIdentityReview, withoutIdentitySource } = await import("./identity-review.server");
    const sb = await admin();
    let review = await loadIdentityReview(sb, data.kind as IdentityReviewKind, data.id);
    if (!review.source.identity_review_original) {
      await captureIdentityBaseline(sb, data.kind as IdentityReviewKind, data.id);
      review = await loadIdentityReview(sb, data.kind as IdentityReviewKind, data.id);
    }
    return withoutIdentitySource(review);
  });

export const fixIdentityFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Item.extend({ findingId: z.string().min(1).max(1000), value: z.string().max(6000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const sb = await admin();
    const { captureIdentityBaseline, loadIdentityReview, withoutIdentitySource, writeIdentityField } = await import("./identity-review.server");
    let review = await loadIdentityReview(sb, data.kind as IdentityReviewKind, data.id);
    const finding = review.findings.find(f => f.id === data.findingId);
    if (!finding) throw new Error("This finding changed. Reload the review and try again.");
    if (data.value !== undefined) {
      const max = /^(code_name|suggested_listing_name|headline|headline_th)$/.test(finding.field) ? 120 : /\.\d+$/.test(finding.field) ? 200 : 6000;
      if (data.value.length > max) throw new Error(`This field allows ${max} characters.`);
    }
    if (!review.source.identity_review_original) await captureIdentityBaseline(sb, data.kind as IdentityReviewKind, data.id);
    review = await loadIdentityReview(sb, data.kind as IdentityReviewKind, data.id);
    const current = review.findings.find(f => f.id === data.findingId);
    if (!current) throw new Error("This finding changed. Reload the review and try again.");
    const changed = await writeIdentityField(sb, review, current, data.value);
    const { error: auditError } = await sb.from("identity_review_fixes").insert({
      item_type: data.kind === "seller" ? "listing" : "buyer_profile", item_id: data.id, version: review.version,
      finding_id: current.id, field: current.field, reason: current.reason,
      old_value: changed.oldValue, new_value: changed.newValue, admin_id: context.userId,
    });
    if (auditError) throw new Error(auditError.message);
    return withoutIdentitySource(await loadIdentityReview(sb, data.kind as IdentityReviewKind, data.id));
  });
