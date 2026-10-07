import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { StartupForm } from "@/components/startups/startup-form";
import { SellerWizard } from "@/components/startups/seller-wizard";
import { PermissionGuard } from "@/components/permission-guard";
import { useSessionContext, usePermissions } from "@/hooks/use-session-context";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createMyBusiness } from "@/lib/seller-setup.functions";
import {
  clearDraft, draftToPrefill, emptyDraft, loadDraft, firstOpenStep, type SellerDraft, type SellerPrefill,
} from "@/lib/seller-wizard";

export const Route = createFileRoute("/_authenticated/my-startups/new")({
  head: () => ({
    meta: [
      { title: "Add My Business — PitchSnack" },
      { name: "description", content: "Answer a few questions to create your business profile." },
    ],
  }),
  component: NewMyStartupPage,
});

function NewMyStartupPage() {
  const navigate = useNavigate();
  const { data } = useSessionContext();
  const userId = data?.user?.id as string | undefined;
  const [initial, setInitial] = useState<SellerDraft | null>(null);
  const [prefill, setPrefill] = useState<SellerPrefill | null>(null);
  const { roles, has } = usePermissions();
  // Seller accounts own their businesses directly (no workspace owner pickers).
  const sellerAccount = roles.includes("STARTUP_USER") && !has("users.read");
  const createMine = useServerFn(createMyBusiness);
  const finish = async (d: SellerDraft) => {
    if (!sellerAccount) { setPrefill(draftToPrefill(d)); return; }
    try {
      const { id } = await createMine({ data: { role: d.role, name: d.name, reg: d.reg, web: d.web, year: d.year, city: d.city, rev: d.rev, size: d.size, sector: d.sector, licences: d.licences, iso: d.iso } });
      if (userId) clearDraft(userId);
      navigate({ to: "/my-startups/$id/edit", params: { id } });
    } catch (e) { toast.error((e as Error).message); }
  };

  useEffect(() => {
    if (userId && !initial) { const saved = loadDraft(userId); setInitial(saved ? { ...saved, step: firstOpenStep(saved) } : emptyDraft()); }
  }, [userId, initial]);

  return (
    <PermissionGuard permission="startups.write" message="You don't have permission to create startups.">
      {prefill ? (
        <div className="mx-auto max-w-4xl space-y-6">
          <Link to="/my-startups" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to My Business
          </Link>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Add my business</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              We've filled in your answers. Review, complete and save your business profile.
            </p>
          </div>
          <StartupForm redirectAfterCreate="my-startups" prefill={prefill} onCreated={() => userId && clearDraft(userId)} />
        </div>
      ) : userId && initial ? (
        <SellerWizard
          userId={userId}
          initial={initial}
          onExit={() => navigate({ to: "/my-startups" })}
          onCancel={() => { if (window.history.length > 1) window.history.back(); else navigate({ to: "/my-startups" }); }}
          onFinish={finish}
        />
      ) : null}
    </PermissionGuard>
  );
}
