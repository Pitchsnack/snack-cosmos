import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks whether a Supabase session exists in the browser. Use to gate
 * authenticated server-fn queries so they don't fire (and 401) before sign-in
 * or after sign-out.
 */
export function useHasSession(): boolean {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setHasSession(!!data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return hasSession;
}
