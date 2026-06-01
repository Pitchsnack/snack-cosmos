import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications.functions";
import { useHasSession } from "@/hooks/use-has-session";

export function useNotifications() {
  const fn = useServerFn(listNotifications);
  const qc = useQueryClient();
  const markOne = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);
  const enabled = useHasSession();

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fn(),
    staleTime: 30_000,
    enabled,
  });

  return {
    ...query,
    markRead: async (id: string) => {
      await markOne({ data: { id, isRead: true } });
      await qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    markAllRead: async () => {
      await markAll();
      await qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  };
}
