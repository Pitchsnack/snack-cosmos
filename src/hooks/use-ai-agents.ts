import { useSyncExternalStore } from "react";
import {
  getAgentsVersion,
  getDrafts,
  getNotifications,
  getRuns,
  getSchedules,
  subscribeAgents,
} from "@/lib/ai-agents/agent-runtime";

/** Reactive view over the session-scoped AI agent runtime. */
export function useAgentRuntime() {
  useSyncExternalStore(subscribeAgents, getAgentsVersion, () => 0);
  return {
    runs: getRuns(),
    drafts: getDrafts(),
    schedules: getSchedules(),
    notifications: getNotifications(),
  };
}
