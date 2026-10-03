import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useNotificationPreferences } from "@/hooks/use-preferences";

export const Route = createFileRoute("/_authenticated/marketplace/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — PitchSnack" },
      { name: "description", content: "Turn PitchSnack email alerts on or off." },
    ],
  }),
  component: NotificationsSettings,
});

function NotificationsSettings() {
  const { data, update } = useNotificationPreferences();
  const on = data?.emailEnabled ?? true;
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <div className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground">ACCOUNT &amp; ACTIVITY</div>
        <h1 className="text-3xl font-semibold tracking-tight">Notifications</h1>
      </div>
      <div className="flex items-start justify-between gap-6 rounded-xl border border-border bg-card p-5">
        <div>
          <div className="font-semibold">Email alerts</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Get an email when your listing or profile is approved, when someone asks for or approves an NDA, when a report or letter of intent arrives, when a new match goes live, and when a message waits unread. The bell in the app keeps working either way.
          </p>
        </div>
        <Switch checked={on} onCheckedChange={(v) => update({ emailEnabled: v }).then(() => toast.success(v ? "Email alerts on" : "Email alerts off"))} />
      </div>
    </div>
  );
}
