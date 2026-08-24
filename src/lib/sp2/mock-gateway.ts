/**
 * Preview-only in-memory Gateway. Used when VITE_SP2_GATEWAY_BASE_URL is
 * unset. Emulates the frozen backend contract for the controlled MVP.
 * Not shipped as a network transport; wired via a fetch shim.
 */
import type { TenantStartupDetailDTO, WorkspaceMembershipDTO } from "./dto";
import { MOCK_MARKERS } from "./mock-auth-adapter";

export const MOCK_DEMO_STARTUP_REF = "stp_demo_001";

const memberships: WorkspaceMembershipDTO[] = [{ tenant_id: "acme", role: "workspace_editor" }];

const startups: Record<string, Record<string, TenantStartupDetailDTO>> = {
  acme: {
    stp_demo_001: {
      record_ref: "stp_demo_001",
      display_name: "Northwind Robotics",
      short_description: "Autonomous last-mile logistics for cold-chain deliveries.",
      investment_stage: "seed",
      record_origin: "tenant_direct",
      record_residency: "tenant",
      record_type: "startup",
      lineage_reference: null,
    },
  },
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function mockGatewayFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input.toString(), "http://mock");
  const auth = new Headers(init?.headers).get("Authorization") ?? "";
  const tenantHeader = new Headers(init?.headers).get("X-Tenant-Id") ?? "";
  const method = (init?.method ?? "GET").toUpperCase();

  if (url.pathname.endsWith("/memberships") && method === "GET") {
    if (auth !== `Bearer ${MOCK_MARKERS.principal}`) return json(401, {});
    // Lawful wire contract: envelope, never a bare array.
    return json(200, { memberships });
  }

  // The COLLECTION routes, matched before the item route so `/tenant/startups`
  // is never read as an item reference.
  if (url.pathname.endsWith("/tenant/startups")) {
    const expectedToken = `Bearer ${MOCK_MARKERS.tenantPrefix}${tenantHeader}`;
    if (!tenantHeader) return json(403, {});
    if (auth !== expectedToken) return json(401, {});
    const tenantStore = startups[tenantHeader];
    if (!tenantStore) return json(403, {});

    if (method === "GET") {
      // Envelope, never a bare array — the same wire contract the BFF serves.
      return json(200, { records: Object.values(tenantStore) });
    }
    if (method === "POST") {
      try {
        const body = JSON.parse((init?.body as string) ?? "{}") as {
          display_name?: unknown;
          short_description?: unknown;
          investment_stage?: unknown;
        };
        const name = typeof body.display_name === "string" ? body.display_name.trim() : "";
        if (name.length === 0 || name.length > 256) return json(422, {});
        const description =
          typeof body.short_description === "string" ? body.short_description : null;
        if (description !== null && description.length > 500) return json(422, {});
        const ref = `stp_mock_${String(Object.keys(tenantStore).length + 1).padStart(3, "0")}`;
        const created: TenantStartupDetailDTO = {
          record_ref: ref,
          display_name: name,
          short_description: description,
          investment_stage:
            typeof body.investment_stage === "string" ? body.investment_stage : null,
          record_origin: "tenant_direct",
          record_residency: "tenant",
          record_type: "startup",
          lineage_reference: null,
        };
        tenantStore[ref] = created;
        // 201, exactly as `createActiveTenantStartup` answers.
        return json(201, created);
      } catch {
        return json(400, {});
      }
    }
    return json(503, {});
  }

  const startupMatch = url.pathname.match(/\/tenant\/startups\/([^/]+)$/);
  if (startupMatch) {
    const ref = decodeURIComponent(startupMatch[1]);
    const expectedToken = `Bearer ${MOCK_MARKERS.tenantPrefix}${tenantHeader}`;
    if (!tenantHeader) return json(403, {});
    if (auth !== expectedToken) return json(401, {});
    const tenantStore = startups[tenantHeader];
    if (!tenantStore) return json(403, {});
    const record = tenantStore[ref];
    if (!record) return json(404, {});

    if (method === "GET") return json(200, record);
    if (method === "PATCH") {
      try {
        const body = JSON.parse((init?.body as string) ?? "{}") as {
          short_description?: string | null;
        };
        if (!("short_description" in body)) return json(400, {});
        const next = body.short_description ?? null;
        if (next !== null && next.length > 500) return json(413, {});
        const updated = { ...record, short_description: next };
        tenantStore[ref] = updated;
        return json(200, updated);
      } catch {
        return json(400, {});
      }
    }
  }
  return json(503, {});
}
