import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePreferences, useNotificationPreferences } from "@/hooks/use-preferences";

export function UserPreferences() {
  const { data: prefs, update } = usePreferences();
  const { data: notif, update: updateNotif } = useNotificationPreferences();

  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [landing, setLanding] = useState("/dashboard");
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    if (prefs) {
      setTheme(prefs.theme);
      setLanding(prefs.defaultLandingPage);
      setItemsPerPage(prefs.itemsPerPage);
    }
  }, [prefs]);

  async function save() {
    try {
      await update({ theme, defaultLandingPage: landing, itemsPerPage });
      toast.success("Preferences saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-lg font-semibold">Workspace</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Personalize how the workspace looks and behaves.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select value={theme} onValueChange={(v) => setTheme(v as typeof theme)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Default landing page</Label>
            <Input value={landing} onChange={(e) => setLanding(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Items per page</Label>
            <Input
              type="number"
              min={5}
              max={200}
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
            />
          </div>
        </div>
        <Button onClick={save} className="mt-4">Save preferences</Button>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Notifications</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Control how SnackPortal2 reaches you.
        </p>
        <div className="space-y-3">
          <PrefRow
            label="Email notifications"
            checked={notif?.emailEnabled ?? true}
            onChange={(v) => updateNotif({ emailEnabled: v }).then(() => toast.success("Saved"))}
          />
          <PrefRow
            label="In-app notifications"
            checked={notif?.inAppEnabled ?? true}
            onChange={(v) => updateNotif({ inAppEnabled: v }).then(() => toast.success("Saved"))}
          />
          <PrefRow
            label="System alerts"
            checked={notif?.systemEnabled ?? true}
            onChange={(v) => updateNotif({ systemEnabled: v }).then(() => toast.success("Saved"))}
          />
        </div>
      </Card>
    </div>
  );
}

function PrefRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
