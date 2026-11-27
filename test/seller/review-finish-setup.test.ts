import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createListingPrepareRunner, fillEmptyListingTexts, LISTING_PREPARE_TIMEOUT_MS, listingTextsMissing } from "@/lib/seller-listing-prepare";

const wizard = readFileSync("src/components/startups/seller-wizard.tsx", "utf8");

function harness() {
  const state = { busy: false, failed: false, patches: [] as unknown[] };
  const runner = createListingPrepareRunner<Record<string, string>>({
    onBusy: (b) => { state.busy = b; },
    onFailed: (f) => { state.failed = f; },
    onPatch: (p) => { state.patches.push(p); },
  });
  return { state, runner };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("seller Review: the busy state always ends", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("ends when the run ends, even after the screen moved to another step", async () => {
    const { state, runner } = harness();
    let answer!: (v: Record<string, string>) => void;
    const done = runner.run(() => new Promise((r) => { answer = r; }));
    expect(state.busy).toBe(true);
    // Moving step: nothing in the runner is cancelled by the screen.
    answer({ headline: "Done" });
    await done;
    expect(state.busy).toBe(false);
    expect(state.patches).toHaveLength(1);
  });

  it("ends when the wizard is mounted twice (development double mount)", async () => {
    const { state, runner } = harness();
    const resolvers: Array<(v: Record<string, string>) => void> = [];
    const first = runner.run(() => new Promise((r) => resolvers.push(r)));
    const second = runner.run(() => new Promise((r) => resolvers.push(r)));
    resolvers[0]!({});
    await first;
    expect(state.busy).toBe(true); // a newer run is still going
    resolvers[1]!({});
    await second;
    expect(state.busy).toBe(false);
    // The wizard guards on the signature ref, not on a per-mount flag.
    expect(wizard).not.toContain("let live = true");
  });

  it("stops waiting after 15 seconds and reports the error", async () => {
    const { state, runner } = harness();
    const done = runner.run(() => new Promise(() => {}));
    expect(LISTING_PREPARE_TIMEOUT_MS).toBe(15_000);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(state.busy).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(state.busy).toBe(false);
    expect(state.failed).toBe(true);
  });

  it("reports the error when the call fails, and Try again clears it while running", async () => {
    const { state, runner } = harness();
    await runner.run(() => Promise.reject(new Error("boom")));
    expect(state.failed).toBe(true);
    expect(state.busy).toBe(false);
    let answer!: (v: Record<string, string>) => void;
    const retry = runner.run(() => new Promise((r) => { answer = r; }));
    expect(state.failed).toBe(false);
    expect(state.busy).toBe(true);
    answer({});
    await retry;
    expect(state.busy).toBe(false);
  });
});

describe("seller Review: the background step only fills what's empty", () => {
  it("doesn't run when listing name, headline and description are all filled in", () => {
    expect(listingTextsMissing({ listingName: "Project Automotive Provider", headline: "A headline", description: "A description" })).toBe(false);
    expect(listingTextsMissing({ listingName: "", headline: "A headline", description: "A description" })).toBe(true);
    expect(listingTextsMissing({ listingName: "Name", headlineTh: "หัวข้อ", descriptionTh: "คำอธิบาย" })).toBe(false);
    expect(listingTextsMissing({ listingName: "Name", headline: "A headline", description: " " })).toBe(true);
    expect(wizard).toContain("if (!listingTextsMissing(d)) return;");
  });

  it("never changes a description the wizard already holds", () => {
    const current = { listingName: "", headline: "", description: "Mine", descriptionTh: "", descriptionStory: "kept" };
    const next = fillEmptyListingTexts(current, { listingName: "Gen", headline: "Gen H", description: "Gen D", descriptionTh: "Gen TH", descriptionStory: "new" });
    expect(next.description).toBe("Mine");
    expect(next.descriptionTh).toBe("");
    expect(next.descriptionStory).toBe("kept");
    expect(next.listingName).toBe("Gen");
    expect(next.headline).toBe("Gen H");
  });
});

describe("seller Review: a saved description in any mode is never rewritten on the server", () => {
  const storyLines = (lang: "en" | "th") => ({ mode: "lines", lang, handover: null, parts: {}, auto: {}, translations: [] });
  for (const mode of ["lines", "own"] as const) {
    it(`keeps a saved ${mode}-mode description`, async () => {
      const updates: Record<string, unknown>[] = [];
      const row = {
        startup_id: "s1", code_name: "Project Saved", suggested_listing_name: "Project Saved",
        headline: "Saved headline", headline_th: "", description: "Seller wrote this.", description_th: "ผู้ขายเขียนเอง",
        description_story: mode === "lines" ? storyLines("en") : null, description_story_th: mode === "lines" ? storyLines("th") : null,
        owner_stays: null, handover_months: null, listing_text_translations: [],
      };
      const chain = (result: unknown) => ({ eq: () => ({ single: async () => result, maybeSingle: async () => result }) });
      const sb = { from: (table: string) => ({
        select: () => chain(table === "startups" ? { data: { startup_name: "Co", sector: "Automotive" }, error: null } : { data: row, error: null }),
        update: (patch: Record<string, unknown>) => { updates.push(patch); return { eq: async () => ({ error: null }) }; },
      }) };
      const { ensureAutomaticSellerListing } = await import("@/lib/seller-listing-text.server");
      const result = await ensureAutomaticSellerListing(sb, "s1", true, "u1");
      expect(updates).toHaveLength(0);
      expect(result?.description).toBe("Seller wrote this.");
      expect(result?.descriptionTh).toBe("ผู้ขายเขียนเอง");
      expect(result?.name).toBe("Project Saved");
    });
  }
});

describe("seller Review screen", () => {
  it("shows the hat loader on Review while the background step runs", () => {
    expect(wizard).toContain('{(reading || listingPreparing)\n');
    expect(wizard).not.toContain('listingPreparing) && cur.id !== "review"');
  });
  it("names a missing answer in the blocked line under the buttons, once", () => {
    expect(wizard).not.toContain('valid[cur.id] || cur.id === "review" ? null');
    expect(wizard).toContain(': cur.id === "review" ? (listingPreparing || !blockers.length ? null : L(`Answer ${');
    expect(wizard.match(/before you continue\./g)).toHaveLength(1);
  });
  it("shows the error with Try again", () => {
    expect(wizard).toContain(`We couldn't write your listing texts.`);
    expect(wizard).toContain("เราไม่สามารถเขียนข้อความประกาศของท่านได้");
    expect(wizard).toContain('L("Try again", "ลองอีกครั้ง")');
  });
  it("has no red * on Review your answers", () => {
    expect(wizard).toContain('cur.id !== "lic" && cur.id !== "review" && <span aria-hidden className="ml-1 text-destructive">*</span>');
  });
  it("puts listing rows in Your listing and founder rows under About the founder", () => {
    const listing = wizard.indexOf('L("Your listing", "ประกาศของท่าน")');
    const founder = wizard.indexOf('L("About the founder", "เกี่ยวกับผู้ก่อตั้ง")');
    const name = wizard.indexOf("['Listing name', 'ชื่อประกาศ'");
    const contact = wizard.indexOf('L("Contact email and phone"');
    expect(listing).toBeGreaterThan(-1);
    expect(name).toBeGreaterThan(listing);
    expect(founder).toBeGreaterThan(name);
    expect(contact).toBeGreaterThan(founder);
    // No box closes between the price rows and the listing name rows.
    expect(wizard.slice(listing, name)).not.toMatch(/<\/div>\n\s*\{barKeys\.includes\('listing'\)/);
  });
});
