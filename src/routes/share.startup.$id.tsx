import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Bookmark,
  Building2,
  CalendarDays,
  Globe,
  Link2,
  Linkedin,
  MapPin,
  MoreVertical,
  ShieldCheck,
  Sprout,
  Target,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useStartup } from "@/hooks/use-startup";
import { useHasSession } from "@/hooks/use-has-session";
import { cn } from "@/lib/utils";
import defaultBackground from "@/assets/default-startup-share-background.jpg";
import type { StartupDetail } from "@/lib/startups.functions";

export const Route = createFileRoute("/share/startup/$id")({
  head: () => ({
    meta: [
      { title: "Startup Profile — Shared on PitchSnack" },
      {
        name: "description",
        content:
          "A startup profile shared by its founder on PitchSnack. See what the company does, its stage, market, founders and investors.",
      },
      { property: "og:title", content: "Startup Profile — Shared on PitchSnack" },
      {
        property: "og:description",
        content:
          "A startup profile shared by its founder on PitchSnack. See what the company does, its stage, market, founders and investors.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicSharePage,
});

function PublicSharePage() {
  const { id } = Route.useParams();
  const hasSession = useHasSession();
  const { data, isLoading, error } = useStartup(id);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 lg:grid-cols-[32%_1fr]">
        <HeroPanel startup={data ?? null} />
        <main className="p-4 sm:p-8">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10">
            {isLoading && hasSession ? (
              <p className="text-sm text-muted-foreground">Loading profile…</p>
            ) : data ? (
              <Profile startup={data} />
            ) : (
              <LockedState reason={error ? (error as Error).message : undefined} />
            )}
          </div>
          <PageFooter />
        </main>
      </div>
    </div>
  );
}

/* ---------------------------------- hero --------------------------------- */

function HeroPanel({ startup }: { startup: StartupDetail | null }) {
  const media = startup?.media ?? [];
  const background =
    media.find((m) => m.slot === 1)?.image_signed_url ??
    media.find((m) => m.image_signed_url)?.image_signed_url ??
    defaultBackground;

  const facts: { icon: typeof Globe; label: string; value: string; href?: string }[] = [];
  if (startup?.year_founded)
    facts.push({ icon: CalendarDays, label: "Founded", value: String(startup.year_founded) });
  if (startup?.website_url)
    facts.push({
      icon: Globe,
      label: "Website",
      value: startup.website_url.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      href: startup.website_url,
    });
  if (startup?.industry?.length)
    facts.push({ icon: Target, label: "Focus", value: startup.industry.join(", ") });
  if (startup?.market_tags?.length)
    facts.push({ icon: Users, label: "Market", value: startup.market_tags.slice(0, 2).join(", ") });

  return (
    <aside
      className="relative flex min-h-[260px] flex-col justify-between overflow-hidden p-8 lg:min-h-screen"
      style={{
        backgroundImage: `url(${background})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(5,18,8,0.35) 0%, rgba(5,14,7,0.6) 50%, rgba(5,12,6,0.82) 100%)",
        }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 text-xl font-semibold tracking-tight text-white">
          <Sprout className="h-6 w-6" /> PitchSnack
        </div>
        <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/90 backdrop-blur">
          <Link2 className="h-3.5 w-3.5" /> Shared by a startup founder
        </span>
        {startup?.short_description && (
          <p className="mt-8 max-w-sm text-2xl font-semibold leading-snug text-white lg:text-3xl">
            {startup.short_description.split(/(?<=\.)\s+/).slice(0, 3).join(" ")}
          </p>
        )}
      </div>

      {facts.length > 0 && (
        <div className="relative mt-8 rounded-2xl border border-white/15 bg-black/35 p-4 backdrop-blur">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
            Quick facts
          </div>
          <dl className="mt-3 space-y-2.5">
            {facts.map((f) => (
              <div key={f.label} className="flex items-center justify-between gap-4 text-sm">
                <dt className="flex items-center gap-2 text-white/70">
                  <f.icon className="h-3.5 w-3.5" /> {f.label}
                </dt>
                <dd className="truncate text-right font-medium text-white">
                  {f.href ? (
                    <a
                      href={f.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline-offset-2 hover:underline"
                    >
                      {f.value}
                    </a>
                  ) : (
                    f.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </aside>
  );
}

/* -------------------------------- profile -------------------------------- */

function Profile({ startup }: { startup: StartupDetail }) {
  const [expanded, setExpanded] = useState(false);
  const about = startup.long_description ?? startup.short_description;
  const meta = [
    startup.investment_stage
      ? { icon: Sprout, label: startup.investment_stage }
      : null,
    startup.company_type ? { icon: Building2, label: startup.company_type } : null,
    startup.headquarters || startup.city
      ? { icon: MapPin, label: startup.headquarters ?? startup.city! }
      : null,
    startup.year_founded
      ? { icon: CalendarDays, label: `Est. ${startup.year_founded}` }
      : null,
  ].filter(Boolean) as { icon: typeof MapPin; label: string }[];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          {startup.logo_signed_url ? (
            <img
              src={startup.logo_signed_url}
              alt={`${startup.startup_name} logo`}
              width={72}
              height={72}
              className="h-[72px] w-[72px] shrink-0 rounded-xl border border-border object-contain"
            />
          ) : (
            <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-xl font-semibold text-muted-foreground">
              {startup.startup_name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight lg:text-[42px]">
              <span className="truncate">{startup.startup_name}</span>
              {startup.status === "Active" && startup.visibility === "Public" && (
                <BadgeCheck className="h-6 w-6 shrink-0 text-primary" aria-label="Verified" />
              )}
            </h1>
            {startup.short_description && (
              <p className="mt-2 max-w-2xl text-muted-foreground">{startup.short_description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link to="/login" search={{ redirect: `/startups/${startup.id}` } as never}>
              Connect on PitchSnack
            </Link>
          </Button>
          <Button variant="outline" size="icon" aria-label="Bookmark">
            <Bookmark className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label="More options">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {meta.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-5 text-sm text-muted-foreground">
          {meta.map((m, i) => (
            <span key={m.label} className="flex items-center gap-4">
              {i > 0 && <span className="text-border">|</span>}
              <span className="flex items-center gap-2">
                <m.icon className="h-4 w-4" /> {m.label}
              </span>
            </span>
          ))}
        </div>
      )}

      {about && (
        <section className="border-t border-border pt-6">
          <h2 className="text-lg font-semibold">About {startup.startup_name}</h2>
          <p
            className={cn(
              "mt-2 whitespace-pre-line text-muted-foreground",
              !expanded && "line-clamp-4",
            )}
          >
            {about}
          </p>
          {about.length > 260 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-sm font-medium text-primary hover:underline"
            >
              {expanded ? "Show less" : "More..."}
            </button>
          )}
        </section>
      )}

      {(startup.product_tags.length > 0 || startup.market_tags.length > 0) && (
        <section className="grid gap-6 border-t border-border pt-6 md:grid-cols-2 md:divide-x md:divide-border">
          {startup.product_tags.length > 0 && (
            <div className="md:pr-6">
              <h3 className="text-sm font-semibold">Product &amp; Service Tags</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {startup.product_tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border px-3 py-1 text-xs text-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
          {startup.market_tags.length > 0 && (
            <div className="md:pl-6">
              <h3 className="text-sm font-semibold">Market Tags</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {startup.market_tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {(startup.founders.length > 0 || startup.investors.length > 0) && (
        <section className="grid gap-6 border-t border-border pt-6 md:grid-cols-[55%_1fr] md:divide-x md:divide-border">
          {startup.founders.length > 0 && (
            <div className="md:pr-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4" /> Founders ({startup.founders.length})
              </h3>
              <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                {startup.founders.map((f) => (
                  <li key={f.id} className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                      {f.full_name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{f.full_name}</div>
                      {f.position && (
                        <div className="truncate text-xs text-muted-foreground">{f.position}</div>
                      )}
                      {f.linkedin_url && (
                        <a
                          href={f.linkedin_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Linkedin className="h-3.5 w-3.5" /> LinkedIn
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {startup.investors.length > 0 && (
            <InvestorChips names={startup.investors.map((i) => i.investor_name)} />
          )}
        </section>
      )}

      <section className="rounded-2xl bg-primary/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-md">
            <h2 className="text-lg font-semibold">Want to see more or connect?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Join PitchSnack to access full profiles, connect with startups, and manage your
              pipeline in one place.
            </p>
          </div>
          <div className="text-center">
            <Button asChild size="lg">
              <Link to="/login">Sign up for free</Link>
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function InvestorChips({ names }: { names: string[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? names : names.slice(0, 8);
  return (
    <div className="md:pl-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Users className="h-4 w-4" /> Investors ({names.length})
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {visible.map((n) => (
          <span key={n} className="rounded-full border border-border px-3 py-1 text-xs">
            {n}
          </span>
        ))}
        {!showAll && names.length > 8 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            +{names.length - 8} more
          </button>
        )}
      </div>
    </div>
  );
}

function LockedState({ reason }: { reason?: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">A startup profile was shared with you</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          This profile is not publicly readable yet. Sign in or create a free PitchSnack account to
          view the full startup profile, its founders and its investors.
        </p>
        {reason && <p className="mt-2 text-xs text-muted-foreground">Details: {reason}</p>}
      </div>
      <div className="rounded-2xl bg-primary/5 p-6">
        <Button asChild size="lg">
          <Link to="/login">Sign up for free</Link>
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

function PageFooter() {
  return (
    <footer className="mt-6 flex flex-wrap items-center justify-center gap-3 py-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5" /> Secure. Private. Built for founders &amp; investors.
      </span>
      <span className="text-border">|</span>
      <span>© {new Date().getFullYear()} PitchSnack</span>
    </footer>
  );
}
