import { useContext } from "react";
import { ViewModeContext } from "@/context/view-mode-context";

/**
 * PRD 7.1 — Read-only access to the View Switcher state.
 * Returns neutral state when called outside the provider; neutral state is
 * NEVER coerced to CONTROL.
 */
export function useViewMode() {
  return useContext(ViewModeContext);
}
