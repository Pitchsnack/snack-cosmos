import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, Check, ClipboardCheck, Clock, LayoutList, Columns2, Lock, Search, Undo2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { addMonths, BO_GROUPS, bkkToday, checkDraft, coverOf, daysBetween, fmtDay, PERIODS, periodLabel, type BoDraft, type BoField } from "@/lib/buy-orders";
import { adminBuyOrderApplicants, adminBuyOrders, adminDecideBuyOrder, adminExtendBuyOrder, type AdminBoFilter, type AdminBoRow, type AppRow } from "@/lib/buy-orders.functions";
import { BuyOrderCard, useBw, useSectorName } from "./bw-card";
import { sectorIcon } from "./bw-icons";
import { BoFields, cardToDraft, draftCard, focusFirst } from "./bw-form";
import { cn } from "@/lib/utils";
import { BuyOrderPicture } from "./bw-picture";

const ADMIN_Q = ["buy-orders", "admin"] as const;
const EDITABLE: BoField[] = ["name", "description", "targetRevenue", "priceRange", "location", "cities", "propertySize", "factorySize", "mustHave", "periodMonths"];
type Tile = NonNullable<AdminBoFilter["tile"]>;

function useStatus() {
  const { c } = useBw();
  return (r: AdminBoRow) => {
    const ext = r.extendedCount > 0 ? <span className="bw-spill bw-s-ext"><Clock className="h-3 w-3" />{r.extendedCount > 1 ? c(`Extended ×${r.extendedCount}`, `ขยาย ×${r.extendedCount}`) : c("Extended", "ขยายแล้ว")}</span> : null;
    let p;
    if (r.status === "waiting") p = <span className="bw-spill bw-s-wait">● {c("Waiting for Admin", "รอแอดมินตรวจ")}</span>;
    else if (r.status === "sent_back") p = <span className="bw-spill bw-s-back">{c("Sent back", "ส่งกลับแล้ว")}</span>;
    else if (r.status === "closed") p = <span className="bw-spill bw-s-closed">{c("Closed", "ปิดแล้ว")}</span>;
    else {
      const n = r.closesOn ? daysBetween(bkkToday(), r.closesOn) : 99;
      p = n <= 30 ? <span className="bw-spill bw-s-soon">{n === 1 ? c("Closes in 1 day", "ปิดในอีก 1 วัน") : c(`Closes in ${n} days`, `ปิดในอีก ${n} วัน`)}</span> : <span className="bw-spill bw-s-open">{c("Open", "เปิดรับ")}</span>;
    }
    return <span className="inline-flex flex-wrap gap-1">{p}{ext}</span>;
  };
}

function KindLine({ r }: { r: AdminBoRow }) {
  const { c } = useBw();
  return <span className="text-[12.5px] text-[#6B7280]">{r.kind === "sealed" ? c(`Sealed · for ${r.client?.name ?? "—"}`, `ปิดผนึก · สำหรับ ${r.client?.name ?? "—"}`) : c(`Advertisement · ${r.company ?? "—"}`, `ประกาศ · ${r.company ?? "—"}`)}</span>;
}

function Tile38({ sector, size = 38 }: { sector: string; size?: number }) {
  const Icon = sectorIcon(sector);
  return <span className="grid shrink-0 place-items-center rounded-[10px] text-white" style={{ width: size, height: size, background: coverOf(sector).mid }}><Icon className="h-5 w-5" /></span>;
}

function Pager({ page, total, size, onPage }: { page: number; total: number; size: number; onPage: (p: number) => void }) {
  const { c } = useBw();
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total ? (page - 1) * size + 1 : 0;
  const nums = pages <= 7 ? Array.from({ length: pages }, (_, i) => i + 1) : [1, 2, 3, page > 4 && page < pages - 2 ? page : null, pages].filter((x, i, a) => x !== null && a.indexOf(x) === i) as number[];
  return (
    <div className="bw-pager flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-[13px] text-[#6B7280]">
      <span>{c(`${from}–${Math.min(total, page * size)} of ${total}`, `${from}–${Math.min(total, page * size)} จาก ${total}`)}</span>
      <span className="flex gap-1">
        <button type="button" aria-label={c("Previous page", "หน้าก่อนหน้า")} disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</button>
        {nums.map((n, i) => <span key={n} className="flex">{i > 0 && n - nums[i - 1] > 1 && <span className="px-1">…</span>}<button type="button" aria-current={n === page ? "page" : undefined} onClick={() => onPage(n)}>{n}</button></span>)}
        <button type="button" aria-label={c("Next page", "หน้าถัดไป")} disabled={page >= pages} onClick={() => onPage(page + 1)}>›</button>
      </span>
    </div>
  );
}

export function AdminAdvertisementPage() {
  const { c, th } = useBw();
  const sectorName = useSectorName();
  const status = useStatus();
  const fn = useServerFn(adminBuyOrders);
  const [view, setView] = useState<"list" | "split">("list");
  const [tile, setTile] = useState<Tile>("all");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"" | "sealed" | "advertisement">("");
  const [sector, setSector] = useState("");
  const [sort, setSort] = useState<NonNullable<AdminBoFilter["sort"]>>("closes");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [checkRow, setCheckRow] = useState<AdminBoRow | null>(null);
  const [appsRow, setAppsRow] = useState<AdminBoRow | null>(null);
  const [extRow, setExtRow] = useState<AdminBoRow | null>(null);
  const size = view === "split" ? 25 : 25;
  const filter = { tile, q, kind: kind || null, sector: sector || null, sort, page, size };
  const res = useQuery({ queryKey: [...ADMIN_Q, filter], queryFn: () => fn({ data: filter }), placeholderData: keepPreviousData });
  const d = res.data;
  useEffect(() => setPage(1), [tile, q, kind, sector, sort]);
  const open = d?.rows.find((r) => r.id === openId) ?? (view === "split" ? d?.rows[0] : undefined);
  const clickRow = (r: AdminBoRow) => {
    if (view === "split") { setOpenId(r.id); return; }
    if (r.status === "waiting") setCheckRow(r); else setAppsRow(r);
  };
  const tiles: { key: Tile; label: string; n: number; sub?: string; violet?: boolean }[] = d ? [
    { key: "all", label: c("All buy orders", "ประกาศซื้อทั้งหมด"), n: d.tiles.all },
    { key: "waiting", label: c("Waiting for Admin", "รอแอดมินตรวจ"), n: d.tiles.waiting, violet: d.tiles.waiting > 0 },
    { key: "open", label: c("Open", "เปิดรับ"), n: d.tiles.open },
    { key: "closing", label: c("Closing in 30 days", "ปิดภายใน 30 วัน"), n: d.tiles.closing },
    { key: "closed", label: c("Closed", "ปิดแล้ว"), n: d.tiles.closed },
    { key: "applicants", label: c("Applicants", "ผู้สมัคร"), n: d.tiles.applicants, sub: c(`${d.tiles.applicantsNew} new`, `ใหม่ ${d.tiles.applicantsNew}`) },
  ] : [];

  const buttons = (r: AdminBoRow) => (
    <span className="flex flex-wrap justify-end gap-2" onClick={(e) => e.stopPropagation()}>
      {r.status === "waiting" && <Button size="sm" onClick={() => (view === "split" ? setOpenId(r.id) : setCheckRow(r))}>{c("Check", "ตรวจ")}</Button>}
      {r.status === "sent_back" && <span className="text-[12.5px] text-[#6B7280]">{c(`Sent back · ${fmtDay(r.sentToAdminAt, false, false)}`, `ส่งกลับ · ${fmtDay(r.sentToAdminAt, true, false)}`)}</span>}
      {(r.status === "posted" || r.status === "closed") && <>
        <Button size="sm" variant="outline" onClick={() => setExtRow(r)}><Clock className="h-3.5 w-3.5" />{r.status === "posted" ? c("Extend", "ขยาย") : c("Reopen", "เปิดอีกครั้ง")}</Button>
        <Button size="sm" variant="outline" onClick={() => setAppsRow(r)}><Users className="h-3.5 w-3.5" />{c("Applicants", "ผู้สมัคร")}</Button>
      </>}
    </span>
  );

  return (
    <div className="bw-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[760px]">
          <div className="bw-eyebrow"><ClipboardCheck className="h-3.5 w-3.5" />{c("APPROVALS", "การอนุมัติ")}</div>
          <h1 className="bw-h1">{c("Advertisement", "ประกาศ")}</h1>
          <p className="bw-sub">{c("Every buy order in Businesses Wanted, from Admin’s check to closing, and its applicants. Check the ones waiting; extend any that needs more time.", "ประกาศซื้อทั้งหมดในธุรกิจที่ผู้ซื้อต้องการ ตั้งแต่แอดมินตรวจจนปิด และผู้สมัคร ตรวจรายการที่รออยู่ และขยายเวลารายการที่ต้องการเวลาเพิ่ม")}</p>
        </div>
        <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label={c("View", "มุมมอง")}>
          <button type="button" aria-pressed={view === "list"} className={cn("flex items-center gap-1 rounded-md px-3 py-1.5 text-sm", view === "list" && "bg-muted font-semibold")} onClick={() => setView("list")}><LayoutList className="h-4 w-4" />{c("List", "รายการ")}</button>
          <button type="button" aria-pressed={view === "split"} className={cn("flex items-center gap-1 rounded-md px-3 py-1.5 text-sm", view === "split" && "bg-muted font-semibold")} onClick={() => setView("split")}><Columns2 className="h-4 w-4" />{c("Split", "แยก")}</button>
        </div>
      </div>

      <div className="bw-tiles6 mt-5" role="group" aria-label={c("Buy orders by stage", "ประกาศซื้อตามขั้นตอน")}>
        {tiles.map((t) => (
          <button key={t.key} type="button" className="bw-tile6" aria-pressed={tile === t.key && t.key !== "all"} onClick={() => setTile(tile === t.key ? "all" : t.key)}>
            <small>{t.label}</small><b style={t.violet ? { color: "#5B21B6" } : undefined}>{t.n}</b>
            {t.sub && <small style={{ color: "#5B21B6" }}>{t.sub}</small>}
          </button>
        ))}
      </div>

      <div className="bw-filters mt-4">
        <label className="bw-search"><Search className="h-4 w-4" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={c("Search name, ref, client or buyer", "ค้นหาชื่อ รหัส ลูกค้า หรือผู้ซื้อ")} aria-label={c("Search", "ค้นหา")} /></label>
        <select className="bw-in max-w-[180px]" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label={c("Kind", "ประเภท")}>
          <option value="">{c("All kinds", "ทุกประเภท")}</option><option value="sealed">{c("Sealed", "ปิดผนึก")}</option><option value="advertisement">{c("Advertisement", "ประกาศ")}</option>
        </select>
        <select className="bw-in max-w-[240px]" value={sector} onChange={(e) => setSector(e.target.value)} aria-label={c("Industry", "อุตสาหกรรม")}>
          <option value="">{c("All industries", "ทุกอุตสาหกรรม")}</option>
          {BO_GROUPS.map((g) => <optgroup key={g.group} label={th ? g.th : g.group}>{g.sectors.map((x) => <option key={x.name} value={x.name}>{th ? x.th : x.name}</option>)}</optgroup>)}
        </select>
        <select className="bw-in max-w-[220px]" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label={c("Sort", "เรียง")}>
          <option value="closes">{c("Closes soonest", "ใกล้ปิดก่อน")}</option><option value="newest">{c("Newest posted", "ลงล่าสุด")}</option>
          <option value="most">{c("Most applicants", "ผู้สมัครมากที่สุด")}</option><option value="mostNew">{c("Most new applicants", "ผู้สมัครใหม่มากที่สุด")}</option>
        </select>
      </div>

      {!d ? <p className="mt-6 text-sm text-[#6B7280]">{res.error ? (res.error as Error).message : c("Loading…", "กำลังโหลด…")}</p>
        : view === "list" ? (
          <div className="mt-4 overflow-hidden rounded-xl border bg-card">
            <div className="bw-arow bw-ahead"><span>{c("Buy order", "ประกาศซื้อ")}</span><span>{c("Status", "สถานะ")}</span><span>{c("Posted", "ลงประกาศ")}</span><span>{c("Closes", "ปิด")}</span><span>{c("Applicants", "ผู้สมัคร")}</span><span /></div>
            {d.rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-[#6B7280]">{c("No buy orders match. Try another word or filter.", "ไม่พบประกาศซื้อ ลองคำหรือตัวกรองอื่น")}</p>}
            {d.rows.map((r) => (
              <div key={r.id} className={cn("bw-arow", r.status === "waiting" && "bw-wait")} onClick={() => clickRow(r)}>
                <span className="flex min-w-0 items-center gap-3"><Tile38 sector={r.sector} /><span className="min-w-0"><span className={cn("block truncate text-[14px]", r.status === "closed" && "text-[#6B7280]")}><b>{r.name}</b> · {r.ref}</span><KindLine r={r} /></span></span>
                <span>{status(r)}</span>
                <span className="text-[13px]">{r.postedAt ? fmtDay(r.postedAt, th, false) : "–"}</span>
                <span className="text-[13px]">{r.closesOn ? <>{fmtDay(r.closesOn, th)}<br /><span className="text-[12px] text-[#6B7280]">{periodLabel(r.periodMonths, th)}</span></> : "–"}</span>
                <span className="text-[13px]">{r.applied} {r.appsNew ? <span className="text-[#5B21B6]">{c(`${r.appsNew} new`, `ใหม่ ${r.appsNew}`)}</span> : <span className="text-[#9CA3AF]">—</span>}</span>
                {buttons(r)}
              </div>
            ))}
            <Pager page={d.page} total={d.total} size={d.size} onPage={setPage} />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 min-[1100px]:grid-cols-[300px_minmax(0,1fr)]">
            <div>
              <div className="grid gap-2">
                {d.rows.length === 0 && <p className="py-8 text-center text-sm text-[#6B7280]">{c("No buy orders match. Try another word or filter.", "ไม่พบประกาศซื้อ ลองคำหรือตัวกรองอื่น")}</p>}
                {d.rows.map((r) => (
                  <button key={r.id} type="button" onClick={() => setOpenId(r.id)} className={cn("flex gap-3 rounded-xl border bg-card p-3 text-left", open?.id === r.id && "outline outline-2 outline-[#F6A823]")}>
                    <Tile38 sector={r.sector} size={44} />
                    <span className="min-w-0 space-y-1"><span className="block truncate text-[13.5px]"><b>{r.name}</b> · {r.ref}</span><KindLine r={r} /><span className="block">{status(r)}</span>
                      <span className="block text-[12px] text-[#6B7280]">{c(`${r.applied} applicants · ${r.appsNew ?? 0} new`, `ผู้สมัคร ${r.applied} · ใหม่ ${r.appsNew ?? 0}`)}</span></span>
                  </button>
                ))}
              </div>
              <Pager page={d.page} total={d.total} size={d.size} onPage={setPage} />
            </div>
            <div className="min-w-0 rounded-2xl border bg-card p-5">
              {!open ? <p className="text-sm text-[#6B7280]">{c("Pick a buy order.", "เลือกประกาศซื้อ")}</p>
                : open.status === "waiting" ? <CheckPanel key={open.id} row={open} onDone={() => setOpenId(null)} />
                : <BuyOrderPanel row={open} status={status(open)} onExtend={() => setExtRow(open)} />}
            </div>
          </div>
        )}

      {checkRow && (
        <Dialog open onOpenChange={(o) => !o && setCheckRow(null)}>
          <DialogContent className="max-h-[calc(100dvh-32px)] max-w-[1080px] overflow-y-auto p-0"><DialogTitle className="sr-only">{checkRow.name}</DialogTitle><div className="p-5"><CheckPanel row={checkRow} onDone={() => setCheckRow(null)} /></div></DialogContent>
        </Dialog>
      )}
      {appsRow && (
        <Dialog open onOpenChange={(o) => !o && setAppsRow(null)}>
          <DialogContent className="max-h-[calc(100dvh-32px)] max-w-[980px] overflow-y-auto">
            <DialogTitle>{appsRow.name} <span className="text-[14px] font-normal text-[#6B7280]">{appsRow.ref}</span></DialogTitle>
            <DialogDescription asChild><div className="flex flex-wrap items-center gap-2"><KindLine r={appsRow} />{status(appsRow)}</div></DialogDescription>
            <Applicants row={appsRow} per={20} />
            <DialogFooter><Button variant="outline" onClick={() => setAppsRow(null)}>{c("Close", "ปิด")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {extRow && <ExtendDialog row={extRow} onClose={() => setExtRow(null)} />}
      <span className="sr-only">{sectorName("")}</span>
    </div>
  );
}

function BuyOrderPanel({ row, status, onExtend }: { row: AdminBoRow; status: React.ReactNode; onExtend: () => void }) {
  const { c, th } = useBw();
  const back = row.status === "sent_back";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">{status}<span className="bw-spill bw-s-closed">{row.kind === "sealed" ? <><Lock className="h-3 w-3" />{c("Sealed", "ปิดผนึก")}</> : c("Advertisement", "ประกาศ")}</span></div>
      <h2 className="text-[21px] font-bold">{row.name} <span className="text-[14px] font-normal text-[#6B7280]">{row.ref}</span></h2>
      <KindLine r={row} />
      <p className="text-[13px] text-[#6B7280]">{row.kind === "sealed" ? c(`Written by ${row.client?.writer ?? "—"}, PitchSnack Control.`, `เขียนโดย ${row.client?.writer ?? "—"} ทีม PitchSnack Control`) : c(`Posted by the buyer, ${row.client?.writer ?? "—"}.`, `ลงโดยผู้ซื้อ ${row.client?.writer ?? "—"}`)}</p>
      <p className="flex flex-wrap items-center gap-2 text-[13px]"><Calendar className="h-3.5 w-3.5" />
        {back ? c(`Applications close ${fmtDay(addMonths(bkkToday(), row.periodMonths), th)}`, `ปิดรับสมัคร ${fmtDay(addMonths(bkkToday(), row.periodMonths), th)}`)
          : row.status === "closed" ? c(`Posted ${fmtDay(row.postedAt, th)} · Closed ${fmtDay(row.closesOn, th)}`, `ลงประกาศ ${fmtDay(row.postedAt, th)} · ปิดแล้ว ${fmtDay(row.closesOn, th)}`)
          : c(`Posted ${fmtDay(row.postedAt, th)} · Applications close ${fmtDay(row.closesOn, th)}`, `ลงประกาศ ${fmtDay(row.postedAt, th)} · ปิดรับสมัคร ${fmtDay(row.closesOn, th)}`)}
        <span className="bw-spill bw-s-closed">{periodLabel(row.periodMonths, th)}</span></p>
      {back ? <p className="text-[13px] text-[#6B7280]">{c(`Sent back · ${fmtDay(row.sentToAdminAt, false, false)}`, `ส่งกลับ · ${fmtDay(row.sentToAdminAt, true, false)}`)}</p>
        : <Button size="sm" variant="outline" onClick={onExtend}><Clock className="h-3.5 w-3.5" />{row.status === "posted" ? c("Extend", "ขยาย") : c("Reopen", "เปิดอีกครั้ง")}</Button>}
      <div className="bw-num5">
        {[[c("Views", "เข้าชม"), row.views], [c("Applicants", "ผู้สมัคร"), row.applied], [c("New", "ใหม่"), row.appsNew ?? 0], [c("NDA requested", "ขอ NDA แล้ว"), row.ndaRequested], [c("Not a fit", "ไม่เหมาะ"), row.notAFit]].map(([l, n]) => <div key={String(l)}><small>{l}</small><b>{back ? 0 : n}</b></div>)}
      </div>
      {!back && <Applicants row={row} per={10} />}
    </div>
  );
}

function Applicants({ row, per }: { row: AdminBoRow; per: number }) {
  const { c, th } = useBw();
  const sectorName = useSectorName();
  const fn = useServerFn(adminBuyOrderApplicants);
  const q = useQuery({ queryKey: [...ADMIN_Q, "apps", row.id], queryFn: () => fn({ data: { id: row.id } }) });
  const [chip, setChip] = useState<"all" | AppRow["status"]>("all");
  const [s, setS] = useState("");
  const [page, setPage] = useState(1);
  const all = q.data?.rows ?? [];
  const list = useMemo(() => all.filter((a) => (chip === "all" || a.status === chip) && (!s.trim() || [a.listing.codeName, a.listing.ref, a.listing.province].some((v) => (v ?? "").toLowerCase().includes(s.trim().toLowerCase())))), [all, chip, s]);
  useEffect(() => setPage(1), [chip, s]);
  const count = (k: AppRow["status"]) => all.filter((a) => a.status === k).length;
  return (
    <div className="mt-2">
      <h3 className="text-[15px] font-bold">{c("Applicants", "ผู้สมัคร")}</h3>
      <p className="text-[12.5px] text-[#6B7280]">{row.kind === "sealed" ? c("Read-only: PitchSnack Control decides on each application. New ones wait for that decision.", "อ่านอย่างเดียว: PitchSnack Control เป็นผู้ตัดสินใบสมัครแต่ละใบ ใบใหม่รอการตัดสิน") : c("Read-only: the buyer decides on each application. New ones wait for that decision.", "อ่านอย่างเดียว: ผู้ซื้อเป็นผู้ตัดสินใบสมัครแต่ละใบ ใบใหม่รอการตัดสิน")}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span role="group" aria-label={c("Applicants by status", "ผู้สมัครตามสถานะ")} className="flex flex-wrap gap-1.5">
          {([["all", c("All", "ทั้งหมด"), all.length], ["new", c("New", "ใหม่"), count("new")], ["nda_requested", c("NDA requested", "ขอ NDA แล้ว"), count("nda_requested")], ["not_a_fit", c("Not a fit", "ไม่เหมาะ"), count("not_a_fit")]] as const).map(([k, l, n]) =>
            <button key={k} type="button" className="bw-chipt" aria-pressed={chip === k} onClick={() => setChip(k)}>{l} {n}</button>)}
        </span>
        <input className="bw-in max-w-[260px]" aria-label={c("Search applicants", "ค้นหาผู้สมัคร")} placeholder={c("Search listing, ref or province", "ค้นหาประกาศ รหัส หรือจังหวัด")} value={s} onChange={(e) => setS(e.target.value)} />
      </div>
      <div className="mt-3 grid gap-2">
        {q.isPending ? <p className="text-sm text-[#6B7280]">{c("Loading…", "กำลังโหลด…")}</p> : list.length === 0 ? <p className="text-sm text-[#6B7280]">{c("No applicants here.", "ไม่มีผู้สมัคร")}</p>
          : list.slice((page - 1) * per, page * per).map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-xl border p-3">
              <Tile38 sector={a.listing.sector ?? ""} />
              <div className="min-w-0 flex-1 text-[13px]">
                <div><b>{a.listing.codeName ?? "—"}</b> · {a.listing.ref}</div>
                <div className="text-[#6B7280]">{[sectorName(a.listing.sector), a.listing.province, a.listing.revenue && c(`Revenue FY25 ${a.listing.revenue}`, `รายได้ปี 2568 ${a.listing.revenue}`)].filter(Boolean).join(" · ")}</div>
                <div className="text-[#6B7280]">{c(`Applied ${fmtDay(a.appliedAt, false, false)}`, `สมัคร ${fmtDay(a.appliedAt, true, false)}`)} · {c(`${a.match.filter((m) => m.ok).length} of 4 match`, `ตรง ${a.match.filter((m) => m.ok).length} จาก 4`)}</div>
              </div>
              <span className={cn("bw-spill", a.status === "new" ? "bw-s-wait" : a.status === "nda_requested" ? "bw-s-open" : "bw-s-closed")}>{a.status === "new" ? c("New", "ใหม่") : a.status === "nda_requested" ? c("NDA requested", "ขอ NDA แล้ว") : c("Not a fit", "ไม่เหมาะ")}</span>
            </div>
          ))}
      </div>
      {list.length > per && <Pager page={page} total={list.length} size={per} onPage={setPage} />}
      <span className="sr-only">{th}</span>
    </div>
  );
}

/** The check: Admin edits, live card, Send back / Post (section 11.5). */
function CheckPanel({ row, onDone }: { row: AdminBoRow; onDone: () => void }) {
  const { c, th } = useBw();
  const qc = useQueryClient();
  const decide = useServerFn(adminDecideBuyOrder);
  const [d, setD] = useState<BoDraft>(() => cardToDraft(row));
  const [errs, setErrs] = useState<Partial<Record<BoField, string>>>({});
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sealed = row.kind === "sealed";
  const [cover, setCover] = useState(row.cover);
  const set = (p: Partial<BoDraft>) => setD((v) => ({ ...v, ...p }));
  const run = async (action: "post" | "send_back") => {
    const e = checkDraft(d, false);
    setErrs(e);
    if (Object.keys(e).length) { focusFirst(e); return; }
    setBusy(true);
    try {
      await decide({ data: { id: row.id, action, draft: d, note: note ?? undefined } });
      toast.success(action === "post" ? c("Posted. Every seller and buyer now sees it in Businesses Wanted.", "ลงประกาศแล้ว ผู้ขายและผู้ซื้อทุกคนเห็นในธุรกิจที่ผู้ซื้อต้องการ")
        : sealed ? c("Sent back to Control with your note.", "ส่งกลับให้ Control พร้อมบันทึกแล้ว") : c("Sent back to the buyer with your note.", "ส่งกลับให้ผู้ซื้อพร้อมบันทึกแล้ว"));
      onDone();
    } catch (err) {
      const m = String((err as Error).message);
      toast.error(m.startsWith("BO_CHANGED") ? c("This buy order has changed. Refresh and try again.", "ประกาศนี้มีการเปลี่ยนแปลง กรุณารีเฟรชแล้วลองอีกครั้ง") : m);
    } finally { setBusy(false); qc.invalidateQueries({ queryKey: ["buy-orders"] }); }
  };
  const written = fmtDay(row.sentToAdminAt, th, false);
  return (
    <div>
      <div className="flex flex-wrap gap-2"><span className="bw-spill bw-s-wait">● {c("Waiting for Admin", "รอแอดมินตรวจ")}</span><span className="bw-spill bw-s-closed">{sealed ? <><Lock className="h-3 w-3" />{c("Sealed", "ปิดผนึก")}</> : c("Advertisement", "ประกาศ")}</span></div>
      <h2 className="mt-2 text-[21px] font-bold">{row.name} <span className="text-[14px] font-normal text-[#6B7280]">{row.ref}</span></h2>
      <p className="text-[13px] text-[#4B5563]">{sealed
        ? <>{c(`Written by ${row.client?.writer ?? "—"}, PitchSnack Control, on ${written} · for `, `เขียนโดย ${row.client?.writer ?? "—"} ทีม PitchSnack Control เมื่อ ${written} · สำหรับ `)}<b>{row.client?.name ?? "—"} · {row.client?.ref ?? "—"}</b>. {c("Only PitchSnack sees the client.", "เฉพาะ PitchSnack เท่านั้นที่เห็นลูกค้า")}</>
        : <>{c(`Written by the buyer, ${row.client?.writer ?? "—"}, on ${written} · `, `เขียนโดยผู้ซื้อ ${row.client?.writer ?? "—"} เมื่อ ${written} · `)}<b>{row.company ?? "—"} · {row.client?.ref ?? "—"}</b>. {c("Sellers see the buyer’s name after the NDA.", "ผู้ขายจะเห็นชื่อผู้ซื้อหลัง NDA")}</>}</p>
      <div className="mt-4 grid gap-5 min-[1100px]:grid-cols-[minmax(0,1fr)_320px]">
        <BoFields d={d} set={set} errs={errs} only={EDITABLE} />
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">{c("What sellers and buyers will see", "สิ่งที่ผู้ขายและผู้ซื้อจะเห็น")}</div>
          <BuyOrderCard card={draftCard(d, { buyerType: row.buyerType, country: row.country }, { ...row, cover })} persona="buyer" mode="preview" onDetails={() => {}} onApply={() => {}} onShare={() => {}} />
          <BuyOrderPicture card={{ ...row, cover }} onSaved={setCover} />
        </div>
      </div>
      <div className="-mx-5 -mb-5 mt-5 border-t bg-muted/40 px-5 py-4">
        {note !== null && (
          <div className="mb-3">
            <label className="bw-lab text-[13.5px] font-semibold" htmlFor="bo-note">{sealed ? c("What should Control change?", "Control ควรแก้ไขอะไร") : c("What should the buyer change?", "ผู้ซื้อควรแก้ไขอะไร")}</label>
            <textarea id="bo-note" autoFocus className="bw-in mt-1" rows={3} maxLength={1000} value={note} placeholder={c("For example: say what the buyer makes in the description.", "เช่น ระบุในคำอธิบายว่าผู้ซื้อผลิตอะไร")} onChange={(e) => setNote(e.target.value)} />
            <div className="mt-2 flex justify-end gap-2"><Button variant="outline" onClick={() => setNote(null)}><X className="h-4 w-4" />{c("Cancel", "ยกเลิก")}</Button><Button disabled={!note.trim() || busy} onClick={() => run("send_back")}>{c("Send back", "ส่งกลับ")}</Button></div>
          </div>
        )}
        {note === null && <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => setNote("")}><Undo2 className="h-4 w-4" />{sealed ? c("Send back to Control", "ส่งกลับให้ Control") : c("Send back to the buyer", "ส่งกลับให้ผู้ซื้อ")}</Button>
          <Button disabled={busy} className="bg-[#F6A823] text-[#0E162F] hover:bg-[#E09612]" onClick={() => run("post")}><Check className="h-4 w-4" />{c("Post buy order", "ลงประกาศซื้อ")}</Button>
        </div>}
      </div>
    </div>
  );
}

function ExtendDialog({ row, onClose }: { row: AdminBoRow; onClose: () => void }) {
  const { c, th } = useBw();
  const qc = useQueryClient();
  const fn = useServerFn(adminExtendBuyOrder);
  const [m, setM] = useState<number>(3);
  const [busy, setBusy] = useState(false);
  const reopen = row.status === "closed";
  const next = reopen ? addMonths(bkkToday(), m) : addMonths(row.closesOn ?? bkkToday(), m);
  const go = async () => {
    setBusy(true);
    try {
      const r = await fn({ data: { id: row.id, months: m } });
      const dt = fmtDay(r.closesOn, th);
      toast.success(reopen ? c(`Reopened. Applications now close ${dt}.`, `เปิดอีกครั้งแล้ว ปิดรับสมัคร ${dt}`) : c(`Extended. Applications now close ${dt}.`, `ขยายแล้ว ปิดรับสมัคร ${dt}`));
      onClose();
    } catch (e) { toast.error(String((e as Error).message).startsWith("BO_CHANGED") ? c("This buy order has changed. Refresh and try again.", "ประกาศนี้มีการเปลี่ยนแปลง กรุณารีเฟรชแล้วลองอีกครั้ง") : (e as Error).message); }
    finally { setBusy(false); qc.invalidateQueries({ queryKey: ["buy-orders"] }); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogTitle>{reopen ? c("Reopen applications", "เปิดรับสมัครอีกครั้ง") : c("Extend applications", "ขยายเวลารับสมัคร")}</DialogTitle>
        <DialogDescription>{reopen ? c(`${row.name} · ${row.ref}. Closed ${fmtDay(row.closesOn, th)}. It opens again from today.`, `${row.name} · ${row.ref} ปิดแล้ว ${fmtDay(row.closesOn, th)} จะเปิดอีกครั้งตั้งแต่วันนี้`) : c(`${row.name} · ${row.ref}. Applications close ${fmtDay(row.closesOn, th)}.`, `${row.name} · ${row.ref} ปิดรับสมัคร ${fmtDay(row.closesOn, th)}`)}</DialogDescription>
        <div>
          <span className="mb-1 block text-[13.5px] font-semibold" id="ext-l">{reopen ? c("Open for", "เปิดเป็นเวลา") : c("Add", "เพิ่ม")}</span>
          <div role="radiogroup" aria-labelledby="ext-l" className="flex gap-2">{PERIODS.map((p) => <button key={p} type="button" role="radio" aria-checked={m === p} className="bw-period" onClick={() => setM(p)}>{reopen ? periodLabel(p, th) : `+${periodLabel(p, th)}`}</button>)}</div>
          <p className="bw-hint mt-2">{c(`New close date: ${fmtDay(next, th)}.`, `วันปิดใหม่: ${fmtDay(next, th)}`)}</p>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>{c("Cancel", "ยกเลิก")}</Button><Button disabled={busy} onClick={go}><Clock className="h-4 w-4" />{reopen ? c("Reopen", "เปิดอีกครั้ง") : c("Extend", "ขยาย")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
