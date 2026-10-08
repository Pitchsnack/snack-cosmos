import { createFileRoute } from "@tanstack/react-router";
import { PublicShell } from "@/components/public-site/public-shell";
import { PrivacyDoc } from "@/components/public-site/privacy-notice";

const D = "What personal data PitchSnack collects, why, who can see it, how long we keep it, and your rights under Thailand's PDPA.";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "PitchSnack · Privacy notice" },
      { name: "description", content: D },
      { property: "og:title", content: "PitchSnack privacy notice" },
      { property: "og:description", content: D },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PublicShell current={null}>
      <div className="pv-page"><div className="pv-sheet"><PrivacyDoc /></div></div>
    </PublicShell>
  ),
});
