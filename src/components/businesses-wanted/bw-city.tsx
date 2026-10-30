import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { citiesOf } from "@/lib/buy-orders";
import { citiesText, FEATURED_CITIES, OTHER_PROVINCES, type ThaiCity } from "@/lib/buy-order-defaults";
import { useBw } from "./bw-card";

/**
 * City, when Location is Thailand: a list of Thai cities to tick.
 * Value is the saved English text ("Bangkok, Pattaya or Chonburi"); "" means Any.
 */
export function CityPicker({ value, onChange, id, invalid, describedBy, namesTh }: {
  value: string; onChange: (v: string) => void; id?: string; invalid?: boolean; describedBy?: string; namesTh?: boolean;
}) {
  const { c, th: appTh } = useBw();
  const th = namesTh ?? appTh;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLButtonElement>(null);
  const ticked = citiesOf(value);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) { setOpen(false); field.current?.focus(); } };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); setOpen(false); field.current?.focus(); }
    };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key, true); };
  }, [open]);

  const setTicked = (list: string[]) => onChange(list.length ? citiesText(list) : "");
  const toggle = (en: string) => {
    if (en === "") { setTicked([]); return; } // Any
    const on = ticked.includes(en);
    const next = on ? ticked.filter((x) => x !== en) : [...ticked, en];
    setTicked(next);
  };

  const needle = q.trim().toLowerCase();
  const match = (x: ThaiCity) => !needle || x.en.toLowerCase().includes(needle) || x.th.includes(needle);
  const featured = FEATURED_CITIES.filter(match);
  const others = OTHER_PROVINCES.filter(match);
  const anyOn = ticked.length === 0;
  const summary = anyOn ? (th ? "ไม่จำกัด" : "Any") : th
    ? ticked.map((en) => FEATURED_CITIES.concat(OTHER_PROVINCES).find((x) => x.en === en)?.th ?? en).join(" ").replace(/ ([^ ]+)$/, " หรือ$1")
    : citiesText(ticked);

  const Row = ({ en, label }: { en: string; label: string }) => {
    const on = en === "" ? anyOn : ticked.includes(en);
    return (
      <button type="button" role="checkbox" aria-checked={on} className="bw-city-row" onClick={() => toggle(en)}>
        <span className="bw-city-box" aria-hidden>{on && <Check className="h-3.5 w-3.5" />}</span>
        <span className={on ? "font-semibold" : undefined}>{label}</span>
      </button>
    );
  };

  return (
    <div className="bw-city" ref={root}>
      <button type="button" ref={field} id={id} aria-invalid={invalid || undefined} aria-describedby={describedBy}
        aria-expanded={open} aria-haspopup="dialog" className="bw-in bw-city-field" onClick={() => setOpen((o) => !o)}>
        <span className="min-w-0 truncate">{summary}</span><ChevronDown className="h-4 w-4 shrink-0 text-[#6B7280]" />
      </button>
      {open && (
        <div className="bw-city-pop" role="dialog" aria-label={c("City", "เมือง")}>
          <label className="bw-city-search"><Search className="h-4 w-4" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={c("Search cities", "ค้นหาเมือง")} aria-label={c("Search cities", "ค้นหาเมือง")} />
          </label>
          <div className="bw-city-list">
            <Row en="" label={c("Any", "ไม่จำกัด")} />
            {featured.map((x) => <Row key={x.en} en={x.en} label={th ? x.th : x.en} />)}
            {!needle && <div className="bw-city-other">{c("Other provinces", "จังหวัดอื่น ๆ")}</div>}
            {others.map((x) => <Row key={x.en} en={x.en} label={th ? x.th : x.en} />)}
            {needle && !featured.length && !others.length && <p className="bw-city-none">{c("No city matches.", "ไม่พบเมืองที่ค้นหา")}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
