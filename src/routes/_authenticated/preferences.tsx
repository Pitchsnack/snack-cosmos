import { createFileRoute } from "@tanstack/react-router";
import { UserPreferences } from "@/components/user-preferences";
import { SubscriptionSection } from "@/components/settings/subscription-section";

export const Route = createFileRoute("/_authenticated/preferences")({
  head: () => ({
    meta: [
      { title: "Settings — PitchSnack" },
      { name: "description", content: "Your PitchSnack account settings and subscription." },
      { property: "og:title", content: "Settings — PitchSnack" },
      { property: "og:description", content: "Your PitchSnack account settings and subscription." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
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
      <SubscriptionSection />
    </div>
  );
}
