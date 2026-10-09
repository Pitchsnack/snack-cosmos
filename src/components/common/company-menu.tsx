import { useId } from "react";
import { EllipsisVertical, Pencil } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** My Company panel ⋮ menu: Edit information first, then the panel's own items. */
export function CompanyMenu({ name, onEdit, children }: { name: string; onEdit: () => void; children?: React.ReactNode }) {
  const id = useId();
  const label = name?.trim() || "Company";
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`${label} menu`} aria-haspopup="menu" aria-controls={id}
          className="ml-2 grid h-9 w-9 shrink-0 place-items-center rounded-[9px] border border-[#DCDFE5] bg-card text-[#434A5C] hover:bg-[#F2F4F7] hover:text-[#151A28] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-[#F2F4F7] data-[state=open]:text-[#151A28] dark:border-border dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground dark:data-[state=open]:bg-muted">
          <EllipsisVertical className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent id={id} aria-label={label} align="end" sideOffset={6} collisionPadding={8}
        className="z-50 min-w-[220px] rounded-[12px] border-[#E5E7EB] p-1.5 shadow-[0_12px_32px_rgba(16,24,40,.14),0_2px_6px_rgba(16,24,40,.06)] dark:border-border [&_[role=menuitem]]:h-10 [&_[role=menuitem]]:gap-2.5 [&_[role=menuitem]]:rounded-[8px] [&_[role=menuitem]]:px-3 [&_[role=menuitem]]:text-[14px] [&_[role=menuitem]]:font-medium [&_[role=menuitem]]:whitespace-nowrap">
        <DropdownMenuItem onSelect={onEdit}><Pencil className="h-4 w-4 text-[#5B6576] dark:text-muted-foreground" />Edit information</DropdownMenuItem>
        {children && <><DropdownMenuSeparator className="bg-[#EEF0F3] dark:bg-border" />{children}</>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Initials for Draft tiles: first letters of the first two words, skipping company words; Thai uses its first consonant. */
export function draftInitials(name: string) {
  const skip = /^(บริษัท|จำกัด|co\.?|ltd\.?|co\.,)$/i;
  const words = (name || "").replace(/[(),]/g, " ").split(/\s+/).filter((w) => w && !skip.test(w));
  if (!words.length) return "?";
  const th = words[0].match(/[\u0E01-\u0E2E]/);
  if (/[\u0E00-\u0E7F]/.test(words[0][0] ?? "")) return th ? th[0] : words[0][0];
  return words.slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

const TINT = {
  seller: { bg: "bg-[#FEF3DE]", fg: "text-[#8A4B06]" },
  buyer: { bg: "bg-[#EEF0FF]", fg: "text-[#4338CA]" },
} as const;

/** Plain Draft card shown while a seller's or buyer's setup isn't done. */
export function DraftCompanyCard({ role, name, typeLine, typeClass, founded, size, website, selected = true }: {
  role: "seller" | "buyer"; name: string; typeLine?: string | null; typeClass?: string; founded?: string | number | null; size?: string | null; website?: string | null; selected?: boolean;
}) {
  const t = TINT[role];
  const meta = [founded ? `Founded ${founded}` : null, size ? `${size} employees` : null].filter(Boolean).join(" · ");
  return (
    <div className={`relative overflow-hidden rounded-[14px] border bg-card ${selected ? "border-[#F6A823]" : "border-border"}`}>
      <div className={`relative h-[84px] ${t.bg} dark:opacity-80`}>
        <span className="absolute right-2.5 top-2.5 inline-flex h-[22px] items-center gap-1.5 rounded-full bg-[#FEF3C7] px-[9px] text-[11.5px] font-bold text-[#92400E]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#92400E]" />Draft
        </span>
      </div>
      <div className={`absolute left-4 top-[58px] grid h-[52px] w-[52px] place-items-center rounded-[12px] border border-[#E5E7EB] bg-card text-[17px] font-bold shadow-[0_1px_2px_rgba(16,24,40,.06)] dark:border-border ${t.fg}`}>{draftInitials(name)}</div>
      <div className="flex flex-col gap-[5px] px-4 pb-4 pt-9">
        <div className="text-[16px] font-bold text-foreground">{name || "Untitled"}</div>
        {typeLine && <div className={`text-[13px] font-semibold ${typeClass ?? ""}`}>{typeLine}</div>}
        {meta && <div className="text-[13px] text-[#4B5563] dark:text-muted-foreground">{meta}</div>}
        <div className="flex items-center gap-1.5 text-[13px] text-[#4B5563] dark:text-muted-foreground">
          <svg aria-hidden className="h-3.5 w-3.5 text-[#6A7181]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg>
          <span className="truncate">{website || "No website yet"}</span>
        </div>
        <div className="mt-1 text-[13px] text-[#9CA3AF]">No description yet.</div>
      </div>
    </div>
  );
}

/** Draft panel: header with tile + name + Draft line + ⋮, the setup banner, and the footer. */
export function DraftCompanyPanel({ role, name, banner, onEdit, onFinish }: {
  role: "seller" | "buyer"; name: string; banner: React.ReactNode; onEdit: () => void; onFinish: () => void;
}) {
  const t = TINT[role];
  const line = role === "seller" ? "Draft · buyers can't see this business yet" : "Draft · sellers can't see this profile yet";
  return (
    <div className="min-w-0 overflow-visible rounded-[14px] border border-border bg-card shadow-sm">
      <div className="flex items-center gap-3.5 border-b border-border p-5">
        <div className={`grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[12px] text-[17px] font-bold ${t.bg} ${t.fg}`}>{draftInitials(name)}</div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[21px] font-bold leading-tight">{name || "Untitled"}</h2>
          <div className="text-[13px] font-medium text-[#92400E] dark:text-amber-400">{line}</div>
        </div>
        <CompanyMenu name={name} onEdit={onEdit} />
      </div>
      <div className="p-5 [&>*]:mb-0">{banner}</div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3.5">
        <span className="text-[13px] text-[#6A7181] dark:text-muted-foreground">{line}</span>
        <button type="button" onClick={onFinish} className="inline-flex h-9 items-center rounded-md bg-[#1E2A4A] px-3 text-[13px] font-semibold text-white hover:bg-[#101d43]">
          {role === "seller" ? "Finish setup to submit" : "Finish setup to publish"}
        </button>
      </div>
    </div>
  );
}
