import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  KeycloakSnackPortalAuthAdapter,
  resolveSp2BootstrapPosture,
  type CallbackFailureReason,
  type Sp2RealIntegrationEnv,
} from "@/lib/sp2/keycloak-auth-adapter";

/**
 * /sp2-gateway/callback — the exact Authorization Code + PKCE redirect URI
 * target (START-GATE §9). The adapter reads code/state/error, immediately
 * strips them from browser history, consumes the single-use transaction,
 * exchanges the code directly with local Keycloak, holds the access token in
 * memory only, and navigates back to /sp2-gateway. Every error renders a
 * controlled fail-closed state; no parameter value is ever logged or shown.
 */
export const Route = createFileRoute("/sp2-gateway/callback")({
  head: () => ({
    meta: [
      { title: "SnackPortal2 Gateway — Completing sign-in" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CallbackEntry,
});

type CallbackUi =
  | { kind: "working" }
  | { kind: "config_unavailable" }
  | { kind: "error"; reason: CallbackFailureReason | "unexpected_error" };

function CallbackEntry() {
  const navigate = useNavigate();
  const [ui, setUi] = useState<CallbackUi>({ kind: "working" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // §9 step 2 — capture the callback URL, then strip code/state/error
      // from browser history IMMEDIATELY, before any other handling
      // (including the fail-closed configuration path below).
      const callbackHref = window.location.href;
      window.history.replaceState(null, "", window.location.pathname);

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
      if (posture.kind !== "real") {
        // The callback only exists for the real adapter. Without complete
        // real configuration it fails closed and never imports mocks.
        if (!cancelled) setUi({ kind: "config_unavailable" });
        return;
      }
      const adapter = new KeycloakSnackPortalAuthAdapter(posture.adapterConfig);
      const result = await adapter.completeAuthorizationCallback(callbackHref);
      if (cancelled) return;
      if (result.ok) {
        // SPA navigation (no reload) so the in-memory token survives. The
        // adapter already sanitized the return path; this slice always
        // returns to the journey route.
        void navigate({ to: "/sp2-gateway", replace: true });
        return;
      }
      setUi({ kind: "error", reason: result.reason });
    })().catch(() => {
      // Controlled fail-closed terminal state for anything unexpected
      // (e.g. a throwing storage implementation) — never hang on "working".
      if (!cancelled) setUi({ kind: "error", reason: "unexpected_error" });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">SnackPortal2 Gateway</h1>
        {ui.kind === "working" && (
          <div className="rounded-md border border-border bg-muted p-4 text-sm text-muted-foreground">
            Completing sign-in…
          </div>
        )}
        {ui.kind === "config_unavailable" && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="font-medium">Configuration unavailable</div>
            <p className="mt-1">
              The sign-in callback is unavailable because the real Gateway and identity-provider
              configuration is not complete. No sign-in was performed.
            </p>
          </div>
        )}
        {ui.kind === "error" && (
          <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            <div className="font-medium">Sign-in could not be completed</div>
            <p className="mt-1">
              The sign-in attempt was rejected and no session was created. You can return and try
              again.
            </p>
            <p className="mt-1 font-mono text-[11px]">reason: {ui.reason}</p>
          </div>
        )}
        {ui.kind !== "working" && (
          <Link to="/sp2-gateway" className="text-sm underline underline-offset-4">
            Return to the Gateway journey
          </Link>
        )}
      </div>
    </div>
  );
}
