import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [{ title: "Notifications — SnackPortal2" }],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { data, markRead, markAllRead, isLoading } = useNotifications();
  const items = data?.notifications ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data?.unread ?? 0} unread · {items.length} total
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => markAllRead()}
          disabled={!data?.unread}
          className="gap-2"
        >
          <CheckCheck className="h-4 w-4" />
          Mark all read
        </Button>
      </div>

      <Card className="divide-y divide-border">
        {isLoading && (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        )}
        {!isLoading && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-12 text-center text-sm text-muted-foreground">
            <Bell className="h-8 w-8 opacity-60" />
            No notifications yet.
          </div>
        )}
        {items.map((n) => (
          <div
            key={n.id}
            className={cn(
              "flex items-start justify-between gap-3 p-4",
              !n.isRead && "bg-accent/20",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{n.type}</Badge>
                <span className="truncate font-medium">{n.title}</span>
              </div>
              {n.message && (
                <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
              )}
              <div className="mt-1 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
              </div>
            </div>
            {!n.isRead && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => markRead(n.id)}
              >
                <Check className="h-3.5 w-3.5" />
                Mark read
              </Button>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
