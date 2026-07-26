/**
 * Focused tests for the real Keycloak Authorization Code + PKCE S256 adapter
 * (corrective START-GATE §13). Deterministic fetch/location/storage/WebCrypto
 * doubles only — no live Keycloak is used, and no secret material is logged.
 */
import { describe, expect, it } from "bun:test";
import {
  KeycloakSnackPortalAuthAdapter,
  PKCE_TRANSACTION_MAX_AGE_MS,
  PKCE_TRANSACTION_STORAGE_KEY,
  TENANT_CLAIM,
  TENANT_SCOPE_PREFIX,
  createInMemoryPrincipalTokenStore,
  createInMemoryTenantTokenStore,
  getResidentTenantId,
  resolveSp2BootstrapPosture,
  type KeycloakAdapterConfig,
  type Sp2RealIntegrationEnv,
} from "../../src/lib/sp2/keycloak-auth-adapter";

const CONFIG: KeycloakAdapterConfig = {
  issuer: "http://127.0.0.1:8814/realms/sp2-local",
  clientId: "sp2-local-web",
  redirectUri: "http://localhost:5173/sp2-gateway/callback",
  postLogoutRedirectUri: "http://localhost:5173/sp2-gateway",
};

/** RFC 7636 Appendix B reference vector. */
const RFC7636_VERIFIER_OCTETS = [
  116, 24, 223, 180, 151, 153, 224, 37, 79, 250, 96, 125, 216, 173, 187, 186, 22, 212, 37, 77, 105,
  214, 191, 240, 91, 88, 5, 88, 83, 132, 141, 121,
];
const RFC7636_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const RFC7636_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
const STATE_OCTETS = Array.from({ length: 32 }, (_, i) => i + 1);

const T0 = 1_700_000_000_000;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

type FetchCall = { url: string; init: RequestInit };

function makeHarness(init?: {
  responses?: Response[];
  randomBytes?: (n: number) => Uint8Array;
  fetchImpl?: typeof fetch;
  config?: KeycloakAdapterConfig;
}) {
  const events: string[] = [];
  const map = new Map<string, string>();
  const storage = {
    getItem(k: string) {
      events.push(`storage.get:${k}`);
      return map.has(k) ? map.get(k)! : null;
    },
    setItem(k: string, v: string) {
      events.push(`storage.set:${k}`);
      map.set(k, v);
    },
    removeItem(k: string) {
      events.push(`storage.remove:${k}`);
      map.delete(k);
    },
  };
  const redirects: string[] = [];
  const historyPaths: string[] = [];
  const fetchCalls: FetchCall[] = [];
  const responses = init?.responses ?? [];
  const clock = { value: T0 };
  const tokenStore = createInMemoryPrincipalTokenStore();
  const tenantStore = createInMemoryTenantTokenStore();
  const adapter = new KeycloakSnackPortalAuthAdapter(init?.config ?? CONFIG, {
    fetchImpl:
      init?.fetchImpl ??
      ((async (input: RequestInfo | URL, i?: RequestInit) => {
        fetchCalls.push({ url: String(input), init: i ?? {} });
        const next = responses.shift();
        if (!next) throw new Error("no fetch response queued");
        return next;
      }) as typeof fetch),
    storage,
    redirect: (u: string) => void redirects.push(u),
    replaceHistoryState: (p: string) => {
      events.push(`history.replace:${p}`);
      historyPaths.push(p);
    },
    now: () => clock.value,
    // Only seed randomness when a test asks for determinism — otherwise the
    // adapter's SHIPPED default (crypto.getRandomValues) is exercised.
    ...(init?.randomBytes ? { randomBytes: init.randomBytes } : {}),
    currentPath: () => "/sp2-gateway",
    tokenStore,
    tenantTokenStore: tenantStore,
  });
  return {
    adapter,
    map,
    events,
    redirects,
    historyPaths,
    fetchCalls,
    clock,
    tokenStore,
    tenantStore,
  };
}

function byteQueue(...arrays: number[][]) {
  const queue = arrays.map((a) => Uint8Array.from(a));
  return (length: number): Uint8Array => {
    const next = queue.shift();
    if (!next || next.length !== length) throw new Error("unexpected randomBytes request");
    return next;
  };
}

function storedTxn(h: ReturnType<typeof makeHarness>): {
  kind: "principal" | "tenant";
  tenantId?: string;
  state: string;
  verifier: string;
  createdAt: number;
  returnPath: string;
} {
  const raw = h.map.get(PKCE_TRANSACTION_STORAGE_KEY);
  if (!raw) throw new Error("no stored transaction");
  return JSON.parse(raw);
}

function callbackUrl(state: string, code = "AUTHCODE_1"): string {
  return `http://localhost:5173/sp2-gateway/callback?code=${encodeURIComponent(
    code,
  )}&state=${encodeURIComponent(state)}`;
}

function tokenResponse(overrides?: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify({
      access_token: "ATK_test_access_token",
      token_type: "Bearer",
      expires_in: 300,
      refresh_token: "RTK_must_be_ignored",
      id_token: "IDT_must_be_ignored",
      ...overrides,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

/** base64url without padding, for structural JWT doubles. */
function b64url(text: string): string {
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Test-only STRUCTURAL JWT double (START-GATE §8.1): three segments with a
 * JSON payload and a placeholder signature. It is not a real token, is not
 * signed, and is never accepted by any real service. No JWT dependency and
 * no frontend signature verification are involved.
 */
function jwtDouble(payload: unknown): string {
  return `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(
    JSON.stringify(payload),
  )}.SIGNATURE_TEST_DOUBLE`;
}

const ACME_TENANT_JWT = jwtDouble({ [TENANT_CLAIM]: "acme" });

/** Begins the tenant flow and completes its callback with the given token. */
async function tenantCallback(
  h: ReturnType<typeof makeHarness>,
  tenantId: string,
): Promise<ReturnType<KeycloakSnackPortalAuthAdapter["completeAuthorizationCallback"]>> {
  await h.adapter.beginWorkspaceAuthentication(tenantId);
  const txn = storedTxn(h);
  return h.adapter.completeAuthorizationCallback(callbackUrl(txn.state));
}

/** Records any localStorage write attempted while `fn` runs. */
async function withRecordingLocalStorage<T>(fn: () => Promise<T>) {
  const writes: string[] = [];
  const g = globalThis as { localStorage?: unknown };
  const previous = g.localStorage;
  g.localStorage = {
    getItem: () => null,
    setItem: (k: string, v: string) => void writes.push(`${k}=${v}`),
    removeItem: () => undefined,
    clear: () => undefined,
    key: () => null,
    length: 0,
  };
  try {
    const result = await fn();
    return { result, writes };
  } finally {
    if (previous === undefined) delete g.localStorage;
    else g.localStorage = previous;
  }
}

describe("KeycloakSnackPortalAuthAdapter — PKCE kickoff", () => {
  it("derives the S256 challenge with correct base64url encoding (RFC 7636 vector)", async () => {
    const h = makeHarness({ randomBytes: byteQueue(RFC7636_VERIFIER_OCTETS, STATE_OCTETS) });
    await h.adapter.beginPrincipalAuthentication();
    const txn = storedTxn(h);
    expect(txn.verifier).toBe(RFC7636_VERIFIER);
    const url = new URL(h.redirects[0]);
    expect(url.searchParams.get("code_challenge")).toBe(RFC7636_CHALLENGE);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("generates verifier and state from cryptographically secure randomness (shipped default path)", async () => {
    const original = crypto.getRandomValues.bind(crypto);
    let calls = 0;
    (crypto as { getRandomValues: typeof crypto.getRandomValues }).getRandomValues = ((
      arr: Uint8Array,
    ) => {
      calls += 1;
      return original(arr);
    }) as typeof crypto.getRandomValues;
    try {
      const h = makeHarness();
      await h.adapter.beginPrincipalAuthentication();
      expect(calls).toBeGreaterThanOrEqual(2);
      const first = storedTxn(h);
      const firstState = new URL(h.redirects[0]).searchParams.get("state")!;
      expect(first.verifier).toMatch(BASE64URL_RE);
      expect(first.verifier.length).toBe(43); // 32 random bytes, base64url
      expect(firstState).toMatch(BASE64URL_RE);
      expect(firstState.length).toBe(43);
      expect(firstState).not.toBe(first.verifier);

      await h.adapter.beginPrincipalAuthentication();
      const second = storedTxn(h);
      const secondState = new URL(h.redirects[1]).searchParams.get("state")!;
      expect(second.verifier).not.toBe(first.verifier);
      expect(secondState).not.toBe(firstState);
    } finally {
      (crypto as { getRandomValues: typeof crypto.getRandomValues }).getRandomValues = original;
    }
  });

  it("builds the authorization URL with exactly the required parameters", async () => {
    const h = makeHarness({ randomBytes: byteQueue(RFC7636_VERIFIER_OCTETS, STATE_OCTETS) });
    await h.adapter.beginPrincipalAuthentication();
    expect(h.redirects).toHaveLength(1);
    const url = new URL(h.redirects[0]);
    expect(`${url.origin}${url.pathname}`).toBe(
      "http://127.0.0.1:8814/realms/sp2-local/protocol/openid-connect/auth",
    );
    expect([...url.searchParams.keys()].sort()).toEqual([
      "client_id",
      "code_challenge",
      "code_challenge_method",
      "redirect_uri",
      "response_type",
      "scope",
      "state",
    ]);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe(CONFIG.clientId);
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(url.searchParams.get("scope")).toBe("openid");
    expect(url.searchParams.get("state")).toBe(storedTxn(h).state);
  });

  it("sends no client secret in the authorization request", async () => {
    const h = makeHarness();
    await h.adapter.beginPrincipalAuthentication();
    expect(h.redirects[0]).not.toContain("client_secret");
    expect(h.redirects[0].toLowerCase()).not.toContain("secret");
  });

  it("stores ONLY transient state/verifier metadata under the namespaced key", async () => {
    const h = makeHarness();
    await h.adapter.beginPrincipalAuthentication();
    expect([...h.map.keys()]).toEqual([PKCE_TRANSACTION_STORAGE_KEY]);
    const txn = storedTxn(h);
    expect(Object.keys(txn).sort()).toEqual([
      "createdAt",
      "kind",
      "returnPath",
      "state",
      "verifier",
    ]);
    expect(txn.createdAt).toBe(T0);
    expect(txn.returnPath).toBe("/sp2-gateway");
  });

  it('principal transaction is discriminated with kind:"principal"', async () => {
    const h = makeHarness();
    await h.adapter.beginPrincipalAuthentication();
    expect(storedTxn(h).kind).toBe("principal");
  });
});

describe("KeycloakSnackPortalAuthAdapter — callback", () => {
  async function successfulLogin(h: ReturnType<typeof makeHarness>) {
    await h.adapter.beginPrincipalAuthentication();
    const txn = storedTxn(h);
    return h.adapter.completeAuthorizationCallback(callbackUrl(txn.state));
  }

  it("rejects a missing transaction", async () => {
    const h = makeHarness();
    const result = await h.adapter.completeAuthorizationCallback(callbackUrl("any-state"));
    expect(result).toEqual({ ok: false, reason: "missing_transaction" });
    expect(h.fetchCalls).toHaveLength(0);
  });

  it("rejects an expired transaction (10-minute bound) and deletes it", async () => {
    const h = makeHarness();
    await h.adapter.beginPrincipalAuthentication();
    const txn = storedTxn(h);
    h.clock.value = T0 + PKCE_TRANSACTION_MAX_AGE_MS + 1;
    const result = await h.adapter.completeAuthorizationCallback(callbackUrl(txn.state));
    expect(result).toEqual({ ok: false, reason: "expired_transaction" });
    expect(h.map.size).toBe(0);
    expect(h.fetchCalls).toHaveLength(0);
  });

  it("accepts a transaction just inside the 10-minute bound", async () => {
    const h = makeHarness({ responses: [tokenResponse()] });
    await h.adapter.beginPrincipalAuthentication();
    const txn = storedTxn(h);
    h.clock.value = T0 + PKCE_TRANSACTION_MAX_AGE_MS;
    const result = await h.adapter.completeAuthorizationCallback(callbackUrl(txn.state));
    expect(result.ok).toBe(true);
  });

  it("rejects a state mismatch without contacting the token endpoint", async () => {
    const h = makeHarness();
    await h.adapter.beginPrincipalAuthentication();
    const result = await h.adapter.completeAuthorizationCallback(callbackUrl("wrong-state"));
    expect(result).toEqual({ ok: false, reason: "state_mismatch" });
    expect(h.fetchCalls).toHaveLength(0);
    expect(h.map.size).toBe(0); // consumed — single use
  });

  it("is single-use: a replayed callback finds no transaction", async () => {
    const h = makeHarness({ responses: [tokenResponse()] });
    await h.adapter.beginPrincipalAuthentication();
    const txn = storedTxn(h);
    const first = await h.adapter.completeAuthorizationCallback(callbackUrl(txn.state));
    expect(first.ok).toBe(true);
    const replay = await h.adapter.completeAuthorizationCallback(callbackUrl(txn.state));
    expect(replay).toEqual({ ok: false, reason: "missing_transaction" });
  });

  it("rejects an OAuth error response and deletes the transaction", async () => {
    const h = makeHarness();
    await h.adapter.beginPrincipalAuthentication();
    const txn = storedTxn(h);
    const result = await h.adapter.completeAuthorizationCallback(
      `${CONFIG.redirectUri}?error=access_denied&state=${encodeURIComponent(txn.state)}`,
    );
    expect(result).toEqual({ ok: false, reason: "provider_error" });
    expect(h.map.size).toBe(0);
    expect(h.fetchCalls).toHaveLength(0);
  });

  it("rejects a rewritten/invalid transaction payload", async () => {
    const h = makeHarness();
    h.map.set(PKCE_TRANSACTION_STORAGE_KEY, "not-json");
    const result = await h.adapter.completeAuthorizationCallback(callbackUrl("s"));
    expect(result).toEqual({ ok: false, reason: "invalid_transaction" });
  });

  it("strips query parameters from browser history before touching the transaction", async () => {
    const h = makeHarness({ responses: [tokenResponse()] });
    await h.adapter.beginPrincipalAuthentication();
    const txn = storedTxn(h);
    await h.adapter.completeAuthorizationCallback(callbackUrl(txn.state));
    expect(h.historyPaths).toEqual(["/sp2-gateway/callback"]);
    const historyIndex = h.events.indexOf("history.replace:/sp2-gateway/callback");
    const readIndex = h.events.indexOf(`storage.get:${PKCE_TRANSACTION_STORAGE_KEY}`);
    expect(historyIndex).toBeGreaterThanOrEqual(0);
    expect(readIndex).toBeGreaterThan(historyIndex);
  });

  it("sends exactly the required token-exchange form fields and no client secret", async () => {
    const h = makeHarness({
      responses: [tokenResponse()],
      randomBytes: byteQueue(RFC7636_VERIFIER_OCTETS, STATE_OCTETS),
    });
    await h.adapter.beginPrincipalAuthentication();
    const txn = storedTxn(h);
    const result = await h.adapter.completeAuthorizationCallback(
      callbackUrl(txn.state, "AUTHCODE_42"),
    );
    expect(result.ok).toBe(true);
    expect(h.fetchCalls).toHaveLength(1);
    const call = h.fetchCalls[0];
    expect(call.url).toBe("http://127.0.0.1:8814/realms/sp2-local/protocol/openid-connect/token");
    expect(call.init.method).toBe("POST");
    const headers = new Headers(call.init.headers);
    expect(headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(headers.get("authorization")).toBeNull();
    const body = new URLSearchParams(String(call.init.body));
    expect([...body.keys()].sort()).toEqual([
      "client_id",
      "code",
      "code_verifier",
      "grant_type",
      "redirect_uri",
    ]);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("client_id")).toBe(CONFIG.clientId);
    expect(body.get("code")).toBe("AUTHCODE_42");
    expect(body.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(body.get("code_verifier")).toBe(RFC7636_VERIFIER);
    expect(String(call.init.body).toLowerCase()).not.toContain("secret");
  });

  it("rejects non-Bearer token responses", async () => {
    const h = makeHarness({ responses: [tokenResponse({ token_type: "mac" })] });
    const result = await successfulLogin(h);
    expect(result).toEqual({ ok: false, reason: "invalid_token_response" });
    expect(await h.adapter.getPrincipalAccessToken()).toBeNull();
  });

  it("accepts Bearer case-insensitively", async () => {
    const h = makeHarness({ responses: [tokenResponse({ token_type: "bearer" })] });
    const result = await successfulLogin(h);
    expect(result.ok).toBe(true);
  });

  it("rejects a missing or empty access token", async () => {
    for (const access_token of [undefined, ""]) {
      const h = makeHarness({ responses: [tokenResponse({ access_token })] });
      const result = await successfulLogin(h);
      expect(result).toEqual({ ok: false, reason: "invalid_token_response" });
    }
  });

  it("rejects non-positive, non-numeric, or null expires_in", async () => {
    for (const expires_in of [0, -5, "300", null]) {
      const h = makeHarness({ responses: [tokenResponse({ expires_in })] });
      const result = await successfulLogin(h);
      expect(result).toEqual({ ok: false, reason: "invalid_token_response" });
    }
  });

  it("rejects a non-finite expires_in produced by huge JSON numerics", async () => {
    // JSON cannot carry Infinity directly, but JSON.parse("1e999") yields it.
    const h = makeHarness({
      responses: [
        new Response(
          '{"access_token":"ATK_test_access_token","token_type":"Bearer","expires_in":1e999}',
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ],
    });
    const result = await successfulLogin(h);
    expect(result).toEqual({ ok: false, reason: "invalid_token_response" });
  });

  it("rejects an unparseable callback URL and still consumes the transaction", async () => {
    const h = makeHarness();
    await h.adapter.beginPrincipalAuthentication();
    expect(h.map.size).toBe(1);
    const result = await h.adapter.completeAuthorizationCallback("not a url");
    expect(result).toEqual({ ok: false, reason: "invalid_callback_url" });
    expect(h.map.size).toBe(0);
    expect(h.fetchCalls).toHaveLength(0);
  });

  it("fails closed on HTTP error and on network failure", async () => {
    const h1 = makeHarness({ responses: [new Response("{}", { status: 400 })] });
    expect(await successfulLogin(h1)).toEqual({ ok: false, reason: "exchange_failed" });

    const h2 = makeHarness({
      fetchImpl: (async () => {
        throw new Error("network down");
      }) as typeof fetch,
    });
    expect(await successfulLogin(h2)).toEqual({ ok: false, reason: "exchange_failed" });
  });

  it("keeps the access token in memory only — never in local/session storage", async () => {
    const h = makeHarness({ responses: [tokenResponse()] });
    const { writes } = await withRecordingLocalStorage(async () => successfulLogin(h));
    expect(writes).toHaveLength(0);
    expect(h.map.size).toBe(0); // transaction deleted on success
    expect(await h.adapter.getPrincipalAccessToken()).toBe("ATK_test_access_token");
    expect(h.tokenStore.accessToken).toBe("ATK_test_access_token");
    for (const value of h.map.values()) {
      expect(value).not.toContain("ATK_test_access_token");
    }
  });

  it("navigates back to the sanitized return path on success", async () => {
    const h = makeHarness({ responses: [tokenResponse()] });
    const result = await successfulLogin(h);
    expect(result).toEqual({ ok: true, returnPath: "/sp2-gateway" });
  });
});

describe("KeycloakSnackPortalAuthAdapter — token memory, expiry, logout, tenant", () => {
  async function signedInHarness() {
    const h = makeHarness({ responses: [tokenResponse()] });
    await h.adapter.beginPrincipalAuthentication();
    const txn = storedTxn(h);
    const result = await h.adapter.completeAuthorizationCallback(callbackUrl(txn.state));
    expect(result.ok).toBe(true);
    return h;
  }

  it("returns null after the in-memory token expires", async () => {
    const h = await signedInHarness();
    h.clock.value = T0 + 300 * 1000 - 1;
    expect(await h.adapter.getPrincipalAccessToken()).toBe("ATK_test_access_token");
    h.clock.value = T0 + 300 * 1000;
    expect(await h.adapter.getPrincipalAccessToken()).toBeNull();
    expect(h.tokenStore.accessToken).toBeNull(); // cleared, not retained
  });

  it("clears the in-memory token on a later callback error (fail closed)", async () => {
    const h = await signedInHarness();
    const bogus = await h.adapter.completeAuthorizationCallback(callbackUrl("replayed-state"));
    expect(bogus.ok).toBe(false);
    expect(await h.adapter.getPrincipalAccessToken()).toBeNull();
  });

  it("logout clears token memory and transient transaction state", async () => {
    const h = await signedInHarness();
    await h.adapter.beginPrincipalAuthentication(); // leave a transaction behind
    expect(h.map.size).toBe(1);
    await h.adapter.logout();
    expect(await h.adapter.getPrincipalAccessToken()).toBeNull();
    expect(h.tokenStore.accessToken).toBeNull();
    expect(h.tokenStore.expiresAtEpochMs).toBeNull();
    expect(h.map.size).toBe(0);
  });

  it("logout redirects to end-session without any token in the URL", async () => {
    const h = await signedInHarness();
    await h.adapter.logout();
    const logoutUrl = h.redirects[h.redirects.length - 1];
    const url = new URL(logoutUrl);
    expect(`${url.origin}${url.pathname}`).toBe(
      "http://127.0.0.1:8814/realms/sp2-local/protocol/openid-connect/logout",
    );
    expect([...url.searchParams.keys()].sort()).toEqual(["client_id", "post_logout_redirect_uri"]);
    expect(url.searchParams.get("client_id")).toBe(CONFIG.clientId);
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe(CONFIG.postLogoutRedirectUri);
    expect(logoutUrl).not.toContain("ATK_test_access_token");
    expect(logoutUrl.toLowerCase()).not.toContain("token");
    expect(logoutUrl.toLowerCase()).not.toContain("secret");
  });

  it("logout without a configured post-logout URI uses the bare end-session endpoint", async () => {
    const h = makeHarness({ config: { ...CONFIG, postLogoutRedirectUri: null } });
    await h.adapter.logout();
    expect(h.redirects).toEqual([
      "http://127.0.0.1:8814/realms/sp2-local/protocol/openid-connect/logout",
    ]);
  });

  it("getTenantAccessToken returns null after principal sign-in alone", async () => {
    const h = await signedInHarness();
    expect(await h.adapter.getTenantAccessToken("acme")).toBeNull();
    expect(await h.adapter.getTenantAccessToken("zeta")).toBeNull();
  });
});

describe("KeycloakSnackPortalAuthAdapter — tenant kickoff (§5.1)", () => {
  it("rejects an empty tenant id without any redirect or storage write", async () => {
    const h = makeHarness();
    await expect(h.adapter.beginWorkspaceAuthentication("")).rejects.toThrow(
      "tenantId must be a non-empty string",
    );
    expect(h.redirects).toHaveLength(0);
    expect(h.map.size).toBe(0);
  });

  it("tenant request has the same accepted parameter set with exactly one tenant scope", async () => {
    const h = makeHarness({ randomBytes: byteQueue(RFC7636_VERIFIER_OCTETS, STATE_OCTETS) });
    await h.adapter.beginWorkspaceAuthentication("acme");
    expect(h.redirects).toHaveLength(1);
    const url = new URL(h.redirects[0]);
    expect(`${url.origin}${url.pathname}`).toBe(
      "http://127.0.0.1:8814/realms/sp2-local/protocol/openid-connect/auth",
    );
    expect([...url.searchParams.keys()].sort()).toEqual([
      "client_id",
      "code_challenge",
      "code_challenge_method",
      "redirect_uri",
      "response_type",
      "scope",
      "state",
    ]);
    expect(url.searchParams.get("scope")).toBe("openid sp2:tenant:acme");
    expect(url.searchParams.get("scope")).toBe(`openid ${TENANT_SCOPE_PREFIX}acme`);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe(CONFIG.clientId);
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(url.searchParams.get("code_challenge")).toBe(RFC7636_CHALLENGE);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe(storedTxn(h).state);
    // §5.1: nothing beyond the principal parameter set — no prompt, max_age,
    // or custom tenant query parameter; the scope is the ONLY difference.
    expect(url.searchParams.get("prompt")).toBeNull();
    expect(url.searchParams.get("max_age")).toBeNull();
    expect(h.redirects[0].toLowerCase()).not.toContain("secret");
  });

  it("uses the tenant id verbatim — no trimming, case-folding, or aliasing", async () => {
    const h = makeHarness();
    await h.adapter.beginWorkspaceAuthentication("AcMe");
    const url = new URL(h.redirects[0]);
    expect(url.searchParams.get("scope")).toBe("openid sp2:tenant:AcMe");
    expect(storedTxn(h).tenantId).toBe("AcMe");
  });

  it('tenant transaction is discriminated with kind:"tenant" and the exact tenant id', async () => {
    const h = makeHarness();
    await h.adapter.beginWorkspaceAuthentication("acme");
    const txn = storedTxn(h);
    expect(txn.kind).toBe("tenant");
    expect(txn.tenantId).toBe("acme");
    expect(Object.keys(txn).sort()).toEqual([
      "createdAt",
      "kind",
      "returnPath",
      "state",
      "tenantId",
      "verifier",
    ]);
  });

  it("selector kickoff alone writes no tenant token", async () => {
    const h = makeHarness();
    await h.adapter.beginWorkspaceAuthentication("acme");
    expect(await h.adapter.getTenantAccessToken("acme")).toBeNull();
    expect(h.tenantStore.tenantId).toBeNull();
    expect(h.tenantStore.accessToken).toBeNull();
  });

  it("keeps one pending transaction per tab — last write wins across flows", async () => {
    const h = makeHarness();
    await h.adapter.beginPrincipalAuthentication();
    const principalState = storedTxn(h).state;
    await h.adapter.beginWorkspaceAuthentication("acme");
    expect([...h.map.keys()]).toEqual([PKCE_TRANSACTION_STORAGE_KEY]);
    const txn = storedTxn(h);
    expect(txn.kind).toBe("tenant");
    expect(txn.state).not.toBe(principalState);
    // The overwritten principal transaction can never complete.
    const result = await h.adapter.completeAuthorizationCallback(callbackUrl(principalState));
    expect(result).toEqual({ ok: false, reason: "state_mismatch" });
  });
});

describe("KeycloakSnackPortalAuthAdapter — tenant callback claim binding (§5.4)", () => {
  it("stores the token under the returned claim when it exactly matches the request", async () => {
    const h = makeHarness({ responses: [tokenResponse({ access_token: ACME_TENANT_JWT })] });
    const result = await tenantCallback(h, "acme");
    expect(result).toEqual({ ok: true, returnPath: "/sp2-gateway" });
    expect(h.tenantStore.tenantId).toBe("acme");
    expect(h.tenantStore.expiresAtEpochMs).toBe(T0 + 300 * 1000);
    expect(await h.adapter.getTenantAccessToken("acme")).toBe(ACME_TENANT_JWT);
    expect(h.map.size).toBe(0); // transaction consumed on success
  });

  it("another tenant key returns null (exact-key lookup, no normalization)", async () => {
    const h = makeHarness({ responses: [tokenResponse({ access_token: ACME_TENANT_JWT })] });
    await tenantCallback(h, "acme");
    expect(await h.adapter.getTenantAccessToken("zeta")).toBeNull();
    expect(await h.adapter.getTenantAccessToken("ACME")).toBeNull();
    expect(await h.adapter.getTenantAccessToken(" acme")).toBeNull();
  });

  it("tenant callback performs exactly one fetch — the issuer token exchange, never the Gateway", async () => {
    const h = makeHarness({ responses: [tokenResponse({ access_token: ACME_TENANT_JWT })] });
    await tenantCallback(h, "acme");
    expect(h.fetchCalls).toHaveLength(1);
    expect(h.fetchCalls[0].url).toBe(
      "http://127.0.0.1:8814/realms/sp2-local/protocol/openid-connect/token",
    );
    expect(h.fetchCalls[0].url).not.toContain("8815");
  });

  it("missing tenant claim fails tenant_claim_missing and stores nothing", async () => {
    const h = makeHarness({
      responses: [tokenResponse({ access_token: jwtDouble({ sub: "user-1" }) })],
    });
    const result = await tenantCallback(h, "acme");
    expect(result).toEqual({ ok: false, reason: "tenant_claim_missing" });
    expect(h.tenantStore.accessToken).toBeNull();
    expect(h.tokenStore.accessToken).toBeNull();
    expect(await h.adapter.getTenantAccessToken("acme")).toBeNull();
  });

  it("malformed two-segment token fails closed", async () => {
    const h = makeHarness({ responses: [tokenResponse({ access_token: "opaque.twosegment" })] });
    expect(await tenantCallback(h, "acme")).toEqual({
      ok: false,
      reason: "tenant_claim_missing",
    });
    expect(h.tenantStore.accessToken).toBeNull();
  });

  it("undecodable base64 or non-JSON payloads fail closed", async () => {
    for (const accessToken of [
      "aaa.!!!not-base64url!!!.ccc",
      `aaa.${b64url("this is not json")}.ccc`,
      `aaa.${b64url("[1,2]")}.ccc`,
      `aaa.${b64url("null")}.ccc`,
      `aaa.${b64url('"just-a-string"')}.ccc`,
      "aaa..ccc",
    ]) {
      const h = makeHarness({ responses: [tokenResponse({ access_token: accessToken })] });
      const result = await tenantCallback(h, "acme");
      expect(result).toEqual({ ok: false, reason: "tenant_claim_missing" });
      expect(h.tenantStore.accessToken).toBeNull();
    }
  });

  it("empty or non-string tenant claims fail closed", async () => {
    for (const payload of [
      { [TENANT_CLAIM]: "" },
      { [TENANT_CLAIM]: 42 },
      { [TENANT_CLAIM]: null },
      { [TENANT_CLAIM]: ["acme"] },
      { [TENANT_CLAIM]: { value: "acme" } },
    ]) {
      const h = makeHarness({ responses: [tokenResponse({ access_token: jwtDouble(payload) })] });
      const result = await tenantCallback(h, "acme");
      expect(result).toEqual({ ok: false, reason: "tenant_claim_missing" });
      expect(h.tenantStore.accessToken).toBeNull();
    }
  });

  it("mismatched tenant claim fails tenant_claim_mismatch and stores under NO key", async () => {
    const h = makeHarness({
      responses: [tokenResponse({ access_token: jwtDouble({ [TENANT_CLAIM]: "zeta" }) })],
    });
    const result = await tenantCallback(h, "acme");
    expect(result).toEqual({ ok: false, reason: "tenant_claim_mismatch" });
    expect(await h.adapter.getTenantAccessToken("acme")).toBeNull();
    expect(await h.adapter.getTenantAccessToken("zeta")).toBeNull();
    expect(h.tenantStore.tenantId).toBeNull();
    expect(h.tokenStore.accessToken).toBeNull(); // ALL token memory cleared
  });

  it("a mismatch consumes the transaction — replay finds nothing", async () => {
    const h = makeHarness({
      responses: [tokenResponse({ access_token: jwtDouble({ [TENANT_CLAIM]: "zeta" }) })],
    });
    await h.adapter.beginWorkspaceAuthentication("acme");
    const txn = storedTxn(h);
    const first = await h.adapter.completeAuthorizationCallback(callbackUrl(txn.state));
    expect(first).toEqual({ ok: false, reason: "tenant_claim_mismatch" });
    expect(h.map.size).toBe(0);
    const replay = await h.adapter.completeAuthorizationCallback(callbackUrl(txn.state));
    expect(replay).toEqual({ ok: false, reason: "missing_transaction" });
  });

  it("a successful tenant callback cannot be replayed", async () => {
    const h = makeHarness({ responses: [tokenResponse({ access_token: ACME_TENANT_JWT })] });
    await h.adapter.beginWorkspaceAuthentication("acme");
    const txn = storedTxn(h);
    expect((await h.adapter.completeAuthorizationCallback(callbackUrl(txn.state))).ok).toBe(true);
    const replay = await h.adapter.completeAuthorizationCallback(callbackUrl(txn.state));
    expect(replay).toEqual({ ok: false, reason: "missing_transaction" });
    // The failure model clears all token memory — fail closed, never partial.
    expect(await h.adapter.getTenantAccessToken("acme")).toBeNull();
  });

  it("stale and negative-age tenant transactions fail closed", async () => {
    const h1 = makeHarness();
    await h1.adapter.beginWorkspaceAuthentication("acme");
    const txn1 = storedTxn(h1);
    h1.clock.value = T0 + PKCE_TRANSACTION_MAX_AGE_MS + 1;
    expect(await h1.adapter.completeAuthorizationCallback(callbackUrl(txn1.state))).toEqual({
      ok: false,
      reason: "expired_transaction",
    });
    expect(h1.fetchCalls).toHaveLength(0);

    const h2 = makeHarness();
    await h2.adapter.beginWorkspaceAuthentication("acme");
    const txn2 = storedTxn(h2);
    h2.clock.value = T0 - 1; // transaction "from the future" — negative age
    expect(await h2.adapter.completeAuthorizationCallback(callbackUrl(txn2.state))).toEqual({
      ok: false,
      reason: "expired_transaction",
    });
    expect(h2.fetchCalls).toHaveLength(0);
  });

  it("cross-flow substitution fails closed", async () => {
    // A tenantless (principal-shaped) token arriving on a tenant transaction
    // can never establish tenant state.
    const h = makeHarness({ responses: [tokenResponse()] });
    const result = await tenantCallback(h, "acme");
    expect(result).toEqual({ ok: false, reason: "tenant_claim_missing" });
    expect(h.tenantStore.accessToken).toBeNull();

    // A state from a different, overwritten flow fails state_mismatch.
    const h2 = makeHarness();
    await h2.adapter.beginWorkspaceAuthentication("acme");
    const tenantState = storedTxn(h2).state;
    await h2.adapter.beginPrincipalAuthentication(); // overwrites (last write wins)
    const result2 = await h2.adapter.completeAuthorizationCallback(callbackUrl(tenantState));
    expect(result2).toEqual({ ok: false, reason: "state_mismatch" });
  });

  it("a kindless (legacy-shape) transaction fails closed as invalid", async () => {
    const h = makeHarness();
    h.map.set(
      PKCE_TRANSACTION_STORAGE_KEY,
      JSON.stringify({ state: "s1", verifier: "v1", createdAt: T0, returnPath: "/sp2-gateway" }),
    );
    expect(await h.adapter.completeAuthorizationCallback(callbackUrl("s1"))).toEqual({
      ok: false,
      reason: "invalid_transaction",
    });
  });

  it("a tenant transaction without a tenant id fails closed as invalid", async () => {
    const h = makeHarness();
    h.map.set(
      PKCE_TRANSACTION_STORAGE_KEY,
      JSON.stringify({
        kind: "tenant",
        state: "s1",
        verifier: "v1",
        createdAt: T0,
        returnPath: "/sp2-gateway",
      }),
    );
    expect(await h.adapter.completeAuthorizationCallback(callbackUrl("s1"))).toEqual({
      ok: false,
      reason: "invalid_transaction",
    });
  });
});

describe("KeycloakSnackPortalAuthAdapter — sequential flows, expiry, logout (§5.3–§5.6)", () => {
  async function tenantResidentHarness() {
    const h = makeHarness({
      responses: [tokenResponse({ access_token: ACME_TENANT_JWT }), tokenResponse()],
    });
    const result = await tenantCallback(h, "acme");
    expect(result.ok).toBe(true);
    return h;
  }

  it("a successful tenant callback clears principal state (sequential, memory-only)", async () => {
    const h = makeHarness({
      responses: [tokenResponse(), tokenResponse({ access_token: ACME_TENANT_JWT })],
    });
    await h.adapter.beginPrincipalAuthentication();
    let txn = storedTxn(h);
    expect((await h.adapter.completeAuthorizationCallback(callbackUrl(txn.state))).ok).toBe(true);
    expect(await h.adapter.getPrincipalAccessToken()).toBe("ATK_test_access_token");
    await h.adapter.beginWorkspaceAuthentication("acme");
    txn = storedTxn(h);
    expect((await h.adapter.completeAuthorizationCallback(callbackUrl(txn.state))).ok).toBe(true);
    expect(await h.adapter.getPrincipalAccessToken()).toBeNull();
    expect(await h.adapter.getTenantAccessToken("acme")).toBe(ACME_TENANT_JWT);
  });

  it("a successful principal callback clears resident tenant state", async () => {
    const h = await tenantResidentHarness();
    await h.adapter.beginPrincipalAuthentication();
    const txn = storedTxn(h);
    expect((await h.adapter.completeAuthorizationCallback(callbackUrl(txn.state))).ok).toBe(true);
    expect(await h.adapter.getPrincipalAccessToken()).toBe("ATK_test_access_token");
    expect(await h.adapter.getTenantAccessToken("acme")).toBeNull();
    expect(h.tenantStore.tenantId).toBeNull();
  });

  it("evicts the tenant token exactly at the expiry boundary", async () => {
    const h = await tenantResidentHarness();
    h.clock.value = T0 + 300 * 1000 - 1;
    expect(await h.adapter.getTenantAccessToken("acme")).toBe(ACME_TENANT_JWT);
    h.clock.value = T0 + 300 * 1000;
    expect(await h.adapter.getTenantAccessToken("acme")).toBeNull();
    expect(h.tenantStore.accessToken).toBeNull(); // evicted, not retained
  });

  it("a callback failure clears principal, tenant, and transaction state", async () => {
    const h = await tenantResidentHarness();
    const bogus = await h.adapter.completeAuthorizationCallback(callbackUrl("no-such-state"));
    expect(bogus.ok).toBe(false);
    expect(await h.adapter.getTenantAccessToken("acme")).toBeNull();
    expect(await h.adapter.getPrincipalAccessToken()).toBeNull();
    expect(h.map.size).toBe(0);
  });

  it("logout clears principal token, tenant token, and the pending transaction", async () => {
    const h = await tenantResidentHarness();
    await h.adapter.beginWorkspaceAuthentication("acme"); // leave a txn behind
    expect(h.map.size).toBe(1);
    await h.adapter.logout();
    expect(await h.adapter.getPrincipalAccessToken()).toBeNull();
    expect(await h.adapter.getTenantAccessToken("acme")).toBeNull();
    expect(h.tenantStore.tenantId).toBeNull();
    expect(h.map.size).toBe(0);
  });

  it("logout after tenant authentication keeps the end-session URL token-free", async () => {
    const h = await tenantResidentHarness();
    await h.adapter.logout();
    const logoutUrl = h.redirects[h.redirects.length - 1];
    const url = new URL(logoutUrl);
    expect(`${url.origin}${url.pathname}`).toBe(
      "http://127.0.0.1:8814/realms/sp2-local/protocol/openid-connect/logout",
    );
    expect([...url.searchParams.keys()].sort()).toEqual(["client_id", "post_logout_redirect_uri"]);
    expect(logoutUrl).not.toContain(ACME_TENANT_JWT);
    expect(logoutUrl).not.toContain("SIGNATURE_TEST_DOUBLE");
  });

  it("getResidentTenantId reads the sole resident id with exact boundary eviction", async () => {
    const h = await tenantResidentHarness();
    expect(getResidentTenantId(T0, h.tenantStore)).toBe("acme");
    expect(getResidentTenantId(T0 + 300 * 1000 - 1, h.tenantStore)).toBe("acme");
    expect(getResidentTenantId(T0 + 300 * 1000, h.tenantStore)).toBeNull();
    expect(h.tenantStore.accessToken).toBeNull(); // evicted
    expect(getResidentTenantId(T0, h.tenantStore)).toBeNull();
  });

  it("getResidentTenantId returns null when no tenant authentication is resident", () => {
    expect(getResidentTenantId(T0, createInMemoryTenantTokenStore())).toBeNull();
  });

  it("keeps tenant tokens out of local/session storage (memory only)", async () => {
    const h = makeHarness({ responses: [tokenResponse({ access_token: ACME_TENANT_JWT })] });
    const { writes } = await withRecordingLocalStorage(async () => tenantCallback(h, "acme"));
    expect(writes).toHaveLength(0);
    for (const value of h.map.values()) {
      expect(value).not.toContain(ACME_TENANT_JWT);
    }
  });
});

describe("resolveSp2BootstrapPosture — §12 selection", () => {
  const FULL: Sp2RealIntegrationEnv = {
    gatewayBaseUrl: "http://127.0.0.1:8815",
    issuer: "http://127.0.0.1:8814/realms/sp2-local",
    clientId: "sp2-local-web",
    redirectUri: "http://localhost:5173/sp2-gateway/callback",
    postLogoutRedirectUri: undefined,
  };
  const EMPTY: Sp2RealIntegrationEnv = {
    gatewayBaseUrl: undefined,
    issuer: undefined,
    clientId: undefined,
    redirectUri: undefined,
    postLogoutRedirectUri: undefined,
  };

  it("selects the real adapter when the complete real configuration is present", () => {
    for (const isProd of [true, false]) {
      const posture = resolveSp2BootstrapPosture(FULL, isProd);
      expect(posture.kind).toBe("real");
      if (posture.kind === "real") {
        expect(posture.gatewayBaseUrl).toBe("http://127.0.0.1:8815");
        expect(posture.adapterConfig).toEqual({
          issuer: "http://127.0.0.1:8814/realms/sp2-local",
          clientId: "sp2-local-web",
          redirectUri: "http://localhost:5173/sp2-gateway/callback",
          postLogoutRedirectUri: null,
        });
      }
    }
  });

  it("accepts an HTTPS issuer and carries the optional post-logout URI", () => {
    const posture = resolveSp2BootstrapPosture(
      {
        ...FULL,
        issuer: "https://idp.example.com/realms/sp2",
        postLogoutRedirectUri: "https://app.example.com/sp2-gateway",
      },
      true,
    );
    expect(posture.kind).toBe("real");
    if (posture.kind === "real") {
      expect(posture.adapterConfig.postLogoutRedirectUri).toBe(
        "https://app.example.com/sp2-gateway",
      );
    }
  });

  it("fails closed on every partial configuration in both modes", () => {
    const drops: Array<keyof Sp2RealIntegrationEnv> = [
      "gatewayBaseUrl",
      "issuer",
      "clientId",
      "redirectUri",
    ];
    for (const key of drops) {
      for (const isProd of [true, false]) {
        const env = { ...FULL, [key]: undefined };
        expect(resolveSp2BootstrapPosture(env, isProd).kind).toBe("fail_closed");
      }
    }
    // A lone post-logout URI is still partial (mixed mock/real is forbidden).
    expect(
      resolveSp2BootstrapPosture(
        { ...EMPTY, postLogoutRedirectUri: "http://localhost:5173/sp2-gateway" },
        false,
      ).kind,
    ).toBe("fail_closed");
  });

  it("fails closed on invalid or non-loopback-HTTP issuer and invalid URLs", () => {
    expect(resolveSp2BootstrapPosture({ ...FULL, issuer: "not-a-url" }, true).kind).toBe(
      "fail_closed",
    );
    expect(
      resolveSp2BootstrapPosture({ ...FULL, issuer: "http://keycloak.example.com/realms/x" }, true)
        .kind,
    ).toBe("fail_closed");
    expect(
      resolveSp2BootstrapPosture({ ...FULL, issuer: "ftp://127.0.0.1/realms/x" }, true).kind,
    ).toBe("fail_closed");
    expect(
      resolveSp2BootstrapPosture({ ...FULL, redirectUri: "/sp2-gateway/callback" }, true).kind,
    ).toBe("fail_closed");
    expect(resolveSp2BootstrapPosture({ ...FULL, gatewayBaseUrl: "not a url" }, true).kind).toBe(
      "fail_closed",
    );
  });

  it("production without real configuration fails closed (never the mock)", () => {
    expect(resolveSp2BootstrapPosture(EMPTY, true).kind).toBe("fail_closed");
  });

  it("development with all real-integration variables absent selects the explicit dev mock", () => {
    expect(resolveSp2BootstrapPosture(EMPTY, false).kind).toBe("dev_mock");
    expect(
      resolveSp2BootstrapPosture(
        {
          gatewayBaseUrl: "",
          issuer: "   ",
          clientId: "",
          redirectUri: "",
          postLogoutRedirectUri: "",
        },
        false,
      ).kind,
    ).toBe("dev_mock");
  });
});
