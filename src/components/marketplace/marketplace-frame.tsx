import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LayoutGrid, Shield, Menu, Sun, Moon } from "lucide-react";
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

export function PersonaCard() {
  const { persona, setPersona } = usePersona();
  const { name, initials, org } = useUserIdentity();
  return (
    <div className="space-y-2 border-b border-sidebar-border p-3">
      <div className="flex items-center gap-2.5 rounded-lg bg-sidebar-accent p-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sidebar-primary/20 text-xs font-semibold text-sidebar-primary">
          {initials}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-medium">{name}</div>
          <div className="truncate text-[11px] text-sidebar-foreground/60">{org}</div>
        </div>
        <PersonaBadge persona={persona} />
      </div>
      <div role="tablist" aria-label="Persona" className="grid grid-cols-2 gap-1 rounded-lg bg-white/[0.07] p-1">
        {(["seller", "buyer"] as const).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={persona === p}
            onClick={() => setPersona(p)}
            className={cn(
              "h-7 rounded-md text-xs font-semibold capitalize transition-colors",
              persona === p ? "bg-white text-[#141a2b]" : "text-[#a9b0c3] hover:text-white",
            )}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MarketplaceEmptyMenu() {
  const navigate = useNavigate();
  return (
    <div className="rounded-lg border border-dashed border-sidebar-border p-3 text-xs leading-relaxed text-sidebar-foreground/60">
      <div className="mb-1 font-semibold text-sidebar-foreground/80">No menu items yet.</div>
      The Marketplace menu is empty for now. Every menu item is in Admin.
      <button
        type="button"
        onClick={() => navigate({ to: lastAdminPath() as "/dashboard" })}
        className="mt-2 block font-semibold text-sidebar-primary hover:underline"
      >
        See the Admin menu →
      </button>
    </div>
  );
}
