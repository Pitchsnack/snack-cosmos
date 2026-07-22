/**
 * Typed SnackPortal2 Gateway client (PRD §5).
 *
 * - One logical origin: import.meta.env.VITE_SP2_GATEWAY_BASE_URL.
 * - Never exposes DSN, SecretRef, database hostname/name, or router mapping.
 * - Never auto-retries PATCH.
 * - Never persists protected business data.
 * - Never logs authorization headers or tokens.
 */
import {
  type GatewayOutcome,
  type TenantStartupDetailDTO,
  type TenantStartupUpdateRequestDTO,
  type WorkspaceMembershipDTO,
  SHORT_DESCRIPTION_MAX,
} from "./dto";

export interface GatewayClientOptions {
  baseUrl: string;
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export class SnackPortalGatewayClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: GatewayClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async listMemberships(
    principalToken: string,
  ): Promise<GatewayOutcome<WorkspaceMembershipDTO[]>> {
    return this.request<WorkspaceMembershipDTO[]>({
      method: "GET",
      path: "/memberships",
      token: principalToken,
    });
  }

  async getTenantStartup(
    tenantToken: string,
    tenantId: string,
    startupRef: string,
  ): Promise<GatewayOutcome<TenantStartupDetailDTO>> {
    return this.request<TenantStartupDetailDTO>({
      method: "GET",
      path: `/tenant/startups/${encodeURIComponent(startupRef)}`,
      token: tenantToken,
      tenantId,
    });
  }

  async updateTenantStartup(
    tenantToken: string,
    tenantId: string,
    startupRef: string,
    request: TenantStartupUpdateRequestDTO,
  ): Promise<GatewayOutcome<TenantStartupDetailDTO>> {
    // Client-side bound guard mirrors backend rule; no auto-retry on PATCH.
    if (
      request.short_description !== null &&
      request.short_description.length > SHORT_DESCRIPTION_MAX
    ) {
      return { kind: "too_large" };
    }
    // Exact body closure — no extra fields allowed.
    const body: TenantStartupUpdateRequestDTO = {
      short_description: request.short_description,
    };
    return this.request<TenantStartupDetailDTO>({
      method: "PATCH",
      path: `/tenant/startups/${encodeURIComponent(startupRef)}`,
      token: tenantToken,
      tenantId,
      body,
    });
  }

  private async request<T>(args: {
    method: "GET" | "PATCH";
    path: string;
    token: string;
    tenantId?: string;
    body?: unknown;
  }): Promise<GatewayOutcome<T>> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${args.token}`,
      Accept: "application/json",
    };
    if (args.tenantId) headers["X-Tenant-Id"] = args.tenantId;
    if (args.body !== undefined) headers["Content-Type"] = "application/json";

    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${args.path}`, {
        method: args.method,
        headers,
        body: args.body !== undefined ? JSON.stringify(args.body) : undefined,
        // Never cache protected business data (PRD §5).
        cache: "no-store",
        credentials: "omit",
      });
    } catch {
      return { kind: "network_error" };
    }

    if (res.status === 401) return { kind: "unauthorized" };
    if (res.status === 403) return { kind: "forbidden" };
    if (res.status === 404) return { kind: "not_found" };
    if (res.status === 413) return { kind: "too_large" };
    if (res.status === 503) return { kind: "unavailable" };
    if (!res.ok) return { kind: "unavailable" };

    try {
      const data = (await res.json()) as T;
      return { kind: "ok", data };
    } catch {
      return { kind: "unavailable" };
    }
  }
}

export function getGatewayBaseUrl(): string {
  const v = import.meta.env.VITE_SP2_GATEWAY_BASE_URL as string | undefined;
  return (v && v.trim()) || "/sp2-gateway-mock";
}
