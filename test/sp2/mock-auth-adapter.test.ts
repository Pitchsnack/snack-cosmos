import { describe, expect, it } from "bun:test";
import { MockSnackPortalAuthAdapter } from "../../src/lib/sp2/mock-auth-adapter";

describe("MockSnackPortalAuthAdapter", () => {
  it("returns null tokens before sign-in", async () => {
    const a = new MockSnackPortalAuthAdapter();
    expect(await a.getPrincipalAccessToken()).toBeNull();
    expect(await a.getTenantAccessToken("acme")).toBeNull();
  });

  it("returns a principal marker after sign-in", async () => {
    const a = new MockSnackPortalAuthAdapter();
    await a.signIn();
    const tok = await a.getPrincipalAccessToken();
    expect(tok).toBeTruthy();
    // Marker must not be JWT-shaped; must not resemble a real bearer.
    expect(tok!.split(".").length).toBe(1);
  });

  it("does not mint a tenant token until beginWorkspaceAuthentication", async () => {
    const a = new MockSnackPortalAuthAdapter();
    await a.signIn();
    expect(await a.getTenantAccessToken("acme")).toBeNull();
    await a.beginWorkspaceAuthentication("acme");
    expect(await a.getTenantAccessToken("acme")).toContain("acme");
  });

  it("logout clears principal and tenant tokens", async () => {
    const a = new MockSnackPortalAuthAdapter({ authorizedTenants: new Set(["acme"]) });
    await a.signIn();
    await a.logout();
    expect(await a.getPrincipalAccessToken()).toBeNull();
    expect(await a.getTenantAccessToken("acme")).toBeNull();
  });

  it("does not write tokens to localStorage", async () => {
    const store: Record<string, string> = {};
    const g = globalThis as unknown as { localStorage?: Storage };
    g.localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      key: () => null,
      length: 0,
    } as Storage;
    const a = new MockSnackPortalAuthAdapter();
    await a.signIn();
    await a.beginWorkspaceAuthentication("acme");
    await a.getPrincipalAccessToken();
    await a.getTenantAccessToken("acme");
    expect(Object.keys(store)).toHaveLength(0);
  });
});
