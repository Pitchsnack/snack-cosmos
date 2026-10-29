import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { BO_GROUPS, boGroupOf } from "@/lib/buy-orders";
import { iconByName, sectorIcon } from "./bw-icons";
import { useBw, useSectorName } from "./bw-card";
import { cn } from "@/lib/utils";

function Tile({ label, count, picked, Icon, onClick, autoFocus, id }: { label: string; count: number; picked: boolean; Icon: any; onClick: () => void; autoFocus?: boolean; id?: string }) {
  return (
    <button id={id} type="button" autoFocus={autoFocus} aria-pressed={picked} onClick={onClick} className={cn("bw-tile", picked && "bw-tile-on", count === 0 && "bw-tile-zero")}>
      <span className="bw-tile-n">{count}</span>
      <Icon className="h-6 w-6" strokeWidth={1.8} />
      <span className="bw-tile-name">{label}</span>
    </button>
  );
}

/** The industry tiles row with ‹ › (section 3.1). */
export function IndustryRow({ sectors, counts, total, picked, onPick, onAll }: { sectors: string[]; counts: Record<string, number>; total: number; picked: string | null; onPick: (s: string | null) => void; onAll: () => void }) {
  const { c } = useBw();
  const name = useSectorName();
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ over: false, start: true, end: true });
  const measure = () => {
    const el = ref.current;
    if (!el) return;
    setEdge({ over: el.scrollWidth > el.clientWidth + 1, start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  };
  useEffect(() => { measure(); const ro = new ResizeObserver(measure); if (ref.current) ro.observe(ref.current); return () => ro.disconnect(); }, [sectors.length]);
  useEffect(() => { if (picked) document.getElementById(`bw-tile-${picked}`)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" }); }, [picked]);
  const move = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <div className="bw-tiles-wrap">
      {edge.over && <button type="button" className="bw-arrow" style={{ opacity: edge.start ? 0.35 : 1 }} aria-label={c("Previous industries", "อุตสาหกรรมก่อนหน้า")} onClick={() => move(-1)}><ChevronLeft className="h-4 w-4" /></button>}
      <div ref={ref} className="bw-tiles" role="group" aria-label={c("Industries", "อุตสาหกรรม")} onScroll={measure}>
        <Tile label={c("All industries", "ทุกอุตสาหกรรม")} count={total} picked={!picked} Icon={LayoutGrid} onClick={onAll} />
        {sectors.map((s) => <Tile key={s} id={`bw-tile-${s}`} label={name(s)} count={counts[s] ?? 0} picked={picked === s} Icon={sectorIcon(s)} onClick={() => onPick(picked === s ? null : s)} />)}
      </div>
      {edge.over && <button type="button" className="bw-arrow" style={{ opacity: edge.end ? 0.35 : 1 }} aria-label={c("Next industries", "อุตสาหกรรมถัดไป")} onClick={() => move(1)}><ChevronRight className="h-4 w-4" /></button>}
    </div>
  );
}

/** Choose an industry (section 3.2). */
export function ChooseIndustry({ open, counts, total, picked, onPick, onClose }: { open: boolean; counts: Record<string, number>; total: number; picked: string | null; onPick: (s: string | null) => void; onClose: () => void }) {
  const { c, th } = useBw();
  const name = useSectorName();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  useEffect(() => { if (open) setOpenGroups(new Set(picked ? [boGroupOf(picked)?.group ?? ""] : [])); }, [open, picked]);
  const toggle = (g: string) => setOpenGroups((s) => { const n = new Set(s); n.has(g) ? n.delete(g) : n.add(g); return n; });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bw-dialog bw-choose">
        <DialogTitle className="text-[18px] font-bold">{c("Choose an industry", "เลือกอุตสาหกรรม")}</DialogTitle>
        <div className="bw-choose-grid">
          <div className="bw-choose-all"><Tile label={c("All industries", "ทุกอุตสาหกรรม")} count={total} picked={!picked} Icon={LayoutGrid} autoFocus={!picked} onClick={() => onPick(null)} /></div>
          <div className="space-y-4">
            {BO_GROUPS.map((g) => {
              const n = g.sectors.reduce((a, s) => a + (counts[s.name] ?? 0), 0);
              const isOpen = openGroups.has(g.group);
              const GIcon = iconByName(g.icon);
              return (
                <div key={g.group}>
                  <button type="button" aria-expanded={isOpen} onClick={() => toggle(g.group)} className={cn("bw-group", isOpen && "bw-group-on", n === 0 && "bw-group-zero")}>
                    <span className="bw-gicon"><GIcon className="h-[18px] w-[18px]" /></span>
                    <span className="min-w-0 flex-1 text-left"><b>{th ? g.th : g.group}</b><small>{c(`${g.sectors.length} industries`, `${g.sectors.length} อุตสาหกรรม`)}</small></span>
                    <span className={cn("bw-gcount", n > 0 && "bw-gcount-on")}>{n}</span>
                  </button>
                  {isOpen && (
                    <div className="bw-gtiles">
                      {g.sectors.map((s) => <Tile key={s.name} label={name(s.name)} count={counts[s.name] ?? 0} picked={picked === s.name} autoFocus={picked === s.name} Icon={iconByName(s.icon)} onClick={() => onPick(s.name)} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
