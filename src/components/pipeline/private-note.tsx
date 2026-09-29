import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getPrivateNote, savePrivateNote, type NoteFields } from "@/lib/private-notes.functions";

const fmt = (s?: string | null) => (s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).replace("Sept", "Sep") : "—");
const url = (w: string) => (/^https?:/.test(w) ? w : `https://${w}`);
let pillSession = false; // collapsed banner stays for the session

function Tile({ name, logo }: { name: string; logo?: string | null }) {
  if (logo) return <img src={logo} alt="" className="h-12 w-12 shrink-0 rounded-[12px] border border-[#E5E7EB] object-contain" />;
  const i = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  return <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br from-[#fb923c] to-[#ea580c] text-[15px] font-semibold text-white">{i}</div>;
}
const Cap = ({ children }: { children: React.ReactNode }) => <div className="mb-1 mt-5 text-[11px] font-medium text-[#9CA3AF]">{children}</div>;
const Empty = () => <span className="text-[#9CA3AF]">Not disclosed</span>;
const Edited = () => <span className="ml-1.5 text-[11.5px] font-normal lowercase text-[#7C3AED]">edited</span>;

function Row({ label, children, edit }: { label: string; children: React.ReactNode; edit?: boolean }) {
  return (
    <div className={`grid grid-cols-[130px_1fr] gap-3 py-[7px] text-[13px] ${edit ? "" : "border-b border-[#F0F1F4]"}`}>
      <div className="text-[#6B7280]">{label}</div>
      <div className="min-w-0 break-words font-normal text-[#374151]">{children}</div>
    </div>
  )  );
}

export function PrivateNote({ pipelineId, onClose }: { pipelineId: string; onClose: () => void }) {
  const get = useServerFn(getPrivateNote);
  const save = useServerFn(savePrivateNote);
  const qc = useQueryClient();
  const key = ["pipeline", "private-note", pipelineId];
  const { data, error } = useQuery({ queryKey: key, queryFn: () => get({ data: { id: pipelineId } }) });
  const [editing, setEditing] = useState(false);
  const [pill, setPill] = useState(pillSession);
  const [draft, setDraft] = useState<NoteFields>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [focusNotes, setFocusNotes] = useState(false);

  const shown = useMemo<NoteFields>(() => {
    if (!data) return {};
    const o: NoteFields = {};
    for (const k of Object.keys(data.generated)) o[k] = k in data.overrides ? data.overrides[k] : data.generated[k];
    return o;
  }, [data]);
  const isEdited = (k: string) => !!data && k in data.overrides && (data.overrides[k] ?? "") !== (data.generated[k] ?? "");

  const startEdit = (toNotes = false) => {
    setDraft(Object.fromEntries(Object.entries(shown).map(([k, v]) => [k, v ?? ""])));
    setNotes(data?.myNotes ?? "");
    setEditing(true);
    setFocusNotes(toNotes);
  };
  useEffect(() => { if (editing && focusNotes) { notesRef.current?.focus(); setFocusNotes(false); } }, [editing, focusNotes]);
  const togglePill = (v: boolean) => { pillSession = v; setPill(v); };

  const differsFromGenerated = !!data && (Object.keys(data.generated).some((k) => (draft[k] ?? "").trim() !== (data.generated[k] ?? "")) || notes.trim() !== "");
  const reset = () => { if (!data) return; setDraft(Object.fromEntries(Object.entries(data.generated).map(([k, v]) => [k, v ?? ""]))); setNotes(""); };
  const submit = async () => {
    setBusy(true);
    try {
      await save({ data: { id: pipelineId, overrides: draft, myNotes: notes } });
      await qc.invalidateQueries({ queryKey: key });
      setEditing(false);
      toast.success("Note saved · only you can see it");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const buyer = data?.direction === "buyer_on_seller";
  const other = buyer ? "seller" : "buyer";
  const link = "font-medium text-[#2563EB] hover:underline";

  const val = (k: string) => {
    const v = shown[k];
    return <>{v ? v : <Empty />}{isEdited(k) && <Edited />}</>;
  };
  const line = (k: string) => (
    <input value={draft[k] ?? ""} placeholder="Not disclosed" onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
      className="w-full border-0 border-b border-dashed border-[#CBD5E1] bg-transparent py-0.5 text-[13px] font-normal text-[#374151] outline-none placeholder:text-[#9CA3AF] focus:border-solid focus:border-[#2563EB]" />
  );
  const area = (k: string, rows: number) => (
    <textarea value={draft[k] ?? ""} rows={rows} placeholder="Not disclosed" onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
      className="w-full rounded-[8px] border border-[#E5E7EB] px-2.5 py-1.5 text-[13px] text-[#374151] outline-none placeholder:text-[#9CA3AF] focus:border-[#2563EB]" />
  );
  const small = (k: string, label: string) => (
    <label className="min-w-0 flex-1"><span className="block text-[11px] text-[#9CA3AF]">{label}</span>{line(k)}</label>
  );
  const field = (label: string, k: string) => <Row label={label} edit={editing}>{editing ? line(k) : val(k)}</Row>;
  const website = (w: string | null | undefined) => w ? <a href={url(w)} target="_blank" rel="noreferrer" className={link}>{w.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a> : null;
  const overview = (parts: (React.ReactNode | null)[], edited: boolean) => {
    const xs = parts.filter(Boolean);
    return xs.length ? <>{xs.map((x, i) => <span key={i}>{i > 0 && " · "}{x}</span>)}{edited && <Edited />}</> : <Empty />;
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        aria-label={buyer ? "Seller profile" : "Investor profile"}
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={{ maxWidth: 560 }}
        className="flex max-h-[calc(100vh-64px)] w-[calc(100vw-32px)] flex-col gap-0 overflow-hidden rounded-[16px] border-0 bg-white p-0 font-['DM_Sans',system-ui,sans-serif] text-[#374151] shadow-[0_30px_70px_rgba(16,24,40,.28)] sm:rounded-[16px] [&>button:last-child]:hidden"
      >
        <div className="flex items-start gap-3 px-6 pb-3 pt-5">
          <Tile name={data?.name ?? "…"} logo={data?.logoUrl} />
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-[17px] font-semibold text-[#111827]">{data?.name ?? "Loading…"}</DialogTitle>
            <DialogDescription className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-[#6B7280]">
              {data?.sub ?? (buyer ? "Seller" : "Buyer")}
              {data?.verified && <span className="inline-flex items-center rounded-full border border-[#BBF7D0] bg-[#ECFDF3] px-2 py-0.5 text-[11.5px] font-medium text-[#15803D]">✓ Verified {other}</span>}
            </DialogDescription>
          </div>
          <button aria-label="Close" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-[8px] text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">
          {error && <p className="text-[13px] text-[#B91C1C]">{(error as Error).message}</p>}
          {data && (
            <>
              {/* banner */}
              {pill ? (
                <div className="mb-3 flex items-center justify-between">
                  <button onClick={() => togglePill(false)} className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-3 text-[12.5px] font-semibold text-[#1D4ED8]">
                    <Lock className="h-3 w-3" /> My private note
                  </button>
                  {!editing && <button onClick={() => startEdit()} className="h-8 rounded-[8px] border border-[#D8C7FB] bg-white px-3 text-[12.5px] font-medium text-[#5B21B6] hover:bg-[#F5F3FF]">Edit note</button>}
                </div>
              ) : (
                <div className={`mb-3 flex items-start gap-3 rounded-[12px] border px-[14px] py-3 ${editing ? "border-[#BFDBFE] bg-[#EFF6FF]" : "border-[#E4D8FD] bg-[#F5F3FF]"}`}>
                  <Lock className={`mt-0.5 h-4 w-4 shrink-0 ${editing ? "text-[#2563EB]" : "text-[#7C3AED]"}`} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-[13.5px] font-semibold ${editing ? "text-[#1D4ED8]" : "text-[#5B21B6]"}`}>{editing ? "Editing your private note" : "Private note · only you can see it"}</div>
                    <div className={`mt-0.5 text-[12.5px] ${editing ? "text-[#5B7BB5]" : "text-[#7C6AA8]"}`}>
                      {editing ? `Only you can see it. ${buyer ? "The seller's listing does not change." : "The buyer's profile does not change."}`
                        : data.editedAt ? `Edited by you on ${fmt(data.editedAt)}.`
                        : `Generated from ${buyer ? "the listing" : "the buyer's profile"} on ${fmt(data.generatedAt)}.`}
                    </div>
                  </div>
                  {!editing && <button onClick={() => startEdit()} className="h-7 shrink-0 rounded-[8px] border border-[#D8C7FB] bg-white px-3 text-[12.5px] font-medium text-[#5B21B6] hover:bg-[#FAF7FF]">Edit note</button>}
                  <button aria-label="Collapse note banner" onClick={() => togglePill(true)} className={`grid h-7 w-7 shrink-0 place-items-center rounded-[8px] ${editing ? "text-[#2563EB] hover:bg-[#DBEAFE]" : "text-[#7C3AED] hover:bg-[#EDE9FE]"}`}><X className="h-3.5 w-3.5" /></button>
                </div>
              )}

              {/* summary */}
              {(() => { const k = buyer ? "summary" : "about"; return editing ? area(k, 3)
                : <p className="text-[13px] leading-relaxed text-[#374151]">{shown[k] || <Empty />}{isEdited(k) && <Edited />}</p>; })()}

              {buyer ? (
                <>
                  <Cap>Company</Cap>
                  <Row label="Code name" edit={editing}>{data.codeName || <Empty />}</Row>
                  <Row label="Overview" edit={editing}>
                    {editing ? <div className="flex gap-3">{small("founded", "Founded")}{small("employees", "Employees")}{small("website", "Website")}</div>
                      : overview([shown.founded && `Founded ${shown.founded}`, shown.employees && `${shown.employees} employees`, website(shown.website)], isEdited("founded") || isEdited("employees") || isEdited("website"))}
                  </Row>
                  <Row label="Address" edit={editing}>{editing ? area("address", 2) : val("address")}</Row>
                </>
              ) : (
                <>
                  <Cap>Investor</Cap>
                  {editing ? (
                    <>{field(data.sizeLabel ?? "Fund size", "size")}{field("Track record", "trackRecord")}{field("Website", "website")}</>
                  ) : (
                    <Row label="Overview">{overview([shown.size && `${data.sizeLabel} ${shown.size}`, shown.trackRecord, website(shown.website)], isEdited("size") || isEdited("trackRecord") || isEdited("website"))}</Row>
                  )}
                  <Row label="Address" edit={editing}>{editing ? area("address", 2) : val("address")}</Row>
                  <Cap>Mandate</Cap>
                  {field("Ticket size", "ticket")}
                  {field("Sectors", "sectors")}
                  {field("Deal type", "mandateDealType")}
                </>
              )}

              <Cap>The deal</Cap>
              {field("Asking price", "askingPrice")}
              {field("Stake for sale", "stake")}
              {field("Deal type", "dealType")}
              {field("Reason for sale", "reason")}
              <Row label="Contact" edit={editing}>
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0">{data.contact || <Empty />}</span>
                  <Link to="/marketplace/my-contact" className={`${link} shrink-0`}>Open in Contacts</Link>
                </div>
              </Row>

              <Cap>My notes</Cap>
              {editing ? (
                <textarea ref={notesRef} value={notes} rows={6} onChange={(e) => setNotes(e.target.value)}
                  placeholder={`Your own notes: fit, questions for the ${other}, next steps…`}
                  className="block min-h-[150px] w-full resize-y rounded-[8px] border border-[#E5E7EB] px-3 py-2 text-[13px] text-[#374151] outline-none placeholder:text-[#9CA3AF] focus:border-[#2563EB]" />
              ) : data.myNotes ? (
                <p className="whitespace-pre-wrap text-[13px] text-[#374151]">{data.myNotes}</p>
              ) : (
                <button onClick={() => startEdit(true)} className={`${link} text-[13px]`}>Add your own notes</button>
              )}
            </>
          )}
        </div>

        {data && (
          <div className="flex items-center justify-between gap-3 border-t border-[#F0F1F4] px-6 py-3">
            {editing ? (
              <>
                <button onClick={reset} disabled={!differsFromGenerated} className="text-[13px] font-medium text-[#2563EB] hover:underline disabled:cursor-not-allowed disabled:text-[#9CA3AF] disabled:no-underline">Reset to generated</button>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="h-9 rounded-[8px] border border-[#E5E7EB] bg-white px-4 text-[13px] font-medium text-[#374151] hover:bg-[#F9FAFB]">Cancel</button>
                  <button onClick={submit} disabled={busy} className="h-9 rounded-[8px] bg-[#111827] px-4 text-[13px] font-medium text-white hover:bg-[#1F2937] disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
                </div>
              </>
            ) : (
              <>
                <span className="text-[12.5px] text-[#6B7280]">{buyer ? "Contact shown because your NDA is approved." : "Contact shown because you approved the NDA."}</span>
                <Link to={buyer ? "/marketplace/browse" : "/marketplace/my-contact"} className="inline-flex h-9 shrink-0 items-center rounded-[8px] border border-[#E5E7EB] px-3 text-[13px] font-medium text-[#374151] hover:bg-[#F9FAFB]">
                  {buyer ? "Open full listing" : "Open buyer profile"}
                </Link>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
