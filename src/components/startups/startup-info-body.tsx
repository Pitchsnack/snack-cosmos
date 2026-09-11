/**
 * Canonical Startup Information Panel body.
 *
 * Every surface that shows startup information (Startup Directory, My
 * Startups, Acquisition Strategy, linked/manual acquisition companies) renders
 * THIS component. The layout, field order, section titles and empty states are
 * identical for every startup — only the data changes.
 *
 * Fields with no data are never removed: they render the standard "—" /
 * "Not available" empty state so the panel is comparable across records.
 */

import { useEffect, useRef, useState } from "react";
import {
  Banknote,
  Building2,
  Calendar,
  FileText,
  Globe,
  Layers,
  Linkedin,
  Mail,
  MapPin,
  ShoppingCart,
  TrendingUp,
  UserCircle2,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

export interface StartupInfoFounder {
  id: string;
  fullName: string | null;
  position?: string | null;
  bio?: string | null;
  linkedinUrl?: string | null;
}

export interface StartupInfoData {
  name: string;
  registeredName?: string | null;
  companyType?: string | null;
  yearFounded?: number | string | null;
  investmentStage?: string | null;
  companySize?: string | null;
  revenue?: string | null;
  headquarters?: string | null;
  region?: string | null;
  city?: string | null;
  website?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
  shortDescription?: string | null;
  longDescription?: string | null;
  industry?: string[];
  productTags?: string[];
  marketTags?: string[];
  founders?: StartupInfoFounder[];
}



function href(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function StartupInfoSection({
  icon: Icon,
  title,
  children,
  right,
}: {
  icon: typeof Calendar;
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="border-t border-border/50 pt-[11.2px]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          {title}
        </h3>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      <div>{children}</div>
    </section>
  );
}




function ChipRow({ tags, tone }: { tags: string[]; tone: "primary" | "muted" }) {
  if (tags.length === 0) return <span className="text-sm text-muted-foreground">Not available</span>;
  const base =
    tone === "primary"
      ? "bg-primary/5 text-foreground/85 border-primary/20"
      : "bg-muted/50 text-muted-foreground border-transparent";
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t} className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${base}`}>
          {t}
        </span>
      ))}
    </div>
  );
}

export function StartupInfoBody({
  data,
  renderFounderAvatar,
}: {
  data: StartupInfoData;
  /** Lets a surface mask founder pictures (Basic Information Restrictions). */
  renderFounderAvatar?: (founder: StartupInfoFounder) => React.ReactNode;
}) {
  const [descExpanded, setDescExpanded] = useState(false);
  const [descClamped, setDescClamped] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = descRef.current;
    if (!el) return;
    const prev = el.style.webkitLineClamp;
    el.style.webkitLineClamp = "unset";
    const full = el.scrollHeight;
    el.style.webkitLineClamp = prev;
    setDescClamped(full > el.clientHeight + 1);
  }, [data.longDescription]);

  const industry = data.industry ?? [];
  const productTags = data.productTags ?? [];
  const marketTags = data.marketTags ?? [];
  const founders = data.founders ?? [];

  const metaItems: { icon: typeof Calendar; value: React.ReactNode }[] = [];
  if (data.yearFounded) metaItems.push({ icon: Calendar, value: `Est. ${data.yearFounded}` });
  if (data.companyType) metaItems.push({ icon: Building2, value: data.companyType });
  if (data.investmentStage) metaItems.push({ icon: TrendingUp, value: data.investmentStage });
  if (data.companySize) metaItems.push({ icon: Users, value: data.companySize });
  if (data.revenue) metaItems.push({ icon: Banknote, value: data.revenue });
  if (data.headquarters) metaItems.push({ icon: MapPin, value: data.headquarters });
  if (data.city) metaItems.push({ icon: MapPin, value: data.city });
  if (data.region) metaItems.push({ icon: Globe, value: data.region });
  if (data.website)
    metaItems.push({
      icon: Globe,
      value: (
        <a
          href={href(data.website)}
          target="_blank"
          rel="noreferrer"
          className="text-blue-900 hover:underline"
        >
          Website →
        </a>
      ),
    });
  if (data.email)
    metaItems.push({
      icon: Mail,
      value: (
        <a href={`mailto:${data.email}`} className="text-blue-900 hover:underline">
          {data.email}
        </a>
      ),
    });
  if (data.linkedinUrl)
    metaItems.push({
      icon: Linkedin,
      value: (
        <a
          href={href(data.linkedinUrl)}
          target="_blank"
          rel="noreferrer"
          className="text-blue-900 hover:underline"
        >
          LinkedIn →
        </a>
      ),
    });


  return (
    <>
      {/* Short description */}
      <p className="text-[15px] leading-relaxed text-foreground/85">
        {data.shortDescription || (
          <span className="text-muted-foreground">No description available yet.</span>
        )}
      </p>

      {/* Compact meta row — matches the investor panel */}
      {metaItems.length > 0 && (
        <div className="grid grid-cols-1 gap-x-5 gap-y-[11px] border-y border-[#EFF1F4] py-[11px] text-[13.5px] sm:grid-cols-2 lg:grid-cols-3">
          {metaItems.map((item, i) => (
            <div key={i} className="flex items-center gap-[9px] min-w-0">
              <item.icon className="h-[15px] w-[15px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <span className="truncate">{item.value}</span>
            </div>
          ))}
        </div>
      )}


      {/* Long description */}
      <StartupInfoSection icon={FileText} title="Product overview">
        {data.longDescription ? (
          <>
            <p
              ref={descRef}
              className={cn(
                "whitespace-pre-line text-[14px] leading-relaxed text-foreground/85",
                !descExpanded && "line-clamp-4",
              )}
            >
              {data.longDescription}
            </p>
            {(descClamped || descExpanded) && (
              <button
                type="button"
                onClick={() => setDescExpanded((v) => !v)}
                className="mt-1 text-[13px] font-medium text-primary hover:underline"
              >
                {descExpanded ? "Less" : "More…"}
              </button>
            )}
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Not available</span>
        )}
      </StartupInfoSection>

      <StartupInfoSection icon={Layers} title="Industry">
        <ChipRow tags={industry} tone="muted" />
      </StartupInfoSection>

      <StartupInfoSection icon={Layers} title="Product & service tags">
        <ChipRow tags={productTags} tone="primary" />
      </StartupInfoSection>

      <StartupInfoSection icon={ShoppingCart} title="Market tags">
        <ChipRow tags={marketTags} tone="muted" />
      </StartupInfoSection>

      <StartupInfoSection
        icon={UserCircle2}
        title={`Founder${founders.length > 1 ? `s (${founders.length})` : ""}`}
      >
        {founders.length === 0 ? (
          <span className="text-sm text-muted-foreground">Not available</span>
        ) : (
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {founders.map((f) => (
              <div key={f.id} className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted/60 text-xs font-semibold text-muted-foreground">
                  {renderFounderAvatar
                    ? renderFounderAvatar(f)
                    : (f.fullName ?? "").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-tight">{f.fullName}</div>
                  {f.position && (
                    <div className="mt-0.5 text-xs text-muted-foreground">{f.position}</div>
                  )}
                  {f.bio && <p className="mt-1 text-xs leading-relaxed text-foreground/75">{f.bio}</p>}
                  {f.linkedinUrl && (
                    <a
                      href={href(f.linkedinUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-900 hover:underline"
                    >
                      <Linkedin className="h-3 w-3" strokeWidth={1.75} /> LinkedIn
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </StartupInfoSection>
    </>
  );
}
