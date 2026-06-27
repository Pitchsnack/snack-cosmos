import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { autoEnrichAdapter, type EnrichStartupResult } from "@/lib/auto-enrich/auto-enrich-adapter";

interface Props {
  websiteUrl: string;
  onEnriched: (result: EnrichStartupResult) => void;
  disabled?: boolean;
}

/**
 * Auto Enrich button — mirrors the PitchSnack1 Edit Startup action.
 * The UI only ever calls `autoEnrichAdapter.enrichStartup(...)`; backend
 * selection lives in the adapter (lovable | api_gateway).
 */
export function AutoEnrichButton({ websiteUrl, onEnriched, disabled }: Props) {
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const raw = (websiteUrl ?? "").trim();
    if (!raw) {
      toast.error("Enter a Website URL first, then click Auto Enrich.");
      return;
    }
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      // eslint-disable-next-line no-new
      new URL(url);
    } catch {
      toast.error("Website URL is not a valid URL.");
      return;
    }
    setLoading(true);
    try {
      const result = await autoEnrichAdapter.enrichStartup({ websiteUrl: url });
      // Count non-empty top-level fields (ignore _debug).
      const fieldsReturned = Object.entries(result).filter(([k, v]) => {
        if (k === "_debug" || v == null) return false;
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === "string") return v.trim().length > 0;
        return true;
      }).length;
      onEnriched(result);
      const dbg = result._debug;
      if (fieldsReturned === 0) {
        toast.warning(
          `Auto Enrich finished but the model returned no fields.` +
            (dbg ? ` Source: ${dbg.origin}, ~${dbg.corpusChars} chars scraped.` : ""),
        );
      } else {
        toast.success(`Auto Enrich complete (${fieldsReturned} field${fieldsReturned === 1 ? "" : "s"} returned).`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Auto Enrich failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      onClick={run}
      disabled={disabled || loading}
      size="sm"
      className="gap-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700"
      title="Scrape the Website URL and back-fill empty fields"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      {loading ? "Enriching…" : "Auto Enrich"}
    </Button>
  );
}
