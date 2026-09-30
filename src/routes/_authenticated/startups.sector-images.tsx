import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { ChevronDown, ChevronLeft, ChevronRight, Info, Plus, Rocket, Search, X } from "lucide-react";
import { Highlight, matchesTerm } from "@/components/peer-comparables/tab-toolbar";
import { SECTOR_GROUPS } from "@/lib/sectors";
import { addSectorImage, deleteSectorImage, type SectorImage } from "@/lib/sector-images.functions";
import { SECTOR_IMAGES_KEY, useSectorImages } from "@/hooks/use-sector-images";
import { useCanManageSectorImages, DIRECTORY_SEARCH_KEY } from "@/components/startups/sector-images-menu";
import { SectorArt } from "@/components/hidden-profile/bits";
import { DeleteEntityDialog } from "@/components/entity-control/delete-entity-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/startups/sector-images")({
  validateSearch: z.object({ sector: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Sector images — Startups Directory" },
      { name: "description", content: "Upload the sector pictures buyers see as listing covers." },
      { property: "og:title", content: "Sector images — Startups Directory" },
      { property: "og:description", content: "Upload the sector pictures buyers see as listing covers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SectorImagesPage,
});

const RULE = "Use a JPG, PNG or WebP, landscape, at least 1200 × 675 px, up to 5 MB.";
const plural = (n: number) => (n === 1 ? "1 image" : `${n} images`);
const mb = (b: number) => Math.max(0.1, b / (1024 * 1024)).toFixed(1);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Checks the file, redraws it (drops EXIF/GPS) and scales it to fit 1920 × 1080. */
async function prepare(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) return null;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp || bmp.width < 1200 || bmp.height < 675 || bmp.width <= bmp.height) return null;
  const k = Math.min(1, 1920 / bmp.width, 1080 / bmp.height);
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  const mime: "image/jpeg" | "image/png" = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob: Blob | null = await new Promise((r) => c.toBlob(r, mime, mime === "image/jpeg" ? 0.85 : undefined));
  if (!blob || blob.size > 5 * 1024 * 1024) return null;
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { width: w, height: h, mime, base64: btoa(bin) };
}

function SectorImagesPage() {
  const navigate = useNavigate();
  const { sector: openKey } = Route.useSearch();
  const { data: can, isLoading: canLoading } = useCanManageSectorImages();
  const { data: images = [] } = useSectorImages();
  const qc = useQueryClient();
  const addFn = useServerFn(addSectorImage);
  const delFn = useServerFn(deleteSectorImage);
  const [open, setOpen] = useState<Set<string>>(() => new Set(openKey ? [openKey] : []));
  const [view, setView] = useState<{ sector: string; id: string | null } | null>(null);
  const [confirm, setConfirm] = useState<SectorImage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [back, setBack] = useState<Record<string, unknown>>({});
  const [q, setQ] = useState("");
  const term = q.trim();
  const fileHit = (s: string) => !!term && images.some((i) => i.sector_key === s && matchesTerm(term, i.file_name));
  const showSector = (group: string, s: string) => !term || matchesTerm(term, s, group) || fileHit(s);
  const isOpenRow = (group: string, s: string) => open.has(s) || (!!term && !matchesTerm(term, s, group) && fileHit(s));
  const anyShown = SECTOR_GROUPS.some((g) => g.sectors.some((s) => showSector(g.group, s)));

  useEffect(() => {
    try { setBack(JSON.parse(sessionStorage.getItem(DIRECTORY_SEARCH_KEY) || "{}")); } catch { /* ignore */ }
  }, []);
  useEffect(() => { if (!canLoading && can === false) navigate({ to: "/startups", replace: true }); }, [can, canLoading, navigate]);
  useEffect(() => {
    if (openKey) setTimeout(() => document.getElementById(`sector-${openKey}`)?.scrollIntoView({ block: "center" }), 50);
  }, [openKey]);

  const bySector = (s: string) => images.filter((i) => i.sector_key === s);
  const refresh = () => qc.invalidateQueries({ queryKey: SECTOR_IMAGES_KEY });

  const onFiles = async (sector: string, files: FileList) => {
    let added = 0, last = "";
    for (const f of Array.from(files)) {
      const p = await prepare(f);
      if (!p) { toast.error(`${f.name} wasn't added. ${RULE}`); continue; }
      try { await addFn({ data: { sector, fileName: f.name, ...p } }); added++; last = f.name; }
      catch (e) { toast.error(`${f.name} wasn't added. ${(e as Error).message}`); }
    }
    if (added) {
      await refresh();
      toast.success(added === 1 ? `${last} added to ${sector}.` : `${added} images added to ${sector}.`);
    }
  };

  const doDelete = async () => {
    if (!confirm) return;
    setDeleting(true);
    try {
      await delFn({ data: { id: confirm.id } });
      await refresh();
      toast.success(`${confirm.file_name} deleted.`);
      if (view?.id === confirm.id) setView(null);
      setConfirm(null);
    } catch (e) { toast.error((e as Error).message); } finally { setDeleting(false); }
  };

  if (!can) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-5">
      <Link to="/startups" search={back as never} className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline">
        <ChevronLeft className="h-3.5 w-3.5" /> Startups Directory
      </Link>
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Rocket className="h-3.5 w-3.5" /> Startup Directory
        </div>
        <h1 className="mt-1 flex items-baseline gap-3 text-3xl font-semibold tracking-tight">
          Sector images <span className="text-sm font-medium tracking-normal text-muted-foreground">{plural(images.length)}</span>
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">Images for each sector. Buyers see them as listing covers until their NDA is approved.</p>
        <p className="mt-2 flex items-start gap-2 text-[13px] text-foreground/80">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          Use pictures without company names, logos, signs or people's faces. JPG, PNG or WebP, landscape, at least 1200 × 675 px, up to 5 MB.
        </p>
      </div>

      <div className="max-w-[760px]">
        <div className="mt-1 flex h-[38px] items-center gap-2 rounded-[9px] border border-input bg-muted px-3 focus-within:border-muted-foreground focus-within:bg-background">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setQ(""); }}
            placeholder="Search sectors or file names…"
            className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground"
          />
          {q && (
            <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="grid h-6 w-6 place-items-center text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {!anyShown && (
          <p className="mt-5 text-[13.5px] text-muted-foreground">
            No sectors or images match “{term}”.{" "}
            <button type="button" onClick={() => setQ("")} className="font-semibold text-primary hover:underline">Clear search</button>
          </p>
        )}
        {SECTOR_GROUPS.filter((g) => g.sectors.some((s) => showSector(g.group, s))).map((g) => (
          <section key={g.group}>
            <div className="mb-2 mt-[22px] text-[11.5px] font-semibold uppercase tracking-[.08em] text-muted-foreground">{g.group}</div>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {g.sectors.filter((s) => showSector(g.group, s)).map((s, idx) => {
                const imgs = bySector(s);
                const isOpen = isOpenRow(g.group, s);
                return (
                  <div key={s} id={`sector-${s}`} className={cn(idx > 0 && "border-t border-border/60")}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpen((o) => { const n = new Set(o); isOpen ? n.delete(s) : n.add(s); return n; })}
                      className={cn("flex h-12 w-full items-center gap-3 pl-4 pr-3 text-left hover:bg-muted/40", isOpen && "bg-muted/40")}
                    >
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium"><Highlight text={s} term={term} /></span>
                      <span className={cn("text-[13px]", imgs.length ? "text-muted-foreground" : "text-muted-foreground/70")}>{imgs.length ? plural(imgs.length) : "No images"}</span>
                      {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground/70" /> : <ChevronRight className="h-4 w-4 text-muted-foreground/70" />}
                    </button>
                    {isOpen && (
                      <div className="bg-muted/40 px-4 pb-4 pt-1">
                        {imgs.length === 0 && <p className="mb-3 text-[13px] text-muted-foreground">No images yet. Listings in {s} show the default cover until you add one.</p>}
                        <div className="grid grid-cols-[repeat(auto-fill,150px)] gap-x-3 gap-y-3.5">
                          {imgs.length === 0 && (
                            <div>
                              <button type="button" onClick={() => setView({ sector: s, id: null })} className="block cursor-zoom-in overflow-hidden rounded-lg border border-border hover:border-muted-foreground">
                                <SectorArt art={s} plain className="h-[84px] w-[150px]" />
                              </button>
                              <div className="mt-1.5 text-[12.5px]">Default cover</div>
                            </div>
                          )}
                          {imgs.map((i) => (
                            <div key={i.id} className="min-w-0">
                              <button type="button" onClick={() => setView({ sector: s, id: i.id })} className="block h-[84px] w-[150px] cursor-zoom-in overflow-hidden rounded-lg border border-border bg-secondary hover:border-muted-foreground">
                                {i.url && <img src={i.url} alt={i.file_name} className="h-full w-full object-cover" />}
                              </button>
                              <div className="mt-1.5 truncate text-[12.5px]" title={i.file_name}><Highlight text={i.file_name} term={term} /></div>
                              <div className="text-[12px] text-muted-foreground">
                                {Math.max(0.1, i.size_bytes / 1048576).toFixed(1)} MB · <button type="button" onClick={() => setConfirm(i)} className="hover:text-destructive hover:underline">Delete</button>
                              </div>
                            </div>
                          ))}
                          <AddBox onFiles={(f) => void onFiles(s, f)} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {view && <FullView sector={view.sector} images={bySector(view.sector)} id={view.id} onMove={(id) => setView({ ...view, id })} onClose={() => setView(null)} onDelete={setConfirm} />}
      <DeleteEntityDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${confirm?.file_name ?? ""}?`}
        description={`Listings that use it will show another ${confirm?.sector_key ?? ""} image, or the default cover if none is left. This can't be undone.`}
        pending={deleting}
        onConfirm={() => void doDelete()}
      />
    </div>
  );
}

function AddBox({ onFiles }: { onFiles: (f: FileList) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.click()} className="flex h-[84px] w-[150px] items-center justify-center gap-1 rounded-lg border-[1.5px] border-dashed border-input bg-card text-[13px] font-semibold text-foreground/80 hover:bg-muted">
        <Plus className="h-3.5 w-3.5" /> Add image
      </button>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = ""; }} />
    </>
  );
}

function FullView({ sector, images, id, onMove, onClose, onDelete }: { sector: string; images: SectorImage[]; id: string | null; onMove: (id: string) => void; onClose: () => void; onDelete: (i: SectorImage) => void }) {
  const idx = id ? images.findIndex((i) => i.id === id) : -1;
  const img = idx >= 0 ? images[idx] : null;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (!img) return;
      if (e.key === "ArrowLeft" && idx > 0) onMove(images[idx - 1].id);
      if (e.key === "ArrowRight" && idx < images.length - 1) onMove(images[idx + 1].id);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [idx, img, images, onClose, onMove]);
  const nav = "grid h-[34px] w-[34px] place-items-center rounded-lg border border-border disabled:opacity-40";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/70 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="w-full max-w-[880px] overflow-hidden rounded-[14px] bg-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3">
          <b className="text-[15px]">{img ? sector : "Default cover"}</b>
          {img && <span className="text-[13px] text-muted-foreground">{idx + 1} of {images.length}</span>}
          <button type="button" aria-label="Close" onClick={onClose} className="ml-auto rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="relative aspect-video bg-foreground">
          {img ? img.url && <img src={img.url} alt={img.file_name} className="absolute inset-0 h-full w-full object-contain" />
            : <SectorArt art={sector} plain className="absolute inset-0" />}
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            {img ? (
              <>
                <div className="truncate text-[13.5px] font-bold">{img.file_name}</div>
                <div className="text-[12.5px] text-muted-foreground">{img.width} × {img.height} px · {mb(img.size_bytes)} MB · Uploaded {fmtDate(img.uploaded_at)}</div>
              </>
            ) : <div className="text-[12.5px] text-muted-foreground">Shown until you add an image for this sector.</div>}
          </div>
          {img && images.length > 1 && (
            <>
              <button type="button" aria-label="Previous" className={nav} disabled={idx === 0} onClick={() => onMove(images[idx - 1].id)}><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" aria-label="Next" className={nav} disabled={idx === images.length - 1} onClick={() => onMove(images[idx + 1].id)}><ChevronRight className="h-4 w-4" /></button>
            </>
          )}
          {img && <button type="button" onClick={() => onDelete(img)} className="text-[13px] font-semibold text-destructive hover:underline">Delete</button>}
        </div>
      </div>
    </div>
  );
}
