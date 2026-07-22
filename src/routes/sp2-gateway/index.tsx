import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SP2AuthProvider, useSP2Auth } from "@/lib/sp2/auth-context";
import type { SnackPortalAuthAdapter } from "@/lib/sp2/auth-adapter";
import {
  SnackPortalGatewayClient,
  getGatewayBaseUrl,
} from "@/lib/sp2/gateway-client";
import {
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

const DEMO_STARTUP_REF = "stp_demo_001";

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
      const configured = getGatewayBaseUrl();
      const isProd = import.meta.env.PROD;

      if (configured) {
        // Real Gateway configured — never touch mock modules.
        // A real IdP-backed adapter is not wired yet, so fail closed until it
        // is provided. This keeps production from silently using the mock.
        if (!cancelled) setBoot({ kind: "fail_closed" });
        return;
      }

      if (isProd) {
        // Production + no Gateway configured => fail closed. Do NOT import
        // any mock module; keep them out of the production bundle.
        if (!cancelled) setBoot({ kind: "fail_closed" });
        return;
      }

      // Development preview only: explicitly opt in to the mock adapter and
      // mock Gateway via dynamic import so bundlers can tree-shake them out
      // of production output.
      const [{ MockSnackPortalAuthAdapter }, { mockGatewayFetch }] = await Promise.all([
        import("@/lib/sp2/mock-auth-adapter"),
        import("@/lib/sp2/mock-gateway"),
      ]);
      if (cancelled) return;
      setBoot({
        kind: "ready",
        adapter: new MockSnackPortalAuthAdapter({
          authorizedTenants: new Set(["acme"]),
        }),
        fetchImpl: mockGatewayFetch,
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
        <div className="mx-auto max-w-2xl text-sm text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  if (boot.kind === "fail_closed") {
    return <FailClosed />;
  }

  return (
    <SP2AuthProvider adapter={boot.adapter}>
      <GatewayJourney
        baseUrl={boot.baseUrl}
        fetchImpl={boot.fetchImpl}
        isMock={boot.isMock}
      />
    </SP2AuthProvider>
  );
}

function FailClosed() {
  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          SnackPortal2 Gateway
        </h1>
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="font-medium">Configuration unavailable</div>
          <p className="mt-1">
            The Gateway is not configured for this environment and no real
            authentication adapter has been provided. This journey is
            unavailable until the controlled-local Keycloak and Gateway are
            wired.
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
      setActiveTenant(null);
      setStartupState({ kind: "idle" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  async function selectWorkspace(tenantId: string) {
    await adapter.beginWorkspaceAuthentication(tenantId);
    setActiveTenant(tenantId);
    await loadStartup(tenantId);
  }

  async function loadStartup(tenantId: string) {
    setStartupState({ kind: "loading" });
    const token = await adapter.getTenantAccessToken(tenantId);
    if (!token) {
      setStartupState({ kind: "error", outcome: "unauthorized" });
      return;
    }
    const outcome = await gw.getTenantStartup(token, tenantId, DEMO_STARTUP_REF);
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

  const over = draft.length > SHORT_DESCRIPTION_MAX;

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              SnackPortal2 Gateway
            </h1>
            <p className="text-xs text-muted-foreground">
              Controlled MVP · {isMock ? "development mock" : "gateway"} · not production
            </p>
          </div>
          {signedIn && (
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              Sign out
            </Button>
          )}
        </header>

        {!signedIn ? (
          <Panel title="Sign in">
            <p className="mb-4 text-sm text-muted-foreground">
              Continue to sign in. Real controlled-local Keycloak is not wired
              in this preview.
            </p>
            <Button onClick={() => void signIn()}>Continue</Button>
          </Panel>
        ) : (
          <>
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
                          <div className="text-[11px] text-muted-foreground">
                            role: {m.role}
                          </div>
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

            {activeTenant && (
              <Panel title={`Startup — ${activeTenant}`}>
                {startupState.kind === "loading" && (
                  <StatusNote>Loading startup…</StatusNote>
                )}
                {startupState.kind === "error" && (
                  <StartupError
                    outcome={startupState.outcome}
                    onRetry={() => void loadStartup(activeTenant)}
                  />
                )}
                {startupState.kind === "ok" && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs uppercase tracking-wide">Name</Label>
                      <div className="text-base font-medium">
                        {startupState.data.display_name}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <div className="uppercase tracking-wide text-muted-foreground">
                          Stage
                        </div>
                        <div>{startupState.data.investment_stage ?? "—"}</div>
                      </div>
                      <div>
                        <div className="uppercase tracking-wide text-muted-foreground">
                          Ref
                        </div>
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
                      {saveState.kind === "ok" && (
                        <StatusNote tone="ok">Saved.</StatusNote>
                      )}
                      {saveState.kind === "error" && (
                        <SaveError outcome={saveState.outcome} />
                      )}
                    </div>
                  </div>
                )}
              </Panel>
            )}
          </>
        )}

        <p className="text-center text-[11px] text-muted-foreground">
          Mode: <span className="font-mono">{isMock ? "development mock (explicit)" : "gateway"}</span>
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

function StatusNote({ tone = "neutral", children }: { tone?: "neutral" | "warn" | "error" | "ok"; children: React.ReactNode }) {
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

void Input;
