/**
 * Preview/test-only mock adapter. Isolated from real runtime.
 *
 * Contains NO bearer token and NO private key. It emits opaque, non-secret
 * marker strings that the mock Gateway (or MSW) can match on. These markers
 * are not JWTs, are not accepted by any real service, and never leave the
 * in-memory adapter instance.
 */
import type { SnackPortalAuthAdapter } from "./auth-adapter";

const MOCK_PRINCIPAL_MARKER = "mock-principal-marker";
const MOCK_TENANT_MARKER_PREFIX = "mock-tenant-marker:";

export interface MockAdapterState {
  signedIn: boolean;
  authorizedTenants: Set<string>;
  principalUnavailable: boolean;
  membershipUnavailable: boolean;
}

export class MockSnackPortalAuthAdapter implements SnackPortalAuthAdapter {
  state: MockAdapterState;

  constructor(init?: Partial<MockAdapterState>) {
    this.state = {
      signedIn: false,
      authorizedTenants: new Set<string>(),
      principalUnavailable: false,
      membershipUnavailable: false,
      ...init,
    };
  }

  async signIn(): Promise<void> {
    this.state.signedIn = true;
  }

  async beginPrincipalAuthentication(): Promise<void> {
    // Mechanical parity with the additive interface member: the mock
    // "authenticates" by flipping its in-memory flag. No redirect, no
    // network, no storage — the development-only safety posture is unchanged.
    this.state.signedIn = true;
  }

  async getPrincipalAccessToken(): Promise<string | null> {
    if (!this.state.signedIn || this.state.principalUnavailable) return null;
    return MOCK_PRINCIPAL_MARKER;
  }

  async beginWorkspaceAuthentication(tenantId: string): Promise<void> {
    // A real adapter would redirect. The mock records the authorization
    // synchronously so the tenant token becomes available on next read.
    if (!this.state.signedIn) return;
    this.state.authorizedTenants.add(tenantId);
  }

  async getTenantAccessToken(tenantId: string): Promise<string | null> {
    if (!this.state.signedIn) return null;
    if (!this.state.authorizedTenants.has(tenantId)) return null;
    return `${MOCK_TENANT_MARKER_PREFIX}${tenantId}`;
  }

  async logout(): Promise<void> {
    this.state.signedIn = false;
    this.state.authorizedTenants.clear();
  }
}

export const MOCK_MARKERS = {
  principal: MOCK_PRINCIPAL_MARKER,
  tenantPrefix: MOCK_TENANT_MARKER_PREFIX,
};
