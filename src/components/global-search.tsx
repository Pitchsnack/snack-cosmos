import { useState } from "react";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="ml-2 hidden rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search startups, investors, deals…" />
        <CommandList>
          <CommandEmpty>
            Global search is part of the workspace framework. Module-specific
            results will appear here when Startups, Investors, and Deals are
            available.
          </CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem disabled>Startups — coming soon</CommandItem>
            <CommandItem disabled>Investors — coming soon</CommandItem>
            <CommandItem disabled>Deals — coming soon</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
