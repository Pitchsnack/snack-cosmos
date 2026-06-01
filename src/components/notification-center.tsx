import { useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { data, markRead, markAllRead } = useNotifications();
  const items = data?.notifications ?? [];
  const unread = data?.unread ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="text-sm font-semibold">Notifications</div>
          <Button
            variant="ghost"
            size="sm"
            disabled={unread === 0}
            onClick={() => markAllRead()}
            className="h-7 gap-1 px-2 text-xs"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        </div>
        <ScrollArea className="max-h-[360px]">
          {items.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              You're all caught up.
            </div>
          )}
          <ul className="divide-y divide-border">
            {items.slice(0, 20).map((n) => (
              <li
                key={n.id}
                className={cn(
                  "flex items-start gap-2 px-3 py-2.5 text-sm",
                  !n.isRead && "bg-accent/30",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="h-4 px-1 text-[10px]">
                      {n.type}
                    </Badge>
                    <span className="truncate font-medium">{n.title}</span>
                  </div>
                  {n.message && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {n.message}
                    </p>
                  )}
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </div>
                </div>
                {!n.isRead && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => markRead(n.id)}
                    aria-label="Mark read"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </ScrollArea>
        <div className="border-t border-border p-2">
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block rounded-md px-2 py-1.5 text-center text-xs font-medium text-foreground/70 hover:bg-muted hover:text-foreground"
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
