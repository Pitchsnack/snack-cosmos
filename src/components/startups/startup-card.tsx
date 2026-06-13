import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import type { StartupListItem } from "@/lib/startups.functions";

function monogram(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function StartupCard({ s }: { s: StartupListItem }) {
  return (
    <Link
      to="/startups/$id"
      params={{ id: s.id }}
      className="group flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-card transition hover:border-accent/50 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
          {s.logo_signed_url ? (
            <img src={s.logo_signed_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-base font-semibold text-muted-foreground">{monogram(s.startup_name)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold leading-tight group-hover:text-accent">
            {s.startup_name}
          </h3>
          {s.company_type && (
            <div className="mt-0.5 text-xs text-muted-foreground">{s.company_type}</div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            {s.headquarters && (
              <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{s.headquarters}</span>
            )}
            {s.year_founded && <span>Founded {s.year_founded}</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {s.investment_stage && (
          <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent text-[10px]">{s.investment_stage}</Badge>
        )}
        {s.industry && (
          <Badge variant="outline" className="text-[10px]">{s.industry}</Badge>
        )}
      </div>

      {s.short_description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{s.short_description}</p>
      )}

      {(s.product_tags?.length || s.market_tags?.length) ? (
        <div className="mt-auto space-y-1.5 pt-1">
          {s.product_tags?.length ? <ChipRow tags={s.product_tags} tone="primary" /> : null}
          {s.market_tags?.length ? <ChipRow tags={s.market_tags} tone="muted" /> : null}
        </div>
      ) : null}
    </Link>
  );
}

function ChipRow({ tags, tone }: { tags: string[]; tone: "primary" | "muted" }) {
  const shown = tags.slice(0, 5);
  const overflow = tags.length - shown.length;
  const base =
    tone === "primary"
      ? "bg-primary/10 text-primary border-primary/30"
      : "bg-muted text-muted-foreground border-border";
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((t) => (
        <span key={t} className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${base}`}>{t}</span>
      ))}
      {overflow > 0 && <span className="text-[10px] text-muted-foreground">+{overflow}</span>}
    </div>
  );
}
