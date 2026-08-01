import { useSyncExternalStore } from "react";
import {
  getConnectionState,
  subscribeConnections,
  type ConnectionState,
} from "@/lib/connections/connection-state";

export function useConnectionState(startupRef: string): ConnectionState {
  return useSyncExternalStore(
    subscribeConnections,
    () => getConnectionState(startupRef),
    () => "none" as const,
  );
}
