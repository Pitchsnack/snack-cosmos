import { useEffect, useState, useCallback } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useSessionContext } from "@/hooks/use-session-context";

export type Persona = "buyer" | "seller";
const EVT = "ps-persona-change";
const LAST_ADMIN_KEY = "ps.lastAdminPath";

function key(userId: string | undefined) {
  return `ps.persona.${userId ?? "anon"}`;
}

export function useIsMarketplace() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    pathname === "/marketplace" ||
    pathname.startsWith("/marketplace/") ||
    pathname === "/my-startups" ||
    pathname.startsWith("/my-startups/") ||
    pathname === "/my-page"
  );
}

/** View-only Seller | Buyer switch, remembered per signed-in user. */
export function usePersona() {
  const { data } = useSessionContext();
  const userId = data?.user?.id as string | undefined;
  const [persona, setPersonaState] = useState<Persona>("buyer");

  useEffect(() => {
    const read = () => {
      try {
        const v = localStorage.getItem(key(userId));
        setPersonaState(v === "seller" ? "seller" : "buyer");
      } catch {
        /* noop */
      }
    };
    read();
    window.addEventListener(EVT, read);
    return () => window.removeEventListener(EVT, read);
  }, [userId]);

  const setPersona = useCallback(
    (p: Persona) => {
      try {
        localStorage.setItem(key(userId), p);
      } catch {
        /* noop */
      }
      setPersonaState(p);
      window.dispatchEvent(new Event(EVT));
    },
    [userId],
  );

  return { persona, setPersona };
}

export function rememberAdminPath(path: string) {
  try {
    localStorage.setItem(LAST_ADMIN_KEY, path);
  } catch {
    /* noop */
  }
}

export function lastAdminPath(): string {
  try {
    return localStorage.getItem(LAST_ADMIN_KEY) || "/dashboard";
  } catch {
    return "/dashboard";
  }
}
