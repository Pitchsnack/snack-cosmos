import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, Building2, Search, Mail, Phone, MapPin, Globe, Linkedin, Copy, StickyNote, Save, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listAdminContacts, listAdminContactNotes, addAdminContactNote, getAdminContactCards } from "@/lib/admin-contacts.functions";
import { filterAdminContacts, contactProfileStatus, contactActiveAge, CONTACT_STATUSES, type AdminContact } from "@/lib/admin-contacts";
import { useTranslation } from "@/i18n/language";
import { StandardListingCard } from "@/components/marketplace/standard-listing-card";
import { StandardInvestorCard } from "@/components/marketplace/standard-investor-card";
import { FirmCard } from "@/components/advisor/advisor-firm-card";
import { toast } from "sonner";

export const adminContactsQuery = queryOptions({ queryKey: ["admin-contacts"], queryFn: () => listAdminContacts(), staleTime: 30_000 });

export function ContactsPage() {
  const { data: contacts } = useSuspenseQuery(adminContactsQuery);
  const { language, t } = useTranslation();
  const txt = (en: string, th: string) => language === "th" ? th : en;
  const [role, setRole] = useState("all");
  const [type, setType] = useState("all");
  const scroll = useRef<HTMLDivElement>(null);
  const split = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [selectedId, setSelectedId] = useState<string | null>(contacts[0]?.id || null);
  const filtered = useMemo(() => filterAdminContacts(contacts, role, status, search, sort, type), [contacts, role, status, search, sort, type]);
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 0; }, [role, type, status, search, sort]);
  useEffect(() => {
    const el = split.current;
    if (!el) return;
    const resize = () => el.style.setProperty('--contacts-height', `${Math.max(360, window.innerHeight - el.getBoundingClientRect().top - 16)}px`);
    const observer = new ResizeObserver(resize); observer.observe(el); window.addEventListener('resize', resize); resize();
    return () => {observer.disconnect(); window.removeEventListener('resize', resize);};
  }, []);
  useEffect(() => { if (selectedId && !filtered.some(c => c.id === selectedId)) setSelectedId(filtered[0]?.id || null); }, [filtered, selectedId]);
  const selected = filtered.find(c => c.id === selectedId);
  const visible = filtered;
  const roles = ["all", "buyer", "seller", "advisor"];
  const roleName = (r: string) => r === "all" ? t("All") : t(r === "buyer" ? "Buyer" : r === "seller" ? "Seller" : "Advisor");
  const initials = (name: string) => name.split(/\s+/).slice(0, 2).map(n => n[0]).join("").toUpperCase();
  return <div className="admin-contacts space-y-5">
    <h1 className="text-2xl font-semibold">{txt("My Contacts", "ผู้ติดต่อของฉัน")}</h1>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {roles.map(r => <Button key={r} variant="outline" onClick={() => setRole(r)} aria-pressed={role === r} className="contact-tile h-auto justify-start gap-3 rounded-lg p-4 text-left">
        <Users className="size-5 shrink-0 text-primary" /><span className="min-w-0"><span className="block text-sm text-muted-foreground">{r === "all" ? txt("Total contacts", "ผู้ติดต่อทั้งหมด") : roleName(r)}</span><span className="block text-2xl font-semibold">{r === "all" ? contacts.length : contacts.filter(c => c.role === r).length}</span></span>
      </Button>)}
    </div>
    <div className="flex flex-wrap gap-2 border-b border-border pb-2" role="tablist" aria-label={txt("Contact roles", "ประเภทผู้ติดต่อ")}>
      {roles.map(r => <Button key={r} role="tab" aria-selected={role === r} className="contact-tab" variant={role === r ? "secondary" : "ghost"} onClick={() => setRole(r)}>{roleName(r)}</Button>)}
    </div>
        <div className="contact-filters flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label={txt("Search contacts", "ค้นหาผู้ติดต่อ")} placeholder={txt("Search name, company or email", "ค้นหาชื่อ บริษัท หรืออีเมล")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
          <Select value={type} onValueChange={setType}><SelectTrigger aria-label={txt("Contact type", "ประเภทผู้ติดต่อ")}><SelectValue /></SelectTrigger><SelectContent>{roles.map(r => <SelectItem key={r} value={r}>{r === 'all' ? txt('All types', 'ทุกประเภท') : roleName(r)}</SelectItem>)}</SelectContent></Select>
          <Select value={status} onValueChange={setStatus}><SelectTrigger aria-label={t("Status")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{txt("All statuses", "ทุกสถานะ")}</SelectItem>{CONTACT_STATUSES.map(s => <SelectItem key={s} value={s}>{statusText(s, language)}</SelectItem>)}</SelectContent></Select>
          <Select value={sort} onValueChange={setSort}><SelectTrigger aria-label={txt("Sort contacts", "เรียงผู้ติดต่อ")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="recent">{txt("Newest joined", "สมัครล่าสุด")}</SelectItem><SelectItem value="active">{txt("Last active", "ใช้งานล่าสุด")}</SelectItem><SelectItem value="name">{txt("Name A–Z", "ชื่อ A–Z")}</SelectItem><SelectItem value="company">{t("Company")}</SelectItem></SelectContent></Select>
        </div>
    <div ref={split} className="contact-split">
      <section className="min-w-0 space-y-3" aria-label={txt("Contact list", "รายชื่อผู้ติดต่อ")}>

        <div ref={scroll} className="contact-table-scroll" aria-label={txt('Scrollable contacts', 'รายชื่อผู้ติดต่อแบบเลื่อน')}>
          <div className="contact-table" role="table">
            <div className="contact-table-head contact-columns" role="row">{['Contact','Company','Role','Status','Connections','Last active'].map(label => <span role="columnheader" key={label}>{txt(label, ({Contact:'ผู้ติดต่อ',Company:'บริษัท',Role:'บทบาท',Status:'สถานะ',Connections:'การเชื่อมต่อ','Last active':'ใช้งานล่าสุด'} as Record<string,string>)[label])}</span>)}</div>
            {!visible.length && <p className="p-10 text-center text-sm text-muted-foreground">{txt("No contacts match", "ไม่พบผู้ติดต่อที่ตรงกัน")}</p>}
            {visible.map(c => {const st = contactProfileStatus(c); const age = contactActiveAge(c.lastActive); return <Button key={c.id} variant="unstyled" size="unstyled" onClick={() => setSelectedId(c.id)} aria-pressed={selectedId === c.id} className="contact-row contact-columns">
              <span className="flex min-w-0 items-center gap-3"><span className="contact-avatar">{initials(c.name)}</span><span className="min-w-0"><span className="block break-words font-medium">{c.name}</span>{c.title && <span className="block text-xs text-muted-foreground">{c.title}</span>}</span></span>
              <span className="min-w-0"><span className="block break-words">{c.organisations.map(o => o.name).join(' · ') || '—'}</span><span className="block text-xs text-muted-foreground">{c.organisations.map(o => o.ref).filter(Boolean).join(' · ')}</span></span>
              <span><span className={`contact-role contact-role-${c.role}`}>{roleName(c.role)}</span></span>
              <span className={`contact-status ${['Live','Verified'].includes(st) ? 'contact-live' : ['In review','Checking'].includes(st) ? 'contact-checking' : ''}`}><i />{statusText(st, language)}</span>
              <span className="whitespace-nowrap">{c.connections && c.role !== 'advisor' ? txt(`${c.connections} ${c.role === 'seller' ? c.connections === 1 ? 'buyer' : 'buyers' : c.connections === 1 ? 'seller' : 'sellers'}`, `${c.role === 'seller' ? 'ผู้ซื้อ' : 'ผู้ขาย'} ${c.connections} ราย`) : '—'}</span>
              <span className="whitespace-nowrap">{!age ? '—' : age.unit === 'today' ? txt('Today','วันนี้') : age.unit === 'yesterday' ? txt('Yesterday','เมื่อวาน') : txt(`${age.n} ${age.unit === 'weeks' && age.n === 1 ? 'week' : age.unit === 'months' && age.n === 1 ? 'month' : age.unit} ago`, `${age.n} ${age.unit === 'days' ? 'วัน' : age.unit === 'weeks' ? 'สัปดาห์' : 'เดือน'}ที่แล้ว`)}</span>
            </Button>;})}
          </div>
        </div>
      </section>
      <section className="contact-panel min-w-0 rounded-lg border border-border bg-card p-5" aria-label={txt("Contact details", "รายละเอียดผู้ติดต่อ")}>
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
    <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h2 className="break-words text-lg font-semibold">{c.name}</h2><div className="contact-role-line"><span className="text-sm text-muted-foreground">{t(c.role === 'buyer' ? 'Buyer' : c.role === 'seller' ? 'Seller' : 'Advisor')}</span><Badge variant="outline">{t(c.status)}</Badge><Button className="contact-more-info" variant="outline" asChild><Link to="/users" search={{edit:c.id}}><ExternalLink className="size-3.5" />{txt('More info','ข้อมูลเพิ่มเติม')}</Link></Button></div>{c.title && <p className="text-sm text-muted-foreground">{c.title}</p>}</div><Button variant="ghost" size="icon" aria-label={t("Close")} onClick={onClose}><X className="size-4" /></Button></div>
    <div className="space-y-3 border-t border-border pt-4">{info.map(({ icon: Icon, label, value }) => <div key={label} className="flex items-start gap-2 text-sm"><Icon className="mt-1 size-4 shrink-0 text-muted-foreground" /><span className="w-20 shrink-0 text-muted-foreground">{label}</span><span className="min-w-0 flex-1 break-all">{value || "—"}</span>{value && <Button size="icon" variant="ghost" className="size-7 shrink-0" title={`${t("Copy")} ${label}`} aria-label={`${t("Copy")} ${label}`} onClick={() => copy(value)}><Copy className="size-3.5" /></Button>}</div>)}<p className="text-xs text-muted-foreground">{txt("Joined", "สมัครเมื่อ")} · {date(c.joined)}</p></div>
    <div className="space-y-3 border-t border-border pt-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><Building2 className="size-4" />{txt("Companies & profiles", "บริษัทและโปรไฟล์")}</h3>{c.organisations.length ? <Suspense fallback={<p>{t('Loading…')}</p>}><ContactCompanyCards contactId={c.id} /></Suspense> : <p className="text-sm text-muted-foreground">{txt("No company yet.", "ยังไม่มีบริษัท")}</p>}</div>
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
  return <div className="space-y-3 border-t border-border pt-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><StickyNote className="size-4" />{txt("Admin-only notes", "โน้ตสำหรับผู้ดูแลระบบเท่านั้น")}</h3><form className="space-y-2" onSubmit={e => { e.preventDefault(); if (body.trim()) mutation.mutate(); }}><Textarea className="contact-note-input" aria-label={txt("Add note", "เพิ่มโน้ต")} placeholder={txt("Add note…", "เพิ่มโน้ต…")} maxLength={4000} value={body} onChange={e => setBody(e.target.value)} disabled={mutation.isPending} /><Button className="contact-note-save" type="submit" size="sm" disabled={!body.trim() || mutation.isPending}><Save className="size-4" />{mutation.isPending ? txt("Saving…", "กำลังบันทึก…") : t("Save")}</Button></form>{!notes.length && <p className="text-sm text-muted-foreground">{txt("No notes yet", "ยังไม่มีโน้ต")}</p>}{notes.map(n => <article key={n.id} className="border-t border-border py-3"><p className="contact-note-body break-words whitespace-pre-wrap">{n.body}</p><p className="contact-note-meta mt-2 text-muted-foreground">{n.author} · {new Date(n.createdAt).toLocaleString(language === "th" ? "th-TH" : "en-GB", { timeZone: "Asia/Bangkok" })}</p></article>)}</div>;
}
function statusText(s: string, language: string) {
  return language === 'th' ? ({Live:'เผยแพร่แล้ว', 'In review':'กำลังตรวจสอบ', Draft:'ฉบับร่าง', Verified:'ยืนยันแล้ว', Checking:'กำลังตรวจสอบ', 'No profile yet':'ยังไม่มีโปรไฟล์'} as Record<string,string>)[s] || s : s;
}
function ContactCompanyCards({contactId}: {contactId:string}) {
  const fn = useServerFn(getAdminContactCards);
  const {data: cards} = useSuspenseQuery({queryKey:['admin-contact-cards',contactId], queryFn: () => fn({data:{contactId}}), staleTime: 30000});
  return <div className="contact-company-cards space-y-3">{cards.map(c => c.kind === 'seller' ? <StandardListingCard key={c.id} l={c.listing} deal={c.deal} privateData={c.privateData} hideStatus /> : c.kind === 'buyer' ? <StandardInvestorCard key={c.id} i={c.card} privateData={c.privateData} exactFigures={c.exactFigures} hideStatus /> : c.firm ? <FirmCard key={c.id} f={c.firm} noStatus /> : null)}</div>;
}
