import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Building2, LayoutGrid, Shield, Menu, Sun, Moon, UserCircle, Check, MapPin, Briefcase, Crown, FileBarChart, Calculator, Lock, GitBranch, Contact, MessageSquare, Star, ShieldAlert, Handshake } from "lucide-react";
import { isReportOrdered, PadlockTile, PitchsnackTag } from "@/components/my-business/locked-report-page";
import { PipelineCountBadge, MessagesCountBadge, AdvisorPipelineCountBadge } from "@/components/menu-count-badge";
import { useMyAdvisorFirms } from "@/components/advisor/advisor-my-company";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouterState } from "@tanstack/react-router";
import { PlanBadge } from "@/components/plan-badge";
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
import { useSessionContext } from "@/hooks/use-session-context";
import { usePreferences } from "@/hooks/use-preferences";
import { ROLE_LABELS } from "@/lib/permissions";
import { useIsMarketplace, usePersona, lastAdminPath, type Persona } from "@/hooks/use-marketplace";
import logoWhite from "@/assets/pitchsnack-white.png";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslation } from "@/i18n/language";

export function useUserIdentity() {
  const { data } = useSessionContext();
  const u = data?.user;
  const name = [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.email || "Signed in";
  const initials =
    ((u?.firstName?.[0] ?? "") + (u?.lastName?.[0] ?? "") || u?.email?.[0] || "?").toUpperCase().slice(0, 2);
  const org = data?.activeWorkspace?.tenantName ?? data?.tenants?.[0]?.tenantName ?? "Your organisation";
  const roleLabel = data?.roles?.[0] ? ROLE_LABELS[data.roles[0]] ?? data.roles[0] : "—";
  return { name, initials, org, roleLabel };
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const { update } = usePreferences();
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    void update({ theme: next ? "dark" : "light" }).catch(() => {});
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="grid h-9 w-9 place-items-center rounded-lg text-[#aab1c4] transition-colors hover:bg-white/10 hover:text-white"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function MarketplaceAdminSwitch() {
  const isMarket = useIsMarketplace();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { locked } = usePersona();
  const path = useRouterState({ select: (s) => s.location.pathname });
  // Sellers, buyers and advisors stay in the Marketplace; only Settings is open outside it.
  const outside = !!locked && !isMarket && !/^\/preferences(\/|$)/.test(path) && !/^\/(marketplace|advisor)(\/|$)/.test(path);
  useEffect(() => { if (outside) navigate({ to: "/marketplace/browse", replace: true }); }, [outside, navigate]);
  if (locked) return null;
  const base =
    "inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-semibold transition-colors";
  return (
    <div role="tablist" aria-label="Area" className="inline-flex gap-1 rounded-[12px] bg-white/[0.07] p-1">
      <button
        role="tab"
        aria-selected={isMarket}
        onClick={() => !isMarket && navigate({ to: "/marketplace" })}
        className={cn(base, isMarket ? "bg-white text-[#141a2b]" : "text-[#a9b0c3] hover:text-white")}
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="hidden sm:inline">{t("Marketplace")}</span>
      </button>
      <button
        role="tab"
        aria-selected={!isMarket}
        onClick={() => isMarket && navigate({ to: lastAdminPath() as "/dashboard" })}
        className={cn(base, !isMarket ? "bg-[#2c3656] text-white" : "text-[#a9b0c3] hover:text-white")}
      >
        <Shield className="h-4 w-4" />
        <span className="hidden sm:inline">{t("Admin")}</span>
      </button>
    </div>
  );
}

export function GlobalBar({ onMenu, showMenu, onLogo }: { onMenu?: () => void; showMenu: boolean; onLogo?: () => void }) {
  const isMarket = useIsMarketplace();
  const { t } = useTranslation();
  const { persona } = usePersona();
  const { roleLabel } = useUserIdentity();
  const label = `Admin · ${roleLabel}`;
  const seller = persona === "seller";
  const advisor = persona === "advisor";
  return (
    <div className="sticky top-0 z-40 flex h-[54px] w-full shrink-0 items-center gap-3 bg-[#151a28] px-3 md:px-4">
      {showMenu && (
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open menu"
          className="grid h-9 w-9 place-items-center rounded-lg text-[#e0e4eb] hover:bg-white/10"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}
      <button
        type="button"
        onClick={onLogo ?? onMenu}
        aria-label="Expand or collapse the menu"
        data-keep-sidebar
        title="Click the logo to expand or collapse the menu"
        className="hidden shrink-0 bg-transparent p-0 sm:block"
      >
        <img src={logoWhite} alt="PitchSnack" className="h-8 w-auto" />
      </button>
      <MarketplaceAdminSwitch />
      <div className="ml-auto flex items-center gap-2">
        {isMarket ? (
          <span
            className={cn(
              "hidden items-center gap-1.5 rounded-full border px-[11px] py-1 text-[12px] font-semibold min-[1180px]:inline-flex",
              advisor
                ? "border-[rgba(45,212,191,.38)] bg-[rgba(45,212,191,.14)] text-[#5EEAD4]"
                : seller
                ? "border-[rgba(246,168,35,.35)] bg-[rgba(246,168,35,.14)] text-[#F6A823]"
                : "border-[rgba(99,110,250,.40)] bg-[rgba(99,110,250,.16)] text-[#A5ADFF]",
            )}
          >
            <span className={cn("h-[7px] w-[7px] rounded-full", advisor ? "bg-[#2DD4BF]" : seller ? "bg-[#F6A823]" : "bg-[#7C85FF]")} />
            {t(advisor ? "Advisor view" : seller ? "Seller view" : "Buyer view")}
          </span>
        ) : (
          <span className="hidden text-[13px] text-[#aab1c4] min-[1180px]:inline">{label}</span>
        )}
        <LanguageSwitcher tone="dark" />
        <ThemeToggle />
      </div>
    </div>
  );
}

const BADGE: Record<Persona, string> = {
  buyer: "bg-[#dbeafe] text-[#1d4ed8]",
  seller: "bg-[#dcfce7] text-[#15803d]",
  advisor: "bg-[#E0F5F2] text-[#0F766E]",
};

export function PersonaBadge({ persona }: { persona: Persona }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", BADGE[persona])}>
      {persona}
    </span>
  );
}

export function PersonaCard({ collapsed = false }: { collapsed?: boolean }) {
  const { persona, setPersona, advisorAllowed, role, locked } = usePersona();
  const { data } = useSessionContext();
  const { name, initials } = useUserIdentity();
  const parts = (advisorAllowed || role ? ["seller", "buyer", "advisor"] : ["seller", "buyer"]) as Persona[];
  const lockedTab = (p: Persona) => !!locked && p !== locked;
  const lockTip = (p: Persona) => `${cap(p)} view is for ${p} accounts. Your account is a${locked === "advisor" ? "n" : ""} ${locked} account.`;
  const pick = (p: Persona) => {
    if (lockedTab(p)) {
      toast(`Your account is a${locked === "advisor" ? "n" : ""} ${locked} account, so the ${cap(p)} tab is greyed out. Ask PitchSnack if you need a${p === "advisor" ? "n" : ""} ${p} account.`);
      return;
    }
    setPersona(p);
  };
  // Another role's page opened by its address lands on the account's own Browse page.
  const navTo = useNavigate();
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  useEffect(() => {
    if (!locked) return;
    const sellerOnly = /^\/(my-startups|my-financials|my-valuation|my-risk)(\/|$)/.test(path);
    const advisorOnly = /^\/advisor\//.test(path);
    if ((sellerOnly && locked !== "seller") || (advisorOnly && locked !== "advisor")) navTo({ to: "/marketplace/browse", replace: true });
  }, [locked, path]);
  const advisor = persona === "advisor";
  const avatar = advisor ? "bg-gradient-to-br from-[#2BB3A3] to-[#0F766E]" : "bg-gradient-to-br from-[#fb923c] to-[#ea580c]";
  const { t } = useTranslation();
  const u = data?.user;
  const workspace = data?.activeWorkspace?.tenantName ?? data?.tenants?.[0]?.tenantName ?? null;
  const firms = useMyAdvisorFirms();
  const org = advisor ? (firms.data?.[0]?.name ?? u?.organisation ?? null) : (u?.organisation ?? workspace);
  const subtitle = [u?.title, org].filter(Boolean).join(" · ");
  const neutral = persona === "seller" ? workspace : advisor ? null : u?.buyerType ?? null;
  const location = [u?.city, u?.country].filter(Boolean).join(", ");
  if (collapsed) {
    const tip = `${name} · ${persona === "seller" ? "Seller" : advisor ? "Advisor" : "Buyer"}`;
    return (
      <div className="flex flex-col items-center px-2 pt-3">
        <div
          tabIndex={0}
          title={tip}
          aria-label={tip}
          className={cn("relative grid h-9 w-9 place-items-center rounded-[10px] text-[13px]", avatar, " font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring")}
        >
          {initials}
          {u?.verified && (
            <span className="absolute -bottom-1 -right-1 grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-sidebar bg-[#16A34A] text-white">
              <Check className="h-[7px] w-[7px]" strokeWidth={4} />
            </span>
          )}
        </div>
        <div role="tablist" aria-label="Persona" className="mt-3 flex flex-col gap-1 rounded-[10px] bg-[var(--mkt-tray)] p-1">
          {parts.map((p) => {
            const Icon = p === "seller" ? Building2 : p === "advisor" ? Handshake : Briefcase;
            const on = persona === p;
            const label = t(p === "seller" ? "I'm Seller" : p === "advisor" ? "I'm Advisor" : "I'm Buyer");
            return (
              <button
                key={p}
                role="tab"
                aria-selected={on}
                aria-label={label}
                aria-disabled={lockedTab(p) || undefined}
                title={lockedTab(p) ? lockTip(p) : label}
                onClick={() => pick(p)}
                className={cn(
                  "relative grid h-[30px] w-[34px] place-items-center rounded-[7px] transition-colors",
                  on ? "bg-[var(--role-accent)] text-[var(--role-on)]" : lockedTab(p) ? "cursor-not-allowed text-[#A7AEBB]" : "text-[var(--mkt-muted)] hover:text-sidebar-foreground",
                )}
              >
                {lockedTab(p) ? <Lock className="h-[13px] w-[13px]" /> : <Icon className="h-[15px] w-[15px]" />}
              </button>
            );
          })}
        </div>
        <RailDivider />
      </div>
    );
  }
  return (
    <div className="space-y-3 border-b border-sidebar-border p-3" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div
        className={cn(
          "rounded-[14px] border p-4",
          "border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[var(--mkt-card-shadow)]",
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "relative grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[14px] text-[18px] font-bold text-white",
              avatar,
            )}
          >
            {initials}
            {u?.verified && (
              <span
                className={cn(
                  "absolute -bottom-1 -right-1 grid h-[18px] w-[18px] place-items-center rounded-full border-2 bg-[#16A34A] text-white",
                  "border-sidebar",
                )}
              >
                <Check className="h-[9px] w-[9px]" strokeWidth={4} />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1 text-[17px] font-bold leading-tight tracking-[-0.01em]">
              <span className="truncate">{name}</span>

            </div>
            {subtitle && (
              <div className={cn("mt-0.5 text-[13px] leading-snug text-[var(--mkt-muted)]", advisor ? "break-words" : "truncate")}>{subtitle}</div>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-[9px] py-1 text-[11px] font-bold uppercase tracking-[0.06em]",
              "bg-[var(--role-pill-bg)] text-[var(--role-pill-fg)]",
            )}
          >
            {persona}
          </span>
          {u?.planInfo && role !== "admin" && <PlanBadge name={u.planInfo.name} style={u.planInfo.badgeStyle} ended={u.planInfo.ended} />}
          {neutral && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-[9px] py-1 text-[11px] font-semibold",
                "bg-[var(--mkt-tray)] text-[var(--mkt-muted)]",
              )}
            >
              {neutral}
            </span>
          )}
        </div>
        {location && (
          <div className={"mt-2.5 flex items-center gap-1.5 truncate text-[12px] text-[var(--mkt-muted)]"}>
            <MapPin className="h-[13px] w-[13px] shrink-0" />
            {location}
          </div>
        )}
      </div>
      <div
        role="tablist"
        aria-label="Persona"
        className={cn("grid gap-1 rounded-[12px] bg-[var(--mkt-tray)] p-1", parts.length === 3 ? "grid-cols-3" : "grid-cols-2")}
      >
        {parts.map((p) => {
          const Icon = p === "seller" ? Building2 : Briefcase;
          const on = persona === p;
          const three = parts.length === 3;
          const aria = p === "seller" ? "I'm Seller" : p === "advisor" ? "I'm Advisor" : "I'm Buyer";
          return (
            <button
              key={p}
              role="tab"
              aria-selected={on}
              aria-label={aria}
              aria-disabled={lockedTab(p) || undefined}
              aria-describedby={lockedTab(p) ? `tip-${p}` : undefined}
              onClick={() => pick(p)}
              className={cn(
                "group relative flex h-10 items-center justify-center gap-[7px] rounded-[9px] font-semibold transition-colors",
                three ? "text-[13px]" : "text-[14px]",
                on
                  ? "bg-[var(--role-accent)] text-[var(--role-on)]"
                  : lockedTab(p) ? "cursor-not-allowed text-[#A7AEBB]" : "text-[var(--mkt-muted)] hover:text-sidebar-foreground",
              )}
            >
              {lockedTab(p) && (
                <>
                  <Lock className="h-3 w-3" />
                  <span id={`tip-${p}`} role="tooltip" className={cn("pointer-events-none absolute top-[calc(100%+6px)] z-50 hidden w-[200px] rounded-[9px] bg-[#151A28] px-2.5 py-2 text-left text-[12px] font-normal leading-snug text-white group-hover:block group-focus-visible:block", p === "seller" ? "left-0" : p === "advisor" ? "right-0" : "left-1/2 -translate-x-1/2")}>{lockTip(p)}</span>
                </>
              )}
              {three ? (p === "seller" ? "Seller" : p === "buyer" ? "Buyer" : "Advisor") : (
                <>
                  <Icon className="h-[15px] w-[15px]" />
                  {aria}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const MENU_LINK_BASE =
  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors";
const MENU_LINK_ACTIVE = {
  className: `${MENU_LINK_BASE} bg-[var(--role-accent)] text-[var(--role-on)] font-medium`,
};
const MENU_LINK_INACTIVE = {
  className: `${MENU_LINK_BASE} text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground`,
};

type MenuItem = { to: string; label: string; icon: typeof LayoutGrid; exact?: boolean; lock?: "financials" | "valuation" | "risk" };

function RailDivider() {
  return <div aria-hidden className="mx-auto my-3 h-px w-7 bg-sidebar-border" />;
}

export function MarketplaceEmptyMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { persona } = usePersona();
  const { t } = useTranslation();
  const advisor = persona === "advisor";
  const discover: MenuItem[] =
    advisor
      ? [
          { to: "/marketplace/browse", label: "Browse marketplace", icon: LayoutGrid },
          { to: "/marketplace/favourites", label: "Favourites", icon: Star },
        ]
      : persona === "buyer"
      ? [
          { to: "/marketplace/browse", label: "Browse listings", icon: LayoutGrid },
          { to: "/marketplace/favourites", label: "Favourites", icon: Star },
        ]
      : [{ to: "/marketplace/browse", label: "Browse investors", icon: LayoutGrid }, { to: "/marketplace/favourites", label: "Favourites", icon: Star }];
  const workspace: MenuItem[] =
    advisor ? [{ to: "/marketplace/my-company", label: "My Company", icon: Building2, exact: false }, { to: "/advisor/pipeline", label: "My Pipeline", icon: GitBranch }, { to: "/advisor/messages", label: "Messages", icon: MessageSquare }, { to: "/marketplace/my-contact", label: "Contacts", icon: Contact }] : persona === "seller"
      ? [
          { to: "/my-startups", label: "My Company", icon: Building2, exact: false },
          { to: "/marketplace/pipeline", label: "Pipeline", icon: GitBranch },
          { to: "/marketplace/my-contact", label: "Contacts", icon: Contact },
          { to: "/marketplace/messages", label: "Messages", icon: MessageSquare },
        ]
      : [
          { to: "/marketplace/my-company", label: "My Company", icon: Building2 },
          { to: "/marketplace/pipeline", label: "Pipeline", icon: GitBranch },
          { to: "/marketplace/my-contact", label: "Contacts", icon: Contact },
          { to: "/marketplace/messages", label: "Messages", icon: MessageSquare },
        ];
  const tools: MenuItem[] =
    persona === "seller"
      ? [
          { to: "/my-financials", label: "My Financials", icon: FileBarChart, lock: "financials" },
          { to: "/my-valuation", label: "Company Valuation", icon: Calculator, lock: "valuation" },
          { to: "/my-risk", label: "Company Risk", icon: ShieldAlert, lock: "risk" },
        ]
      : [];
  const account: MenuItem[] = advisor
    ? [{ to: "/my-page", label: "My Profile", icon: UserCircle }]
    : [{ to: "/my-page", label: "My Profile", icon: UserCircle }, { to: "/marketplace/notifications", label: "Notifications", icon: BellRing }];

  if (collapsed) {
    const railItem = (it: MenuItem) => {
      const locked = it.lock ? !isReportOrdered(it.lock) : false;
      const tip = locked ? `${t(it.label)} · locked` : t(it.label);
      return (
        <Link
          key={it.to}
          to={it.to}
          activeOptions={it.exact === false ? { exact: false } : undefined}
          title={tip}
          aria-label={tip}
          activeProps={{ className: "bg-[var(--role-accent)] text-[var(--role-on)] font-medium" }}
          inactiveProps={{ className: "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" }}
          className="relative flex items-center justify-center rounded-lg px-2 py-2.5 transition-colors"
        >
          <it.icon className="h-4 w-4 shrink-0" />
          {it.to === "/marketplace/pipeline" && <PipelineCountBadge collapsed />}
          {(it.to === "/marketplace/messages" || it.to === "/advisor/messages") && <MessagesCountBadge collapsed />}
          {it.to === "/advisor/pipeline" && <AdvisorPipelineCountBadge collapsed />}
          {locked && (
            <span data-mkt-badge data-rail className="absolute right-1 top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-accent text-accent-foreground">
              <Lock className="h-2 w-2" strokeWidth={3} />
            </span>
          )}
        </Link>
      );
    };
    return (
      <div>
        <div className="space-y-1">{discover.map(railItem)}</div>
        {workspace.length > 0 && (
          <>
            <RailDivider />
            <div className="space-y-1">{workspace.map(railItem)}</div>
          </>
        )}
        {tools.length > 0 && (
          <>
            <RailDivider />
            <div className="space-y-1">{tools.map(railItem)}</div>
          </>
        )}
        <RailDivider />
        <div className="space-y-1">{account.map(railItem)}</div>
      </div>
    );
  }

  const fullItem = (it: MenuItem) => (
    <Link
      key={it.to}
      to={it.to}
      activeOptions={it.exact === false ? { exact: false } : undefined}
      activeProps={MENU_LINK_ACTIVE}
      inactiveProps={MENU_LINK_INACTIVE}
    >
      <it.icon className="h-4 w-4 shrink-0" />
      <span>{t(it.label)}</span>
      {it.to === "/marketplace/pipeline" && <PipelineCountBadge />}
      {(it.to === "/marketplace/messages" || it.to === "/advisor/messages") && <MessagesCountBadge />}
      {it.to === "/advisor/pipeline" && <AdvisorPipelineCountBadge />}
      {it.lock && (isReportOrdered(it.lock) ? <PitchsnackTag /> : <PadlockTile />)}
    </Link>
  );
  const title = (text: string) => (
    <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{t(text)}</div>
  );
  return (
    <div className="space-y-4">
      <div className="space-y-1">{title("Discover")}{discover.map(fullItem)}</div>
      {workspace.length > 0 && <div className="space-y-1">{title("My Workspace")}{workspace.map(fullItem)}</div>}
      {tools.length > 0 && <div className="space-y-1">{title("Tools")}{tools.map(fullItem)}</div>}
      <div className="space-y-1">{title("Account")}{account.map(fullItem)}</div>
    </div>
  );
}
