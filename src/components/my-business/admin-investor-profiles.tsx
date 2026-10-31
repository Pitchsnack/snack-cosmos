import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DraftCompanyCard, DraftCompanyPanel } from "@/components/common/company-menu";
import { addInvestorProfile, getBuyerInvestorById, listMyInvestorProfileIds } from "@/lib/buyer-investor.functions";
import { BuyerInvestorEdit, buyerInvestorKey, type Data } from "@/components/my-business/buyer-investor-edit";
import { buyerProgressFor, type BuyerRelation } from "@/lib/buyer-wizard";
import { typeName } from "@/lib/investor-bands";
import { tr } from "@/i18n/language";
import { cn } from "@/lib/utils";
import { SetupBanner } from "@/components/my-business/buyer-my-company";

export const INVESTOR_IDS_KEY = ["buyer-investor", "ids"];

/** Ids of the investor profiles this account holds (own + Admin's extra ones). */
export function useMyInvestorProfileIds(enabled = true) {
  const fn = useServerFn(listMyInvestorProfileIds);
  return useQuery({ queryKey: INVESTOR_IDS_KEY, queryFn: () => fn(), enabled, staleTime: 15_000 });
}

/** + Add Investor Profile: a new Draft on the server, then its wizard at question 1. One Draft per click. */
export function useAddInvestorProfile() {
  const add = useServerFn(addInvestorProfile);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const run = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const { id } = await add();
      await navigate({ to: "/buyer/company/$id/setup", params: { id }, search: {} });
    } catch (e) { toast((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  };
  return { run, busy };
}

export function AddInvestorProfileButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <Button className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={busy} aria-busy={busy} onClick={onClick}>
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Add Investor Profile
    </Button>
  );
}

/** Admin's extra investor profiles on Buyer › My Company, each opening its own panel, wizard and Edit profile. */
export function AdminInvestorProfiles({ ids, openId }: { ids: string[]; openId?: string }) {
  if (!ids.length) return null;
  return <div className="space-y-5">{ids.map((id) => <ExtraProfile key={id} id={id} open={openId === id} />)}</div>;
}

function ExtraProfile({ id, open }: { id: string; open: boolean }) {
  const fetchById = useServerFn(getBuyerInvestorById);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState(false);
  const { data: r } = useQuery({ queryKey: buyerInvestorKey(id), queryFn: async () => { const x = await fetchById({ data: { id } }); return x.ok ? { ok: true as const, data: x.data as Data } : { ok: false as const, data: null }; } });
  useEffect(() => { if (open && r?.ok) ref.current?.scrollIntoView({ block: "center" }); }, [open, r?.ok]);
  if (!r) return <Skeleton className="h-[220px]" />;
  if (!r.ok || !r.data) return null;
  const d = r.data;
  const iv = d.investor;
  const rel = (d.buyer.relation ?? null) as BuyerRelation | null;
  const prog = buyerProgressFor(rel, iv as never);
  const individual = rel === "individual";
  const nm = iv.investor_name || (iv.investor_type ? typeName(iv.investor_type) : tr("New investor profile"));
  const openWizard = () => void navigate({ to: "/buyer/company/$id/setup", params: { id }, search: {} });
  return (
    <div ref={ref} className={cn("grid gap-5 rounded-[14px] lg:grid-cols-[320px_minmax(0,1fr)]", open && "ring-2 ring-accent/40 ring-offset-4 ring-offset-background")} style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <DraftCompanyCard role="buyer" name={nm} typeLine={iv.investor_type ? typeName(iv.investor_type) : null}
        founded={individual ? null : iv.year_founded} size={individual ? null : iv.company_size_band} website={iv.website_url} />
      {!iv.setup_done_at ? (
        <DraftCompanyPanel role="buyer" name={nm} banner={<SetupBanner n={prog.n} N={prog.N} onOpen={openWizard} />}
          onEdit={() => setEditing(true)} onFinish={openWizard}
          deleteDraft={{ kind: "investor", id, invalidate: [INVESTOR_IDS_KEY, buyerInvestorKey(id)] }} />
      ) : (
        <div className="min-w-0 rounded-[14px] border border-border bg-card p-5 shadow-sm">
          <p className="text-[15px] font-semibold">{nm}</p>
          <p className="mt-1 text-sm text-muted-foreground">{d.buyer.ref_no} · {tr("Setup done")}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>{tr("Edit profile")}</Button>
          </div>
        </div>
      )}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[88vh] max-w-[860px] overflow-y-auto">
          <DialogTitle className="sr-only">{tr("Edit profile")}</DialogTitle>
          <BuyerInvestorEdit id={id} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
