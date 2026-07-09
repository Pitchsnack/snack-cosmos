import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { StartupListItem } from "@/lib/startups.functions";

function monogram(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

/** Wraps a truncated element with a tooltip showing full text. */
function Truncate({
  text,
  children,
  className,
}: {
  text: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span className={className}>{children}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs break-words">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function StartupCard({ s }: { s: StartupListItem }) {
  return (
    <TooltipProvider disableHoverableContent>
      <Link
        to="/startups/$id"
        params={{ id: s.id }}
        className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-card transition hover:border-accent/50 hover:shadow-md"
      >
        {s.tile_image_signed_url && (
          <div className="-m-5 mb-0 overflow-hidden rounded-t-xl border-b border-border bg-muted/40 aspect-[16/9]">
            <img
              src={s.tile_image_signed_url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            />
          </div>
        )}
        <div className="flex items-start gap-3">
          <div className="flex h-[32px] w-[64px] shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
            {s.logo_signed_url ? (
              <img src={s.logo_signed_url} alt="" className="h-full w-auto max-w-full object-contain" />
            ) : (
              <span className="text-[11px] font-semibold text-muted-foreground">{monogram(s.startup_name)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <Truncate text={s.startup_name} className="block">
              <h3 className="truncate text-sm font-semibold leading-tight group-hover:text-accent">
                {s.startup_name}
              </h3>
            </Truncate>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
              {s.headquarters && (
                <Truncate text={s.headquarters}>
                  <span className="inline-flex max-w-[10rem] items-center gap-0.5 truncate">
                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{s.headquarters}</span>
                  </span>
                </Truncate>
              )}
              {s.year_founded && <span className="shrink-0">Founded {s.year_founded}</span>}
            </div>
          </div>
          {s.company_type && (
            <Truncate text={s.company_type}>
              <Badge variant="outline" className="shrink-0 rounded-full px-1.5 py-0 text-[10px]">
                {s.company_type}
              </Badge>
            </Truncate>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {s.investment_stage && (
            <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent text-[10px]">
              {s.investment_stage}
            </Badge>
          )}
          {s.industry?.map((ind) => (
            <Badge key={ind} variant="outline" className="text-[10px]">{ind}</Badge>
          ))}
        </div>

        {s.short_description && (
          <Truncate text={s.short_description} className="block">
            <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{s.short_description}</p>
          </Truncate>
        )}

        {(s.product_tags?.length || s.market_tags?.length) ? (
          <div className="mt-auto space-y-1.5 pt-1">
            {s.product_tags?.length ? <ChipRow tags={s.product_tags} tone="primary" /> : null}
            {s.market_tags?.length ? <ChipRow tags={s.market_tags} tone="muted" /> : null}
          </div>
        ) : null}
      </Link>
    </TooltipProvider>
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
        <Tooltip key={t} delayDuration={200}>
          <TooltipTrigger asChild>
            <span
              className={`max-w-[10rem] truncate rounded-full border px-2 py-0.5 text-[10px] font-medium ${base}`}
            >
              {t}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">{t}</TooltipContent>
        </Tooltip>
      ))}
      {overflow > 0 && (
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <span className="text-[10px] text-muted-foreground">+{overflow}</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs break-words">
            {tags.slice(5).join(", ")}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
