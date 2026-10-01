import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImageIcon, Menu } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { listInvestorImages } from "@/lib/investor-images.functions";
import { useCanManageSectorImages } from "@/components/startups/sector-images-menu";

export const INVESTOR_IMAGES_KEY = ["investor-images"] as const;
export const INVESTOR_DIRECTORY_SEARCH_KEY = "investors-directory-search";

export function useInvestorImages() {
  const fn = useServerFn(listInvestorImages);
  return useQuery({ queryKey: INVESTOR_IMAGES_KEY, queryFn: () => fn(), staleTime: 5 * 60_000 });
}

/** Investors Directory ☰ button: one item, Investor images. Approvers only. */
export function InvestorImagesMenu({ directorySearch }: { directorySearch: unknown }) {
  const navigate = useNavigate();
  const { data: can } = useCanManageSectorImages();
  const { data: imgs } = useInvestorImages();
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
            try { sessionStorage.setItem(INVESTOR_DIRECTORY_SEARCH_KEY, JSON.stringify(directorySearch ?? {})); } catch { /* ignore */ }
            navigate({ to: "/investors/investor-images" });
          }}
        >
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1">Investor images</span>
          {n > 0 && <span className="text-[12px] text-muted-foreground">{n}</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
