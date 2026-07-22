/**
 * SnackPortalAuthAdapter — the ONLY authentication boundary used by the
 * Lovable controlled-MVP journey (login → memberships → workspace → tenant
 * Startup read/edit → logout).
 *
 * Rules (PRD §4):
 *  - Lovable never mints or exchanges a tenant token.
 *  - Tokens must never be written to localStorage, URLs, logs, analytics,
 *    error messages, or repository files.
 *  - The real implementation redirects to controlled-local Keycloak.
 *  - X-Tenant-Id alone is NEVER authorization.
 */
export interface SnackPortalAuthAdapter {
  /**
   * Kicks off principal (IdP) authentication. The real implementation
   * redirects the browser to the Keycloak authorization endpoint
   * (Authorization Code + PKCE S256) and therefore does not complete
   * in-page; the mock flips its in-memory flag.
   */
  beginPrincipalAuthentication(): Promise<void>;
  /** Principal-only OIDC access token for GET /memberships. */
  getPrincipalAccessToken(): Promise<string | null>;
  /** Kicks off IdP redirect that mints a tenant-scoped token. */
  beginWorkspaceAuthentication(tenantId: string): Promise<void>;
  /** IdP-minted, tenant-scoped OIDC access token; null when unavailable. */
  getTenantAccessToken(tenantId: string): Promise<string | null>;
  /** Clear in-memory session state and present logout UI. */
  logout(): Promise<void>;
}
