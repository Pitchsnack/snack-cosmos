import { Building2, Compass, Lightbulb, Radar, TrendingUp } from "lucide-react";

import type { AcquisitionStrategy } from "@/lib/acquisition/strategy-store";

function InsightCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Lightbulb;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-card">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
        {title}
      </h3>
      {children}
    </section>
  );
}

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-xs text-muted-foreground">No data yet.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <span
          key={it}
          className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-foreground/85"
        >
          {it}
        </span>
      ))}
    </div>
  );
}

/** Read-only analysis view derived from the saved strategy (placeholder-grade AI insights). */
export function InsightsTab({
  strategy,
  startupName,
}: {
  strategy: AcquisitionStrategy;
  startupName: string;
}) {
  const extracted = strategy.competitors.filter((c) => c.status === "extracted" && c.result);
  const patterns = [...new Set(extracted.flatMap((c) => c.result!.strategicPatterns))];
  const themes = [...new Set(extracted.flatMap((c) => c.result!.commonThemes))];
  const r = strategy.requirements;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <InsightCard icon={Compass} title="Acquisition Strategy Summary">
        <p className="text-xs leading-relaxed text-muted-foreground">
          {startupName} is tracking{" "}
          <span className="font-medium text-foreground">{strategy.targets.length}</span> target{" "}
          {strategy.targets.length === 1 ? "company" : "companies"} and{" "}
          <span className="font-medium text-foreground">{strategy.competitors.length}</span>{" "}
          competitor {strategy.competitors.length === 1 ? "reference" : "references"} (
          {extracted.length} extracted). Requirements cover{" "}
          <span className="font-medium text-foreground">{r.industries.length}</span>{" "}
          {r.industries.length === 1 ? "industry" : "industries"} and{" "}
          <span className="font-medium text-foreground">{r.markets.length}</span>{" "}
          {r.markets.length === 1 ? "market" : "markets"}.
        </p>
        {strategy.updatedAt && (
          <p className="mt-2 text-[11px] text-muted-foreground/70">
            Last saved: {new Date(strategy.updatedAt).toLocaleString()}
          </p>
        )}
      </InsightCard>

      <InsightCard icon={TrendingUp} title="Top Target Industries">
        <Chips items={r.industries} />
      </InsightCard>

      <InsightCard icon={Radar} title="Competitor Acquisition Pattern Summary">
        {patterns.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Extract at least one competitor reference to see acquisition patterns here.
          </p>
        ) : (
          <ul className="list-disc space-y-1 pl-4 text-xs text-foreground/80">
            {patterns.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </InsightCard>

      <InsightCard icon={Lightbulb} title="Suggested Acquisition Themes">
        {themes.length === 0 && r.keywords.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Suggested themes will appear once requirements or competitor extractions exist.
          </p>
        ) : (
          <Chips items={[...new Set([...r.keywords, ...themes])]} />
        )}
      </InsightCard>

      <InsightCard icon={Building2} title="Similar Companies to Review">
        <p className="text-xs text-muted-foreground">
          AI-assisted discovery of similar acquisition targets will appear here in a future update.
          Companies matching your industries, markets and keywords will be ranked automatically.
        </p>
      </InsightCard>
    </div>
  );
}
