import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getPreferences,
  updatePreferences,
  getNotificationPreferences,
  updateNotificationPreferences,
  type WorkspacePreferencesDTO,
  type NotificationPreferencesDTO,
} from "@/lib/preferences.functions";

export function usePreferences() {
  const fn = useServerFn(getPreferences);
  const update = useServerFn(updatePreferences);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["preferences"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
  return {
    ...query,
    update: async (patch: Partial<WorkspacePreferencesDTO>) => {
      await update({ data: patch });
      await qc.invalidateQueries({ queryKey: ["preferences"] });
    },
  };
}

export function useNotificationPreferences() {
  const fn = useServerFn(getNotificationPreferences);
  const update = useServerFn(updateNotificationPreferences);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });
  return {
    ...query,
    update: async (patch: Partial<NotificationPreferencesDTO>) => {
      await update({ data: patch });
      await qc.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  };
}
