import { forwardRef, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  investorEnrichAdapter,
  type EnrichInvestorResult,
} from "@/lib/auto-enrich/investor-enrich-adapter";

interface Props {
  websiteUrl: string;
  onEnriched: (result: EnrichInvestorResult) => void;
  disabled?: boolean;
}

/**
 * Auto Enrich button for Edit Investor — mirrors the PitchSnack1 Admin action.
 * The UI only calls `investorEnrichAdapter.enrichInvestor(...)`.
 */
export const InvestorAutoEnrichButton = forwardRef<HTMLButtonElement, Props>(
  function InvestorAutoEnrichButton({ websiteUrl, onEnriched, disabled, ...rest }, ref) {
    const [loading, setLoading] = useState(false);

    const run = async () => {
      const raw = (websiteUrl ?? "").trim();
      if (!raw) {
        toast.error("Enter a Company URL first, then click Auto Enrich.");
        return;
      }
      const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      let hostname = "";
      try {
        hostname = new URL(url).hostname;
      } catch {
        toast.error("Company URL is not a valid URL.");
        return;
      }
      if (!hostname.includes(".") || hostname.endsWith(".")) {
        toast.error("Company URL must include a domain (e.g. example.com).");
        return;
      }
      setLoading(true);
      try {
        const result = await investorEnrichAdapter.enrichInvestor({ websiteUrl: url });
        const fieldsReturned = Object.entries(result).filter(([k, v]) => {
          if (k === "_debug" || v == null) return false;
          if (Array.isArray(v)) return v.length > 0;
          if (typeof v === "string") return v.trim().length > 0;
          return true;
        }).length;
        onEnriched(result);
        const dbg = result._debug;
        const hqMsg = (() => {
          switch (dbg?.headquartersDiagnostic) {
            case "inferred_from_phone":
              return `Country inferred from public contact phone country code ${dbg.headquartersPhoneCc ?? ""}.`.trim();
            case "conflicting_signals":
              return "Headquarters not filled: multiple conflicting country signals found.";
            case "not_found":
              return "Headquarters not filled: no direct country or reliable phone country code found.";
            default:
              return "";
          }
        })();
        if (fieldsReturned === 0) {
          toast.warning(
            "Auto Enrich finished but the model returned no fields." +
              (dbg ? ` Source: ${dbg.origin}, ~${dbg.corpusChars} chars scraped.` : ""),
          );
        } else {
          toast.success(
            `Auto Enrich complete (${fieldsReturned} field${fieldsReturned === 1 ? "" : "s"} returned).` +
              (hqMsg ? ` ${hqMsg}` : ""),
          );
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Auto Enrich failed.");
      } finally {
        setLoading(false);
      }
    };

  return (
    <Button
      {...rest}
      ref={ref}
      type="button"
      onClick={run}
      disabled={disabled || loading}
      size="sm"
      className="gap-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700"
      title="Scrape the Company URL and back-fill empty fields"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      {loading ? "Enriching…" : "Auto Enrich"}
    </Button>
  );
});

