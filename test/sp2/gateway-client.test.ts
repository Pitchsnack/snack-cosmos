import { describe, expect, it } from "bun:test";
import { SnackPortalGatewayClient } from "../../src/lib/sp2/gateway-client";
import { SHORT_DESCRIPTION_MAX } from "../../src/lib/sp2/dto";
import { mockGatewayFetch } from "../../src/lib/sp2/mock-gateway";
import { MOCK_MARKERS } from "../../src/lib/sp2/mock-auth-adapter";

type Call = { url: string; method: string; body: unknown; headers: Record<string, string> };

function fetchStub(responder: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v));
    const call: Call = {
      url: typeof input === "string" ? input : input.toString(),
      method: (init?.method ?? "GET").toUpperCase(),
      body: init?.body ? JSON.parse(init.body as string) : undefined,
      headers,
    };
    calls.push(call);
    return responder(call);
  }) as typeof fetch;
  return { impl, calls };
}

const BASE = "https://gateway.example";

describe("SnackPortalGatewayClient", () => {
  it("GET /memberships sends principal bearer and unwraps the envelope", async () => {
    const stub = fetchStub(
      () =>
        new Response(JSON.stringify({ memberships: [{ tenant_id: "acme", role: "editor" }] }), {
          status: 200,
        }),
    );
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    const out = await gw.listMemberships("PRINCIPAL_TOK");
    expect(out.kind).toBe("ok");
    if (out.kind === "ok") {
      expect(out.data).toEqual([{ tenant_id: "acme", role: "editor" }]);
    }
    expect(stub.calls[0].method).toBe("GET");
    expect(stub.calls[0].url).toBe(`${BASE}/memberships`);
    expect(stub.calls[0].headers["authorization"]).toBe("Bearer PRINCIPAL_TOK");
    expect(stub.calls[0].headers["x-tenant-id"]).toBeUndefined();
  });

  it("empty memberships envelope returns []", async () => {
    const stub = fetchStub(
      () => new Response(JSON.stringify({ memberships: [] }), { status: 200 }),
    );
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    const out = await gw.listMemberships("PRINCIPAL_TOK");
    expect(out.kind).toBe("ok");
    if (out.kind === "ok") {
      expect(Array.isArray(out.data)).toBe(true);
      expect(out.data).toEqual([]);
    }
  });

  it("non-empty memberships envelope returns the exact contained array", async () => {
    const wire = {
      memberships: [
        { tenant_id: "acme", role: "workspace_editor" },
        { tenant_id: "zeta", role: "workspace_viewer" },
      ],
    };
    const stub = fetchStub(() => new Response(JSON.stringify(wire), { status: 200 }));
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    const out = await gw.listMemberships("PRINCIPAL_TOK");
    expect(out.kind).toBe("ok");
    if (out.kind === "ok") expect(out.data).toEqual(wire.memberships);
  });

  it("bare-array memberships body is not a lawful envelope and fails closed", async () => {
    const stub = fetchStub(
      () =>
        new Response(JSON.stringify([{ tenant_id: "acme", role: "editor" }]), {
          status: 200,
        }),
    );
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    const out = await gw.listMemberships("PRINCIPAL_TOK");
    expect(out.kind).toBe("unavailable");
  });

  it.each([
    ["object without memberships key", {}],
    ["memberships is a string", { memberships: "nope" }],
    ["memberships is an object", { memberships: {} }],
    ["memberships entry is not an object", { memberships: [1] }],
    ["memberships entry missing role", { memberships: [{ tenant_id: "acme" }] }],
    ["memberships entry with non-string tenant_id", { memberships: [{ tenant_id: 7, role: "r" }] }],
    ["null body", null],
    ["string body", "memberships"],
  ] as const)("invalid memberships envelope fails closed: %s", async (_label, body) => {
    const stub = fetchStub(() => new Response(JSON.stringify(body), { status: 200 }));
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    const out = await gw.listMemberships("PRINCIPAL_TOK");
    expect(out.kind).toBe("unavailable");
  });

  it("mock Gateway serves /memberships as the real envelope, never a bare array", async () => {
    const res = await mockGatewayFetch("http://mock/memberships", {
      method: "GET",
      headers: { Authorization: `Bearer ${MOCK_MARKERS.principal}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { memberships?: unknown };
    expect(Array.isArray(body)).toBe(false);
    expect(Array.isArray(body.memberships)).toBe(true);
  });

  it("gateway-client decodes the mock Gateway envelope end-to-end", async () => {
    const gw = new SnackPortalGatewayClient({
      baseUrl: "http://mock",
      fetchImpl: mockGatewayFetch as typeof fetch,
    });
    const out = await gw.listMemberships(MOCK_MARKERS.principal);
    expect(out.kind).toBe("ok");
    if (out.kind === "ok") {
      expect(Array.isArray(out.data)).toBe(true);
      expect(out.data.length).toBeGreaterThan(0);
      expect(typeof out.data[0].tenant_id).toBe("string");
    }
  });

  it("GET tenant startup sends X-Tenant-Id header and tenant token", async () => {
    const stub = fetchStub(
      () => new Response(JSON.stringify({ record_ref: "r1" }), { status: 200 }),
    );
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    await gw.getTenantStartup("TENANT_TOK", "acme", "r1");
    expect(stub.calls[0].url).toBe(`${BASE}/tenant/startups/r1`);
    expect(stub.calls[0].headers["authorization"]).toBe("Bearer TENANT_TOK");
    expect(stub.calls[0].headers["x-tenant-id"]).toBe("acme");
  });

  it("PATCH sends exactly { short_description } and no extra fields", async () => {
    const stub = fetchStub(
      () =>
        new Response(JSON.stringify({ record_ref: "r1", short_description: "x" }), { status: 200 }),
    );
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    await gw.updateTenantStartup("T", "acme", "r1", { short_description: "hello" });
    expect(stub.calls[0].method).toBe("PATCH");
    expect(Object.keys(stub.calls[0].body as object)).toEqual(["short_description"]);
    expect((stub.calls[0].body as { short_description: string }).short_description).toBe("hello");
  });

  it("PATCH allows explicit null", async () => {
    const stub = fetchStub(
      () => new Response(JSON.stringify({ record_ref: "r1" }), { status: 200 }),
    );
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    await gw.updateTenantStartup("T", "acme", "r1", { short_description: null });
    expect(
      (stub.calls[0].body as { short_description: string | null }).short_description,
    ).toBeNull();
  });

  it("PATCH rejects over-limit client-side with too_large without calling network", async () => {
    let called = 0;
    const stub = fetchStub(() => {
      called++;
      return new Response("{}", { status: 200 });
    });
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    const out = await gw.updateTenantStartup("T", "acme", "r1", {
      short_description: "x".repeat(SHORT_DESCRIPTION_MAX + 1),
    });
    expect(out.kind).toBe("too_large");
    expect(called).toBe(0);
  });

  it("PATCH accepts exactly SHORT_DESCRIPTION_MAX characters", async () => {
    const stub = fetchStub(
      () => new Response(JSON.stringify({ record_ref: "r1" }), { status: 200 }),
    );
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    const out = await gw.updateTenantStartup("T", "acme", "r1", {
      short_description: "x".repeat(SHORT_DESCRIPTION_MAX),
    });
    expect(out.kind).toBe("ok");
  });

  it("PATCH does not auto-retry on 503 (single request)", async () => {
    let called = 0;
    const stub = fetchStub(() => {
      called++;
      return new Response("{}", { status: 503 });
    });
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    const out = await gw.updateTenantStartup("T", "acme", "r1", { short_description: "x" });
    expect(out.kind).toBe("unavailable");
    expect(called).toBe(1);
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [413, "too_large"],
    [503, "unavailable"],
  ] as const)("maps status %i to %s", async (status, kind) => {
    const stub = fetchStub(() => new Response("{}", { status }));
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    const out = await gw.getTenantStartup("T", "acme", "r1");
    expect(out.kind).toBe(kind);
  });

  it("maps fetch throw to network_error", async () => {
    const impl = (async () => {
      throw new Error("boom");
    }) as typeof fetch;
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: impl });
    const out = await gw.listMemberships("T");
    expect(out.kind).toBe("network_error");
  });
});
