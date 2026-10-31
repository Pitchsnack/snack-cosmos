import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMyAdvisorFirms } from "@/components/advisor/advisor-my-company";
import { AdvisorSetupWizard } from "@/components/advisor/advisor-setup-wizard";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdvisorFirmForAdmin } from "@/lib/advisor-firm.functions";

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
      { property: "og:description", content: "Answer 11 short questions to set up your firm profile for sellers and buyers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const { id } = Route.useParams();
  const { data, error, isLoading } = useMyAdvisorFirms();
  const fetchAdmin = useServerFn(getAdvisorFirmForAdmin);
  const adminFirm = useQuery({ queryKey: ["advisor-setup-admin", id], enabled: !!data && !data.some(f => f.id === id), retry: false,
    queryFn: () => fetchAdmin({ data: { id } }) });
  if (error) return <p className="p-8 text-sm text-muted-foreground">Couldn't load your firm profile. Please refresh.</p>;
  if (isLoading || !data) return <div className="min-h-screen bg-[#F6F7F9] dark:bg-background" />;
  const firm = data.find((f) => f.id === id) ?? adminFirm.data;
  if (!firm && adminFirm.isFetching) return <div className="min-h-screen bg-background" />;
  if (!firm) return <p className="p-8 text-sm text-muted-foreground">This firm profile isn't yours.</p>;
  return <AdvisorSetupWizard key={firm.id} firm={firm} />;
}
