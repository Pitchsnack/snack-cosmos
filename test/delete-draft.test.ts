import { describe, expect, it } from "vitest";
import {
  advisorNdaIsActive,
  advisorNeverSubmitted,
  buyerNeverSubmitted,
  draftDeleteDecision,
  invitationIsActive,
  pipelineIsActive,
  startupNeverSubmitted,
} from "@/lib/delete-draft";

describe("draftDeleteDecision", () => {
  it("allows a never-submitted draft with no active deals or NDAs", () => {
    expect(draftDeleteDecision({ neverSubmitted: true, activeDealsOrNdas: false })).toEqual({ deletable: true, reason: null });
  });
  it("blocks a profile that was submitted before, with the submitted reason", () => {
    expect(draftDeleteDecision({ neverSubmitted: false, activeDealsOrNdas: false })).toEqual({ deletable: false, reason: "submitted" });
  });
  it("blocks a draft with an active NDA or deal, with the active reason", () => {
    expect(draftDeleteDecision({ neverSubmitted: true, activeDealsOrNdas: true })).toEqual({ deletable: false, reason: "active" });
  });
  it("reports submitted before active when both apply", () => {
    expect(draftDeleteDecision({ neverSubmitted: false, activeDealsOrNdas: true })).toEqual({ deletable: false, reason: "submitted" });
  });
});

describe("startupNeverSubmitted", () => {
  it("treats a missing hidden profile as a draft", () => {
    expect(startupNeverSubmitted(null)).toBe(true);
  });
  it("allows approval_status draft with no submitted_at", () => {
    expect(startupNeverSubmitted({ approval_status: "draft", submitted_at: null })).toBe(true);
  });
  it("blocks a draft that was submitted before (submitted_at set)", () => {
    expect(startupNeverSubmitted({ approval_status: "draft", submitted_at: "2026-10-01T00:00:00Z" })).toBe(false);
  });
  it.each(["in_review", "resubmitted", "live", "live_edits_pending", "unpublished", "changes_requested", "not_approved"])(
    "blocks approval_status %s",
    (status) => {
      expect(startupNeverSubmitted({ approval_status: status, submitted_at: null })).toBe(false);
    },
  );
});

describe("buyerNeverSubmitted", () => {
  it("allows a draft account row with no verification submission", () => {
    expect(buyerNeverSubmitted({ approval_status: "draft", submitted_at: null }, null)).toBe(true);
  });
  it("blocks when the account row was submitted", () => {
    expect(buyerNeverSubmitted({ approval_status: "in_review", submitted_at: "2026-10-01T00:00:00Z" }, null)).toBe(false);
  });
  it("blocks when the investor verification row was submitted", () => {
    expect(buyerNeverSubmitted({ approval_status: "draft", submitted_at: null }, { submitted_at: "2026-10-01T00:00:00Z" })).toBe(false);
  });
});

describe("advisorNeverSubmitted", () => {
  it("allows a draft firm never sent for verification", () => {
    expect(advisorNeverSubmitted({ status: "draft", advisor_verification: "unverified", verification_requested_at: null })).toBe(true);
  });
  it("blocks a firm sent for verification (verification_requested_at set)", () => {
    expect(advisorNeverSubmitted({ status: "draft", advisor_verification: "pending", verification_requested_at: "2026-10-01T00:00:00Z" })).toBe(false);
  });
  it("blocks a live or paused firm", () => {
    expect(advisorNeverSubmitted({ status: "live", advisor_verification: "verified", verification_requested_at: "2026-10-01T00:00:00Z" })).toBe(false);
    expect(advisorNeverSubmitted({ status: "paused", advisor_verification: "verified", verification_requested_at: null })).toBe(false);
  });
});

describe("active deal and NDA predicates", () => {
  it("treats open pipeline deals as active", () => {
    expect(pipelineIsActive({ status: "active", ended_at: null })).toBe(true);
    expect(pipelineIsActive({ status: "nda_requested", ended_at: null })).toBe(true);
  });
  it.each(["withdrawn", "declined", "ended", "revoked"])("treats %s deals as inactive", (status) => {
    expect(pipelineIsActive({ status, ended_at: null })).toBe(false);
  });
  it("treats any deal with ended_at as inactive", () => {
    expect(pipelineIsActive({ status: "active", ended_at: "2026-10-01T00:00:00Z" })).toBe(false);
  });
  it("treats an open listing invitation as active and a closed one as inactive", () => {
    expect(invitationIsActive({ closed_at: null })).toBe(true);
    expect(invitationIsActive({ closed_at: "2026-10-01T00:00:00Z" })).toBe(false);
  });
  it("treats a signed unexpired advisor NDA as active", () => {
    const now = Date.parse("2026-10-31T00:00:00Z");
    expect(advisorNdaIsActive({ signed_at: "2026-10-01T00:00:00Z", expires_at: null }, now)).toBe(true);
    expect(advisorNdaIsActive({ signed_at: "2026-10-01T00:00:00Z", expires_at: "2027-10-01T00:00:00Z" }, now)).toBe(true);
    expect(advisorNdaIsActive({ signed_at: "2026-10-01T00:00:00Z", expires_at: "2026-10-15T00:00:00Z" }, now)).toBe(false);
    expect(advisorNdaIsActive({ signed_at: null, expires_at: null }, now)).toBe(false);
  });
});
