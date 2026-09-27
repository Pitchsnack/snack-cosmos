import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MyBusinessProfiles } from "@/components/my-business/my-business-profiles";
import { AdminReviewCtx, type AdminReview } from "@/components/my-business/admin-review-context";
import { listStartups } from "@/lib/startups.functions";
import { SectorArt } from "@/components/hidden-profile/bits";
import {
  addLibraryImage, assignApproval, createLibraryUpload, decideListing, FIELD_LABEL, getListingReview, listImageLibrary,
  setNotifyAdminEdits, setPublicImage, undoAdminEdit,
} from "@/lib/approvals.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/approvals/listings/$id")({
  head: () => ({
    meta: [
      { title: "Listing review — Pitchsnack Admin" },
      { name: "description", content: "Review a seller's Public and Private view before publishing it to the Marketplace." },
    ],
  }),
  component: ListingReview,
});

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const REASONS = ["Contains a name", "Unverifiable claim", "Wrong sector/tags", "Fact doesn't match Private view", "Other"];
const FIELDS = ["Headline", "Description", "Products & services", "Markets", "Facts", "Private view"];
const STATUS: Record<string, string> = { in_review: "In review", changes_requested: "Changes requested", live: "Live", live_edits_pending: "Live · edits pending", rejected: "Rejected", draft: "Draft", unpublished: "Unpublished" };

function ListingReview() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fn = useServerFn(getListingReview);
  const decideFn = useServerFn(decideListing);
  const assignFn = useServerFn(assignApproval);
  const notifyFn = useServerFn(setNotifyAdminEdits);
  const listFn = useServerFn(listStartups);
  const { data, isLoading, error } = useQuery({ queryKey: ["approvals", "listing", id], queryFn: () => fn({ data: { id } }) });
  const startupId = (data as any)?.hp?.startup_id as string | undefined;
  const { data: items } = useQuery({
    queryKey: ["approvals", "listing-startup", startupId],
    enabled: !!startupId,
    queryFn: () => listFn({ data: { ids: [startupId!], pageSize: 1 } as never }),
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["approvals"] }); qc.invalidateQueries({ queryKey: ["hidden-profiles"] }); };
  const decide = useMutation({
    mutationFn: (v: { id: string; action: "approve" | "request_changes" | "reject"; note?: string; reasons?: string[]; fields?: string[]; category?: string; isNew?: boolean; featured?: boolean }) => decideFn({ data: v }),
    onSuccess: (_r, v) => {
      refresh();
      const name = (data as any)?.hp?.code_name ?? "Listing";
      toast.success(v.action === "approve" ? `Published. ${name} is now live in the Startup Directory · seller notified` : v.action === "reject" ? "Rejected · seller notified" : "Changes requested · seller notified");
      navigate({ to: v.action === "approve" ? "/startups" : "/approvals" });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const assign = useMutation({ mutationFn: () => assignFn({ data: { kind: "listing", id } }), onSuccess: () => { refresh(); toast.success("Assigned to you"); } });
  const notify = useMutation({ mutationFn: (value: boolean) => notifyFn({ data: { id, value } }), onSuccess: refresh });
  const [changes, setChanges] = useState(false);
  const [reject, setReject] = useState(false);
  const [approve, setApprove] = useState(false);
  const [library, setLibrary] = useState(false);
  const [editsOpen, setEditsOpen] = useState(false);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error || !data) return <p className="text-sm text-destructive">{(error as Error)?.message ?? "Not found"}</p>;
  const { hp, snapshot, changed, events, edits, names } = data as any;
  const v = snapshot.private ?? {};
  const decidable = hp.approval_status === "in_review";
  const item = (items as any)?.items?.[0] ?? (items as any)?.rows?.[0] ?? (Array.isArray(items) ? items[0] : null);
  const ctx: AdminReview = {
    pendingCover: hp.pending_cover ?? (hp.status === "live" ? hp.cover_image_url : null),
    editsCount: edits.length,
    notify: hp.notify_admin_edits !== false,
    onToggleNotify: (x) => notify.mutate(x),
    onSetImage: () => setLibrary(true),
    onShowEdits: () => setEditsOpen(true),
    onEditPrivate: () => navigate({ to: "/startups/$id/edit", params: { id: hp.startup_id } }),
    onEditMedia: () => navigate({ to: "/startups/$id/edit", params: { id: hp.startup_id } }),
  };
  const statusLabel = hp.approval_status === "in_review" && hp.status === "live" ? "Live · edits pending" : STATUS[hp.approval_status] ?? hp.approval_status;

  return (
    <div className="space-y-5" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <Link to="/approvals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Approvals</Link>
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-border bg-card p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><h1 className="truncate text-xl font-bold">{hp.code_name}</h1><Pill s={statusLabel} /></div>
          <p className="text-[13px] text-muted-foreground">
            {v.startup_name} · {hp.ref_no} · v{hp.version} · submitted {fmt(hp.submitted_at)} by {names[hp.submitted_by] ?? "seller"}
            {changed.length > 0 && <> · changed since last version: <b>{changed.join(", ")}</b></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => assign.mutate()}>{hp.assignee_id ? `Assigned: ${names[hp.assignee_id] ?? "—"}` : "Assign to me"}</Button>
          <Button variant="outline" size="sm" disabled={!decidable} onClick={() => setReject(true)}>Reject</Button>
          <Button variant="outline" size="sm" disabled={!decidable} onClick={() => setChanges(true)}>Request changes</Button>
          <Button size="sm" disabled={!decidable || decide.isPending} onClick={() => setApprove(true)} className="bg-emerald-600 text-primary-foreground hover:bg-emerald-700"><Check className="mr-1.5 h-4 w-4" />Approve & publish</Button>
        </div>
      </div>

      {item ? (
        <AdminReviewCtx.Provider value={ctx}>
          <MyBusinessProfiles items={[item]} />
        </AdminReviewCtx.Provider>
      ) : <p className="text-sm text-muted-foreground">Loading the seller's My business screen…</p>}

      <div className="rounded-[14px] border border-border bg-card p-4">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Activity</div>
        {events.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
        {events.map((e: any) => (
          <div key={e.id} className="flex justify-between gap-3 border-t border-border py-2 text-[13px]">
            <span><b>{e.action.replace("_", " ")}</b>{e.version ? ` · v${e.version}` : ""} by {names[e.actor_id] ?? "—"}{e.note ? ` — ${e.note}` : ""}</span>
            <span className="shrink-0 text-muted-foreground">{fmt(e.created_at)}</span>
          </div>
        ))}
      </div>

      {changes && <RequestChangesDialog onClose={() => setChanges(false)} pending={decide.isPending} onSend={(r, f, note) => decide.mutate({ id, action: "request_changes", reasons: r, fields: f, note })} />}
      {reject && <RejectDialog onClose={() => setReject(false)} pending={decide.isPending} onSend={(note) => decide.mutate({ id, action: "reject", note })} />}
      {approve && (
        <ApproveDialog name={hp.code_name} sector={v.sector ?? ""} editsCount={edits.length} notify={ctx.notify} hasImage={!!ctx.pendingCover} pending={decide.isPending}
          onClose={() => setApprove(false)} onConfirm={(o) => decide.mutate({ id, action: "approve", ...o })} />
      )}
      {library && <ImageLibraryDialog id={id} current={ctx.pendingCover} sector={v.sector} onClose={() => setLibrary(false)} onDone={refresh} />}
      {editsOpen && <AdminEditsDialog edits={edits} names={names} onClose={() => setEditsOpen(false)} onDone={refresh} />}
    </div>
  );
}

const ART = ["Food & Beverage", "Manufacturing", "Technology", "Retail & Consumer", "Logistics", "Healthcare", "Media", "Business Services"];

function ImageLibraryDialog({ id, current, sector, onClose, onDone }: { id: string; current: string | null; sector?: string; onClose: () => void; onDone: () => void }) {
  const listFn = useServerFn(listImageLibrary);
  const setFn = useServerFn(setPublicImage);
  const uploadFn = useServerFn(createLibraryUpload);
  const addFn = useServerFn(addLibraryImage);
  const { data: lib, refetch } = useQuery({ queryKey: ["approvals", "library"], queryFn: () => listFn() });
  const [pick, setPick] = useState<string | null>(current);
  const [busy, setBusy] = useState(false);
  const arts = sector && !ART.includes(sector) ? [sector, ...ART] : ART;
  const upload = async (file: File) => {
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) return toast.error("Use a JPG, PNG or WebP image");
    if (file.size > 8 * 1024 * 1024) return toast.error("Max 8 MB");
    setBusy(true);
    try {
      const { path, uploadUrl } = await uploadFn({ data: { ext: ext as "jpg" } });
      const res = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "content-type": file.type } });
      if (!res.ok) throw new Error("Upload failed");
      await addFn({ data: { path, label: file.name.replace(/\.[^.]+$/, "").slice(0, 80) } });
      await refetch();
      setPick(path);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true);
    try { await setFn({ data: { id, cover: pick } }); onDone(); toast.success("Public image set · goes live on approval"); onClose(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const Tile = ({ value, children }: { value: string; children: React.ReactNode }) => (
    <button type="button" onClick={() => setPick(value)} className={cn("overflow-hidden rounded-[10px] border-2 text-left", pick === value ? "border-primary" : "border-transparent")}>{children}</button>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogTitle>Set public image</DialogTitle>
        <DialogDescription>Only Admin sets the Marketplace picture. It replaces the locked placeholder when you approve.</DialogDescription>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Image library</span>
              <label className="cursor-pointer text-[13px] font-semibold text-primary">{busy ? "Working…" : "Upload to library"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
              </label>
            </div>
            {(lib ?? []).length === 0 ? <p className="text-[13px] text-muted-foreground">No uploaded pictures yet.</p> : (
              <div className="grid grid-cols-3 gap-2">
                {(lib ?? []).map((r: any) => (
                  <Tile key={r.id} value={r.path}>
                    <div className="relative h-24 bg-muted">{r.url && <img src={r.url} alt={r.label} className="absolute inset-0 h-full w-full object-cover" />}</div>
                    <div className="truncate px-2 py-1 text-[11.5px]">{r.label || "Untitled"}</div>
                  </Tile>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Sector artwork</div>
            <div className="grid grid-cols-4 gap-2">
              {arts.map((a) => (
                <Tile key={a} value={`art:${a}`}><SectorArt art={a} className="h-20 w-full" /><div className="truncate px-2 py-1 text-[11.5px]">{a}</div></Tile>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || !pick || pick === current} onClick={() => void save()}>Use this image</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const show = (x: unknown) => (x == null || x === "" ? "—" : Array.isArray(x) ? x.join(", ") || "—" : typeof x === "string" && /^(art:|library\/)/.test(x) ? (x.startsWith("art:") ? `Artwork: ${x.slice(4)}` : "Library picture") : String(x));

function AdminEditsDialog({ edits, names, onClose, onDone }: { edits: any[]; names: Record<string, string>; onClose: () => void; onDone: () => void }) {
  const undoFn = useServerFn(undoAdminEdit);
  const undo = useMutation({ mutationFn: (editId: string) => undoFn({ data: { editId } }), onSuccess: () => { onDone(); toast.success("Undone"); }, onError: (e) => toast.error((e as Error).message) });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogTitle>Admin edits on this version</DialogTitle>
        <DialogDescription>Every change Admin made, with the old and new value.</DialogDescription>
        <div className="max-h-[60vh] overflow-y-auto">
          {edits.length === 0 && <p className="text-sm text-muted-foreground">No admin edits yet.</p>}
          {edits.map((e) => (
            <div key={e.id} className="grid grid-cols-[130px_1fr_auto] items-start gap-3 border-t border-border py-2.5 text-[13px]">
              <span className="font-semibold">{FIELD_LABEL[e.field] ?? e.field}</span>
              <span className="min-w-0 break-words"><span className="text-muted-foreground line-through">{show(e.old_value)}</span> → {show(e.new_value)}
                <div className="text-[11.5px] text-muted-foreground">{names[e.admin_id] ?? "Admin"} · {fmt(e.created_at)}</div></span>
              <Button size="sm" variant="ghost" disabled={undo.isPending} onClick={() => undo.mutate(e.id)}>Undo</Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ApproveDialog({ name, sector, editsCount, notify, hasImage, pending, onClose, onConfirm }: {
  name: string; sector: string; editsCount: number; notify: boolean; hasImage: boolean; pending: boolean; onClose: () => void;
  onConfirm: (o: { category: string; isNew: boolean; featured: boolean }) => void;
}) {
  const [category, setCategory] = useState(sector);
  const [isNew, setIsNew] = useState(true);
  const [featured, setFeatured] = useState(false);
  const steps = [
    "Listing status → Live, version stamped.",
    "Card inserted into the Startup Directory under the chosen category.",
    hasImage ? "Admin-chosen public image goes live, replacing the placeholder." : "No public image chosen — the sector artwork is used.",
    `Seller notified in-app${notify && editsCount ? `, including ${editsCount} admin edit${editsCount === 1 ? "" : "s"}` : ""}.`,
    "Approval written to History with your name, time, version and edits.",
  ];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogTitle>Approve & publish {name}?</DialogTitle>
        <DialogDescription>This is what will happen.</DialogDescription>
        <ol className="list-decimal space-y-1.5 pl-5 text-[13px]">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
        <div className="space-y-3 rounded-[10px] bg-muted p-3">
          <div className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Directory placement</div>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" maxLength={80} />
          <label className="flex items-center gap-2 text-[13px]"><Checkbox checked={isNew} onCheckedChange={(x) => setIsNew(!!x)} />"New" badge for 14 days</label>
          <label className="flex items-center gap-2 text-[13px]"><Checkbox checked={featured} onCheckedChange={(x) => setFeatured(!!x)} />Feature on Directory home</label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={pending} className="bg-emerald-600 text-primary-foreground hover:bg-emerald-700" onClick={() => onConfirm({ category: category.trim(), isNew, featured })}>Approve & publish</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Pill({ s }: { s: string }) {
  const tone = /Changes|edits/.test(s) ? "bg-amber-500/15 text-amber-800" : /^Live/.test(s) ? "bg-emerald-500/15 text-emerald-700" : /Reject/.test(s) ? "bg-red-500/15 text-red-700" : "bg-blue-500/15 text-blue-700";
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", tone)}>{s}</span>;
}

function RequestChangesDialog({ onClose, onSend, pending }: { onClose: () => void; onSend: (r: string[], f: string[], note: string) => void; pending: boolean }) {
  const [r, setR] = useState<string[]>([]);
  const [f, setF] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const toggle = (arr: string[], set: (v: string[]) => void, x: string) => set(arr.includes(x) ? arr.filter((y) => y !== x) : [...arr, x]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogTitle>Request changes</DialogTitle>
        <DialogDescription>Both views go back to the seller. The resubmission returns as a new version with what changed highlighted.</DialogDescription>
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Reasons</div>
            {REASONS.map((x) => <label key={x} className="flex items-center gap-2 py-1 text-sm"><Checkbox checked={r.includes(x)} onCheckedChange={() => toggle(r, setR, x)} />{x}</label>)}
          </div>
          <div>
            <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Fields to fix</div>
            <div className="flex flex-wrap gap-1.5">
              {FIELDS.map((x) => (
                <button key={x} type="button" onClick={() => toggle(f, setF, x)} className={cn("rounded-full border px-2.5 py-1 text-[12px] font-semibold", f.includes(x) ? "border-foreground bg-foreground text-background" : "border-border")}>{x}</button>
              ))}
            </div>
          </div>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the seller (required)" rows={3} maxLength={2000} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={pending || !note.trim()} onClick={() => onSend(r, f, note.trim())}>Send to seller</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({ onClose, onSend, pending }: { onClose: () => void; onSend: (note: string) => void; pending: boolean }) {
  const [note, setNote] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogTitle>Reject listing</DialogTitle>
        <DialogDescription>The listing stays a Draft. Tell the seller why.</DialogDescription>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason" rows={3} maxLength={2000} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={pending || !note.trim()} onClick={() => onSend(note.trim())}>Reject</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
