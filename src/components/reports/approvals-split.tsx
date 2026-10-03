import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Briefcase, Check, ExternalLink, LayoutList, Lock, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectorArt } from "@/components/hidden-profile/bits";
import { decideBuyer, decideBuyerProfile, decideListing } from "@/lib/approvals.functions";
import { bandText, descriptionLeaks } from "@/lib/investor-bands";
import { employeesBand, provinceOnly, revenueBand } from "@/lib/public-listing";
import { cn } from "@/lib/utils";

/**
 * Admin › Approvals split view: queue on the left, the selected item's review
 * panel on the right. Sellers tab = listings; Buyers tab = investor profiles + verifications.
 */

type Kind = "new" | "edit" | "prof" | "ver";
type Check3 = [ok: boolean, title: string, detail: string];
type Field = [label: string, submitted: string, shown: string];
type Item = {
  key: string; id: string; kind: Kind; name: string; ref: string; who: string; submittedAt: string | null; version: number;
  initials: string; dirLabel: string; dirTo: string; dirParams: Record<string, string>; reviewTo?: { to: string; params: Record<string, string> };
  checks: Check3[]; changed?: [string, string, string][]; groups: [string, Field[]][]; preview?: React.ReactNode; art?: any;
};

const KIND: Record<Kind, [string, string]> = {
  new: ["border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]", "New listing"],
  edit: ["border-[#FCD34D] bg-[#FFFBEB] text-[#B45309]", "Edits"],
  prof: ["border-[#C7D2FE] bg-[#EEF0FF] text-[#4338CA]", "Profile to publish"],
  ver: ["border-[#DDD6FE] bg-[#F5F3FF] text-[#6D28D9]", "Verification"],
};
const THUMB: Record<Kind, string> = { new: "bg-[#FEF3DE] text-[#8A4B06]", edit: "bg-[#FEF3DE] text-[#8A4B06]", prof: "bg-[#EEF0FF] text-[#4338CA]", ver: "bg-[#F5F3FF] text-[#6D28D9]" };

const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—");
const waitDays = (d?: string | null) => (d ? Math.max(0, Math.floor((Date.now() - +new Date(d)) / 86_400_000)) : 0);
const waitText = (d?: string | null) => { const n = waitDays(d); return n === 0 ? "today" : `${n} day${n === 1 ? "" : "s"}`; };
const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
const v = (x: unknown) => (x == null || x === "" || (Array.isArray(x) && !x.length) ? "—" : Array.isArray(x) ? x.join(", ") : String(x));
const thb = (n: unknown) => (n == null || n === "" ? "—" : `฿${Number(n).toLocaleString()}`);

function Chip({ kind }: { kind: Kind }) {
  return <span className={cn("inline-flex h-5 items-center whitespace-nowrap rounded-full border px-2 text-[11px] font-semibold", KIND[kind][0])}>{KIND[kind][1]}</span>;
}

export function listingItems(rows: any[], names: Record<string, string>, emails: Record<string, string>): Item[] {
  return rows.map((l) => {
    const snap = l.snapshot ?? {};
    const pub = snap.public ?? {};
    const pr = snap.private ?? {};
    const prev = snap.prev?.public ?? null;
    const name = l.startups?.startup_name ?? l.code_name;
    const flags: string[] = snap.identity_flags ?? [];
    const years: string[] = pr.financial_years ?? [];
    const changed: [string, string, string][] = [];
    if (prev) {
      const cmp: [string, string][] = [["Headline", "headline"], ["Description", "description"], ["Asking price", "asking_price"], ["Stake for sale", "stake_pct"], ["Deal type", "deal_type"]];
      for (const [label, k] of cmp) if (v(prev[k]) !== v(pub[k])) changed.push([label, v(prev[k]), v(pub[k])]);
    }
    return {
      key: `l:${l.id}`, id: l.id, kind: l.has_live ? "edit" : "new", name, ref: `${l.ref_no ?? ""} · ${l.code_name}`,
      who: emails[l.submitted_by] || names[l.submitted_by] || "—", submittedAt: l.submitted_at, version: l.version ?? 1,
      initials: initials(name), art: l, dirLabel: "Startups Directory", dirTo: "/startups/$id", dirParams: { id: l.startup_id },
      reviewTo: { to: "/approvals/listings/$id", params: { id: l.id } },
      checks: [
        [!flags.length, "Identity check", flags.length ? `Mentions ${flags.slice(0, 3).join(", ")}` : "Passed · name hidden"],
        [!!pr.registered_number, "Company registration", pr.registered_number ? `No. ${pr.registered_number}` : "Not added"],
        [years.length > 0, "Financials", years.length ? `${years.length} filed year${years.length === 1 ? "" : "s"}` : "None on file"],
      ],
      changed: changed.length ? changed : undefined,
      preview: (
        <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-3.5 rounded-[10px] bg-card p-2.5 shadow-sm">
          <div className="relative min-h-[120px] overflow-hidden rounded-lg">
            <SectorArt art={l.cover_art ?? l.startups?.sector} sector={l.startups?.sector} imageId={l.public_image_id} className="absolute inset-0 h-full w-full" />
            <span className="absolute left-2 top-2 inline-flex h-5 items-center gap-1 rounded-full border border-border bg-card px-2 text-[10.5px] font-semibold text-muted-foreground"><Lock className="h-2.5 w-2.5" />Identity hidden</span>
          </div>
          <div className="min-w-0">
            <h4 className="mb-1.5 mt-0.5 text-sm font-semibold leading-snug">{pub.headline || "No headline yet"}</h4>
            <p className="line-clamp-3 text-xs text-muted-foreground">{pub.description || "No description yet"}</p>
            <div className="mt-1.5 text-xs text-muted-foreground">Revenue <b className="font-medium text-foreground">{revenueBand(pr.last_year_revenue) ?? "—"}</b></div>
            <div className="mt-2 flex justify-between border-t border-border pt-1.5 text-[11.5px] text-muted-foreground"><span>{l.code_name} · {l.ref_no}</span><span>{l.has_live ? "Live · edits pending" : "Not published yet"}</span></div>
          </div>
        </div>
      ),
      groups: [
        ["Company Info", [
          ["Company", v(pr.registered_name || pr.startup_name), "Hidden"],
          ["Address", v([pr.city, pr.headquarters].filter(Boolean).join(", ")), v(provinceOnly(pr.city, pr.headquarters))],
          ["Employees", v(pr.company_size), v(employeesBand(pr.company_size))],
          ["Website", v(pr.website_url), "Hidden"],
        ]],
        ["Financials", [["Revenue (last year)", thb(pr.last_year_revenue), v(revenueBand(pr.last_year_revenue))]]],
        ["Deal terms", [["Stake for sale", pub.stake_pct != null ? `${pub.stake_pct}%` : "—", "Same"], ["Asking price", thb(pub.asking_price), "Same"], ["Deal type", v(pub.deal_type), "Same"]]],
      ],
    } satisfies Item;
  });
}

export function profileItems(rows: any[], names: Record<string, string>): Item[] {
  return rows.filter((r) => r.approval_status === "in_review").map((r) => {
    const inv = r.investor ?? {};
    const name = r.investor_name ?? "Investor profile";
    const leaks = descriptionLeaks(r.description ?? "", r.investor_name ?? "", "");
    const verified = r.verification?.status === "verified";
    const type = r.investor_type ?? "Investor";
    return {
      key: `p:${r.user_id}`, id: r.user_id, kind: "prof", name, ref: `${r.ref_no ?? ""} · ${type}`, who: names[r.user_id] ?? "—",
      submittedAt: r.submitted_at, version: 1, initials: initials(name),
      dirLabel: "Investors Directory", dirTo: r.investor_id ? "/investors/$id" : "/investors", dirParams: r.investor_id ? { id: r.investor_id } : {},
      checks: [
        [!leaks.length, "Identity check", leaks.length ? leaks.join(", ") : "Passed · name hidden"],
        [verified, "Verified buyer", verified ? `Since ${day(r.verification?.decided_at)}` : "Not verified yet"],
        [!!r.pof_verified_at, "Proof of funds", r.pof_verified_at ? `Checked ${day(r.pof_verified_at)}` : "Not added"],
      ],
      preview: (
        <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-3.5 rounded-[10px] bg-card p-2.5 shadow-sm">
          <div className="relative grid min-h-[120px] place-items-center rounded-lg bg-[#E0E7FF] text-[#4338CA]">
            <span className="absolute left-2 top-2 inline-flex h-5 items-center gap-1 rounded-full border border-border bg-card px-2 text-[10.5px] font-semibold text-muted-foreground"><Lock className="h-2.5 w-2.5" />Name hidden</span>
            <Briefcase className="h-8 w-8" strokeWidth={1.6} />
          </div>
          <div className="min-w-0">
            <h4 className="mb-1.5 mt-0.5 text-sm font-semibold">{type}</h4>
            <p className="line-clamp-3 text-xs text-muted-foreground">{r.description || "No public description"}</p>
            <div className="mt-1.5 flex flex-wrap gap-3.5 text-xs text-muted-foreground">
              <span>Ticket size <b className="font-medium text-foreground">{bandText(inv.ticket_band) ?? "—"}</b></span>
              <span>AUM <b className="font-medium text-foreground">{bandText(inv.aum_band) ?? "—"}</b></span>
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-1.5 text-[11.5px] text-muted-foreground"><span>{type} · {r.ref_no}</span><span>Not published yet</span></div>
          </div>
        </div>
      ),
      groups: [
        ["Profile", [["Firm name", v(inv.investor_name), type], ["Website", v(inv.website_url), "Hidden"], ["Registration", v(inv.registration_no), "Hidden"]]],
        ["Mandate", [
          ["Ticket size", v(bandText(inv.ticket_band)), "Same"],
          ["Min. target revenue", v(bandText(inv.revenue_min_band)), "Same"],
          ["Sectors", v(inv.preferred_industries), "Same"],
          ["Stages", v(inv.preferred_stages), "Same"],
          ["Deal types", v(r.deal_types), "Same"],
          ["Geography", v(inv.investment_focus), "Same"],
        ]],
        ["Fund", [["AUM", v(bandText(inv.aum_band)), "Same"]]],
      ],
    } satisfies Item;
  });
}

export function verificationItems(rows: any[], names: Record<string, string>): Item[] {
  return rows.map((b) => {
    const person = names[b.user_id] ?? b.work_email ?? "Buyer";
    const match = b.email_domain_match;
    return {
      key: `v:${b.id}`, id: b.id, kind: "ver", name: person, ref: [b.company_name, b.buyer_type].filter(Boolean).join(" · "), who: person,
      submittedAt: b.submitted_at, version: 1, initials: initials(person),
      dirLabel: "full review", dirTo: "/approvals/buyers/$id", dirParams: { id: b.id },
      checks: [
        [!!b.registration_no, "Company registration", b.registration_no ? `No. ${b.registration_no}` : "Not added"],
        [match !== false, "Work email", match == null ? "Not checked" : match ? "Matches company domain" : "Domain differs"],
        [!!b.linkedin, "LinkedIn", b.linkedin ? "Provided" : "Not added"],
      ],
      groups: [
        ["Profile", [
          ["Company", v(b.company_name), v(b.registration_no)],
          ["Type", v(b.buyer_type), "—"],
          ["Work email", v(b.work_email), match === false ? "!Domain differs" : match ? "Matches" : "—"],
          ["Website", v(b.website), "—"],
          ["LinkedIn", v(b.linkedin), "—"],
        ]],
      ],
    } satisfies Item;
  });
}

const ACTIONS: Record<Kind, [string, string, string]> = {
  new: ["Decline", "Request changes", "Approve & publish"], edit: ["Decline", "Request changes", "Approve & publish"],
  prof: ["Decline", "Request changes", "Approve & publish"], ver: ["Decline", "Request more info", "Verify buyer"],
};

export function ApprovalsSplit({ groups, empty }: { groups: [string, Item[]][]; empty: string }) {
  const all = useMemo(() => groups.flatMap(([, g]) => g), [groups]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("oldest");
  const [sel, setSel] = useState<string | null>(null);
  const filt = (g: Item[]) => {
    let l = q ? g.filter((x) => `${x.name} ${x.ref} ${x.who}`.toLowerCase().includes(q.toLowerCase())) : g;
    l = [...l].sort((a, b) => (+new Date(a.submittedAt ?? 0) - +new Date(b.submittedAt ?? 0)) * (sort === "oldest" ? 1 : -1));
    return l;
  };
  const shown = groups.map(([t, g]) => [t, filt(g)] as const);
  const cur = all.find((x) => x.key === sel) ?? shown.flatMap(([, g]) => g)[0] ?? null;
  useEffect(() => { if (sel && !all.some((x) => x.key === sel)) setSel(null); }, [all, sel]);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[372px_minmax(0,1fr)]">
      <div>
        <div className="mb-2.5 flex gap-2">
          <div className="flex h-[34px] min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-2.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-8 border-0 bg-transparent px-0 text-[12.5px] shadow-none focus-visible:ring-0" />
          </div>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-[34px] w-36 text-[12.5px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="oldest">Oldest first</SelectItem><SelectItem value="newest">Newest first</SelectItem></SelectContent>
          </Select>
        </div>
        {shown.map(([title, g]) => (
          <div key={title}>
            <div className="mx-0.5 mb-2 mt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{title} ({g.length})</div>
            {g.length === 0 ? <div className="px-0.5 py-2.5 text-[12.5px] text-muted-foreground">Nothing waiting.</div> : g.map((x) => (
              <div key={x.key} role="button" tabIndex={0} onClick={() => setSel(x.key)} onKeyDown={(e) => e.key === "Enter" && setSel(x.key)}
                className={cn("mb-2 grid w-full cursor-pointer grid-cols-[40px_minmax(0,1fr)_28px] gap-2.5 rounded-xl border bg-card p-3 text-left transition-colors",
                  cur?.key === x.key ? "border-[#F6A823] shadow-[0_0_0_3px_#FEF3DE]" : "border-border hover:border-[#CBD2DC]")}>
                <Thumb x={x} />
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-semibold">{x.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{x.ref}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
                    <Chip kind={x.kind} /><span>{day(x.submittedAt)} · <span className={cn(waitDays(x.submittedAt) >= 2 && "font-semibold text-[#B45309]")}>waiting {waitText(x.submittedAt)}</span></span>
                  </div>
                </div>
                <Link to={x.dirTo as any} params={x.dirParams as any} onClick={(e) => e.stopPropagation()} title={`Open in ${x.dirLabel}`}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-border bg-card text-[#2563EB] hover:border-[#BFDBFE] hover:bg-[#EFF6FF]"><ExternalLink className="h-3.5 w-3.5" /></Link>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div>{cur ? <Panel x={cur} /> : <div className="rounded-[14px] border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">{empty}</div>}</div>
    </div>
  );
}

function Thumb({ x, big }: { x: Item; big?: boolean }) {
  const cls = big ? "h-12 w-12 rounded-xl text-sm" : "h-10 w-10 rounded-[10px] text-xs";
  if (x.art) return <SectorArt art={x.art.cover_art ?? x.art.startups?.sector} sector={x.art.startups?.sector} imageId={x.art.public_image_id} className={cn("shrink-0 overflow-hidden", cls)} />;
  return <span className={cn("grid shrink-0 place-items-center font-bold", cls, THUMB[x.kind])}>{x.initials}</span>;
}

function Panel({ x }: { x: Item }) {
  const qc = useQueryClient();
  const listingFn = useServerFn(decideListing);
  const profileFn = useServerFn(decideBuyerProfile);
  const buyerFn = useServerFn(decideBuyer);
  const [ask, setAsk] = useState<null | 0 | 1>(null);
  const [note, setNote] = useState("");
  const A = ACTIONS[x.kind];
  const decide = useMutation({
    mutationFn: async (i: 0 | 1 | 2) => {
      const n = i === 2 ? undefined : note.trim();
      if (x.kind === "ver") return buyerFn({ data: { id: x.id, action: (["decline", "more_info", "verify"] as const)[i], note: n } });
      if (x.kind === "prof") return profileFn({ data: { id: x.id, action: (["decline", "request_changes", "approve"] as const)[i], note: n } });
      return listingFn({ data: { id: x.id, action: (["reject", "request_changes", "approve"] as const)[i], note: n } });
    },
    onSuccess: (_d, i) => { qc.invalidateQueries({ queryKey: ["approvals"] }); toast.success(i === 2 ? `${A[2]} done` : "Decision sent"); setAsk(null); setNote(""); },
    onError: (e) => toast.error((e as Error).message),
  });
  const shownHead = x.kind === "ver" ? "Checked against" : x.kind === "prof" ? "Sellers see" : "Buyers see";

  return (
    <div className="sticky top-3 overflow-hidden rounded-[14px] border border-border bg-card">
      <div className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-start gap-3 border-b border-border/60 px-[18px] pb-3.5 pt-4">
        <Thumb x={x} big />
        <h2 className="flex flex-wrap items-center gap-2 self-center text-lg font-semibold">{x.name}<Chip kind={x.kind} /></h2>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setAsk(0)}>{A[0]}</Button>
          <Button size="sm" variant="outline" onClick={() => setAsk(1)}>{A[1]}</Button>
          <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate(2)}>{A[2]}</Button>
        </div>
        <p className="col-start-2 col-end-4 -mt-1 text-xs text-muted-foreground">
          {x.ref} · submitted {day(x.submittedAt)} by {x.who} · <span className={cn(waitDays(x.submittedAt) >= 2 && "font-semibold text-[#B45309]")}>waiting {waitText(x.submittedAt)}</span> · version {x.version}
          {x.reviewTo && <> · <Link to={x.reviewTo.to as any} params={x.reviewTo.params as any} className="font-semibold text-[#2563EB] hover:underline">Full review</Link></>}
        </p>
      </div>
      <div className="flex items-center gap-3 border-b border-[#E0E7FF] bg-[#F8FAFF] px-[18px] py-2.5 text-[12.5px]">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#E0E7FF] text-[#3730A3]"><LayoutList className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">The full record is in {x.dirLabel}<small className="block text-[11.5px] text-muted-foreground">Click any field below to open it there.</small></span>
        <Link to={x.dirTo as any} params={x.dirParams as any} className="inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 text-xs font-semibold text-[#1D4ED8]">Open in {x.dirLabel}<ExternalLink className="h-3 w-3" /></Link>
      </div>
      <div className="space-y-[18px] px-[18px] pb-[18px] pt-4">
        <Sec title="Checks">
          <div className="grid gap-2 sm:grid-cols-3">
            {x.checks.map(([ok, t, d]) => (
              <div key={t} className="min-w-0 rounded-[10px] border border-border/60 px-3 py-2.5 text-xs text-muted-foreground">
                <b className="mb-0.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground">{ok ? <Check className="h-3.5 w-3.5 text-[#047857]" /> : <AlertTriangle className="h-3.5 w-3.5 text-[#B45309]" />}{t}</b>{d}
              </div>
            ))}
          </div>
        </Sec>
        {x.changed && (
          <Sec title={`What changed since v${x.version - 1}`} right={<span className="text-xs text-muted-foreground">{x.changed.length} field{x.changed.length === 1 ? "" : "s"}</span>}>
            <div className="overflow-hidden rounded-[10px] border border-border/60">
              {x.changed.map(([l, a, b]) => (
                <div key={l} className="grid grid-cols-[150px_minmax(0,1fr)_minmax(0,.9fr)] gap-2.5 border-t border-border/60 bg-[#FFFDF5] px-3 py-2 text-[12.5px] first:border-t-0">
                  <span className="text-muted-foreground">{l}</span><s className="truncate text-muted-foreground/70">{a}</s><span className="truncate">{b}</span>
                </div>
              ))}
            </div>
          </Sec>
        )}
        {x.preview && <Sec title={x.kind === "prof" ? "What sellers will see" : "What buyers will see"}><div className="rounded-xl bg-muted p-3">{x.preview}</div></Sec>}
        {x.groups.map(([g, rows]) => (
          <Sec key={g} title={g} right={<Link to={x.dirTo as any} params={x.dirParams as any} className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline">{g} in {x.dirLabel}<ExternalLink className="h-3 w-3" /></Link>}>
            <div className="overflow-hidden rounded-[10px] border border-border/60">
              <div className="grid grid-cols-[150px_minmax(0,1fr)_minmax(0,.9fr)_26px] gap-2.5 border-b border-border/60 bg-muted/40 px-3 py-[7px] text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                <span>Field</span><span>Submitted</span><span>{shownHead}</span><span />
              </div>
              {rows.map(([l, a, b]) => (
                <Link key={l} to={x.dirTo as any} params={x.dirParams as any}
                  className="group grid grid-cols-[150px_minmax(0,1fr)_minmax(0,.9fr)_26px] items-center gap-2.5 border-t border-border/60 px-3 py-2 text-[12.5px] first:border-t-0 hover:bg-[#F8FAFF]">
                  <span className="text-muted-foreground">{l}</span>
                  <span className="min-w-0 break-words">{a}</span>
                  <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                    {b === "—" ? "—" : b.startsWith("!") ? <span className="font-semibold text-[#B45309]">! {b.slice(1)}</span> : <><i className="font-bold not-italic text-[#047857]">✓</i>{b}</>}
                  </span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground/60 group-hover:text-[#2563EB]" />
                </Link>
              ))}
            </div>
          </Sec>
        ))}
      </div>
      {ask !== null && (
        <Dialog open onOpenChange={(o) => !o && setAsk(null)}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogTitle>{A[ask]}</DialogTitle>
            <DialogDescription>{x.kind === "ver" || x.kind === "prof" ? "The buyer gets this note." : "The seller gets this note."}</DialogDescription>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAsk(null)}>Cancel</Button>
              <Button disabled={!note.trim() || decide.isPending} onClick={() => decide.mutate(ask)}>Send</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Sec({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2.5"><h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{title}</h3>{right}</div>
      {children}
    </div>
  );
}
