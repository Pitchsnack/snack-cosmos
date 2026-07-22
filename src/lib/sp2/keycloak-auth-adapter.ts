/**
 * KeycloakSnackPortalAuthAdapter — the REAL SnackPortalAuthAdapter for the
 * controlled-local Keycloak proof (Authorization Code + PKCE S256).
 *
 * Security rails (corrective START-GATE §6–§11):
 *  - Public browser client. No client secret exists anywhere in this module,
 *    in any request it constructs, or in any storage it touches.
 *  - Access tokens live in adapter/module MEMORY ONLY. They are never written
 *    to localStorage, sessionStorage, cookies, IndexedDB, Cache Storage,
 *    URLs, logs, or analytics. A page reload therefore requires
 *    re-authentication — acceptable for the controlled-local proof.
 *  - sessionStorage is used ONLY for the transient PKCE transaction
 *    (state, verifier, timestamp, return path) under one namespaced key.
 *    The transaction is single-use, expires after 10 minutes, and is deleted
 *    on success, on callback failure, and on logout. The cryptographically
 *    random `state` doubles as the one-time transaction identifier.
 *  - ID tokens and refresh tokens returned by Keycloak are IGNORED — never
 *    read into adapter state, never persisted. No refresh flow exists.
 *  - Tenant-scoped authentication is explicitly UNSUPPORTED in this slice
 *    (IC-005 R1 principal-only bootstrap): beginWorkspaceAuthentication()
 *    fails closed with a typed error and getTenantAccessToken() returns null.
 *    No tenant token is fabricated; X-Tenant-Id is never authorization.
 *  - The browser never treats decoded token claims as authorization. The
 *    SnackPortal2 Gateway remains the token-validation authority; Keycloak
 *    performs the browser code exchange (the Gateway never mints/exchanges).
 *  - Implemented with browser WebCrypto and standard fetch only — zero
 *    dependencies added.
 */
import type { SnackPortalAuthAdapter } from "./auth-adapter";

/** Typed, explicit fail-closed error for the unsupported tenant flow. */
export class TenantAuthenticationUnsupportedError extends Error {
  readonly code = "SP2_TENANT_AUTHENTICATION_UNSUPPORTED" as const;

  constructor() {
    super(
      "Tenant-scoped authentication is not supported in this slice (principal-only IC-005 R1 bootstrap).",
    );
    this.name = "TenantAuthenticationUnsupportedError";
  }
}

/** Exact namespaced sessionStorage key for the transient PKCE transaction. */
export const PKCE_TRANSACTION_STORAGE_KEY = "sp2.oidc.pkce.txn.v1";

/** Maximum transient PKCE transaction lifetime (START-GATE §8): 10 minutes. */
export const PKCE_TRANSACTION_MAX_AGE_MS = 10 * 60 * 1000;

/** The ONLY values authorized to enter sessionStorage (START-GATE §8). */
interface PkceTransaction {
  state: string;
  verifier: string;
  createdAt: number;
  returnPath: string;
}

/** Minimal storage surface so tests can inject a deterministic double. */
export interface TransientTransactionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** In-memory principal token holder. Never serialized, never persisted. */
export interface PrincipalTokenStore {
  accessToken: string | null;
  expiresAtEpochMs: number | null;
}

/** Module-memory store shared between the callback route and the journey
 *  route so an SPA navigation keeps the just-acquired token. A full page
 *  reload clears it by construction (memory only). */
const sharedPrincipalTokenStore: PrincipalTokenStore = {
  accessToken: null,
  expiresAtEpochMs: null,
};

export function createInMemoryPrincipalTokenStore(): PrincipalTokenStore {
  return { accessToken: null, expiresAtEpochMs: null };
}

export interface KeycloakAdapterConfig {
  /** Absolute issuer URL — loopback HTTP (controlled-local) or HTTPS. */
  issuer: string;
  /** Public OIDC client id. Public value; there is no client secret. */
  clientId: string;
  /** Exact configured callback URL (must match the Keycloak client). */
  redirectUri: string;
  /** Optional post-logout redirect target. */
  postLogoutRedirectUri: string | null;
}

/**
 * Injectable seams for deterministic tests (START-GATE §13: fetch, location,
 * storage, and WebCrypto test doubles — no live Keycloak in this stage).
 * Every default is the standard browser facility.
 */
export interface KeycloakAdapterDeps {
  fetchImpl?: typeof fetch;
  storage?: TransientTransactionStorage;
  redirect?: (url: string) => void;
  replaceHistoryState?: (path: string) => void;
  now?: () => number;
  randomBytes?: (length: number) => Uint8Array;
  sha256?: (bytes: Uint8Array) => Promise<ArrayBuffer>;
  currentPath?: () => string;
  tokenStore?: PrincipalTokenStore;
}

export type CallbackFailureReason =
  | "invalid_callback_url"
  | "missing_transaction"
  | "invalid_transaction"
  | "expired_transaction"
  | "provider_error"
  | "state_mismatch"
  | "missing_code"
  | "exchange_failed"
  | "invalid_token_response";

export type CallbackResult =
  | { ok: true; returnPath: string }
  | { ok: false; reason: CallbackFailureReason };

/** base64url without padding (RFC 4648 §5), as PKCE requires. */
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Only same-origin absolute paths may be used as a post-login return. */
function sanitizeReturnPath(candidate: unknown): string {
  if (typeof candidate === "string" && candidate.startsWith("/") && !candidate.startsWith("//")) {
    return candidate;
  }
  return "/sp2-gateway";
}

export class KeycloakSnackPortalAuthAdapter implements SnackPortalAuthAdapter {
  private readonly config: KeycloakAdapterConfig;
  private readonly deps: KeycloakAdapterDeps;
  private readonly tokenStore: PrincipalTokenStore;

  constructor(config: KeycloakAdapterConfig, deps: KeycloakAdapterDeps = {}) {
    this.config = { ...config, issuer: config.issuer.replace(/\/+$/, "") };
    this.deps = deps;
    this.tokenStore = deps.tokenStore ?? sharedPrincipalTokenStore;
  }

  // -- default seams (resolved lazily so SSR never touches window) ----------

  private get fetchImpl(): typeof fetch {
    return this.deps.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
  }

  private get storage(): TransientTransactionStorage {
    return this.deps.storage ?? window.sessionStorage;
  }

  private redirect(url: string): void {
    (this.deps.redirect ?? ((u: string) => window.location.assign(u)))(url);
  }

  private replaceHistoryState(path: string): void {
    (this.deps.replaceHistoryState ?? ((p: string) => window.history.replaceState(null, "", p)))(
      path,
    );
  }

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }

  private randomBytes(length: number): Uint8Array {
    const generate =
      this.deps.randomBytes ?? ((n: number) => crypto.getRandomValues(new Uint8Array(n)));
    return generate(length);
  }

  private sha256(bytes: Uint8Array): Promise<ArrayBuffer> {
    const digest =
      this.deps.sha256 ??
      ((b: Uint8Array) => crypto.subtle.digest("SHA-256", b as unknown as BufferSource));
    return digest(bytes);
  }

  private currentPath(): string {
    return (this.deps.currentPath ?? (() => window.location.pathname))();
  }

  // -- SnackPortalAuthAdapter ----------------------------------------------

  /**
   * Real principal kickoff (START-GATE §8): generate verifier + state from
   * cryptographically secure randomness, derive the S256 challenge, store
   * ONLY the transient transaction in sessionStorage, and redirect to the
   * Keycloak authorization endpoint. Sends no client secret.
   */
  async beginPrincipalAuthentication(): Promise<void> {
    const verifier = base64UrlEncode(this.randomBytes(32));
    const challengeDigest = await this.sha256(new TextEncoder().encode(verifier));
    const challenge = base64UrlEncode(new Uint8Array(challengeDigest));
    // `state` is cryptographically random and single-use — it is also the
    // one-time transaction identifier required by §8.
    const state = base64UrlEncode(this.randomBytes(32));

    const transaction: PkceTransaction = {
      state,
      verifier,
      createdAt: this.now(),
      returnPath: sanitizeReturnPath(this.currentPath()),
    };
    this.storage.setItem(PKCE_TRANSACTION_STORAGE_KEY, JSON.stringify(transaction));

    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: "openid",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
    });
    this.redirect(`${this.config.issuer}/protocol/openid-connect/auth?${params.toString()}`);
  }

  /**
   * Completes the Authorization Code + PKCE callback (START-GATE §9).
   * Order is contractual: read params → immediately strip the query from
   * browser history → load AND DELETE the single-use transaction → validate
   * → exchange the code directly with Keycloak → hold the token in memory
   * only. Every failure is a typed, controlled, fail-closed result; the
   * in-memory token is cleared on any callback error (§10).
   */
  async completeAuthorizationCallback(currentUrl: string): Promise<CallbackResult> {
    let url: URL;
    try {
      url = new URL(currentUrl);
    } catch {
      // Defensive: the route always passes window.location.href. Still
      // consume the pending transaction so no failure path leaves it behind
      // (the route strips the query from history before calling in).
      this.storage.removeItem(PKCE_TRANSACTION_STORAGE_KEY);
      return this.failCallback("invalid_callback_url");
    }
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

    // 2. Immediately remove code/state/error from browser history.
    this.replaceHistoryState(url.pathname);

    // 3+5. Load the one-time transaction and delete it BEFORE any terminal
    // handling — a replayed callback can never find it again.
    const raw = this.storage.getItem(PKCE_TRANSACTION_STORAGE_KEY);
    this.storage.removeItem(PKCE_TRANSACTION_STORAGE_KEY);
    if (raw === null) return this.failCallback("missing_transaction");

    let transaction: PkceTransaction;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        typeof (parsed as PkceTransaction).state !== "string" ||
        (parsed as PkceTransaction).state.length === 0 ||
        typeof (parsed as PkceTransaction).verifier !== "string" ||
        (parsed as PkceTransaction).verifier.length === 0 ||
        typeof (parsed as PkceTransaction).createdAt !== "number" ||
        !Number.isFinite((parsed as PkceTransaction).createdAt)
      ) {
        return this.failCallback("invalid_transaction");
      }
      transaction = parsed as PkceTransaction;
    } catch {
      return this.failCallback("invalid_transaction");
    }

    const age = this.now() - transaction.createdAt;
    if (age < 0 || age > PKCE_TRANSACTION_MAX_AGE_MS) {
      return this.failCallback("expired_transaction");
    }
    if (oauthError !== null) {
      // Never log or surface provider error values.
      return this.failCallback("provider_error");
    }
    if (state === null || state !== transaction.state) {
      return this.failCallback("state_mismatch");
    }
    if (code === null || code.length === 0) {
      return this.failCallback("missing_code");
    }

    // 6. Exchange the code directly with local Keycloak. Exact form fields,
    // no client secret, no Authorization header.
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.config.clientId,
      code,
      redirect_uri: this.config.redirectUri,
      code_verifier: transaction.verifier,
    });
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.config.issuer}/protocol/openid-connect/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: body.toString(),
        cache: "no-store",
        credentials: "omit",
      });
    } catch {
      return this.failCallback("exchange_failed");
    }
    if (!response.ok) return this.failCallback("exchange_failed");

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return this.failCallback("invalid_token_response");
    }
    if (typeof payload !== "object" || payload === null) {
      return this.failCallback("invalid_token_response");
    }
    const tokenType = (payload as { token_type?: unknown }).token_type;
    const accessToken = (payload as { access_token?: unknown }).access_token;
    const expiresIn = (payload as { expires_in?: unknown }).expires_in;
    if (typeof tokenType !== "string" || tokenType.toLowerCase() !== "bearer") {
      return this.failCallback("invalid_token_response");
    }
    if (typeof accessToken !== "string" || accessToken.length === 0) {
      return this.failCallback("invalid_token_response");
    }
    if (typeof expiresIn !== "number" || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      return this.failCallback("invalid_token_response");
    }

    // 12. Memory only. Any id_token / refresh_token in the payload is
    // deliberately ignored — never read into state, never persisted.
    this.tokenStore.accessToken = accessToken;
    this.tokenStore.expiresAtEpochMs = this.now() + expiresIn * 1000;

    return { ok: true, returnPath: sanitizeReturnPath(transaction.returnPath) };
  }

  /** Principal token from memory; null after expiry (§10). */
  async getPrincipalAccessToken(): Promise<string | null> {
    const { accessToken, expiresAtEpochMs } = this.tokenStore;
    if (accessToken === null || expiresAtEpochMs === null) return null;
    if (this.now() >= expiresAtEpochMs) {
      this.clearTokenMemory();
      return null;
    }
    return accessToken;
  }

  /** Tenant auth is NOT in this slice — fail closed, typed, explicit (§6). */
  async beginWorkspaceAuthentication(_tenantId: string): Promise<void> {
    throw new TenantAuthenticationUnsupportedError();
  }

  /** No tenant token exists in this slice; never fabricated (§6). */
  async getTenantAccessToken(_tenantId: string): Promise<string | null> {
    return null;
  }

  /**
   * Logout (§11): clear in-memory token state and the transient transaction,
   * then redirect to the Keycloak end-session endpoint. No client secret and
   * no token ever appears in the URL (no ID token is retained, so no
   * id_token_hint is available by construction; the public client_id
   * accompanies the post-logout redirect instead).
   */
  async logout(): Promise<void> {
    this.clearTokenMemory();
    this.storage.removeItem(PKCE_TRANSACTION_STORAGE_KEY);

    const endSession = `${this.config.issuer}/protocol/openid-connect/logout`;
    if (this.config.postLogoutRedirectUri) {
      const params = new URLSearchParams({
        client_id: this.config.clientId,
        post_logout_redirect_uri: this.config.postLogoutRedirectUri,
      });
      this.redirect(`${endSession}?${params.toString()}`);
    } else {
      this.redirect(endSession);
    }
  }

  // -- internals ------------------------------------------------------------

  private clearTokenMemory(): void {
    this.tokenStore.accessToken = null;
    this.tokenStore.expiresAtEpochMs = null;
  }

  private failCallback(reason: CallbackFailureReason): CallbackResult {
    // §10: clear the token on callback error — fail closed, never partial.
    this.clearTokenMemory();
    return { ok: false, reason };
  }
}

// ===========================================================================
// Bootstrap posture selection (START-GATE §7 + §12).
// Pure and unit-testable: the route files read import.meta.env and pass the
// values in; no environment access happens here.
// ===========================================================================

/** The five public real-integration variables (all treated as public). */
export interface Sp2RealIntegrationEnv {
  gatewayBaseUrl: string | undefined;
  issuer: string | undefined;
  clientId: string | undefined;
  redirectUri: string | undefined;
  postLogoutRedirectUri: string | undefined;
}

export type Sp2BootstrapPosture =
  | { kind: "real"; gatewayBaseUrl: string; adapterConfig: KeycloakAdapterConfig }
  | { kind: "fail_closed" }
  | { kind: "dev_mock" };

function presentOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseAbsoluteHttpUrl(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url;
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

/**
 * Selects exactly one of: real adapter, fail-closed, or explicit dev mock.
 *
 *  - Complete real configuration (all four required variables, valid URLs,
 *    issuer loopback-HTTP or HTTPS) → real.
 *  - Partial or invalid real configuration → fail closed (production AND
 *    development — mixed mock/real configuration is forbidden).
 *  - Production with no real configuration → fail closed; production never
 *    falls back to the mock.
 *  - Development with ALL real-integration variables absent → explicit
 *    dev mock (loaded by the route through dynamic imports only).
 */
export function resolveSp2BootstrapPosture(
  env: Sp2RealIntegrationEnv,
  isProd: boolean,
): Sp2BootstrapPosture {
  const gatewayBaseUrl = presentOrNull(env.gatewayBaseUrl);
  const issuer = presentOrNull(env.issuer);
  const clientId = presentOrNull(env.clientId);
  const redirectUri = presentOrNull(env.redirectUri);
  const postLogoutRedirectUri = presentOrNull(env.postLogoutRedirectUri);

  const requiredPresent = [gatewayBaseUrl, issuer, clientId, redirectUri].every((v) => v !== null);
  const anyPresent =
    gatewayBaseUrl !== null ||
    issuer !== null ||
    clientId !== null ||
    redirectUri !== null ||
    postLogoutRedirectUri !== null;

  if (requiredPresent && gatewayBaseUrl && issuer && clientId && redirectUri) {
    const issuerUrl = parseAbsoluteHttpUrl(issuer);
    const gatewayUrl = parseAbsoluteHttpUrl(gatewayBaseUrl);
    const redirectUrl = parseAbsoluteHttpUrl(redirectUri);
    const postLogoutValid =
      postLogoutRedirectUri === null || parseAbsoluteHttpUrl(postLogoutRedirectUri) !== null;
    const issuerTransportValid =
      issuerUrl !== null && (issuerUrl.protocol === "https:" || isLoopbackHost(issuerUrl.hostname));

    if (issuerUrl && gatewayUrl && redirectUrl && postLogoutValid && issuerTransportValid) {
      return {
        kind: "real",
        gatewayBaseUrl,
        adapterConfig: {
          issuer,
          clientId,
          redirectUri,
          postLogoutRedirectUri,
        },
      };
    }
    return { kind: "fail_closed" };
  }

  if (anyPresent) return { kind: "fail_closed" };
  if (isProd) return { kind: "fail_closed" };
  return { kind: "dev_mock" };
}
