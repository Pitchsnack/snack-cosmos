import { createFileRoute } from "@tanstack/react-router";
import { UserPreferences } from "@/components/user-preferences";

export const Route = createFileRoute("/_authenticated/preferences")({
  head: () => ({
    meta: [{ title: "Preferences — SnackPortal2" }],
  }),
  component: PreferencesPage,
});

function PreferencesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Preferences</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Workspace appearance and notification settings.
        </p>
      </div>
      <UserPreferences />
    </div>
  );
}
