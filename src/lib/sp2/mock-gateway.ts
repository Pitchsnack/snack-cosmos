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
