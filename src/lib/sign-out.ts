/** Browser-only coordination; never used to authorize a user. */
let pending = false;
let signingOut = false;

export const isMenuSigningOut = () => signingOut;

type SignOutActions = {
  setBusy: (busy: boolean) => void;
  recordLogout: () => Promise<unknown>;
  cancelQueries: () => Promise<unknown>;
  pauseQueries?: () => void;
  resumeQueries?: () => void;
  signOut: () => Promise<{ error: unknown }>;
  clear: () => void;
  navigate: (options: { to: "/login"; replace: true; search: { redirect: undefined } }) => Promise<unknown>;
  success: () => void;
  error: (error: unknown) => void;
  logAuditError: (error: unknown) => void;
};

export async function signOutFromMenu(actions: SignOutActions) {
  // Synchronous, shared lock also covers the mobile/desktop menu instances.
  if (pending) return;
  pending = true;
  actions.setBusy(true);
  try {
    try { await actions.recordLogout(); }
    catch (error) { actions.logAuditError(error); }
    await actions.cancelQueries();
    // Clearing mounted observers can create fresh queries before navigation completes.
    // Pause their network work for this short interval, not the auth request.
    actions.pauseQueries?.();
    signingOut = true;
    const { error } = await actions.signOut();
    if (error) throw error;
    actions.clear();
    await actions.navigate({ to: "/login", replace: true, search: { redirect: undefined } });
    actions.success();
  } catch (error) {
    actions.error(error);
  } finally {
    actions.resumeQueries?.();
    signingOut = false;
    pending = false;
    actions.setBusy(false);
  }
}

/** Capture the origin before asynchronous cancellation; auth callbacks must not await auth calls. */
export async function handleSignedOut(actions: {
  cancelQueries: () => Promise<unknown>;
  clear: () => void;
  invalidateRouter: () => unknown;
}) {
  const fromMenu = isMenuSigningOut();
  await actions.cancelQueries();
  actions.clear();
  if (!fromMenu) await actions.invalidateRouter();
}