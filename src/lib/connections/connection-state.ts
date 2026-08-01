/**
 * Startup Directory relationship state (Connect → Requested → Share).
 *
 * Frontend-only, session-scoped store. There is no backend connection
 * contract yet, so state lives in memory for the current tab and resets on
 * reload. No DB, auth, RBAC or tenant-routing behaviour is involved.
 */
export type ConnectionState = "none" | "requested" | "connected";

const state = new Map<string, ConnectionState>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeConnections(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getConnectionState(startupRef: string): ConnectionState {
  return state.get(startupRef) ?? "none";
}

/** Sends the connection request. No-op when a request already exists. */
export function requestConnection(startupRef: string) {
  if (getConnectionState(startupRef) !== "none") return;
  state.set(startupRef, "requested");
  emit();
}

/** Recipient accepted — the relationship action becomes Share. */
export function acceptConnection(startupRef: string) {
  if (getConnectionState(startupRef) !== "requested") return;
  state.set(startupRef, "connected");
  emit();
}

/** Cancels a pending request (returns to the pre-connection state). */
export function cancelConnectionRequest(startupRef: string) {
  if (getConnectionState(startupRef) !== "requested") return;
  state.delete(startupRef);
  emit();
}
