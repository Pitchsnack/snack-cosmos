import { SetupWizardLoading } from "@/components/setup/setup-wizard-loading";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { tr } from "@/i18n/language";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getBuyerInvestorById } from "@/lib/buyer-investor.functions";
import { buyerInvestorKey, type Data } from "@/components/my-business/buyer-investor-edit";
import { BuyerSetupWizard } from "@/components/my-business/buyer-setup-wizard";

export const Route = createFileRoute("/buyer/company/$id/setup")({
  ssr: false,
  // The router's search parser turns ?q=1 into a number; coerce back to string.
  validateSearch: z.object({ q: z.coerce.string().optional() }),
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  head: () => ({
    meta: [
      { title: "Investor Profile Setup Wizard — PitchSnack" },
      { name: "description", content: "Set up your investor profile one question at a time." },
      { property: "og:title", content: "Investor Profile Setup Wizard — PitchSnack" },
      { property: "og:description", content: "Answer a few short questions to set up your investor profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const { id } = Route.useParams();
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const fetchById = useServerFn(getBuyerInvestorById);
  // The profile in the address, owner checked on the server: anyone else's sends no data.
  const { data: r, error, refetch } = useQuery({ queryKey: buyerInvestorKey(id), queryFn: async () => { const x = await fetchById({ data: { id } }); return x.ok ? { ok: true as const, data: x.data as Data, missing: false } : { ok: false as const, data: null, missing: !!(x as { missing?: boolean }).missing }; } });
  const missing = !!r && !r.ok && r.missing;
  useEffect(() => {
    if (!missing) return;
    toast(tr("This profile has been removed."));
    void navigate({ to: "/marketplace/my-company", search: {}, replace: true });
  }, [missing, navigate]);
  if (error || !r || missing) return <SetupWizardLoading title={tr("Investor Profile") + " " + tr("Setup Wizard")} error={error} onRetry={() => void refetch()} />;
  if (!r.ok) return <p className="p-8 text-sm text-muted-foreground">This profile isn't yours.</p>;
  return <BuyerSetupWizard key={id} data={r.data} startAt={q} />;
}
