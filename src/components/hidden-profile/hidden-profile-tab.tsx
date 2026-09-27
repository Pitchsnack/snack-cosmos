import { useState } from "react";
import { AlertTriangle, Check, EyeOff, Lock, Pencil, Plus, Store } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  hiddenStatusOf,
  isStartupEntry,
  runIdentityCheck,
  type EntryFacts,
  type HiddenDraft,
  type HiddenProfileRow,
} from "@/lib/hidden-profile";
import {
  buildPublicListing,
  checkListing,
  decadeLabel,
  listingTerms,
  suggestDescription,
  type ListingSource,
} from "@/lib/public-listing";
import { Flagged } from "./bits";
import { PublicListingCard } from "./public-listing-card";
import { PublicListingEditor } from "./public-listing-editor";

function fmtDate(s?: string | null) {
  return s ? new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export function HiddenProfileTab({
  name,
  companyType,
  row,
  facts,
  onEdit,
  onCreate,
  onPublish,
  creating,
  publishBlocked,
  source,
  hasFinancials,
}: {
  name: string;
  companyType?: string | null;
  row: HiddenProfileRow | null;
  facts: EntryFacts | undefined;
  showMarkers?: boolean;
  onEdit: () => void;
  onCreate: () => void;
  onPublish: () => void;
  creating?: boolean;
  industry?: string;
  /** When set, Publish stays disabled and this text explains why. */
  publishBlocked?: string | null;
  source: ListingSource;
  hasFinancials: boolean;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const startup = isStartupEntry(companyType);
  if (!row) {
    const preview = buildPublicListing(source, null, hasFinancials);
    return (
      <div className="space-y-3">
        {startup && <p className="flex items-start gap-2 text-sm text-muted-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Startup listings aren't available on the Marketplace yet. This preview is private.</p>}
        {!startup && <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"><span>{name} has no public listing yet. This preview is private.</span><Button onClick={onCreate} disabled={creating} variant="outline"><Plus className="mr-1.5 h-4 w-4" />Create public view</Button></div>}
        <div className="rounded-[14px] bg-muted p-3.5">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">How buyers would see it</div>
          <PublicListingCard l={preview} seller />
        </div>
      </div>
    );
  }
  const status = hiddenStatusOf(row, companyType);
  const live = status === "live" || status === "live_edited";
  const src: ListingSource = { ...source, people: facts?.people ?? source.people };
  const terms = listingTerms(src);
  const listing = buildPublicListing(src, { ...row, live }, hasFinancials);
  const flagged = [
    ...checkListing(listing, terms),
    ...(facts ? runIdentityCheck(row as HiddenDraft, facts).map((f) => f.term) : []),
  ].filter((v, i, a) => a.indexOf(v) === i);
  const overview = (source.long_description || source.short_description || "").trim().split(/(?<=[.!?])\s/)[0] ?? "";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
        {startup && <span className="text-muted-foreground">Startup listings aren't available on the Marketplace yet. This preview is private.</span>}
        {status === "draft" ? (
          <span className="text-muted-foreground"><strong className="text-amber-700 dark:text-amber-400">Draft</strong> · buyers can't see it · SME Takeover · {row.ref_no} · saved {fmtDate(row.updated_at)}</span>
        ) : status === "live_edited" ? (
          <span className="text-muted-foreground"><strong className="text-emerald-700 dark:text-emerald-400">Live</strong> · your changes aren't published yet</span>
        ) : (
          <span className="text-muted-foreground"><strong className="text-emerald-700 dark:text-emerald-400">Live in SME Takeover</strong> · Since {fmtDate(row.published_at)} as {row.live?.code_name ?? row.code_name} · {row.views} views · {row.ndas_approved} NDAs approved</span>
        )}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditorOpen(true)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit public view</Button>
          {startup ? null : status === "draft" ? (
            <Button size="sm" onClick={onPublish} disabled={!!publishBlocked || flagged.length > 0} title={publishBlocked ?? (flagged.length ? "Fix the identity check first" : undefined)} className="bg-accent text-accent-foreground hover:bg-accent/90">Publish to Marketplace</Button>
          ) : (
            <Button size="sm" variant="outline" asChild><Link to="/marketplace"><Store className="mr-1.5 h-3.5 w-3.5" />View in Marketplace</Link></Button>
          )}
        </div>
      </div>

      <div className="rounded-[14px] bg-[#EEF0F4] p-3.5 dark:bg-muted">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">How buyers see it on the Marketplace</span>
          <span className={live ? "rounded-full bg-[#E8F6EE] px-2 py-0.5 text-[11px] font-bold text-[#166534]" : "rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-bold text-[#92400E]"}>
            {live ? "Live · published" : "Draft · not published"}
          </span>
        </div>
        <PublicListingCard l={listing} seller />
      </div>
      {flagged.length === 0 ? (
        <p className="flex items-center gap-1.5 text-[12.5px] text-emerald-700 dark:text-emerald-400"><Check className="h-4 w-4" />Identity check passed · no company, product or people names in the public text.</p>
      ) : (
        <p className="flex items-start gap-1.5 text-[12.5px] text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Identity check found: {flagged.join(", ")}. Edit the public view to remove them before you publish.</p>
      )}

      <div>
        <div className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Filled from your wizard answers <span className="font-normal normal-case tracking-normal">· only the headline is new</span></div>
        <div className="overflow-hidden rounded-[12px] border border-border bg-card text-[12.5px]">
          <SrcRow tag="YOU" field="Headline" hl>
            The one thing to write: one line, no company or product name. We suggest one from your sector and product overview.{" "}
            <button type="button" onClick={() => setEditorOpen(true)} className="font-semibold text-profile">Edit</button>
          </SrcRow>
          <SrcRow tag="WEBSITE" field="Description">
            {overview ? (
              <>
                <span className="text-muted-foreground"><Struck text={overview} terms={terms} /></span>
                {" → "}{listing.description || suggestDescription(overview, terms)}
              </>
            ) : "Product overview from Auto Enrich, with company and product names removed"}
          </SrcRow>
          <SrcRow tag="WEBSITE" field="Products & services">Tags generated by Auto Enrich from your website; product names removed</SrcRow>
          <SrcRow tag="WEBSITE" field="Markets">Customer segments and regions generated by Auto Enrich</SrcRow>
          <SrcRow tag="WIZARD" field="Revenue">'Revenue last year' band, shown as you chose it: {listing.revenueBand ?? "not answered"}</SrcRow>
          <SrcRow tag="WIZARD" field="Location">City / province → province only, no address</SrcRow>
          <SrcRow tag="WIZARD" field="Employees">'Size of your company' band: {listing.employees ?? "not answered"}</SrcRow>
          <SrcRow tag="WIZARD" field="Founded">{source.year_founded ? `Year founded ${source.year_founded} → shown as ${decadeLabel(source.year_founded)}` : "Year founded → shown as a decade"}</SrcRow>
          <SrcRow tag="WIZARD" field="Sector">SET sector and sub-sector, as selected</SrcRow>
          <SrcRow tag="WIZARD" field="Certifications">Licences and ISO standards, as ticked</SrcRow>
          <SrcRow tag="WIZARD" field="Verified">Badge shown once the registration number is verified</SrcRow>
        </div>
        <div className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">In private view <span className="font-normal normal-case tracking-normal">· shown after you approve an NDA</span></div>
        <div className="flex flex-wrap gap-1.5">
          {["Company name & logo", "Product name", "Website & email", "Photos", "Founder name", "Exact figures", "Data room"].map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11.5px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"><Lock className="h-3 w-3" />{t}</span>
          ))}
        </div>
      </div>

      {editorOpen && (
        <PublicListingEditor row={row} source={src} listing={listing} onClose={() => setEditorOpen(false)} onFullEdit={() => { setEditorOpen(false); onEdit(); }} />
      )}
    </div>
  );
}

function Struck({ text, terms }: { text: string; terms: { term: string; reason: string }[] }) {
  return (
    <span className="[&_mark]:bg-transparent [&_mark]:px-0 [&_mark]:text-destructive [&_mark]:line-through">
      <Flagged text={text} terms={terms} />
    </span>
  );
}

const TAG = {
  YOU: "bg-[#FEF3C7] text-[#92400E]",
  WEBSITE: "bg-[#E8F6EE] text-[#166534]",
  WIZARD: "bg-[#EEF0FF] text-[#4338CA]",
} as const;

function SrcRow({ tag, field, hl, children }: { tag: keyof typeof TAG; field: string; hl?: boolean; children: React.ReactNode }) {
  return (
    <div className={`grid grid-cols-[170px_minmax(0,1fr)] gap-3 border-t border-border px-3 py-2 first:border-t-0 ${hl ? "bg-[#FFFDF5] dark:bg-amber-950/20" : ""}`}>
      <div className="flex items-center gap-1.5">
        <span className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold ${TAG[tag]}`}>{tag}</span>
        <span className="font-semibold">{field}</span>
      </div>
      <div className="text-foreground/80">{children}</div>
    </div>
  );
}

function Empty({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
      <EyeOff className="h-6 w-6" />
      {text}
      {children}
    </div>
  );
}
