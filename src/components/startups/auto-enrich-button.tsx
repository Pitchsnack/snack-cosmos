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
    const url = (websiteUrl ?? "").trim();
    if (!url) {
      toast.error("Enter a Website URL first, then click Auto Enrich.");
      return;
    }
    setLoading(true);
    try {
      const result = await autoEnrichAdapter.enrichStartup({ websiteUrl: url });
      onEnriched(result);
      toast.success("Auto Enrich complete — empty fields populated.");
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
