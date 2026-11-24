import { describe, expect, it } from "vitest";
import {
  adminExtraBuyerProfile,
  findBuyerApprovalProfile,
  updateBuyerApprovalProfile,
} from "@/lib/buyer-approval-profile.server";

const investorId = "2fbd6476-b91f-4e9e-af00-2a9d4b811ab3";
const controlUserId = "d4e90f3f-9630-4af7-833b-6c15a1670b27";

describe("Control-added buyer approval profiles", () => {
  it("uses the existing investor id and Control creator without inventing a buyer account", () => {
    expect(adminExtraBuyerProfile({
      id: investorId,
      created_by: controlUserId,
      wizard: { admin_profile: true, bp: { ref_no: "INV-1040", approval_status: "in_review" } },
    })).toMatchObject({
      user_id: controlUserId,
      investor_id: investorId,
      ref_no: "INV-1040",
      approval_status: "in_review",
    });
  });

  it("writes registration state to the existing wizard answers and preserves all other answers", async () => {
    const writes: { table: string; patch: any; column: string; value: string }[] = [];
    const sb = {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: { wizard: { admin_profile: true, answered: ["role", "firm"], bp: { ref_no: "INV-1040", description: "Existing answer" } } },
              error: null,
            }),
          }),
        }),
        update: (patch: any) => ({
          eq: (column: string, value: string) => {
            writes.push({ table, patch, column, value });
            return Promise.resolve({ error: null });
          },
        }),
      }),
    };

    await updateBuyerApprovalProfile(sb, {
      extra: true,
      investorId,
      p: { user_id: controlUserId },
    }, { approval_status: "in_review", submitted_at: "2026-11-24T11:00:00.000Z" });

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ table: "investors", column: "id", value: investorId });
    expect(writes[0]?.patch.wizard).toMatchObject({
      admin_profile: true,
      answered: ["role", "firm"],
      bp: {
        ref_no: "INV-1040",
        description: "Existing answer",
        approval_status: "in_review",
        submitted_at: "2026-11-24T11:00:00.000Z",
      },
    });
  });

  it("uses the investor id as the extra profile's approval-queue key", async () => {
    const sb = {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => table === "buyer_profiles"
              ? { data: null, error: null }
              : {
                  data: {
                    id: investorId,
                    created_by: controlUserId,
                    wizard: { admin_profile: true, bp: { ref_no: "INV-1040", approval_status: "in_review" } },
                  },
                  error: null,
                },
          }),
        }),
      }),
    };

    const record = await findBuyerApprovalProfile(sb, investorId);
    expect(record).toMatchObject({
      key: investorId,
      subjectUserId: controlUserId,
      investorId,
      extra: true,
      p: { ref_no: "INV-1040", approval_status: "in_review" },
    });
  });

  it("keeps an ordinary buyer's registration state in buyer_profiles", async () => {
    const writes: { table: string; patch: any; column: string; value: string }[] = [];
    const sb = {
      from: (table: string) => ({
        update: (patch: any) => ({
          eq: (column: string, value: string) => {
            writes.push({ table, patch, column, value });
            return Promise.resolve({ error: null });
          },
        }),
      }),
    };

    await updateBuyerApprovalProfile(sb, {
      extra: false,
      investorId,
      p: { user_id: controlUserId },
    }, { approval_status: "in_review" });

    expect(writes).toEqual([{
      table: "buyer_profiles",
      patch: { approval_status: "in_review" },
      column: "user_id",
      value: controlUserId,
    }]);
  });
});
