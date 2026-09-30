import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImageIcon, Menu } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { canManageSectorImages } from "@/lib/sector-images.functions";
import { useSectorImages } from "@/hooks/use-sector-images";

export const DIRECTORY_SEARCH_KEY = "startups-directory-search";

export function useCanManageSectorImages() {
  const fn = useServerFn(canManageSectorImages);
  return useQuery({ queryKey: ["sector-images", "can-manage"], queryFn: () => fn(), staleTime: 5 * 60_000 });
}

/** Startups Directory ☰ button: one item, Sector images. Approvers only. */
export function SectorImagesMenu({ directorySearch }: { directorySearch: unknown }) {
  const navigate = useNavigate();
  const { data: can } = useCanManageSectorImages();
  const { data: imgs } = useSectorImages();
  if (!can) return null;
  const n = imgs?.length ?? 0;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="More"
          className="grid h-10 w-10 place-items-center rounded-[9px] border border-border bg-background text-foreground transition-colors data-[state=open]:border-input data-[state=open]:bg-muted"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-[220px] rounded-xl p-1.5 shadow-lg">
        <DropdownMenuItem
          className="h-10 gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium"
          onSelect={() => {
            try { sessionStorage.setItem(DIRECTORY_SEARCH_KEY, JSON.stringify(directorySearch ?? {})); } catch { /* ignore */ }
            navigate({ to: "/startups/sector-images" });
          }}
        >
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1">Sector images</span>
          {n > 0 && <span className="text-[12px] text-muted-foreground">{n}</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
