import { describe, expect, it } from "bun:test";
import { SnackPortalGatewayClient } from "../../src/lib/sp2/gateway-client";
import { SHORT_DESCRIPTION_MAX } from "../../src/lib/sp2/dto";

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
  it("GET /memberships sends principal bearer and returns list", async () => {
    const stub = fetchStub(() => new Response(JSON.stringify([{ tenant_id: "acme", role: "editor" }]), { status: 200 }));
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    const out = await gw.listMemberships("PRINCIPAL_TOK");
    expect(out.kind).toBe("ok");
    if (out.kind === "ok") expect(out.data[0].tenant_id).toBe("acme");
    expect(stub.calls[0].url).toBe(`${BASE}/memberships`);
    expect(stub.calls[0].headers["authorization"]).toBe("Bearer PRINCIPAL_TOK");
    expect(stub.calls[0].headers["x-tenant-id"]).toBeUndefined();
  });

  it("GET tenant startup sends X-Tenant-Id header and tenant token", async () => {
    const stub = fetchStub(() => new Response(JSON.stringify({ record_ref: "r1" }), { status: 200 }));
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    await gw.getTenantStartup("TENANT_TOK", "acme", "r1");
    expect(stub.calls[0].url).toBe(`${BASE}/tenant/startups/r1`);
    expect(stub.calls[0].headers["authorization"]).toBe("Bearer TENANT_TOK");
    expect(stub.calls[0].headers["x-tenant-id"]).toBe("acme");
  });

  it("PATCH sends exactly { short_description } and no extra fields", async () => {
    const stub = fetchStub(() => new Response(JSON.stringify({ record_ref: "r1", short_description: "x" }), { status: 200 }));
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    await gw.updateTenantStartup("T", "acme", "r1", { short_description: "hello" });
    expect(stub.calls[0].method).toBe("PATCH");
    expect(Object.keys(stub.calls[0].body as object)).toEqual(["short_description"]);
    expect((stub.calls[0].body as { short_description: string }).short_description).toBe("hello");
  });

  it("PATCH allows explicit null", async () => {
    const stub = fetchStub(() => new Response(JSON.stringify({ record_ref: "r1" }), { status: 200 }));
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    await gw.updateTenantStartup("T", "acme", "r1", { short_description: null });
    expect((stub.calls[0].body as { short_description: string | null }).short_description).toBeNull();
  });

  it("PATCH rejects over-limit client-side with too_large without calling network", async () => {
    let called = 0;
    const stub = fetchStub(() => { called++; return new Response("{}", { status: 200 }); });
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    const out = await gw.updateTenantStartup("T", "acme", "r1", {
      short_description: "x".repeat(SHORT_DESCRIPTION_MAX + 1),
    });
    expect(out.kind).toBe("too_large");
    expect(called).toBe(0);
  });

  it("PATCH accepts exactly SHORT_DESCRIPTION_MAX characters", async () => {
    const stub = fetchStub(() => new Response(JSON.stringify({ record_ref: "r1" }), { status: 200 }));
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    const out = await gw.updateTenantStartup("T", "acme", "r1", {
      short_description: "x".repeat(SHORT_DESCRIPTION_MAX),
    });
    expect(out.kind).toBe("ok");
  });

  it("PATCH does not auto-retry on 503 (single request)", async () => {
    let called = 0;
    const stub = fetchStub(() => { called++; return new Response("{}", { status: 503 }); });
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
    const impl = (async () => { throw new Error("boom"); }) as typeof fetch;
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: impl });
    const out = await gw.listMemberships("T");
    expect(out.kind).toBe("network_error");
  });
});
