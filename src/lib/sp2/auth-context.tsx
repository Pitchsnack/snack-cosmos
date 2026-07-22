import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { SnackPortalAuthAdapter } from "./auth-adapter";
import { MockSnackPortalAuthAdapter } from "./mock-auth-adapter";

type Ctx = {
  adapter: SnackPortalAuthAdapter;
  /** Test-visible flag; the real adapter would track its own session. */
  signedIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SP2AuthContext = createContext<Ctx | null>(null);

export function SP2AuthProvider({ children }: { children: ReactNode }) {
  // Preview build uses the mock adapter. Real Keycloak wiring is a later gate.
  const adapter = useMemo(
    () =>
      new MockSnackPortalAuthAdapter({
        // Pre-authorize ACME so the mock end-to-end preview works without a
        // real IdP redirect. In production the IdP mints tenant tokens.
        authorizedTenants: new Set(["acme"]),
      }),
    [],
  );
  const [signedIn, setSignedIn] = useState(false);

  const value: Ctx = {
    adapter,
    signedIn,
    signIn: async () => {
      await (adapter as MockSnackPortalAuthAdapter).signIn();
      setSignedIn(true);
    },
    signOut: async () => {
      await adapter.logout();
      setSignedIn(false);
    },
  };

  return <SP2AuthContext.Provider value={value}>{children}</SP2AuthContext.Provider>;
}

export function useSP2Auth() {
  const ctx = useContext(SP2AuthContext);
  if (!ctx) throw new Error("useSP2Auth must be used within SP2AuthProvider");
  return ctx;
}
