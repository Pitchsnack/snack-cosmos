// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// ---------------------------------------------------------------------------------------------
// SnackPortal2 Stage 6 — local development proxy to the FastAPI BFF.
//
// The target architecture is `Frontend -> BFF` (D-46). The BFF is the single frontend-facing
// ingress and the ONLY service published locally, on 127.0.0.1:8000.
//
// WHY A DEV PROXY RATHER THAN CORS ON THE BACKEND.
// Without one the browser calls the BFF cross-origin (dev server -> BFF :8000), which needs a CORS
// policy on the public ingress. The rebuild has no CORS middleware, and adding one is a decision
// about what the public ingress permits — a contract question, not a local-launch convenience.
// Proxying instead makes the call SAME-ORIGIN, so the question does not arise, and nothing about
// the deployed ingress changes to suit a development machine.
//
// It also removes the failure mode .env.example warns about: a one-character origin mismatch
// produces a SILENT browser-side CORS block, with the preflight answered 204 and nothing at all in
// any server log.
//
// The rewrite strips the `/sp2-api` prefix, so the client's own paths reach the BFF unchanged:
//
//     browser  GET http://localhost:5173/sp2-api/memberships
//     BFF      GET /memberships
//
// `VITE_SP2_GATEWAY_BASE_URL` must therefore be the dev server's own origin plus the prefix —
// `http://localhost:5173/sp2-api`. It has to stay an ABSOLUTE http(s) URL: the bootstrap posture
// resolver parses it with `parseAbsoluteHttpUrl`, and a bare path resolves to fail-closed.
//
// LOCAL DEVELOPMENT ONLY. A Vite dev-server proxy does not exist in a production build; the
// deployed frontend reaches the BFF by its real origin.
// ---------------------------------------------------------------------------------------------
const SP2_BFF_LOCAL_ORIGIN = process.env.VITE_SP2_BFF_PROXY_TARGET ?? "http://127.0.0.1:8000";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    server: {
      // Pinned, and pinned STRICTLY. The default is 8080 with no strictPort outside a Lovable
      // sandbox, so Vite silently increments when the port is taken — and 8080 is inside the range
      // the retired local backend topology occupied. A silently-moved dev server breaks the fixed
      // OIDC `redirect_uri`, which is registered against one exact origin. Refusing to start is
      // the better outcome: it is visible.
      port: 5173,
      strictPort: true,
      proxy: {
        "/sp2-api": {
          target: SP2_BFF_LOCAL_ORIGIN,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/sp2-api/, ""),
        },
      },
    },
  },
});
