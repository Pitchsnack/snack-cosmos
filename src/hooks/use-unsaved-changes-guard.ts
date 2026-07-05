import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";

/**
 * Local-only Unsaved Changes guard. Uses:
 *   - TanStack Router `useBlocker` for in-app navigation blocking.
 *   - Native `beforeunload` for refresh / tab close (attached only when dirty).
 *
 * Zero backend / zero persistence — pure UI safety.
 */
export function useUnsavedChangesGuard(opts: {
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  canSave?: boolean;
}) {
  const { isDirty, isSaving, onSave, canSave = true } = opts;

  const [dialogOpen, setDialogOpen] = useState(false);
  // Resolver for the current router-blocked navigation, when applicable.
  const routerResolveRef = useRef<((allow: boolean) => void) | null>(null);
  // Pending manual navigation (e.g. Cancel button).
  const manualProceedRef = useRef<(() => void) | null>(null);
  // Bypass flag: set true immediately before an intentional programmatic
  // navigation that should not trigger the guard (e.g. after successful save).
  const bypassRef = useRef(false);

  // ── Router in-app navigation blocking (TanStack Router useBlocker) ──
  useBlocker({
    shouldBlockFn: () => {
      if (bypassRef.current) return false;
      return isDirty && !isSaving;
    },
    withResolver: true,
    enableBeforeUnload: false, // we manage beforeunload ourselves below
  }) as unknown; // resolver values consumed via the callback form below

  // The hook above returns { status, proceed, reset } when withResolver:true.
  // Re-invoke to capture the resolver — TanStack returns the same live object.
  const blocker = useBlocker({
    shouldBlockFn: () => {
      if (bypassRef.current) return false;
      return isDirty && !isSaving;
    },
    withResolver: true,
    enableBeforeUnload: false,
  }) as { status: "blocked" | "idle"; proceed: () => void; reset: () => void };

  useEffect(() => {
    if (blocker.status === "blocked") {
      routerResolveRef.current = (allow) => {
        if (allow) blocker.proceed();
        else blocker.reset();
      };
      setDialogOpen(true);
    }
  }, [blocker.status, blocker]);

  // ── Native beforeunload — only while dirty ──
  useEffect(() => {
    if (!isDirty || isSaving) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, isSaving]);

  // ── Public helpers ──
  const confirmNavigate = useCallback(
    (proceed: () => void) => {
      if (!isDirty) {
        proceed();
        return;
      }
      manualProceedRef.current = proceed;
      setDialogOpen(true);
    },
    [isDirty],
  );

  const bypassOnce = useCallback(() => {
    bypassRef.current = true;
    // Reset shortly after so subsequent edits are guarded again.
    setTimeout(() => {
      bypassRef.current = false;
    }, 0);
  }, []);

  const closeAndClear = () => {
    setDialogOpen(false);
    routerResolveRef.current = null;
    manualProceedRef.current = null;
  };

  const onContinueEditing = () => {
    routerResolveRef.current?.(false);
    closeAndClear();
  };

  const onDiscard = () => {
    // Allow the pending navigation without saving.
    bypassRef.current = true;
    routerResolveRef.current?.(true);
    manualProceedRef.current?.();
    closeAndClear();
    setTimeout(() => {
      bypassRef.current = false;
    }, 0);
  };

  const handleSave = () => {
    // Kick off save; caller is responsible for closing / navigating on success.
    onSave();
  };

  return {
    dialogProps: {
      open: dialogOpen,
      onContinueEditing,
      onDiscard,
      onSave: handleSave,
      saving: isSaving,
      canSave,
    },
    confirmNavigate,
    bypassOnce,
    /** Call after save success so router navigation is not blocked. */
    markSaved: () => {
      // Resolve any pending router block/manual nav that Save-Changes was answering.
      bypassRef.current = true;
      routerResolveRef.current?.(true);
      manualProceedRef.current?.();
      closeAndClear();
      setTimeout(() => {
        bypassRef.current = false;
      }, 0);
    },
  };
}
