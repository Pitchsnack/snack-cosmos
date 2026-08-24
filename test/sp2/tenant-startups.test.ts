/**
 * Stage 6A — the two BFF operations the tenant journey needs to obtain a REAL
 * record reference: `listActiveTenantStartups` and `createActiveTenantStartup`.
 *
 * Both already existed on the BFF; nothing here is a new contract. What these
 * pins protect is the property that replaced the old hard-coded demo
 * reference: the browser never invents a tenant record reference, it reads one
 * the server minted. A decoder that accepted a bare array, or a create that
 * returned something without a `record_ref`, would put a fabricated reference
 * back into the journey by the back door.
 */
import { describe, expect, it } from "bun:test";
import { SnackPortalGatewayClient } from "../../src/lib/sp2/gateway-client";
import { DISPLAY_NAME_MAX, SHORT_DESCRIPTION_MAX } from "../../src/lib/sp2/dto";
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

const BASE = "https://bff.example";

const RECORD = {
  record_ref: "ref:acme:startups:1",
  display_name: "Northwind Analytics",
  short_description: null,
  investment_stage: null,
  record_origin: "tenant_direct",
  record_residency: "tenant",
  record_type: "startup",
  lineage_reference: null,
};

describe("GET /tenant/startups — listActiveTenantStartups", () => {
  it("sends the tenant bearer and the X-Tenant-Id carrier, and unwraps the envelope", async () => {
    const stub = fetchStub(
      () => new Response(JSON.stringify({ records: [RECORD] }), { status: 200 }),
    );
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    const out = await gw.listTenantStartups("TENANT_TOK", "acme");

    expect(out.kind).toBe("ok");
    if (out.kind === "ok") expect(out.data).toEqual([RECORD]);
    expect(stub.calls[0].method).toBe("GET");
    expect(stub.calls[0].url).toBe(`${BASE}/tenant/startups`);
    expect(stub.calls[0].headers["authorization"]).toBe("Bearer TENANT_TOK");
    expect(stub.calls[0].headers["x-tenant-id"]).toBe("acme");
  });

  it("an empty tenant is a lawful success, not an error", async () => {
    const stub = fetchStub(() => new Response(JSON.stringify({ records: [] }), { status: 200 }));
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    const out = await gw.listTenantStartups("T", "acme");
    expect(out.kind).toBe("ok");
    if (out.kind === "ok") expect(out.data).toEqual([]);
  });

  it.each([
    ["bare array", [RECORD]],
    ["object without records key", {}],
    ["records is a string", { records: "nope" }],
    ["records is an object", { records: {} }],
    ["entry is not an object", { records: [1] }],
    ["entry missing record_ref", { records: [{ display_name: "x" }] }],
    ["entry with an empty record_ref", { records: [{ record_ref: "", display_name: "x" }] }],
    ["entry with a non-string record_ref", { records: [{ record_ref: 7, display_name: "x" }] }],
    ["entry missing display_name", { records: [{ record_ref: "r1" }] }],
    ["null body", null],
    ["string body", "records"],
  ] as const)("invalid list envelope fails closed: %s", async (_label, body) => {
    const stub = fetchStub(() => new Response(JSON.stringify(body), { status: 200 }));
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    const out = await gw.listTenantStartups("T", "acme");
    expect(out.kind).toBe("unavailable");
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [503, "unavailable"],
  ] as const)("maps HTTP %s to %s", async (status, kind) => {
    const stub = fetchStub(() => new Response("{}", { status }));
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    const out = await gw.listTenantStartups("T", "acme");
    expect(out.kind).toBe(kind);
  });
});

describe("POST /tenant/startups — createActiveTenantStartup", () => {
  it("accepts the 201 the BFF answers with, and returns the server's record_ref", async () => {
    const stub = fetchStub(() => new Response(JSON.stringify(RECORD), { status: 201 }));
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    const out = await gw.createTenantStartup("TENANT_TOK", "acme", {
      display_name: "Northwind Analytics",
    });

    expect(out.kind).toBe("ok");
    if (out.kind === "ok") expect(out.data.record_ref).toBe(RECORD.record_ref);
    expect(stub.calls[0].method).toBe("POST");
    expect(stub.calls[0].url).toBe(`${BASE}/tenant/startups`);
    expect(stub.calls[0].headers["x-tenant-id"]).toBe("acme");
  });

  it("sends exactly the three client-supplied fields and nothing the server derives", async () => {
    const stub = fetchStub(() => new Response(JSON.stringify(RECORD), { status: 201 }));
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    await gw.createTenantStartup("T", "acme", { display_name: "Acme Robotics" });

    const body = stub.calls[0].body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      "display_name",
      "investment_stage",
      "short_description",
    ]);
    // No tenant, principal, role or permission may appear in a request body.
    for (const forbidden of ["tenant_id", "tenant", "principal_ref", "role", "actor_ref"]) {
      expect(forbidden in body).toBe(false);
    }
  });

  it("trims the display name before sending it", async () => {
    const stub = fetchStub(() => new Response(JSON.stringify(RECORD), { status: 201 }));
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    await gw.createTenantStartup("T", "acme", { display_name: "  Acme Robotics  " });
    expect((stub.calls[0].body as { display_name: string }).display_name).toBe("Acme Robotics");
  });

  it.each([
    ["empty", ""],
    ["whitespace only", "   "],
  ] as const)("refuses a %s display name without calling the network", async (_label, name) => {
    let called = 0;
    const stub = fetchStub(() => {
      called++;
      return new Response("{}", { status: 201 });
    });
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    const out = await gw.createTenantStartup("T", "acme", { display_name: name });
    expect(out.kind).toBe("too_large");
    expect(called).toBe(0);
  });

  it("refuses an over-bound display name without calling the network", async () => {
    let called = 0;
    const stub = fetchStub(() => {
      called++;
      return new Response("{}", { status: 201 });
    });
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    const out = await gw.createTenantStartup("T", "acme", {
      display_name: "x".repeat(DISPLAY_NAME_MAX + 1),
    });
    expect(out.kind).toBe("too_large");
    expect(called).toBe(0);
  });

  it("accepts exactly DISPLAY_NAME_MAX characters", async () => {
    const stub = fetchStub(() => new Response(JSON.stringify(RECORD), { status: 201 }));
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    const out = await gw.createTenantStartup("T", "acme", {
      display_name: "x".repeat(DISPLAY_NAME_MAX),
    });
    expect(out.kind).toBe("ok");
  });

  it("refuses an over-bound short description without calling the network", async () => {
    let called = 0;
    const stub = fetchStub(() => {
      called++;
      return new Response("{}", { status: 201 });
    });
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    const out = await gw.createTenantStartup("T", "acme", {
      display_name: "Acme",
      short_description: "x".repeat(SHORT_DESCRIPTION_MAX + 1),
    });
    expect(out.kind).toBe("too_large");
    expect(called).toBe(0);
  });

  it("does not auto-retry (single request) on 503", async () => {
    let called = 0;
    const stub = fetchStub(() => {
      called++;
      return new Response("{}", { status: 503 });
    });
    const gw = new SnackPortalGatewayClient({ baseUrl: BASE, fetchImpl: stub.impl });
    const out = await gw.createTenantStartup("T", "acme", { display_name: "Acme" });
    expect(out.kind).toBe("unavailable");
    expect(called).toBe(1);
  });
});

describe("the development mock serves the same two routes", () => {
  const tenantToken = `${MOCK_MARKERS.tenantPrefix}acme`;

  it("GET /tenant/startups is an envelope, never a bare array", async () => {
    const res = await mockGatewayFetch("http://mock/tenant/startups", {
      method: "GET",
      headers: { Authorization: `Bearer ${tenantToken}`, "X-Tenant-Id": "acme" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { records?: unknown };
    expect(Array.isArray(body)).toBe(false);
    expect(Array.isArray(body.records)).toBe(true);
  });

  it("the collection route is not read as an item reference", async () => {
    // `/tenant/startups` must not match the `/tenant/startups/{ref}` route with
    // ref = "startups"; that would answer 404 and strand the journey.
    const res = await mockGatewayFetch("http://mock/tenant/startups", {
      method: "GET",
      headers: { Authorization: `Bearer ${tenantToken}`, "X-Tenant-Id": "acme" },
    });
    expect(res.status).not.toBe(404);
  });

  it("a create is readable back through the item route, by the returned reference", async () => {
    const gw = new SnackPortalGatewayClient({
      baseUrl: "http://mock",
      fetchImpl: mockGatewayFetch as typeof fetch,
    });
    const created = await gw.createTenantStartup(tenantToken, "acme", {
      display_name: "Harbourline Robotics",
    });
    expect(created.kind).toBe("ok");
    if (created.kind !== "ok") return;

    const read = await gw.getTenantStartup(tenantToken, "acme", created.data.record_ref);
    expect(read.kind).toBe("ok");
    if (read.kind === "ok") expect(read.data.display_name).toBe("Harbourline Robotics");

    const listed = await gw.listTenantStartups(tenantToken, "acme");
    expect(listed.kind).toBe("ok");
    if (listed.kind === "ok") {
      expect(listed.data.map((r) => r.record_ref)).toContain(created.data.record_ref);
    }
  });

  it("the mock refuses the collection route without the tenant carrier and token", async () => {
    const noCarrier = await mockGatewayFetch("http://mock/tenant/startups", {
      method: "GET",
      headers: { Authorization: `Bearer ${tenantToken}` },
    });
    expect(noCarrier.status).toBe(403);

    const wrongToken = await mockGatewayFetch("http://mock/tenant/startups", {
      method: "GET",
      headers: { Authorization: `Bearer ${MOCK_MARKERS.principal}`, "X-Tenant-Id": "acme" },
    });
    expect(wrongToken.status).toBe(401);
  });
});
