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
  const routerResolveRef = useRef<((allow: boolean) => void) | null>(null);
  const manualProceedRef = useRef<(() => void) | null>(null);
  const bypassRef = useRef(false);

  // TanStack Router in-app navigation blocking.
  const blocker = useBlocker({
    shouldBlockFn: () => {
      if (bypassRef.current) return false;
      return isDirty && !isSaving;
    },
    withResolver: true,
    enableBeforeUnload: false,
  }) as unknown as {
    status: "blocked" | "idle";
    proceed: () => void;
    reset: () => void;
  };

  useEffect(() => {
    if (blocker.status === "blocked") {
      routerResolveRef.current = (allow) => {
        if (allow) blocker.proceed();
        else blocker.reset();
      };
      setDialogOpen(true);
    }
  }, [blocker.status, blocker]);

  // Native beforeunload — only while dirty.
  useEffect(() => {
    if (!isDirty || isSaving) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, isSaving]);

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
    bypassRef.current = true;
    routerResolveRef.current?.(true);
    manualProceedRef.current?.();
    closeAndClear();
    setTimeout(() => {
      bypassRef.current = false;
    }, 0);
  };

  const handleSave = () => {
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
    /** Call before an intentional navigation that should skip the guard. */
    bypassOnce: () => {
      bypassRef.current = true;
      setTimeout(() => {
        bypassRef.current = false;
      }, 0);
    },
    /** Call after save success — resolves any pending block and closes dialog. */
    markSaved: () => {
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
