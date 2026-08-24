import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SP2AuthProvider, useSP2Auth } from "@/lib/sp2/auth-context";
import type { SnackPortalAuthAdapter } from "@/lib/sp2/auth-adapter";
import {
  KeycloakSnackPortalAuthAdapter,
  getResidentTenantId,
  resolveSp2BootstrapPosture,
  type Sp2RealIntegrationEnv,
} from "@/lib/sp2/keycloak-auth-adapter";
import { decideTenantJourney } from "@/lib/sp2/tenant-journey";
import { SnackPortalGatewayClient } from "@/lib/sp2/gateway-client";
import {
  DISPLAY_NAME_MAX,
  SHORT_DESCRIPTION_MAX,
  type GatewayOutcome,
  type TenantStartupDetailDTO,
  type WorkspaceMembershipDTO,
} from "@/lib/sp2/dto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/sp2-gateway/")({
  head: () => ({
    meta: [
      { title: "SnackPortal2 Gateway — Controlled MVP" },
      {
        name: "description",
        content:
          "Controlled MVP: sign in, select ACME, and edit a Startup short description via the SnackPortal2 Gateway.",
      },
      { property: "og:title", content: "SnackPortal2 Gateway — Controlled MVP" },
      {
        property: "og:description",
        content: "SnackPortal2 Gateway controlled MVP preview.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RouteEntry,
});

type Bootstrap =
  | { kind: "loading" }
  | { kind: "fail_closed" }
  | {
      kind: "ready";
      adapter: SnackPortalAuthAdapter;
      fetchImpl: typeof fetch | undefined;
      baseUrl: string;
      isMock: boolean;
    };

function RouteEntry() {
  const [boot, setBoot] = useState<Bootstrap>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const env: Sp2RealIntegrationEnv = {
        gatewayBaseUrl: import.meta.env.VITE_SP2_GATEWAY_BASE_URL as string | undefined,
        issuer: import.meta.env.VITE_SP2_OIDC_ISSUER as string | undefined,
        clientId: import.meta.env.VITE_SP2_OIDC_CLIENT_ID as string | undefined,
        redirectUri: import.meta.env.VITE_SP2_OIDC_REDIRECT_URI as string | undefined,
        postLogoutRedirectUri: import.meta.env.VITE_SP2_OIDC_POST_LOGOUT_REDIRECT_URI as
          | string
          | undefined,
      };
      const posture = resolveSp2BootstrapPosture(env, import.meta.env.PROD);

      if (posture.kind === "real") {
        // Complete real configuration — construct the real Keycloak adapter
        // and the real BFF client (global fetch). Never import mock modules
        // on this path. No startup reference is configured here, in either
        // posture: the journey obtains one from the server by listing the
        // active tenant's Startups, or by creating one. A tenant record
        // reference is never a build-time constant.
        if (!cancelled)
          setBoot({
            kind: "ready",
            adapter: new KeycloakSnackPortalAuthAdapter(posture.adapterConfig),
            // Receiver-safe wrapper around the real global fetch. The client
            // invokes fetchImpl as a method (`this.fetchImpl(...)`); native
            // window.fetch is brand-checked and throws "Illegal invocation"
            // when called with a foreign receiver, so never hand it over
            // unbound.
            fetchImpl: (input, init) => fetch(input, init),
            baseUrl: posture.gatewayBaseUrl,
            isMock: false,
          });
        return;
      }

      if (posture.kind === "fail_closed") {
        // Partial/invalid real configuration, or production without real
        // configuration => fail closed. Do NOT import any mock module; keep
        // them out of the production bundle. Production never falls back to
        // the mock; mixed mock/real configuration is forbidden.
        if (!cancelled) setBoot({ kind: "fail_closed" });
        return;
      }

      // posture is "dev_mock", which resolveSp2BootstrapPosture never returns
      // in production. Keep this additional STATIC guard so bundlers can
      // prove the mock imports below are unreachable and exclude the mock
      // modules from every production artifact (client and SSR).
      if (import.meta.env.PROD) {
        if (!cancelled) setBoot({ kind: "fail_closed" });
        return;
      }

      // Development preview only: explicitly opt in to the mock adapter and
      // mock Gateway via dynamic import so bundlers can tree-shake them out
      // of production output.
      const [{ MockSnackPortalAuthAdapter }, mockGw] = await Promise.all([
        import("@/lib/sp2/mock-auth-adapter"),
        import("@/lib/sp2/mock-gateway"),
      ]);
      if (cancelled) return;
      setBoot({
        kind: "ready",
        adapter: new MockSnackPortalAuthAdapter({
          authorizedTenants: new Set(["acme"]),
        }),
        fetchImpl: mockGw.mockGatewayFetch,
        baseUrl: "/sp2-gateway-dev",
        isMock: true,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (boot.kind === "loading") {
    return (
      <div className="min-h-screen bg-muted/30 px-4 py-10">
        <div className="mx-auto max-w-2xl text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (boot.kind === "fail_closed") {
    return <FailClosed />;
  }

  return (
    <SP2AuthProvider adapter={boot.adapter}>
      <GatewayJourney baseUrl={boot.baseUrl} fetchImpl={boot.fetchImpl} isMock={boot.isMock} />
    </SP2AuthProvider>
  );
}

function FailClosed() {
  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">SnackPortal2 Gateway</h1>
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="font-medium">Configuration unavailable</div>
          <p className="mt-1">
            The Gateway is not configured for this environment and no real authentication adapter
            has been provided. This journey is unavailable until the controlled-local Keycloak and
            Gateway are wired.
          </p>
        </div>
      </div>
    </div>
  );
}

function GatewayJourney({
  baseUrl,
  fetchImpl,
  isMock,
}: {
  baseUrl: string;
  fetchImpl: typeof fetch | undefined;
  isMock: boolean;
}) {
  const { signedIn, signIn, signOut, adapter } = useSP2Auth();
  const gw = useMemo(
    () => new SnackPortalGatewayClient({ baseUrl, fetchImpl }),
    [baseUrl, fetchImpl],
  );

  const [membershipsState, setMembershipsState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "empty" }
    | { kind: "ok"; items: WorkspaceMembershipDTO[] }
    | { kind: "error"; outcome: GatewayOutcome<unknown>["kind"] }
  >({ kind: "idle" });

  const [activeTenant, setActiveTenant] = useState<string | null>(null);

  // The active tenant's Startups, from GET /tenant/startups. This is where a
  // REAL record reference comes from: the browser holds no hard-coded tenant
  // record reference and never fabricates one.
  const [startupsState, setStartupsState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok"; items: TenantStartupDetailDTO[] }
    | { kind: "error"; outcome: GatewayOutcome<unknown>["kind"] }
  >({ kind: "idle" });

  const [newStartupName, setNewStartupName] = useState<string>("");
  const [createState, setCreateState] = useState<
    | { kind: "idle" }
    | { kind: "creating" }
    | { kind: "error"; outcome: GatewayOutcome<unknown>["kind"] }
  >({ kind: "idle" });

  const [startupState, setStartupState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok"; data: TenantStartupDetailDTO }
    | { kind: "error"; outcome: GatewayOutcome<unknown>["kind"] }
  >({ kind: "idle" });

  const [draft, setDraft] = useState<string>("");
  const [saveState, setSaveState] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "ok" }
    | { kind: "error"; outcome: GatewayOutcome<unknown>["kind"] }
  >({ kind: "idle" });

  const [signInKickoffFailed, setSignInKickoffFailed] = useState(false);

  // §6.5: presentation-only "active tenant ready" state, derived EXCLUSIVELY
  // from the resident (claim-verified) tenant authentication on route mount
  // after the tenant callback — never from a selector click. It is not
  // server-confirmed authorization; the Gateway has not been called.
  const [residentTenant, setResidentTenant] = useState<string | null>(null);

  useEffect(() => {
    setResidentTenant(getResidentTenantId());
  }, []);

  // After the TENANT callback, the resident tenant authentication is the only
  // authentication in memory: the adapter's sequential model clears the
  // principal token when a tenant token is stored, so `signedIn` is false here
  // by design. The workspace is nevertheless authenticated, and this is where
  // its records are asked for.
  //
  // The active tenant comes from `getResidentTenantId()` — the value the
  // callback match-or-rejected against the returned signed claim — and never
  // from a selector click. §6.3/§6.4 are unchanged: a click may only START
  // authentication, and activation still requires a real tenant token.
  useEffect(() => {
    if (residentTenant === null || activeTenant !== null) return;
    setActiveTenant(residentTenant);
    void loadStartups(residentTenant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residentTenant]);

  // After the PKCE callback SPA-navigates back here, the principal token is
  // already in adapter memory — resume the signed-in journey without another
  // kickoff. (The token is never read out of any storage; memory only.)
  useEffect(() => {
    if (signedIn) return;
    let cancelled = false;
    void adapter.getPrincipalAccessToken().then((token) => {
      if (!cancelled && token) void signIn();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  async function beginRealSignIn() {
    setSignInKickoffFailed(false);
    try {
      // Redirects to the Keycloak authorization endpoint; does not resolve
      // into a signed-in state in-page.
      await adapter.beginPrincipalAuthentication();
    } catch {
      setSignInKickoffFailed(true);
    }
  }

  async function loadMemberships() {
    setMembershipsState({ kind: "loading" });
    const token = await adapter.getPrincipalAccessToken();
    if (!token) {
      setMembershipsState({ kind: "error", outcome: "unauthorized" });
      return;
    }
    const outcome = await gw.listMemberships(token);
    if (outcome.kind !== "ok") {
      setMembershipsState({ kind: "error", outcome: outcome.kind });
      return;
    }
    if (outcome.data.length === 0) {
      setMembershipsState({ kind: "empty" });
      return;
    }
    setMembershipsState({ kind: "ok", items: outcome.data });
  }

  useEffect(() => {
    if (signedIn) loadMemberships();
    else {
      setMembershipsState({ kind: "idle" });
      // §6.6: deliberately does NOT touch residentTenant — the principal
      // signed-out reset never erases a valid resident tenant presentation,
      // and (since the tenant callback clears the principal token) must not
      // tear down a tenant journey that is the only authentication in memory.
      if (residentTenant === null) {
        setActiveTenant(null);
        setStartupsState({ kind: "idle" });
        setStartupState({ kind: "idle" });
        setCreateState({ kind: "idle" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  async function selectWorkspace(tenantId: string) {
    // §6.3: a selector click may only START authentication — it never
    // establishes the active tenant. The real adapter performs the same
    // top-level visible redirect as principal sign-in and does not resolve
    // into tenant state in-page.
    await adapter.beginWorkspaceAuthentication(tenantId);
    // §6.4: activation requires an actual resident tenant token. The dev
    // mock completes synchronously so a token exists here; the real posture
    // has navigated away and returns null, so no active state is ever set
    // before the claim-verified callback.
    const token = await adapter.getTenantAccessToken(tenantId);
    if (!token) return;
    setActiveTenant(tenantId);
    setStartupState({ kind: "idle" });
    await loadStartups(tenantId);
  }

  /** GET /tenant/startups for the active tenant — the source of every record reference. */
  async function loadStartups(tenantId: string) {
    setStartupsState({ kind: "loading" });
    setCreateState({ kind: "idle" });
    const token = await adapter.getTenantAccessToken(tenantId);
    if (!token) {
      setStartupsState({ kind: "error", outcome: "unauthorized" });
      return;
    }
    const outcome = await gw.listTenantStartups(token, tenantId);
    if (outcome.kind !== "ok") {
      setStartupsState({ kind: "error", outcome: outcome.kind });
      return;
    }
    setStartupsState({ kind: "ok", items: outcome.data });
  }

  /** POST /tenant/startups, then open the record the SERVER minted a reference for. */
  async function createStartup(tenantId: string, displayName: string) {
    setCreateState({ kind: "creating" });
    const token = await adapter.getTenantAccessToken(tenantId);
    if (!token) {
      setCreateState({ kind: "error", outcome: "unauthorized" });
      return;
    }
    const outcome = await gw.createTenantStartup(token, tenantId, { display_name: displayName });
    if (outcome.kind !== "ok") {
      setCreateState({ kind: "error", outcome: outcome.kind });
      return;
    }
    setCreateState({ kind: "idle" });
    setNewStartupName("");
    await loadStartups(tenantId);
    await loadStartup(tenantId, outcome.data.record_ref);
  }

  async function loadStartup(tenantId: string, startupRef: string) {
    // The no-Startup boundary (START-GATE §7): every Startup request decision
    // still flows through decideTenantJourney, so an absent or blank reference
    // cannot produce a request. What changed is where the reference comes
    // from — a server response rather than build-time configuration.
    const journey = decideTenantJourney(startupRef);
    if (!journey.loadStartup) return;
    setStartupState({ kind: "loading" });
    const token = await adapter.getTenantAccessToken(tenantId);
    if (!token) {
      setStartupState({ kind: "error", outcome: "unauthorized" });
      return;
    }
    const outcome = await gw.getTenantStartup(token, tenantId, journey.startupRef);
    if (outcome.kind !== "ok") {
      setStartupState({ kind: "error", outcome: outcome.kind });
      return;
    }
    setStartupState({ kind: "ok", data: outcome.data });
    setDraft(outcome.data.short_description ?? "");
    setSaveState({ kind: "idle" });
  }

  async function saveDescription(next: string | null) {
    if (!activeTenant || startupState.kind !== "ok") return;
    setSaveState({ kind: "saving" });
    const token = await adapter.getTenantAccessToken(activeTenant);
    if (!token) {
      setSaveState({ kind: "error", outcome: "unauthorized" });
      return;
    }
    const outcome = await gw.updateTenantStartup(
      token,
      activeTenant,
      startupState.data.record_ref,
      { short_description: next },
    );
    if (outcome.kind !== "ok") {
      setSaveState({ kind: "error", outcome: outcome.kind });
      return;
    }
    setStartupState({ kind: "ok", data: outcome.data });
    setDraft(outcome.data.short_description ?? "");
    setSaveState({ kind: "ok" });
  }

  async function handleSignOut() {
    // §5.6: logout clears principal token, tenant token, and transaction
    // memory; the local presentation state is dropped with it.
    setResidentTenant(null);
    await signOut();
  }

  const over = draft.length > SHORT_DESCRIPTION_MAX;

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">SnackPortal2 Gateway</h1>
            <p className="text-xs text-muted-foreground">
              Controlled MVP · {isMock ? "development mock" : "gateway"} · not production
            </p>
          </div>
          {(signedIn || residentTenant !== null) && (
            <Button variant="outline" size="sm" onClick={() => void handleSignOut()}>
              Sign out
            </Button>
          )}
        </header>

        {!signedIn && residentTenant === null ? (
          <Panel title="Sign in">
            {isMock ? (
              <>
                <p className="mb-4 text-sm text-muted-foreground">
                  Continue to sign in. Development mock only — the real controlled-local Keycloak
                  adapter is selected when the real configuration is present.
                </p>
                <Button onClick={() => void signIn()}>Continue</Button>
              </>
            ) : (
              <>
                <p className="mb-4 text-sm text-muted-foreground">
                  Sign in with the controlled-local identity provider (Authorization Code with
                  PKCE).
                </p>
                <Button onClick={() => void beginRealSignIn()}>Sign in</Button>
                {signInKickoffFailed && (
                  <div className="mt-3">
                    <StatusNote tone="error">
                      Sign-in could not be started. Please try again.
                    </StatusNote>
                  </div>
                )}
              </>
            )}
          </Panel>
        ) : (
          <>
            {residentTenant !== null && (
              <Panel title={`Workspace — ${residentTenant}`}>
                <StatusNote tone="ok">
                  Tenant workspace <span className="font-mono">{residentTenant}</span> is
                  authenticated. The active tenant is the signed claim the callback verified — not
                  the workspace that was clicked.
                </StatusNote>
              </Panel>
            )}

            {signedIn && (
              <Panel title="Memberships">
                {membershipsState.kind === "loading" && (
                  <StatusNote>Loading memberships…</StatusNote>
                )}
                {membershipsState.kind === "empty" && (
                  <StatusNote tone="warn">No workspace available.</StatusNote>
                )}
                {membershipsState.kind === "error" && (
                  <MembershipError outcome={membershipsState.outcome} onRetry={loadMemberships} />
                )}
                {membershipsState.kind === "ok" && (
                  <ul className="space-y-2">
                    {membershipsState.items.map((m) => {
                      const isActive = activeTenant === m.tenant_id;
                      return (
                        <li
                          key={m.tenant_id}
                          className="flex items-center justify-between rounded-md border border-border bg-background p-3"
                        >
                          <div>
                            <div className="text-sm font-medium">{m.tenant_id}</div>
                            <div className="text-[11px] text-muted-foreground">role: {m.role}</div>
                          </div>
                          <Button
                            size="sm"
                            variant={isActive ? "secondary" : "default"}
                            onClick={() => void selectWorkspace(m.tenant_id)}
                          >
                            {isActive ? "Selected" : "Select"}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
            )}

            {activeTenant && (
              <Panel title={`Startups — ${activeTenant}`}>
                {startupsState.kind === "loading" && <StatusNote>Loading startups…</StatusNote>}
                {startupsState.kind === "error" && (
                  <StartupError
                    outcome={startupsState.outcome}
                    onRetry={() => void loadStartups(activeTenant)}
                  />
                )}
                {startupsState.kind === "ok" && startupsState.items.length > 0 && (
                  <ul className="mb-4 space-y-2">
                    {startupsState.items.map((s) => {
                      const isOpen =
                        startupState.kind === "ok" && startupState.data.record_ref === s.record_ref;
                      return (
                        <li
                          key={s.record_ref}
                          className="flex items-center justify-between rounded-md border border-border bg-background p-3"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{s.display_name}</div>
                            <div className="truncate font-mono text-[11px] text-muted-foreground">
                              {s.record_ref}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={isOpen ? "secondary" : "default"}
                            onClick={() => void loadStartup(activeTenant, s.record_ref)}
                          >
                            {isOpen ? "Open" : "Open"}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {startupsState.kind === "ok" && startupsState.items.length === 0 && (
                  <div className="mb-4">
                    <StatusNote tone="warn">
                      This tenant holds no Startups yet. Create one to continue — it is written to
                      this tenant&apos;s own physical database.
                    </StatusNote>
                  </div>
                )}
                {startupsState.kind === "ok" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="new_startup" className="text-xs uppercase tracking-wide">
                      Add a Startup
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        id="new_startup"
                        value={newStartupName}
                        placeholder="Organization name"
                        maxLength={DISPLAY_NAME_MAX}
                        onChange={(e) => setNewStartupName(e.target.value)}
                        className="max-w-xs"
                      />
                      <Button
                        size="sm"
                        disabled={
                          newStartupName.trim().length === 0 || createState.kind === "creating"
                        }
                        onClick={() => void createStartup(activeTenant, newStartupName)}
                      >
                        {createState.kind === "creating" ? "Creating…" : "Create"}
                      </Button>
                    </div>
                    {createState.kind === "error" && (
                      <StatusNote tone="error">
                        {createState.outcome === "forbidden"
                          ? "Access denied."
                          : createState.outcome === "unauthorized"
                            ? "Session expired. Please sign in again."
                            : createState.outcome === "too_large"
                              ? "That name exceeds the permitted bound."
                              : "The Startup could not be created."}
                      </StatusNote>
                    )}
                  </div>
                )}
              </Panel>
            )}

            {activeTenant && startupState.kind !== "idle" && (
              <Panel title={`Startup — ${activeTenant}`}>
                {startupState.kind === "loading" && <StatusNote>Loading startup…</StatusNote>}
                {startupState.kind === "error" && (
                  <StartupError
                    outcome={startupState.outcome}
                    onRetry={() => void loadStartups(activeTenant)}
                  />
                )}
                {startupState.kind === "ok" && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs uppercase tracking-wide">Name</Label>
                      <div className="text-base font-medium">{startupState.data.display_name}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <div className="uppercase tracking-wide text-muted-foreground">Stage</div>
                        <div>{startupState.data.investment_stage ?? "—"}</div>
                      </div>
                      <div>
                        <div className="uppercase tracking-wide text-muted-foreground">Ref</div>
                        <div className="font-mono">{startupState.data.record_ref}</div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="short_desc" className="text-xs uppercase tracking-wide">
                          Short description
                        </Label>
                        <span
                          className={`text-[11px] ${over ? "text-red-600" : "text-muted-foreground"}`}
                        >
                          {draft.length} / {SHORT_DESCRIPTION_MAX}
                        </span>
                      </div>
                      <Textarea
                        id="short_desc"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={4}
                        maxLength={SHORT_DESCRIPTION_MAX + 100}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={over || saveState.kind === "saving"}
                          onClick={() => void saveDescription(draft)}
                        >
                          {saveState.kind === "saving" ? "Saving…" : "Save"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saveState.kind === "saving"}
                          onClick={() => void saveDescription(null)}
                        >
                          Clear
                        </Button>
                      </div>
                      {saveState.kind === "ok" && <StatusNote tone="ok">Saved.</StatusNote>}
                      {saveState.kind === "error" && <SaveError outcome={saveState.outcome} />}
                    </div>
                  </div>
                )}
              </Panel>
            )}
          </>
        )}

        <p className="text-center text-[11px] text-muted-foreground">
          Mode:{" "}
          <span className="font-mono">{isMock ? "development mock (explicit)" : "gateway"}</span>
        </p>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatusNote({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "warn" | "error" | "ok";
  children: React.ReactNode;
}) {
  const cls =
    tone === "error"
      ? "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
      : tone === "warn"
        ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
        : tone === "ok"
          ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
          : "border-border bg-muted text-muted-foreground";
  return <div className={`rounded-md border p-3 text-sm ${cls}`}>{children}</div>;
}

function MembershipError({
  outcome,
  onRetry,
}: {
  outcome: GatewayOutcome<unknown>["kind"];
  onRetry: () => void;
}) {
  const msg =
    outcome === "unauthorized"
      ? "Session expired. Please sign in again."
      : outcome === "forbidden"
        ? "Access denied."
        : outcome === "unavailable"
          ? "Gateway unavailable."
          : outcome === "network_error"
            ? "Connection unavailable."
            : "Memberships could not be loaded.";
  return (
    <div className="space-y-2">
      <StatusNote tone="error">{msg}</StatusNote>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function StartupError({
  outcome,
  onRetry,
}: {
  outcome: GatewayOutcome<unknown>["kind"];
  onRetry: () => void;
}) {
  const msg =
    outcome === "unauthorized"
      ? "Session expired. Please sign in again."
      : outcome === "forbidden"
        ? "Access denied. No tenant data shown."
        : outcome === "not_found"
          ? "Startup not found."
          : outcome === "unavailable"
            ? "Gateway unavailable."
            : outcome === "network_error"
              ? "Connection unavailable."
              : "Startup could not be loaded.";
  return (
    <div className="space-y-2">
      <StatusNote tone="error">{msg}</StatusNote>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function SaveError({ outcome }: { outcome: GatewayOutcome<unknown>["kind"] }) {
  const msg =
    outcome === "too_large"
      ? "Description exceeds the permitted bound."
      : outcome === "unauthorized"
        ? "Session expired. Please sign in again."
        : outcome === "forbidden"
          ? "Access denied."
          : outcome === "not_found"
            ? "Startup not found."
            : outcome === "unavailable"
              ? "Gateway unavailable. Please try again."
              : outcome === "network_error"
                ? "Connection unavailable. Unsaved text retained in memory."
                : "Save failed.";
  return <StatusNote tone="error">{msg}</StatusNote>;
}
