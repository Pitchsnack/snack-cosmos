import { createContext, useContext, useState, type ReactNode } from "react";
import type { SnackPortalAuthAdapter } from "./auth-adapter";

/**
 * SP2AuthProvider requires an explicit adapter. Production never selects a
 * mock implicitly — callers must inject a real (or explicitly-chosen dev)
 * adapter. Missing adapter fails closed at the route level.
 */
type Ctx = {
  adapter: SnackPortalAuthAdapter;
  signedIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SP2AuthContext = createContext<Ctx | null>(null);

export function SP2AuthProvider({
  adapter,
  children,
}: {
  adapter: SnackPortalAuthAdapter;
  children: ReactNode;
}) {
  const [signedIn, setSignedIn] = useState(false);

  const value: Ctx = {
    adapter,
    signedIn,
    signIn: async () => {
      const maybeSignIn = (adapter as SnackPortalAuthAdapter & { signIn?: () => Promise<void> }).signIn;
      if (typeof maybeSignIn === "function") await maybeSignIn.call(adapter);
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
