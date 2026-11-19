import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { repairSellerListingTexts, type SellerListingTextRepairReport } from "@/lib/profile-repair.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/control-description-repair")({
  head: () => ({ meta: [
    { title: "Control Description repair | PitchSnack" },
    { name: "description", content: "Control-only seller Description sentence repair." },
    { property: "og:title", content: "Control Description repair | PitchSnack" },
    { property: "og:description", content: "Control-only seller Description sentence repair." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ControlDescriptionRepair,
});

function ControlDescriptionRepair() {
  const runRepair = useServerFn(repairSellerListingTexts);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<SellerListingTextRepairReport | null>(null);
  const [error, setError] = useState("");
  const run = async () => {
    setBusy(true); setError("");
    try { setReport(await runRepair()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Repair failed"); }
    finally { setBusy(false); }
  };
  return <main className="p-8">
    <Button type="button" disabled={busy} onClick={run}>{busy ? "Running Description upgrade" : "Run Description upgrade"}</Button>
    {error && <p role="alert">{error}</p>}
    {report && <pre data-testid="repair-report">{JSON.stringify(report, null, 2)}</pre>}
  </main>;
}
