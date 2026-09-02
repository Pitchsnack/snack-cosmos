/**
 * Deterministic JSON snapshot of the editable StartupForm state.
 *
 * Used by the Unsaved Changes guard: compare initial vs current snapshot
 * strings; equal => clean, different => dirty. Toggling a field and
 * reverting it produces the same string, so no false positives.
 *
 * Rules (per PitchSnack1 UnsavedChanges reference):
 *   - Include every user-editable value.
 *   - Exclude ephemeral UI state, timestamps, random IDs, signed URLs,
 *     blob URLs, and raw File objects.
 *   - Serialize File as stable metadata: name/size/type/lastModified.
 *   - Normalize null/undefined/"" consistently.
 */
import type { EntityMediaState, SlotState } from "@/components/media/entity-media-editor";
import type { FounderDraft } from "@/components/startups/founder-editor";

export interface StartupFormSnapshotInput {
  isEdit: boolean;
  tenantId: string;
  startupName: string;
  companyType: string;
  registeredName: string;
  registeredNumber: string;
  companySize: string;
  lastYearRevenue: string;
  yearFounded: string;
  email: string;
  headquarters: string;
  region: string;
  city: string;
  websiteUrl: string;
  linkedinUrl: string;
  shortDescription: string;
  longDescription: string;
  industries: string[];
  productTags: string[];
  marketTags: string[];
  investmentStage: string;
  status: string;
  visibility: string;
  investorIds: string[];
  founders: FounderDraft[];
  owningAgentUserId: string;
  owningAiAgentId: string;
  media: EntityMediaState;
}

function s(v: string | null | undefined): string {
  return (v ?? "").toString();
}

function slotMeta(slot: SlotState) {
  // Stable, non-ephemeral metadata only. No File, no blob URL, no signedUrl.
  // "Cleared" is expressed naturally by (persistedPath === null && pendingFile === null).
  const pf = slot.pendingFile;
  return {
    persistedPath: s(slot.persistedPath),
    pending: pf
      ? {
          name: pf.name,
          size: pf.size,
          type: pf.type,
          lastModified: pf.lastModified,
        }
      : null,
    isLocked: !!slot.isLocked,
  };
}

export function buildStartupFormSnapshot(input: StartupFormSnapshotInput): string {
  const createOnly = input.isEdit
    ? {}
    : {
        tenantId: s(input.tenantId),
        status: s(input.status),
        visibility: s(input.visibility),
        owningAgentUserId: s(input.owningAgentUserId),
        owningAiAgentId: s(input.owningAiAgentId),
      };

  const payload = {
    ...createOnly,
    startupName: s(input.startupName),
    companyType: s(input.companyType),
    registeredName: s(input.registeredName),
    registeredNumber: s(input.registeredNumber),
    companySize: s(input.companySize),
    lastYearRevenue: s(input.lastYearRevenue),
    yearFounded: s(input.yearFounded),
    email: s(input.email),
    headquarters: s(input.headquarters),
    region: s(input.region),
    city: s(input.city),
    websiteUrl: s(input.websiteUrl),
    linkedinUrl: s(input.linkedinUrl),
    shortDescription: s(input.shortDescription),
    longDescription: s(input.longDescription),
    investmentStage: s(input.investmentStage),
    industries: [...input.industries],
    productTags: [...input.productTags],
    marketTags: [...input.marketTags],
    // Investor selection is a set; sort for order-stability.
    investorIds: [...input.investorIds].sort(),
    founders: input.founders.map((f) => ({
      full_name: s(f.full_name),
      position: s(f.position),
      linkedin_url: s(f.linkedin_url),
      bio: s(f.bio),
    })),
    media: {
      logo: slotMeta(input.media.logo),
      slots: input.media.slots.map(slotMeta),
    },
  };

  return JSON.stringify(payload);
}
