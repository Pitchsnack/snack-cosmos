import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  firm: { id: "11111111-1111-4111-8111-111111111111", owner_user_id: "owner", name: "Company name", setup_done_at: "2026-11-03T00:00:00Z", advisor_verification: "unverified", registration_no: null, live_since: null, suggested_listing_name: "legacy suggestion", suggested_headline: "legacy headline", published_listing_name: "test", published_headline: "legacy published headline" } as Record<string, unknown>,
  updates: [] as Record<string, unknown>[],
}));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn };
  return builder;
} }));
vi.mock("../../src/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("../../src/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from: (table: string) => {
    const query = {
      select: () => query, eq: () => query,
      maybeSingle: async () => ({ data: table === "advisor_firms" ? fixture.firm : null }),
      update: (row: Record<string, unknown>) => { fixture.updates.push(row); return query; },
      insert: async () => ({ error: null }),
      upsert: async () => ({ error: null }),
      then: (resolve: (result: unknown) => void) => resolve({ error: null }),
    };
    return query;
  },
} }));
import { decideOneStep, registerAdvisorFirm } from "../../src/lib/approvals-one-step.functions";
type Handler = (input: { data: Record<string, unknown>; context: Record<string, unknown> }) => Promise<unknown>;
const context = { userId: "owner", supabase: { rpc: async (name: string) => ({ data: name === "is_control" ? true : "admin" }) } };

beforeEach(() => { fixture.updates.length = 0; fixture.firm.owner_user_id = "owner"; fixture.firm.setup_done_at = "2026-11-03T00:00:00Z"; fixture.firm.advisor_verification = "unverified"; });
describe("Advisor server registration and publication", () => {
  it("registers a completed owner firm without listing-name or headline answers", async () => {
    fixture.firm.suggested_listing_name = null; fixture.firm.suggested_headline = null;
    await expect((registerAdvisorFirm as unknown as Handler)({ data: { firmId: fixture.firm.id }, context })).resolves.toEqual({ ok: true });
    expect(fixture.updates[0]?.advisor_verification).toBe("pending");
  });
  it("keeps the ownership gate", async () => {
    fixture.firm.owner_user_id = "someone-else";
    await expect((registerAdvisorFirm as unknown as Handler)({ data: { firmId: fixture.firm.id }, context })).rejects.toThrow("Not your firm");
    expect(fixture.updates).toHaveLength(0);
  });
  it("keeps setup completion required", async () => {
    fixture.firm.setup_done_at = null;
    await expect((registerAdvisorFirm as unknown as Handler)({ data: { firmId: fixture.firm.id }, context })).rejects.toThrow("finish setup");
    expect(fixture.updates).toHaveLength(0);
  });
  it("publishes without writing any legacy name/headline column", async () => {
    fixture.firm.owner_user_id = null;
    await expect((decideOneStep as unknown as Handler)({ data: { kind: "advisor", id: fixture.firm.id, action: "approve" }, context })).resolves.toEqual({ ok: true });
    expect(fixture.updates[0]?.status).toBe("live");
    expect(fixture.updates[0]?.advisor_verification).toBe("verified");
    for (const key of ["suggested_listing_name", "suggested_headline", "published_listing_name", "published_headline", "published_headline_th"]) expect(fixture.updates[0]).not.toHaveProperty(key);
  });
});