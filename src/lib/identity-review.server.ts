import {
  applyIdentityFinding,
  buyerIdentityFacts,
  buyerIdentityValues,
  fixedIdentityFindings,
  publicIdentityValues,
  scanIdentityReview,
  sellerIdentityFacts,
  sellerIdentityValues,
  type IdentityFinding,
  type IdentityReviewKind,
  type IdentityReviewResult,
  type IdentityReviewValues,
} from "./identity-review";

function labelled(original: IdentityReviewValues, current: IdentityReviewValues): IdentityReviewValues {
  const out: IdentityReviewValues = { ...publicIdentityValues(original) };
  for (const [key, value] of Object.entries(current)) if (key.endsWith("__label")) out[key] = value;
  for (const key of Object.keys(publicIdentityValues(current))) if (!(key in out)) out[key] = current[key];
  return out;
}
function effectiveSeller(hp: any) {
  const draft = hp.review_draft && typeof hp.review_draft === "object" ? hp.review_draft : {};
  return {
    ...hp,
    code_name: text(draft.name) || hp.code_name,
    headline: text(draft.headline) || hp.published_headline || hp.headline,
    headline_th: text(draft.headlineTh) || hp.published_headline_th || hp.headline_th,
  };
}
const text = (v: unknown) => typeof v === "string" ? v : "";

/** Admin-only source read and one shared scan for seller/buyer reviews. */
export async function loadIdentityReview(sb: any, kind: IdentityReviewKind, itemId: string): Promise<IdentityReviewResult & { source: any; startup?: any }> {
  if (kind === "seller") {
    const { data: hp, error } = await sb.from("hidden_profiles").select("*").eq("id", itemId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!hp) throw new Error("Listing not found");
    const [{ data: startup, error: startupError }, { data: founders, error: founderError }] = await Promise.all([
      sb.from("startups").select("*").eq("id", hp.startup_id).maybeSingle(),
      sb.from("startup_founders").select("full_name").eq("startup_id", hp.startup_id),
    ]);
    if (startupError) throw new Error(startupError.message);
    if (founderError) throw new Error(founderError.message);
    const source = effectiveSeller(hp);
    const fields = sellerIdentityValues(source, startup ?? {});
    const originalFields = labelled((hp.identity_review_original as IdentityReviewValues | null) ?? fields, fields);
    const facts = sellerIdentityFacts(startup ?? {}, founders ?? [], hp);
    const findings = scanIdentityReview(fields, facts), originalFindings = scanIdentityReview(originalFields, facts);
    return { kind, itemId, version: hp.version ?? 1, fields, originalFields, findings, originalFindings, fixed: fixedIdentityFindings(originalFindings, findings), source: hp, startup };
  }
  const { findBuyerApprovalProfile } = await import("./buyer-approval-profile.server");
  const record = await findBuyerApprovalProfile(sb, itemId);
  if (!record) throw new Error("Profile not found");
  const { p: profile, investor } = record;
  const fields = buyerIdentityValues(profile);
  const originalFields = labelled((profile.identity_review_original as IdentityReviewValues | null) ?? fields, fields);
  const facts = buyerIdentityFacts(profile, investor ?? {});
  const findings = scanIdentityReview(fields, facts), originalFindings = scanIdentityReview(originalFields, facts);
  return { kind, itemId, version: 1, fields, originalFields, findings, originalFindings, fixed: fixedIdentityFindings(originalFindings, findings), source: profile };
}

export function withoutIdentitySource(review: IdentityReviewResult & { source?: any; startup?: any }): IdentityReviewResult {
  return { kind: review.kind, itemId: review.itemId, version: review.version, fields: review.fields, originalFields: review.originalFields, findings: review.findings, originalFindings: review.originalFindings, fixed: review.fixed };
}

export async function captureIdentityBaseline(sb: any, kind: IdentityReviewKind, itemId: string) {
  const review = await loadIdentityReview(sb, kind, itemId);
  const value = publicIdentityValues(review.fields);
  if (kind === "seller") {
    const { error } = await sb.from("hidden_profiles").update({ identity_review_original: value }).eq("id", itemId);
    if (error) throw new Error(error.message);
    return;
  }
  const { findBuyerApprovalProfile, updateBuyerApprovalProfile } = await import("./buyer-approval-profile.server");
  const record = await findBuyerApprovalProfile(sb, itemId);
  if (!record) throw new Error("Profile not found");
  await updateBuyerApprovalProfile(sb, record, { identity_review_original: value });
}

function arrayPatch(source: any, base: string, index: number, value: string) {
  const next = Array.isArray(source?.[base]) ? [...source[base]] : [];
  if (value.trim()) next[index] = value;
  else next.splice(index, 1);
  return next;
}

/** Persist exactly one public field; private and post-NDA columns are unreachable here. */
export async function writeIdentityField(sb: any, review: IdentityReviewResult & { source: any; startup?: any }, finding: IdentityFinding, customValue?: string) {
  const nextValues = applyIdentityFinding(review.fields, finding, customValue);
  const oldValue = review.fields[finding.field], newValue = nextValues[finding.field];
  const match = finding.field.match(/^(.*)\.(\d+)$/);
  const base = match?.[1] ?? finding.field;
  const index = match ? Number(match[2]) : null;
  const now = new Date().toISOString();
  if (review.kind === "seller") {
    const startupField = /^(short_description|short_description_th|product_tags|product_tags_th|market_tags|market_tags_th)$/.test(base);
    const table = startupField ? "startups" : "hidden_profiles";
    const id = startupField ? review.source.startup_id : review.source.id;
    const source = startupField ? review.startup : review.source;
    const patch: Record<string, unknown> = { updated_at: now };
    patch[base] = index === null ? newValue : arrayPatch(source, base, index, newValue);
    if (base === "code_name") {
      patch.review_draft = { ...(review.source.review_draft ?? {}), name: newValue };
    } else if (base === "headline") {
      patch.published_headline = newValue;
      patch.review_draft = { ...(review.source.review_draft ?? {}), headline: newValue };
    } else if (base === "headline_th") {
      patch.published_headline_th = newValue;
      patch.review_draft = { ...(review.source.review_draft ?? {}), headlineTh: newValue };
    }
    const { error } = await sb.from(table).update(patch).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    if (base !== "description" && base !== "description_th") throw new Error("This buyer field is not editable in Identity check.");
    const { findBuyerApprovalProfile, updateBuyerApprovalProfile } = await import("./buyer-approval-profile.server");
    const record = await findBuyerApprovalProfile(sb, review.itemId);
    if (!record) throw new Error("Profile not found");
    await updateBuyerApprovalProfile(sb, record, { [base]: newValue || null, updated_at: now });
  }
  return { oldValue, newValue };
}

