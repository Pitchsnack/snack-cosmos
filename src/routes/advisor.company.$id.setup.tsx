import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMyAdvisorFirms } from "@/components/advisor/advisor-my-company";
import { AdvisorSetupWizard } from "@/components/advisor/advisor-setup-wizard";

export const Route = createFileRoute("/advisor/company/$id/setup")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  head: () => ({
    meta: [
      { title: "Firm Profile Setup Wizard — PitchSnack" },
      { name: "description", content: "Set up your advisory firm's profile one question at a time." },
      { property: "og:title", content: "Firm Profile Setup Wizard — PitchSnack" },
      { property: "og:description", content: "Answer 10 short questions to set up your firm profile for sellers and buyers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const { id } = Route.useParams();
  const { data, error, isLoading } = useMyAdvisorFirms();
  if (error) return <p className="p-8 text-sm text-muted-foreground">Couldn't load your firm profile. Please refresh.</p>;
  if (isLoading || !data) return <div className="min-h-screen bg-[#F6F7F9] dark:bg-background" />;
  const firm = data.find((f) => f.id === id);
  if (!firm) return <p className="p-8 text-sm text-muted-foreground">This firm profile isn't yours.</p>;
  return <AdvisorSetupWizard key={firm.id} firm={firm} />;
}
