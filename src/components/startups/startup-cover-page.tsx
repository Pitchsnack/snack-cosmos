import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  Calendar,
  Check,
  ExternalLink,
  Image as ImageIcon,
  Linkedin,
  Loader2,
  MapPin,
  Link2,
  Tag,
  TrendingUp,
  Users,
} from "lucide-react";

import logoWhite from "@/assets/pitchsnack-white.png";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStartup } from "@/hooks/use-startup";
import { useCoverBackground } from "@/hooks/use-cover-background";
import {
  COVER_BACKGROUNDS,
  coverBackgroundPreset,
} from "@/lib/cover/cover-background";
import { useRestrictionMask } from "@/hooks/use-startup-restrictions";
import { MaskedImage, restrictedSet } from "@/components/startups/restricted-placeholder";
import { cn } from "@/lib/utils";

const NAVY = "#0B2D63";

function monogram(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-[13px] font-medium"
      style={{ color: NAVY, backgroundColor: "#F4F7FC", borderColor: "#DCE4F0" }}
    >
      {children}
    </span>
  );
}

function SectionHeading({
  icon: Icon,
  children,
}: {
  icon: typeof Tag;
  children: React.ReactNode;
}) {
  return (
    <h2 className="mb-2.5 flex items-center gap-2 text-[15px] font-semibold" style={{ color: NAVY }}>
      <Icon className="h-[15px] w-[15px]" strokeWidth={1.9} />
      {children}
    </h2>
  );
}

/**
 * Reusable Startup Cover Page.
 *
 * Presentation layer over the existing Startup Information Panel record — no
 * new fields, no generated copy, no duplicated dataset. The same component
 * serves Startup Directory (view only) and My Startups (background editable).
 */
export function StartupCoverPage({
  id,
  workspace = "startups",
  canEditBackground = false,
}: {
  id: string;
  workspace?: "startups" | "my-startups";
  canEditBackground?: boolean;
}) {
  const { data, isLoading, error } = useStartup(id);
  const { mask } = useRestrictionMask(workspace);
  const { selected, select } = useCoverBackground(id);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [showAllInvestors, setShowAllInvestors] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading cover page…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-10 text-center text-sm text-destructive">
        Failed to load: {(error as Error)?.message ?? "Not found"}
      </div>
    );
  }

  const s = mask(data);
  const restricted = restrictedSet(s);

  // Cover background priority: explicit selection → Media1 → Yellow default.
  const media1 = s.media?.find((m) => m.slot === 1);
  const media1Url =
    !restricted.has("media_images") && !mediaFailed ? media1?.image_signed_url ?? null : null;
  const preset = coverBackgroundPreset(selected);
  const useMedia = !selected && !!media1Url;

  const metaItems: { icon: typeof Calendar; label: string }[] = [];
  if (s.investment_stage) metaItems.push({ icon: TrendingUp, label: s.investment_stage });
  if (s.company_type) metaItems.push({ icon: Building2, label: s.company_type });
  if (s.headquarters) metaItems.push({ icon: MapPin, label: s.headquarters });
  if (s.year_founded) metaItems.push({ icon: Calendar, label: `Est. ${s.year_founded}` });

  const investors = s.investors ?? [];
  const visibleInvestors = showAllInvestors ? investors : investors.slice(0, 12);

  return (
    <div className="bg-white text-[#0F172A]">
      <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:py-7" style={{ zoom: 0.8 }}>
        <div className="overflow-hidden rounded-[18px] border border-[#E6ECF5] shadow-[0_18px_60px_-32px_rgba(11,45,99,0.45)] lg:grid lg:grid-cols-[31%_69%] lg:items-stretch">
          {/* ---------------- Left cover ---------------- */}
          <div
            className="relative flex min-h-[240px] flex-col justify-between overflow-hidden p-5 sm:min-h-[280px] lg:p-6"
            style={useMedia ? undefined : { background: preset.css }}
          >
            {/* Media1 is treated purely as a background: cropped, scaled and
                blurred so source website text never reads as page content. */}
            {useMedia && media1Url && (
              <>
                <div
                  className="pointer-events-none absolute -inset-10 scale-125 blur-[10px]"
                  style={{
                    backgroundImage: `url(${media1Url})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                />
                <img
                  src={media1Url}
                  alt=""
                  className="hidden"
                  onError={() => setMediaFailed(true)}
                />
              </>
            )}
            {/* Readability overlay: media must read as background, never as content */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: useMedia
                  ? "linear-gradient(to bottom, rgba(4,10,22,0.78) 0%, rgba(4,10,22,0.70) 40%, rgba(4,10,22,0.90) 100%)"
                  : "linear-gradient(to bottom, rgba(4,10,22,0.35) 0%, rgba(4,10,22,0.22) 40%, rgba(4,10,22,0.72) 100%)",
              }}
            />


            <div className="relative z-10 space-y-3">
              {/* PitchSnack logo — mandatory solid black box */}
              <div className="inline-flex items-center rounded-[10px] bg-black px-3.5 py-2">
                <img src={logoWhite} alt="PitchSnack" className="h-6 w-auto" />
              </div>

              <div>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium text-white"
                  style={{ background: "rgba(11,45,99,0.6)" }}
                >
                  <Link2 className="h-3 w-3" style={{ color: "#7FB2FF" }} />
                  Shared by a startup founder
                </span>
              </div>

              {/* Existing short description only — never generated copy */}
              {s.short_description && (
                <div className="pt-1">
                  <p className="line-clamp-5 max-w-[20ch] text-[21px] font-bold leading-[1.25] text-white sm:text-[25px]">
                    {s.short_description}
                  </p>
                  <div className="mt-3 h-1 w-9 rounded-full" style={{ background: "#3B82F6" }} />
                </div>
              )}
            </div>

            {/* Quick Facts — only rows that already exist on the record */}
            <div className="relative z-10 mt-6">
              <QuickFacts
                founded={s.year_founded}
                website={s.website_url}
                focus={s.industry?.[0] ?? null}
                market={s.market_tags?.[0] ?? null}
              />

              {canEditBackground && (
                <div className="mt-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-2 rounded-full border-white/25 bg-white/15 text-white backdrop-blur hover:bg-white/25"
                      >
                        <ImageIcon className="h-4 w-4" /> Change Cover Background
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuLabel>PitchSnack backgrounds</DropdownMenuLabel>
                      {COVER_BACKGROUNDS.map((b) => (
                        <DropdownMenuItem
                          key={b.id}
                          onSelect={() => select(b.id)}
                          className="gap-2"
                        >
                          <span
                            className="h-4 w-4 shrink-0 rounded-full border border-border"
                            style={{ background: b.swatch }}
                          />
                          <span className="flex-1">
                            {b.label}
                            {b.id === "yellow" && (
                              <span className="ml-1 text-xs text-muted-foreground">(default)</span>
                            )}
                          </span>
                          {selected === b.id && <Check className="h-4 w-4" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </div>

          {/* ---------------- Right information panel ---------------- */}
          <div className="bg-white p-5 sm:p-7 lg:p-8">
            {/* Header */}
            <div className="flex flex-wrap items-start gap-4 sm:flex-nowrap">
              <div className="flex h-[96px] w-[96px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#E6ECF5] bg-white shadow-[0_6px_18px_-12px_rgba(11,45,99,0.5)]">
                {restricted.has("logo") ? (
                  <MaskedImage seed={`${s.id}-logo`} cells={8} />
                ) : s.logo_signed_url ? (
                  <img src={s.logo_signed_url} alt="" className="h-full w-full object-contain p-2" />
                ) : (
                  <span className="text-xl font-semibold" style={{ color: NAVY }}>
                    {monogram(s.startup_name)}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h1
                  className="text-[30px] font-bold leading-[1.1] tracking-tight sm:text-[40px]"
                  style={{ color: NAVY }}
                >
                  {s.startup_name}
                </h1>
                {s.short_description && (
                  <p className="mt-1.5 max-w-[58ch] text-[15px] leading-[1.5] text-[#42536B]">
                    {s.short_description}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  className="h-10 rounded-lg px-4 text-[14px] text-white hover:opacity-90"
                  style={{ backgroundColor: NAVY }}
                  asChild
                >
                  <Link
                    to={workspace === "my-startups" ? "/my-startups/$id" : "/startups/$id"}
                    params={{ id }}
                  >
                    {workspace === "my-startups" ? "Back to my startup" : "Connect on PitchSnack"}
                  </Link>
                </Button>
              </div>
            </div>

            {/* Compact metadata row */}
            {metaItems.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[14px] text-[#42536B]">
                {metaItems.map((m, i) => {
                  const Icon = m.icon;
                  return (
                    <span key={m.label} className="flex items-center gap-1.5">
                      {i > 0 && <span className="mr-1.5 text-[#C3CDDB]">·</span>}
                      <Icon className="h-4 w-4" style={{ color: NAVY }} strokeWidth={1.9} />
                      {m.label}
                    </span>
                  );
                })}

              </div>
            )}

            {/* About — existing Product Overview only */}
            {s.long_description && (
              <section className="mt-5 border-t border-[#EDF1F7] pt-4">
                <SectionHeading icon={Building2}>About {s.startup_name}</SectionHeading>
                <p
                  className={cn(
                    "whitespace-pre-line text-[15px] leading-[1.6] text-[#42536B]",
                    !aboutExpanded && "line-clamp-4",
                  )}
                >
                  {s.long_description}
                </p>
                <button
                  type="button"
                  onClick={() => setAboutExpanded((v) => !v)}
                  className="mt-1 text-[14px] font-medium hover:underline"
                  style={{ color: NAVY }}
                >
                  {aboutExpanded ? "Show less" : "More…"}
                </button>
              </section>
            )}

            {/* Tags */}
            {(s.product_tags?.length > 0 || s.market_tags?.length > 0) && (
              <section className="mt-5 grid gap-4 border-t border-[#EDF1F7] pt-4 md:grid-cols-2 md:gap-6">
                {s.product_tags?.length > 0 && (
                  <div>
                    <SectionHeading icon={Tag}>Product &amp; Service Tags</SectionHeading>
                    <div className="flex flex-wrap gap-2">
                      {s.product_tags.map((t) => (
                        <Pill key={t}>{t}</Pill>
                      ))}
                    </div>
                  </div>
                )}
                {s.market_tags?.length > 0 && (
                  <div className="md:border-l md:border-[#EDF1F7] md:pl-6">
                    <SectionHeading icon={Tag}>Market Tags</SectionHeading>
                    <div className="flex flex-wrap gap-2">
                      {s.market_tags.map((t) => (
                        <Pill key={t}>{t}</Pill>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Founders + Investors */}
            {(s.founders?.length > 0 || investors.length > 0) && (
              <section className="mt-5 grid gap-4 border-t border-[#EDF1F7] pt-4 md:grid-cols-[56%_44%] md:gap-6">
                {s.founders?.length > 0 && (
                  <div>
                    <SectionHeading icon={Users}>Founders ({s.founders.length})</SectionHeading>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {s.founders.map((f) => (
                        <div key={f.id} className="flex min-w-0 items-start gap-2.5">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-[13px] font-semibold"
                            style={{ backgroundColor: "#F1F5FB", color: NAVY }}
                          >
                            {restricted.has("founders") ? (
                              <MaskedImage
                                seed={`${s.id}-${f.id}`}
                                cells={6}
                                className="rounded-full"
                                showLock={false}
                                label="Restricted founder picture"
                              />
                            ) : (
                              (f.full_name ?? "").charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[14px] font-semibold leading-tight" style={{ color: NAVY }}>
                              {f.full_name}
                            </div>
                            {f.position && (
                              <div className="mt-0.5 truncate text-[13px] text-[#5B6B84]">{f.position}</div>
                            )}
                            {f.linkedin_url && (
                              <a
                                href={f.linkedin_url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-flex"
                                aria-label={`${f.full_name} on LinkedIn`}
                              >
                                <Linkedin className="h-4 w-4" style={{ color: NAVY }} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {investors.length > 0 && (
                  <div className="md:border-l md:border-[#EDF1F7] md:pl-6">
                    <SectionHeading icon={Users}>Investors ({investors.length})</SectionHeading>
                    <div className="flex flex-wrap gap-2">
                      {visibleInvestors.map((i) => (
                        <Pill key={i.id}>{i.investor_name}</Pill>
                      ))}
                      {!showAllInvestors && investors.length > visibleInvestors.length && (
                        <button
                          type="button"
                          onClick={() => setShowAllInvestors(true)}
                          className="text-[13px] font-medium hover:underline"
                          style={{ color: NAVY }}
                        >
                          +{investors.length - visibleInvestors.length} more
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* CTA */}
            <section
              className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4"
              style={{ backgroundColor: "#F7FAFF", borderColor: "#E1E9F5" }}
            >
              <div className="min-w-[240px] flex-1">
                <h3 className="text-[17px] font-semibold" style={{ color: NAVY }}>
                  Want to see more or connect?
                </h3>
                <p className="mt-1 max-w-[52ch] text-[14px] leading-snug text-[#5B6B84]">
                  Join PitchSnack to access full profiles, connect with startups, and manage your
                  pipeline in one place.
                </p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Button
                  className="h-11 rounded-lg px-8 text-[15px] text-white hover:opacity-90"
                  style={{ backgroundColor: NAVY }}
                  asChild
                >
                  <Link to="/login">Sign up for free</Link>
                </Button>
                <p className="text-[13px] text-[#5B6B84]">
                  Already have an account?{" "}
                  <Link to="/login" className="font-semibold underline" style={{ color: NAVY }}>
                    Log in
                  </Link>
                </p>
              </div>
            </section>
          </div>
        </div>

        <p className="mt-3 text-center text-[12px] text-[#8494A8]">
          Secure. Private. Built for founders &amp; investors.{"\u00a0 \u00a0"}
          |{"\u00a0 \u00a0"}2025 PitchSnack
        </p>
      </div>
    </div>
  );
}

function QuickFacts({
  founded,
  website,
  focus,
  market,
}: {
  founded: number | null;
  website: string | null;
  focus: string | null;
  market: string | null;
}) {
  const rows: { label: string; value: React.ReactNode }[] = [];
  if (founded) rows.push({ label: "Founded", value: String(founded) });
  if (website) {
    const host = website.replace(/^https?:\/\//, "").replace(/\/$/, "");
    rows.push({
      label: "Website",
      value: (
        <a
          href={website}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 hover:underline"
        >
          {host}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ),
    });
  }
  if (focus) rows.push({ label: "Focus", value: focus });
  if (market) rows.push({ label: "Market", value: market });
  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/15 bg-black/60 p-3.5 backdrop-blur-sm">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "#7FB2FF" }}>
        Quick Facts
      </div>
      <dl className="divide-y divide-white/12">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 py-1.5">
            <dt className="text-[12px] text-white/70">{r.label}</dt>
            <dd className="truncate text-[12px] font-medium text-white">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
