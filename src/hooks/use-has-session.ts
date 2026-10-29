import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SessionStatus = "checking" | "signed_in" | "signed_out";

/**
 * Three-state browser session check. Starts as "checking" and never reports
 * signed out before the stored session has actually been read.
 */
export function useSessionStatus(): SessionStatus {
  const [status, setStatus] = useState<SessionStatus>("checking");

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setStatus(data.session ? "signed_in" : "signed_out");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setStatus(session ? "signed_in" : "signed_out");
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return status;
}

/**
 * True only once a session is confirmed. Use to gate authenticated server-fn
 * queries so they start only when signed in (never while still checking).
 */
export function useHasSession(): boolean {
  return useSessionStatus() === "signed_in";
}
