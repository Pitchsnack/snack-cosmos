import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications.functions";

export function useNotifications() {
  const fn = useServerFn(listNotifications);
  const qc = useQueryClient();
  const markOne = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fn(),
    staleTime: 30_000,
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
