import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { APP_EMAIL_IDENTITY } from "../../src/config/email-identity";

describe("automatic email identity", () => {
  it("keeps the approved addresses", () => {
    expect(APP_EMAIL_IDENTITY.sender).toBe("noreply@notify.pitchsnack.com");
    expect(APP_EMAIL_IDENTITY.replyTo).toBe("support@pitchsnack.com");
  });

  it("enforces reply-to centrally, including account emails", () => {
    const sender = readFileSync("src/lib/email-templates/send-email.ts", "utf8");
    const auth = readFileSync("src/routes/lovable/email/auth/webhook.ts", "utf8");
    expect(sender).toContain("reply_to: APP_EMAIL_IDENTITY.replyTo");
    expect(sender).not.toContain("options.replyTo");
    expect(sender).toContain('const FROM_DOMAIN = "notify.pitchsnack.com"');
    expect(auth).toContain("replyTo: APP_EMAIL_IDENTITY.replyTo");
  });

  it("shows the same identity in Admin Sending rules", () => {
    const rules = readFileSync("src/routes/_authenticated/email-alerts.tsx", "utf8");
    expect(rules).toContain("APP_EMAIL_IDENTITY.sender");
    expect(rules).toContain("APP_EMAIL_IDENTITY.replyTo");
  });
});