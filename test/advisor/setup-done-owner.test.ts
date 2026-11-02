import { describe, expect, test } from "bun:test";
import { shouldProtectSetupDone } from "../../src/lib/advisor-setup-completion";

const OWNER = "d4e90f3f-9630-4af7-833b-6c15a1670b27";
const OTHER = "11111111-2222-3333-4444-555555555555";

describe("Advisor setup-completion guard", () => {
  test("the owner's own save is never stripped of its setup_done_at stamp", () => {
    expect(shouldProtectSetupDone(OWNER, OWNER)).toBe(false);
  });
  test("editing someone else's firm is protected", () => {
    expect(shouldProtectSetupDone(OTHER, OWNER)).toBe(true);
  });
  test("a brand-new firm with no stored owner is not protected", () => {
    expect(shouldProtectSetupDone(null, OWNER)).toBe(false);
    expect(shouldProtectSetupDone(undefined, OWNER)).toBe(false);
  });
});
