import { useMemo, useState } from "react";
import { AlertTriangle, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { pickDraft, type HiddenProfileRow } from "@/lib/hidden-profile";
import {
  DESCRIPTION_MAX,
  HEADLINE_MAX,
  checkListing,
  listingTerms,
  suggestHeadline,
  type ListingSource,
  type PublicListing,
} from "@/lib/public-listing";
import { useHiddenProfileActions } from "@/hooks/use-hidden-profiles";

const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

/** Edits the headline (required), description and tags only. */
export function PublicListingEditor({ row, source, listing, onClose, onFullEdit }: {
  row: HiddenProfileRow; source: ListingSource; listing: PublicListing; onClose: () => void; onFullEdit: () => void;
}) {
  const suggestion = useMemo(() => suggestHeadline(source), [source]);
  const [headline, setHeadline] = useState(row.headline.trim() || suggestion);
  const [description, setDescription] = useState(listing.description);
  const [products, setProducts] = useState(listing.productTags.join(", "));
  const [markets, setMarkets] = useState(listing.marketTags.join(", "));
  const { save } = useHiddenProfileActions();
  const terms = useMemo(() => listingTerms(source), [source]);
  const flagged = checkListing({ headline, description, productTags: split(products), marketTags: split(markets) }, terms);
  const tooLong = headline.length > HEADLINE_MAX || description.length > DESCRIPTION_MAX;

  const submit = async () => {
    await save.mutateAsync({
      startupId: row.startup_id,
      draft: { ...pickDraft(row), headline: headline.trim(), description: description.trim(), product_tags: split(products), market_tags: split(markets) },
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
        <DialogHeader><DialogTitle>Edit public view</DialogTitle></DialogHeader>
        <div className="space-y-4 text-[13px]">
          <div>
            <label className="mb-1 block font-semibold">Headline <span className="text-destructive">*</span></label>
            <Input value={headline} maxLength={HEADLINE_MAX + 20} onChange={(e) => setHeadline(e.target.value)} placeholder={suggestion} />
            <div className="mt-1 flex items-center justify-between text-[11.5px] text-muted-foreground">
              {headline.trim() !== suggestion ? (
                <button type="button" onClick={() => setHeadline(suggestion)} className="inline-flex items-center gap-1 font-semibold text-profile"><Sparkles className="h-3.5 w-3.5" />Use suggestion: {suggestion}</button>
              ) : <span>No company or product names.</span>}
              <span className={headline.length > HEADLINE_MAX ? "text-destructive" : ""}>{headline.length}/{HEADLINE_MAX}</span>
            </div>
          </div>
          <div>
            <label className="mb-1 block font-semibold">Description</label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className={`mt-1 text-right text-[11.5px] ${description.length > DESCRIPTION_MAX ? "text-destructive" : "text-muted-foreground"}`}>{description.length}/{DESCRIPTION_MAX}</div>
          </div>
          <div>
            <label className="mb-1 block font-semibold">Products & services <span className="font-normal text-muted-foreground">(comma separated)</span></label>
            <Input value={products} onChange={(e) => setProducts(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block font-semibold">Markets <span className="font-normal text-muted-foreground">(comma separated)</span></label>
            <Input value={markets} onChange={(e) => setMarkets(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block font-semibold">Public picture</label>
            <p className="text-[12px] text-muted-foreground">Image locked · set by Admin. Admin picks it from the image library so every Marketplace card looks consistent; it goes live when your listing is approved.</p>
          </div>
          {flagged.length === 0 ? (
            <p className="flex items-center gap-1.5 text-[12.5px] text-emerald-700 dark:text-emerald-400"><Check className="h-4 w-4" />Identity check passed</p>
          ) : (
            <p className="flex items-start gap-1.5 text-[12.5px] text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4" />Remove: {flagged.join(", ")}</p>
          )}
          <p className="text-[12px] text-muted-foreground">Everything else comes from your Private view and wizard answers. <button type="button" onClick={onFullEdit} className="font-semibold text-profile">Edit deal terms & code name</button></p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={!headline.trim() || tooLong || save.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
