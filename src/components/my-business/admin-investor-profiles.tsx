import { setupText } from "@/i18n/language";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EditInfoPopup } from "@/components/common/edit-info-popup";
import { DraftCompanyCard, DraftCompanyPanel } from "@/components/common/company-menu";
import { addInvestorProfile, getBuyerInvestorById, listMyInvestorProfileIds } from "@/lib/buyer-investor.functions";
import { BuyerInvestorEdit, buyerInvestorKey, type Data } from "@/components/my-business/buyer-investor-edit";
import { buyerProgressFor, type BuyerRelation } from "@/lib/buyer-wizard";
import { bandText, typeName } from "@/lib/investor-bands";
import { tr } from "@/i18n/language";
import { cn } from "@/lib/utils";
import type { BuyerOrg, BuyerProfile } from "@/lib/buyer-profile";
import { BuyerDirectoryItem, SetupBanner } from "@/components/my-business/buyer-my-company";

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
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} {setupText("Add Investor Profile")}
    </Button>
  );
}

function directoryCardData(d: Data, id: string): { p: BuyerProfile; org: BuyerOrg } {
  const iv = d.investor;
  const status = d.buyer.status === "live" || d.buyer.status === "paused" ? d.buyer.status : "draft";
  return {
    p: {
      user_id: id,
      ref_no: d.buyer.ref_no ?? "",
      code_name: "",
      headline: d.buyer.suggested_headline || null,
      description: d.buyer.description || null,
      show_name: true,
      status,
      live_since: null,
      legal_name: iv.legal_name,
      address: iv.business_address,
      city: iv.city,
      country: iv.country,
      logo_url: iv.logo_signed_url,
      private_description: iv.short_description,
      aum_exact: iv.aum,
      ticket_exact: [iv.min_ticket_size, iv.max_ticket_size].filter(Boolean).join(" – ") || null,
      ticket_min: null,
      ticket_max: null,
      aum_value: null,
      track_record: null,
      decision_process: null,
      pof_verified_at: null,
      sectors: iv.preferred_industries,
      stages: iv.preferred_stages,
      deal_types: d.buyer.deal_types,
      target_size: null,
      geography: iv.investment_focus_raw.join(", ") || null,
      people: d.people,
      portfolio: iv.portfolio_extra.map((name) => ({ name, note: "" })),
      profile_views_month: 0,
      updated_at: iv.updated_at,
    },
    org: {
      name: iv.investor_name,
      type: iv.investor_type,
      website: iv.website_url,
      registrationNo: iv.registration_no,
      verified: d.verification.status === "verified",
      ndas: 0,
      lois: 0,
    },
  };
}

/** Admin's extra investor profiles on Buyer › My Company, each opening its own panel, wizard and Edit profile. */
export function AdminInvestorProfiles({ ids, openId, part, mode = "grid", onSelect }: { ids: string[]; openId?: string; part?: "list" | "panel" | "directory"; mode?: "grid" | "list"; onSelect?: (id: string) => void }) {
  if (!ids.length) return null;
  const profiles = ids.filter(id => part !== "panel" || id === openId).map((id) => <ExtraProfile key={id} id={id} open={openId === id} part={part} mode={mode} onSelect={onSelect} />);
  return part === "directory" ? <>{profiles}</> : <div className="space-y-5">{profiles}</div>;
}

function ExtraProfile({ id, open, part, mode = "grid", onSelect }: { id: string; open: boolean; part?: "list" | "panel" | "directory"; mode?: "grid" | "list"; onSelect?: (id: string) => void }) {
  const fetchById = useServerFn(getBuyerInvestorById);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState(false);
  const { data: r } = useQuery({ queryKey: buyerInvestorKey(id), queryFn: async () => { const x = await fetchById({ data: { id } }); return x.ok ? { ok: true as const, data: x.data as Data } : { ok: false as const, data: null }; } });
  useEffect(() => { if (!part && open && r?.ok) ref.current?.scrollIntoView({ block: "center" }); }, [open, r?.ok, part]);
  if (!r) return <Skeleton className="h-[220px]" />;
  if (!r.ok || !r.data) return null;
  const d = r.data;
  const iv = d.investor;
  if (part === "directory") {
    const { p, org } = directoryCardData(d, id);
    return <BuyerDirectoryItem p={p} org={org} mode={mode} selected={false} ticketLabel={bandText(iv.ticket_band)} onClick={() => onSelect?.(id)} />;
  }
  const rel = (d.buyer.relation ?? null) as BuyerRelation | null;
  const prog = buyerProgressFor(rel, iv, d.buyer, d.people);
  const individual = rel === "individual";
  const nm = iv.investor_name || (iv.investor_type ? typeName(iv.investor_type) : tr("New investor profile"));
  const openWizard = () => void navigate({ to: "/buyer/company/$id/setup", params: { id }, search: {} });
  return (
    <div ref={ref} data-company-selected={open} className={cn(!part && "grid gap-5 rounded-[14px] lg:grid-cols-[320px_minmax(0,1fr)]", open && !part && "ring-2 ring-accent/40 ring-offset-4 ring-offset-background")} style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      {part !== "panel" && <div role={part ? "button" : undefined} tabIndex={part ? 0 : undefined} onClick={() => onSelect?.(id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect?.(id); } }}>
      <DraftCompanyCard role="buyer" name={nm} typeLine={iv.investor_type ? typeName(iv.investor_type) : null}
        selected={part ? open : true} founded={individual ? null : iv.year_founded} size={individual ? null : iv.company_size_band} website={iv.website_url} />
      </div>}
      {part !== "list" && (!iv.setup_done_at ? (
        <DraftCompanyPanel role="buyer" name={nm} banner={<SetupBanner n={prog.n} N={prog.N} onOpen={openWizard} />}
          onEdit={() => setEditing(true)} onFinish={openWizard}
          deleteDraft={{ kind: "investor", id, invalidate: [INVESTOR_IDS_KEY, buyerInvestorKey(id)] }} />
      ) : (
        <div className="min-w-0 rounded-[14px] border border-border bg-card p-5 shadow-sm">
          <p className="text-[15px] font-semibold">{nm}</p>
          <p className="mt-1 text-sm text-muted-foreground">{d.buyer.ref_no} · {tr("Setup done")}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>{tr("Edit information")}</Button>
          </div>
        </div>
      ))}
      {editing && <EditInfoPopup open subtitle={nm} companyName={nm} onClosed={()=>setEditing(false)}><BuyerInvestorEdit id={id} /></EditInfoPopup>}
    </div>
  );
}
