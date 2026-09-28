import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Building2, LayoutGrid, Shield, Menu, Sun, Moon, UserCircle, Check, MapPin, Briefcase, Crown, FileBarChart, Calculator, Lock, GitBranch } from "lucide-react";
import { isReportOrdered, PadlockTile, PitchsnackTag } from "@/components/my-business/locked-report-page";
import { cn } from "@/lib/utils";
import { useSessionContext } from "@/hooks/use-session-context";
import { usePreferences } from "@/hooks/use-preferences";
import { ROLE_LABELS } from "@/lib/permissions";
import { useIsMarketplace, usePersona, lastAdminPath, type Persona } from "@/hooks/use-marketplace";
import logoWhite from "@/assets/pitchsnack-white.png";

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
  const navigate = useNavigate();
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
        <span className="hidden sm:inline">Marketplace</span>
      </button>
      <button
        role="tab"
        aria-selected={!isMarket}
        onClick={() => isMarket && navigate({ to: lastAdminPath() as "/dashboard" })}
        className={cn(base, !isMarket ? "bg-[#2c3656] text-white" : "text-[#a9b0c3] hover:text-white")}
      >
        <Shield className="h-4 w-4" />
        <span className="hidden sm:inline">Admin</span>
      </button>
    </div>
  );
}

export function GlobalBar({ onMenu, showMenu, onLogo }: { onMenu?: () => void; showMenu: boolean; onLogo?: () => void }) {
  const isMarket = useIsMarketplace();
  const { persona } = usePersona();
  const { roleLabel } = useUserIdentity();
  const label = isMarket ? `Marketplace · ${persona} view` : `Admin · ${roleLabel}`;
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
        <span className="hidden text-[13px] text-[#aab1c4] min-[1180px]:inline">{label}</span>
        <ThemeToggle />
      </div>
    </div>
  );
}

const BADGE: Record<Persona, string> = {
  buyer: "bg-[#dbeafe] text-[#1d4ed8]",
  seller: "bg-[#dcfce7] text-[#15803d]",
};

export function PersonaBadge({ persona }: { persona: Persona }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", BADGE[persona])}>
      {persona}
    </span>
  );
}

export function PersonaCard({ collapsed = false }: { collapsed?: boolean }) {
  const { persona, setPersona } = usePersona();
  const { data } = useSessionContext();
  const { name, initials } = useUserIdentity();
  const u = data?.user;
  const workspace = data?.activeWorkspace?.tenantName ?? data?.tenants?.[0]?.tenantName ?? null;
  const org = u?.organisation ?? workspace;
  const subtitle = [u?.title, org].filter(Boolean).join(" · ");
  const neutral = persona === "seller" ? workspace : u?.buyerType ?? null;
  const location = [u?.city, u?.country].filter(Boolean).join(", ");
  const dark = persona === "seller";
  if (collapsed) {
    const tip = `${name} · ${persona === "seller" ? "Seller" : "Buyer"}`;
    return (
      <div className="flex flex-col items-center px-2 pt-3">
        <div
          tabIndex={0}
          title={tip}
          aria-label={tip}
          className="relative grid h-9 w-9 place-items-center rounded-[10px] bg-gradient-to-br from-[#fb923c] to-[#ea580c] text-[13px] font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          {initials}
          {u?.verified && (
            <span className="absolute -bottom-1 -right-1 grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-sidebar bg-[#16A34A] text-white">
              <Check className="h-[7px] w-[7px]" strokeWidth={4} />
            </span>
          )}
        </div>
        <div role="tablist" aria-label="Persona" className="mt-3 flex flex-col gap-1 rounded-[10px] border border-sidebar-border bg-sidebar-accent p-1">
          {(["seller", "buyer"] as const).map((p) => {
            const Icon = p === "seller" ? Building2 : Briefcase;
            const on = persona === p;
            const label = p === "seller" ? "I'm Seller" : "I'm Buyer";
            return (
              <button
                key={p}
                role="tab"
                aria-selected={on}
                aria-label={label}
                title={label}
                onClick={() => setPersona(p)}
                className={cn(
                  "grid h-[30px] w-[34px] place-items-center rounded-[7px] transition-colors",
                  on ? "bg-white text-[#0f1115]" : "text-sidebar-foreground/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-[15px] w-[15px]" />
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
          dark
            ? "border-[#343846] bg-[#262933] text-[#e5e7eb]"
            : "border-[#E6E8EC] bg-white text-[#0f1115] shadow-[0_1px_2px_rgba(16,24,40,.04),0_6px_16px_rgba(16,24,40,.06)]",
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "relative grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[14px] text-[18px] font-bold text-white",
              dark ? "bg-gradient-to-br from-[#f59e0b] to-[#b45309]" : "bg-gradient-to-br from-[#fb923c] to-[#ea580c]",
            )}
          >
            {initials}
            {u?.verified && (
              <span
                className={cn(
                  "absolute -bottom-1 -right-1 grid h-[18px] w-[18px] place-items-center rounded-full border-2 bg-[#16A34A] text-white",
                  dark ? "border-[#262933]" : "border-white",
                )}
              >
                <Check className="h-[9px] w-[9px]" strokeWidth={4} />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1 text-[17px] font-bold leading-tight tracking-[-0.01em]">
              <span className="truncate">{name}</span>
              {u?.plan && (
                <span title={`${u.plan} plan`} className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[#EDE4FF] text-[#6D28D9]">
                  <Crown className="h-[9px] w-[9px]" />
                </span>
              )}
            </div>
            {subtitle && (
              <div className={cn("mt-0.5 truncate text-[13px] leading-snug", dark ? "text-[#a1a6b3]" : "text-[#6b7280]")}>{subtitle}</div>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-[9px] py-1 text-[11px] font-bold uppercase tracking-[0.06em]",
              dark ? "bg-[rgba(22,163,74,.16)] text-[#4ADE80]" : "bg-[#EEF0FF] text-[#4338CA]",
            )}
          >
            {persona}
          </span>
          {neutral && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-[9px] py-1 text-[11px] font-semibold",
                dark ? "bg-[#30343f] text-[#cbd0da]" : "bg-[#f3f4f6] text-[#374151]",
              )}
            >
              {neutral}
            </span>
          )}
        </div>
        {location && (
          <div className={cn("mt-2.5 flex items-center gap-1.5 truncate text-[12px]", dark ? "text-[#8b90a0]" : "text-[#6b7280]")}>
            <MapPin className="h-[13px] w-[13px] shrink-0" />
            {location}
          </div>
        )}
      </div>
      <div
        role="tablist"
        aria-label="Persona"
        className={cn("grid grid-cols-2 gap-1 rounded-[12px] p-1", dark ? "border border-[#343846] bg-[#262933]" : "bg-[#f3f4f6]")}
      >
        {(["seller", "buyer"] as const).map((p) => {
          const Icon = p === "seller" ? Building2 : Briefcase;
          const on = persona === p;
          return (
            <button
              key={p}
              role="tab"
              aria-selected={on}
              onClick={() => setPersona(p)}
              className={cn(
                "flex h-10 items-center justify-center gap-[7px] rounded-[9px] text-[14px] font-semibold transition-colors",
                on
                  ? cn("bg-white text-[#0f1115]", !dark && "shadow-[0_1px_3px_rgba(16,24,40,.12)]")
                  : dark ? "text-[#9ca3af] hover:text-white" : "text-[#6b7280] hover:text-[#0f1115]",
              )}
            >
              <Icon className="h-[15px] w-[15px]" />
              {p === "seller" ? "I'm Seller" : "I'm Buyer"}
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
  className: `${MENU_LINK_BASE} bg-sidebar-accent text-sidebar-primary font-medium`,
};
const MENU_LINK_INACTIVE = {
  className: `${MENU_LINK_BASE} text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground`,
};

type MenuItem = { to: string; label: string; icon: typeof LayoutGrid; exact?: boolean; lock?: "financials" | "valuation" };

function RailDivider() {
  return <div aria-hidden className="mx-auto my-3 h-px w-7 bg-sidebar-border" />;
}

export function MarketplaceEmptyMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { persona } = usePersona();
  const discover: MenuItem[] = [{ to: "/marketplace/browse", label: "Browse listings", icon: LayoutGrid }];
  const workspace: MenuItem[] =
    persona === "seller"
      ? [
          { to: "/my-startups", label: "My Company", icon: Building2, exact: false },
          { to: "/marketplace/pipeline", label: "Pipeline", icon: GitBranch },
          { to: "/my-financials", label: "My Financials", icon: FileBarChart, lock: "financials" },
          { to: "/my-valuation", label: "Company Valuation", icon: Calculator, lock: "valuation" },
          { to: "/marketplace/my-contact", label: "Contacts", icon: Building2 },
        ]
      : [{ to: "/marketplace/pipeline", label: "Pipeline", icon: GitBranch }];
  const account: MenuItem[] = [{ to: "/my-page", label: "My Profile", icon: UserCircle }];

  if (collapsed) {
    const railItem = (it: MenuItem) => {
      const locked = it.lock ? !isReportOrdered(it.lock) : false;
      const tip = locked ? `${it.label} · locked` : it.label;
      return (
        <Link
          key={it.to}
          to={it.to}
          activeOptions={it.exact === false ? { exact: false } : undefined}
          title={tip}
          aria-label={tip}
          activeProps={{ className: "bg-sidebar-accent text-sidebar-primary font-medium" }}
          inactiveProps={{ className: "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" }}
          className="relative flex items-center justify-center rounded-lg px-2 py-2.5 transition-colors"
        >
          <it.icon className="h-4 w-4 shrink-0" />
          {locked && (
            <span className="absolute right-1 top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-accent text-accent-foreground">
              <Lock className="h-2 w-2" strokeWidth={3} />
            </span>
          )}
        </Link>
      );
    };
    return (
      <div>
        <div className="space-y-1">{discover.map(railItem)}</div>
        <RailDivider />
        <div className="space-y-1">{workspace.map(railItem)}</div>
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
      <span>{it.label}</span>
      {it.lock && (isReportOrdered(it.lock) ? <PitchsnackTag /> : <PadlockTile />)}
    </Link>
  );
  const title = (t: string) => (
    <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{t}</div>
  );
  return (
    <div className="space-y-4">
      <div className="space-y-1">{title("Discover")}{discover.map(fullItem)}</div>
      <div className="space-y-1">{title("My Workspace")}{workspace.map(fullItem)}</div>
    </div>
  );
}
