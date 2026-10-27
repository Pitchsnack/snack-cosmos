import { Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, Building2, Search, Mail, Phone, MapPin, Globe, Linkedin, Copy, StickyNote, Save, ChevronLeft, ChevronRight, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listAdminContacts, listAdminContactNotes, addAdminContactNote } from "@/lib/admin-contacts.functions";
import { filterAdminContacts, type AdminContact } from "@/lib/admin-contacts";
import { useTranslation } from "@/i18n/language";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const adminContactsQuery = queryOptions({ queryKey: ["admin-contacts"], queryFn: () => listAdminContacts(), staleTime: 30_000 });

export function ContactsPage() {
  const { data: contacts } = useSuspenseQuery(adminContactsQuery);
  const { language, t } = useTranslation();
  const txt = (en: string, th: string) => language === "th" ? th : en;
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(contacts[0]?.id || null);
  const filtered = useMemo(() => filterAdminContacts(contacts, role, status, search, sort), [contacts, role, status, search, sort]);
  useEffect(() => { setPage(0); }, [role, status, search, sort]);
  useEffect(() => { if (selectedId && !filtered.some(c => c.id === selectedId)) setSelectedId(filtered[0]?.id || null); }, [filtered, selectedId]);
  const selected = filtered.find(c => c.id === selectedId);
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * 20, (currentPage + 1) * 20);
  const roles = ["all", "buyer", "seller", "advisor"];
  const roleName = (r: string) => r === "all" ? t("All") : t(r === "buyer" ? "Buyer" : r === "seller" ? "Seller" : "Advisor");
  const initials = (name: string) => name.split(/\s+/).slice(0, 2).map(n => n[0]).join("").toUpperCase();
  return <div className="space-y-5">
    <h1 className="text-2xl font-semibold">{t("My Contacts")}</h1>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {roles.map(r => <Button key={r} variant="outline" onClick={() => setRole(r)} className={cn("h-auto justify-start gap-3 rounded-lg p-4 text-left", role === r && "border-primary bg-accent")}>
        <Users className="size-5 shrink-0 text-primary" /><span className="min-w-0"><span className="block text-sm text-muted-foreground">{r === "all" ? txt("Total contacts", "ผู้ติดต่อทั้งหมด") : roleName(r)}</span><span className="block text-2xl font-semibold">{r === "all" ? contacts.length : contacts.filter(c => c.role === r).length}</span></span>
      </Button>)}
    </div>
    <div className="flex flex-wrap gap-2 border-b border-border pb-2" role="tablist" aria-label={txt("Contact roles", "ประเภทผู้ติดต่อ")}>
      {roles.map(r => <Button key={r} role="tab" aria-selected={role === r} variant={role === r ? "secondary" : "ghost"} onClick={() => setRole(r)}>{roleName(r)}</Button>)}
    </div>
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <section className="min-w-0 space-y-3" aria-label={txt("Contact list", "รายชื่อผู้ติดต่อ")}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label={txt("Search contacts", "ค้นหาผู้ติดต่อ")} placeholder={txt("Search contacts…", "ค้นหาผู้ติดต่อ…")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-36" aria-label={t("Status")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{txt("All statuses", "ทุกสถานะ")}</SelectItem>{[...new Set(contacts.map(c => c.status))].sort().map(s => <SelectItem key={s} value={s}>{t(s)}</SelectItem>)}</SelectContent></Select>
          <Select value={sort} onValueChange={setSort}><SelectTrigger className="w-40" aria-label={txt("Sort contacts", "เรียงผู้ติดต่อ")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="recent">{txt("Newest joined", "สมัครล่าสุด")}</SelectItem><SelectItem value="name">{t("Name")}</SelectItem><SelectItem value="company">{t("Company")}</SelectItem></SelectContent></Select>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b border-border bg-muted/30 px-4 py-3 text-xs font-semibold text-muted-foreground"><span>{t("Contact")}</span><span>{t("Company")}</span></div>
          {!visible.length && <p className="p-10 text-center text-sm text-muted-foreground">{txt("No contacts match", "ไม่พบผู้ติดต่อที่ตรงกัน")}</p>}
          {visible.map(c => <Button key={c.id} variant="ghost" onClick={() => setSelectedId(c.id)} aria-pressed={selectedId === c.id} className={cn("grid h-auto w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 rounded-none border-b border-border px-4 py-4 text-left whitespace-normal", selectedId === c.id && "bg-accent border-l-2 border-l-primary")}>
            <span className="flex min-w-0 items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">{initials(c.name)}</span><span className="min-w-0"><span className="block break-words font-medium">{c.name}</span><span className="block text-xs text-muted-foreground">{c.title || roleName(c.role)}</span><Badge variant="outline" className="mt-1 text-[10px]">{roleName(c.role)} · {t(c.status)}</Badge></span></span>
            <span className="min-w-0 text-sm font-normal"><span className="block break-words">{c.organisations.map(o => o.name).join(" · ") || "—"}</span><span className="block text-xs text-muted-foreground">{c.organisations.map(o => o.ref).filter(Boolean).join(" · ")}</span></span>
          </Button>)}
          <div className="flex items-center justify-between gap-2 px-4 py-3 text-sm text-muted-foreground"><span>{filtered.length ? currentPage * 20 + 1 : 0}–{Math.min((currentPage + 1) * 20, filtered.length)} / {filtered.length}</span><div className="flex items-center gap-2"><Button variant="outline" size="icon" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} aria-label={txt("Previous page", "หน้าก่อนหน้า")}><ChevronLeft className="size-4" /></Button><span>{currentPage + 1} / {pages}</span><Button variant="outline" size="icon" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)} aria-label={txt("Next page", "หน้าถัดไป")}><ChevronRight className="size-4" /></Button></div></div>
        </div>
      </section>
      <section className="min-w-0 rounded-lg border border-border bg-card p-5" aria-label={txt("Contact details", "รายละเอียดผู้ติดต่อ")}>
        {selected ? <ContactDetails key={selected.id} contact={selected} onClose={() => setSelectedId(null)} /> : <p className="py-24 text-center text-sm text-muted-foreground">{txt("Select a contact", "เลือกผู้ติดต่อ")}</p>}
      </section>
    </div>
  </div>;
}

function ContactDetails({ contact: c, onClose }: { contact: AdminContact; onClose: () => void }) {
  const { language, t } = useTranslation();
  const txt = (en: string, th: string) => language === "th" ? th : en;
  const date = (value: string) => new Date(value).toLocaleDateString(language === "th" ? "th-TH" : "en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" });
  const copy = async (v: string) => { try { await navigator.clipboard.writeText(v); toast.success(txt("Copied", "คัดลอกแล้ว")); } catch { toast.error(txt("Unable to copy", "ไม่สามารถคัดลอกได้")); } };
  const info = [{ icon: Mail, label: t("Email"), value: c.email }, { icon: Phone, label: t("Phone"), value: c.phone }, { icon: MapPin, label: t("Location"), value: c.location }, { icon: Linkedin, label: "LinkedIn", value: c.linkedin }, { icon: Globe, label: t("Website"), value: c.website }];
  return <div className="space-y-5">
    <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h2 className="break-words text-lg font-semibold">{c.name}</h2><p className="text-sm text-muted-foreground">{c.title || t(c.role === "buyer" ? "Buyer" : c.role === "seller" ? "Seller" : "Advisor")}</p><Badge variant="outline" className="mt-2">{t(c.status)}</Badge></div><Button variant="ghost" size="icon" aria-label={t("Close")} onClick={onClose}><X className="size-4" /></Button></div>
    <div className="space-y-3 border-t border-border pt-4">{info.map(({ icon: Icon, label, value }) => <div key={label} className="flex items-start gap-2 text-sm"><Icon className="mt-1 size-4 shrink-0 text-muted-foreground" /><span className="w-20 shrink-0 text-muted-foreground">{label}</span><span className="min-w-0 flex-1 break-all">{value || "—"}</span>{value && <Button size="icon" variant="ghost" className="size-7 shrink-0" title={`${t("Copy")} ${label}`} aria-label={`${t("Copy")} ${label}`} onClick={() => copy(value)}><Copy className="size-3.5" /></Button>}</div>)}<p className="text-xs text-muted-foreground">{txt("Joined", "สมัครเมื่อ")} · {date(c.joined)}</p></div>
    <div className="space-y-3 border-t border-border pt-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><Building2 className="size-4" />{txt("Companies & profiles", "บริษัทและโปรไฟล์")}</h3>{c.organisations.length ? c.organisations.map(o => <div key={o.id} className="flex flex-wrap items-center justify-between gap-2"><div className="min-w-0"><p className="break-words text-sm font-medium">{o.name}</p><p className="text-xs text-muted-foreground">{o.ref} · {t(o.status)}</p></div>{o.kind === "seller" ? <Button variant="ghost" size="sm" asChild><Link to="/startups/$id" params={{ id: o.id }}><ExternalLink className="size-3.5" />{t("Open")}</Link></Button> : o.kind === "buyer" && o.id !== c.id ? <Button variant="ghost" size="sm" asChild><Link to="/investors/$id" params={{ id: o.id }}><ExternalLink className="size-3.5" />{t("Open")}</Link></Button> : null}</div>) : <p className="text-sm text-muted-foreground">{txt("No company profile", "ยังไม่มีโปรไฟล์บริษัท")}</p>}</div>
    <Button variant="outline" asChild><Link to="/users" search={{ edit: c.id }}><ExternalLink className="size-4" />{t("Open in Users")}</Link></Button>
    <Suspense fallback={<p className="text-sm text-muted-foreground">{t("Loading…")}</p>}><ContactNotes contactId={c.id} /></Suspense>
  </div>;
}

function ContactNotes({ contactId }: { contactId: string }) {
  const { language, t } = useTranslation();
  const txt = (en: string, th: string) => language === "th" ? th : en;
  const fn = useServerFn(listAdminContactNotes);
  const save = useServerFn(addAdminContactNote);
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const { data: notes } = useSuspenseQuery({ queryKey: ["admin-contact-notes", contactId], queryFn: () => fn({ data: { contactId } }) });
  const mutation = useMutation({ mutationFn: () => save({ data: { contactId, body } }), onSuccess: async () => { setBody(""); await qc.invalidateQueries({ queryKey: ["admin-contact-notes", contactId] }); toast.success(txt("Note saved", "บันทึกโน้ตแล้ว")); }, onError: () => toast.error(txt("Unable to save note", "ไม่สามารถบันทึกโน้ตได้")) });
  return <div className="space-y-3 border-t border-border pt-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><StickyNote className="size-4" />{txt("Admin-only notes", "โน้ตสำหรับผู้ดูแลระบบเท่านั้น")}</h3><form className="space-y-2" onSubmit={e => { e.preventDefault(); if (body.trim()) mutation.mutate(); }}><Textarea aria-label={txt("Add note", "เพิ่มโน้ต")} placeholder={txt("Add note…", "เพิ่มโน้ต…")} maxLength={4000} value={body} onChange={e => setBody(e.target.value)} disabled={mutation.isPending} /><Button type="submit" size="sm" disabled={!body.trim() || mutation.isPending}><Save className="size-4" />{mutation.isPending ? txt("Saving…", "กำลังบันทึก…") : t("Save")}</Button></form>{!notes.length && <p className="text-sm text-muted-foreground">{txt("No notes yet", "ยังไม่มีโน้ต")}</p>}{notes.map(n => <article key={n.id} className="border-t border-border py-3"><p className="break-words whitespace-pre-wrap text-sm">{n.body}</p><p className="mt-2 text-xs text-muted-foreground">{n.author} · {new Date(n.createdAt).toLocaleString(language === "th" ? "th-TH" : "en-GB", { timeZone: "Asia/Bangkok" })}</p></article>)}</div>;
}