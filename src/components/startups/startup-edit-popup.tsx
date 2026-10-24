import { useState } from "react";
import { EditInfoPopup } from "@/components/common/edit-info-popup";
import { StartupForm } from "@/components/startups/startup-form";
import { useStartup } from "@/hooks/use-startup";
import { useEntryFacts, useHiddenProfile } from "@/hooks/use-hidden-profiles";
import { Skeleton } from "@/components/ui/skeleton";

/** Shared directory editor; the parent owns dismissal and retains its page state. */
export function StartupEditPopup({ id, onClose, onCreated }: { id?: string; onClose: () => void; onCreated?: (id: string) => void }) {
  const { data } = useStartup(id);
  const { row } = useHiddenProfile(id);
  const { data: facts } = useEntryFacts(id);
  const [view, setView] = useState<"public" | "private">("private");
  const [tab, setTab] = useState(id ? "images" : "about");
  return <EditInfoPopup open title={id ? undefined : "New startup"} creating={id ? undefined : "startup"} subtitle={`${data?.startup_name || "Not created yet"} · ${view === "public" ? "Public view" : "Private view"}`} companyName={data?.startup_name ?? ""} onClosed={onClose} phoneTabs>
    {id && !data ? <Skeleton className="h-[500px]" /> : <StartupForm startup={data} onCreated={onCreated} popup={{view,tab,onNav:(v,t) => {setView(v);setTab(t || (v === "public" ? "identity" : "images"));},row:row ?? null,facts}} />}
  </EditInfoPopup>;
}