import { useMemo, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SellerWizard } from "@/components/startups/seller-wizard";
import { getSellerSetup, saveSellerSetup, type SellerSetup } from "@/lib/seller-setup.functions";
import { emptyDraft, firstOpenStep, type SellerDraft } from "@/lib/seller-wizard";
import { useSessionContext } from "@/hooks/use-session-context";

export const Route = createFileRoute("/_authenticated/my-startups/setup/$id")({
  head: () => ({
    meta: [
      { title: "Business Setup Wizard — PitchSnack" },
      { name: "description", content: "Set up your business profile one question at a time." },
      { property: "og:title", content: "Business Setup Wizard — PitchSnack" },
      { property: "og:description", content: "Answer a few short questions to set up your business profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

export const sellerSetupKey = (id: string) => ["seller-setup", id];

function toDraft(s: SellerSetup): SellerDraft {
  const d: SellerDraft = {
    ...emptyDraft(), role: s.role, name: s.name, reg: s.reg, web: s.web, year: s.year, city: s.city,
    rev: s.rev, size: s.size, sector: s.sector, licences: s.licences as SellerDraft["licences"], iso: s.iso, addr: s.addr,
  };
  return { ...d, step: firstOpenStep(d, s.fromSignup) };
}

function Page() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: session } = useSessionContext();
  const fetchFn = useServerFn(getSellerSetup);
  const saveFn = useServerFn(saveSellerSetup);
  const { data, error } = useQuery({ queryKey: sellerSetupKey(id), queryFn: () => fetchFn({ data: { id } }), staleTime: 0 });
  const initial = useMemo(() => (data ? toDraft(data) : null), [data]);
  const timer = useRef<number | null>(null);
  const payload = (d: SellerDraft, done?: boolean) => ({
    id, role: d.role, name: d.name, reg: d.reg, web: d.web, year: d.year, city: d.city, rev: d.rev, size: d.size,
    sector: d.sector, licences: d.licences, iso: d.iso, addr: d.addr, done,
  });
  const persist = (d: SellerDraft) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { saveFn({ data: payload(d) }).catch((e: Error) => toast.error(e.message)); }, 400);
  };
  const leave = () => { void qc.invalidateQueries(); navigate({ to: "/my-startups" }); };

  if (error) return <p className="p-8 text-sm text-muted-foreground">{(error as Error).message}</p>;
  if (!data || !initial || !session?.user?.id) return null;
  return (
    <SellerWizard
      userId={session.user.id}
      initial={initial}
      fromSignup={data.fromSignup}
      persist={persist}
      title="Set up your business"
      onExit={leave}
      onCancel={leave}
      onFinish={async (d) => {
        if (timer.current) window.clearTimeout(timer.current);
        try { await saveFn({ data: payload(d, true) }); } catch (e) { toast.error((e as Error).message); return; }
        void qc.invalidateQueries();
        navigate({ to: "/my-startups/$id/edit", params: { id } });
      }}
    />
  );
}
