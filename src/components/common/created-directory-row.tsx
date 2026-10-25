import {useEffect, useRef, type ReactNode} from "react";
import {MoreVertical, Pencil} from "lucide-react";
import {Button} from "@/components/ui/button";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@/components/ui/dropdown-menu";

/** The new row owns its short-lived highlight and keyboard focus, not the directory sort. */
export function CreatedDirectoryRow({active, children, onEdit}: {active: boolean; children: ReactNode; onEdit: ()=>void}) {
  const menu = useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if (!active) return;
    const timer = setTimeout(()=>{menu.current?.scrollIntoView({block:"nearest"});menu.current?.focus({preventScroll:true});},150);
    return ()=>clearTimeout(timer);
  },[active]);
  return <div className={active ? "edit-created-row relative rounded-lg" : "relative"}>
    {children}
    {active && <DropdownMenu><DropdownMenuTrigger asChild><Button ref={menu} variant="ghost" size="icon" aria-label="New profile actions" className="absolute bottom-1 right-1 h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onSelect={onEdit}><Pencil className="mr-2 h-4 w-4" />Edit information</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
  </div>;
}