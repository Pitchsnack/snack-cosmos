import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, Search, Target } from "lucide-react";
import { toast } from "sonner";
import { usePersona } from "@/hooks/use-marketplace";
import { BO_SECTORS, SELLER_BANDS, boSector, citiesOf, overlaps, rangeOf, sectorOrder } from "@/lib/buy-orders";
import { listBuyOrders, myApplyContext, type BoCard } from "@/lib/buy-orders.functions";
import { BuyOrderCard, useBw, useSectorName } from "./bw-card";
import { BuyOrderDetails } from "./bw-details";
import { ApplyDialog } from "./bw-apply";
import { ChooseIndustry, IndustryRow } from "./bw-industries";

export const BO_QUERY = ["buy-orders"] as const;

export function BusinessesWantedPage({ bo }: { bo?: string }) {
  const { c } = useBw();
  const sectorName = useSectorName();
  const { persona } = usePersona();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listBuyOrders);
  const ctxFn = useServerFn(myApplyContext);
  const q = useQuery({ queryKey: BO_QUERY, queryFn: () => list() });
  const ctxQ = useQuery({ queryKey: ["buy-orders-apply-ctx"], queryFn: () => ctxFn(), enabled: persona === "seller" });

  const [search, setSearch] = useState("");
  const [sector, setSector] = useState<string | null>(null);
  const [rev, setRev] = useState("");
  const [price, setPrice] = useState("");
  const [city, setCity] = useState("");
  const [choose, setChoose] = useState(false);
  const [details, setDetails] = useState<string | null>(null);
  const [applyId, setApplyId] = useState<string | null>(null);

  const cards = q.data?.cards ?? [];
  useEffect(() => {
    if (!bo || !q.data) return;
    const hit = cards.find((x) => x.ref.toLowerCase() === bo.toLowerCase());
    if (hit) setDetails(hit.id);
    navigate({ to: ".", search: {}, replace: true });
  }, [bo, q.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const allCities = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of cards) for (const ct of citiesOf(x.cities)) if (!m.has(ct.toLowerCase())) m.set(ct.toLowerCase(), ct);
    return [...m.values()].sort((a, b) => a.localeCompare(b));
  }, [cards]);

  const passes = (x: BoCard, skipSector = false) => {
    const s = search.trim().toLowerCase();
    if (s) {
      const hay = [x.name, x.sector, sectorName(x.sector), x.ref, x.description, x.location, x.cities, x.buyerType, x.country, x.products].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(s)) return false;
    }
    if (!skipSector && sector && x.sector !== sector) return false;
    if (rev && !overlaps(rangeOf(x.targetRevenue), rangeOf(rev))) return false;
    if (price && !overlaps(rangeOf(x.priceRange), rangeOf(price))) return false;
    if (city && !citiesOf(x.cities).some((ct) => ct.toLowerCase() === city.toLowerCase())) return false;
    return true;
  };
  const base = cards.filter((x) => passes(x, true));
  const counts: Record<string, number> = {};
  for (const x of base) counts[x.sector] = (counts[x.sector] ?? 0) + 1;
  const tileSectors = [...new Set([...cards.map((x) => x.sector), ...(sector ? [sector] : [])])].filter((s) => boSector(s)).sort((a, b) => sectorOrder(a) - sectorOrder(b));
  const shown = base.filter((x) => !sector || x.sector === sector).sort((a, b) => {
    const ca = a.status === "closed" ? 1 : 0, cb = b.status === "closed" ? 1 : 0;
    if (ca !== cb) return ca - cb;
    return ca ? (b.closesOn ?? "").localeCompare(a.closesOn ?? "") : (b.postedAt ?? "").localeCompare(a.postedAt ?? "");
  });

  const p = persona as "seller" | "buyer" | "advisor";
  const sub = p === "seller"
    ? <>{c("Buyers seeking businesses in selected industries.", "ผู้ซื้อที่กำลังมองหาธุรกิจในอุตสาหกรรมที่เลือก")}<br />{c("Qualified Buyers. Specific Mandates. Ready to Acquire.", "ผู้ซื้อที่ผ่านการคัดกรอง ความต้องการชัดเจน พร้อมซื้อกิจการ")}</>
    : p === "buyer" ? c("What buyers on PitchSnack are looking for. Buyers’ names stay private. Share a buy order with someone who may have a business that fits.", "สิ่งที่ผู้ซื้อบน PitchSnack กำลังมองหา ชื่อผู้ซื้อถูกเก็บเป็นความลับ แชร์ประกาศให้คนที่อาจมีธุรกิจที่เหมาะ")
    : c("What buyers on PitchSnack are looking for. Buyers’ names stay private.", "สิ่งที่ผู้ซื้อบน PitchSnack กำลังมองหา ชื่อผู้ซื้อถูกเก็บเป็นความลับ");

  const share = (x: BoCard) => {
    const url = `${window.location.origin}/marketplace/businesses-wanted?bo=${encodeURIComponent(x.ref)}`;
    navigator.clipboard?.writeText(url).then(() => toast.success(c("Link copied. Sharing by email comes in the next step.", "คัดลอกลิงก์แล้ว การแชร์ทางอีเมลจะมาในขั้นถัดไป")), () => toast.error(url));
  };
  const detailCard = cards.find((x) => x.id === details) ?? null;
  const applyCard = cards.find((x) => x.id === applyId) ?? null;
  const refresh = () => { qc.invalidateQueries({ queryKey: BO_QUERY }); qc.invalidateQueries({ queryKey: ["buy-orders-new"] }); };

  const sel = (value: string, set: (v: string) => void, first: string, opts: string[], aria: string) => (
    <label className="bw-select">
      <span className="sr-only">{aria}</span>
      <select value={value} onChange={(e) => set(e.target.value)}>
        <option value="">{first}</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="h-4 w-4" aria-hidden />
    </label>
  );

  return (
    <div className="bw-page">
      <div className="bw-eyebrow"><Target className="h-3.5 w-3.5" />{c("MARKETPLACE", "มาร์เก็ตเพลส")}</div>
      <h1 className="bw-h1">{c("Businesses Wanted by Buyers", "ธุรกิจที่ผู้ซื้อต้องการ")}</h1>
      <p className="bw-sub">{sub}</p>

      <div className="bw-filters">
        <label className="bw-search">
          <Search className="h-4 w-4 text-[#6B7280]" />
          <input aria-label={c("Search buy orders", "ค้นหาประกาศซื้อ")} placeholder={c("Search industry, country or ref", "ค้นหาอุตสาหกรรม ประเทศ หรือรหัส")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <button type="button" className="bw-select bw-indbtn" onClick={() => setChoose(true)}>
          <span className="truncate">{sector ? sectorName(sector) : c("All industries", "ทุกอุตสาหกรรม")}</span><ChevronDown className="h-4 w-4 shrink-0" />
        </button>
        {sel(rev, setRev, c("Target revenue", "รายได้เป้าหมาย"), SELLER_BANDS.map((b) => b.label), c("Target revenue", "รายได้เป้าหมาย"))}
        {sel(price, setPrice, c("Price range", "ช่วงราคา"), SELLER_BANDS.map((b) => b.label), c("Price range", "ช่วงราคา"))}
        {sel(city, setCity, c("All cities", "ทุกเมือง"), allCities, c("City", "เมือง"))}
      </div>

      <IndustryRow sectors={tileSectors} counts={counts} total={base.length} picked={sector} onPick={setSector} onAll={() => setChoose(true)} />
      <p className="bw-count">{shown.length === 1 ? c("Showing 1 buy order", "แสดง 1 ประกาศ") : c(`Showing ${shown.length} buy orders`, `แสดง ${shown.length} ประกาศ`)}</p>

      {q.isLoading ? <p className="bw-count">{c("Loading…", "กำลังโหลด…")}</p>
        : q.error ? <p className="text-destructive">{(q.error as Error).message}</p>
        : !cards.length ? <div className="bw-empty"><b>{c("No buy orders here yet.", "ยังไม่มีประกาศซื้อ")}</b></div>
        : !shown.length ? <div className="bw-empty"><b>{c("No buy orders match.", "ไม่พบประกาศที่ตรงกัน")}</b><span>{c("Try another word or filter.", "ลองคำหรือตัวกรองอื่น")}</span></div>
        : (
          <div className="bw-grid">
            {shown.map((x) => (
              <BuyOrderCard key={x.id} card={x} persona={p} applyCtx={ctxQ.data}
                onDetails={() => setDetails(x.id)} onApply={() => setApplyId(x.id)} onShare={() => share(x)} />
            ))}
          </div>
        )}

      <ChooseIndustry open={choose} counts={counts} total={base.length} picked={sector} onClose={() => setChoose(false)} onPick={(s) => { setSector(s); setChoose(false); }} />
      {detailCard && !applyCard && <BuyOrderDetails card={detailCard} persona={p} applyCtx={ctxQ.data} onClose={() => setDetails(null)} onApply={(x) => setApplyId(x.id)} onShare={share} />}
      {applyCard && ctxQ.data?.listing && <ApplyDialog card={applyCard} ctx={ctxQ.data} onClose={() => setApplyId(null)} onDone={() => { setApplyId(null); refresh(); }} />}
      <span hidden>{BO_SECTORS.length}</span>
    </div>
  );
}
