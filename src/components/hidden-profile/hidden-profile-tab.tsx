import { useEffect, useState } from "react";
import { AlertTriangle, Check, Pencil, Store } from "lucide-react";
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
  listingTerms,
  type ListingSource,
} from "@/lib/public-listing";
import { PublicListingCard } from "./public-listing-card";
import { PublicListingEditor } from "./public-listing-editor";


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
  const [editAfterCreate, setEditAfterCreate] = useState(false);
  const startup = isStartupEntry(companyType);
  // After "Edit public view" creates the draft, open the editor as soon as the row arrives.
  useEffect(() => {
    if (row && editAfterCreate) { setEditorOpen(true); setEditAfterCreate(false); }
  }, [row, editAfterCreate]);
  if (!row) {
    const preview = buildPublicListing(source, null, hasFinancials);
    return (
      <div className="space-y-3">
        {startup && <p className="flex items-start gap-2 text-sm text-muted-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Startup listings aren't available on the Marketplace yet. This preview is private.</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{name} has no public listing yet. This preview is private.</span>
          <Button onClick={() => { setEditAfterCreate(true); onCreate(); }} disabled={creating} variant="outline"><Pencil className="mr-1.5 h-4 w-4" />{creating ? "Creating…" : "Edit public view"}</Button>
        </div>
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
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


      {editorOpen && (
        <PublicListingEditor row={row} source={src} listing={listing} onClose={() => setEditorOpen(false)} onFullEdit={() => { setEditorOpen(false); onEdit(); }} />
      )}
    </div>
  );
}



