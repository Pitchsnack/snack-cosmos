import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Info, Link2, Lock, Mail, Phone, Search, X } from "lucide-react";
import { toast } from "sonner";
import { usePersona } from "@/hooks/use-marketplace";
import { listContacts, type ContactPerson } from "@/lib/contacts.functions";

export const Route = createFileRoute("/_authenticated/marketplace/my-contact")({
  head: () => ({
    meta: [
      { title: "Contacts — PitchSnack" },
      { name: "description", content: "Everyone you are working with on PitchSnack, with their contact details in one place." },
      { property: "og:title", content: "Contacts — PitchSnack" },
      { property: "og:description", content: "Everyone you are working with on PitchSnack, with their contact details in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactsPage,
});

const TILES = ["bg-amber-500", "bg-sky-600", "bg-emerald-600", "bg-rose-500", "bg-violet-600", "bg-slate-600"];
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
const tile = (n: string) => TILES[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % TILES.length];
const handle = (l: string | null) => (l ? "/in/" + l.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, "").replace(/\/$/, "") : null);
const liUrl = (l: string) => (l.startsWith("http") ? l : `https://linkedin.com/in/${l.replace(/^\/?in\//, "")}`);
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

function Avatar({ name, size }: { name: string; size: number }) {
  return (
    <div style={{ width: size, height: size }} className={`grid flex-none place-items-center rounded-[10px] text-sm font-bold text-white ${tile(name)}`}>
      {initials(name)}
    </div>
  );
}

function Cap({ children }: { children: React.ReactNode }) {
  return <div className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground/70">{children}</div>;
}

function ContactsPage() {
  const { persona } = usePersona();
  const fetchContacts = useServerFn(listContacts);
  const { data } = useQuery({ queryKey: ["contacts", persona], queryFn: () => fetchContacts({ data: { as: persona } }) });
  const [tab, setTab] = useState<"all" | "counterparty" | "advisor">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<ContactPerson | null>(null);
  const other = persona === "seller" ? "Buyers" : "Sellers";
  const contacts = data?.contacts ?? [];
  const counts = { all: contacts.length, counterparty: contacts.filter((c) => c.group === "counterparty").length, advisor: contacts.filter((c) => c.group === "advisor").length };
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return contacts.filter((c) => (tab === "all" || c.group === tab) && (!s || [c.name, c.company, c.email].some((v) => v?.toLowerCase().includes(s))));
  }, [contacts, tab, q]);
  const my = data?.my;
  const n = data?.visibleTo ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1120px] px-8 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
      <p className="mt-1 text-sm text-muted-foreground">Everyone you are working with on your {persona === "seller" ? "sale" : "deals"}. Their contact details in one place.</p>

      <div className="mt-5 mb-6 rounded-[14px] border bg-card px-5 pt-3.5 pb-4">
        <div className="flex items-center gap-2">
          <Cap>My contact card</Cap>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11.5px] text-emerald-700">
            <Lock className="h-3 w-3" /> Visible to {n} {n === 1 ? other.toLowerCase().slice(0, -1) : other.toLowerCase()}
          </span>
          <Link to="/my-page" className="ml-auto text-[12.5px] font-semibold text-blue-600 hover:underline">Edit</Link>
        </div>
        <div className="mt-3 grid items-end gap-6" style={{ gridTemplateColumns: "1.45fr 1fr 0.75fr 1fr" }}>
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={my?.name ?? "Me"} size={40} />
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-semibold" title={my?.name}>{my?.name ?? "…"}</div>
              <div className="truncate text-[12.5px] text-muted-foreground">{[my?.role, my?.company].filter(Boolean).join(" · ") || "—"}</div>
            </div>
          </div>
          {([["Email", my?.email], ["Phone", my?.phone], ["LinkedIn", handle(my?.linkedin ?? null)]] as const).map(([k, v]) => (
            <div key={k} className="min-w-0">
              <Cap>{k}</Cap>
              <div className="truncate text-[13.5px] font-semibold" title={v ?? ""}>{v || "—"}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-end justify-between gap-4 border-b">
        <div className="flex gap-5">
          {([["all", "All"], ["counterparty", other], ["advisor", "Advisors"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 text-sm font-medium ${tab === k ? "border-amber-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {label}
              <span className="rounded-full bg-muted px-1.5 text-[11.5px] text-muted-foreground">{counts[k]}</span>
            </button>
          ))}
        </div>
        <div className="relative mb-2 w-[260px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or company" className="h-[34px] w-full rounded-lg border bg-card pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>

      <div className="overflow-hidden rounded-[14px] border bg-card">
        <div className="grid gap-6 bg-muted/40 px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground/70" style={{ gridTemplateColumns: "1.4fr 1.15fr 0.8fr 0.85fr" }}>
          <div>Contact</div><div>Email</div><div>Phone</div><div>LinkedIn</div>
        </div>
        {shown.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">No contacts match.</div>
        ) : shown.map((c) => (
          <Row key={c.id} c={c} active={open?.id === c.id} onOpen={() => setOpen(c)} />
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
        <Info className="h-3.5 w-3.5" /> People are added here automatically when their NDA is approved in{" "}
        <Link to="/marketplace/pipeline" className="font-semibold text-foreground hover:underline">Pipeline</Link>.
      </p>

      {open && <InfoBox c={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Row({ c, active, onOpen }: { c: ContactPerson; active: boolean; onOpen: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const h = handle(c.linkedin);
  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      className={`relative grid cursor-pointer items-center gap-6 border-t border-border/60 px-5 py-4 outline-none first:border-t-0 focus-visible:bg-muted/40 ${active ? "bg-amber-50" : "hover:bg-muted/40"}`}
      style={{ gridTemplateColumns: "1.4fr 1.15fr 0.8fr 0.85fr" }}
    >
      {active && <span className="absolute inset-y-0 left-0 w-[3px] bg-amber-500" />}
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={c.name} size={38} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold" title={c.name}>{c.name}</div>
          <div className="truncate text-[12.5px] text-muted-foreground">{[c.role, c.company].filter(Boolean).join(" · ")}</div>
        </div>
      </div>
      <div className="min-w-0">{c.email ? <a href={`mailto:${c.email}`} onClick={stop} title={c.email} className="flex min-w-0 items-center gap-1.5 text-sm hover:underline"><Mail className="h-3.5 w-3.5 flex-none text-muted-foreground" /><span className="truncate">{c.email}</span></a> : "—"}</div>
      <div className="min-w-0">{c.phone ? <a href={`tel:${c.phone}`} onClick={stop} title={c.phone} className="flex min-w-0 items-center gap-1.5 text-sm hover:underline"><Phone className="h-3.5 w-3.5 flex-none text-muted-foreground" /><span className="truncate">{c.phone}</span></a> : "—"}</div>
      <div className="min-w-0">{h && c.linkedin ? <a href={liUrl(c.linkedin)} target="_blank" rel="noreferrer" onClick={stop} title={h} className="block truncate text-sm text-blue-600 hover:underline">{h}</a> : "—"}</div>
    </div>
  );
}

function InfoBox({ c, onClose }: { c: ContactPerson; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const copy = (v: string) => { navigator.clipboard?.writeText(v); toast(`Copied ${v}`); };
  const advisor = c.group === "advisor";
  const h = handle(c.linkedin);
  const line = (icon: React.ReactNode, v: string | null, label: string, canCopy = true) => (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[13.5px]" title={v ?? ""}>{v || "—"}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
      {canCopy && v && <button onClick={() => copy(v)} className="h-7 rounded-md border px-2.5 text-xs font-medium hover:bg-muted">Copy</button>}
    </div>
  );
  const kv = (k: string, v: React.ReactNode) => (
    <div className="flex py-1 text-[13.5px]"><span className="w-[110px] flex-none text-muted-foreground">{k}</span><span className="min-w-0 flex-1 truncate">{v || "—"}</span></div>
  );
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(17,24,39,.45)" }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={c.name} onClick={(e) => e.stopPropagation()} className="w-[480px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-2xl bg-card" style={{ maxHeight: "calc(100vh - 64px)", boxShadow: "0 30px 70px rgba(16,24,40,.28)" }}>
        <div className="flex items-start gap-3 p-5">
          <Avatar name={c.name} size={52} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold">{c.name}</div>
            <div className="truncate text-[12.5px] text-muted-foreground">{[c.role, c.company].filter(Boolean).join(" · ")}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="border-t px-5 py-3">
          <Cap>Contact</Cap>
          {line(<Mail className="h-4 w-4" />, c.email, "Email")}
          {line(<Phone className="h-4 w-4" />, c.phone, "Phone")}
          {line(<Link2 className="h-4 w-4" />, h ? `linkedin.com${h}` : null, "LinkedIn")}
          {line(<Clock className="h-4 w-4" />, c.bestTime, "Best time to reach", false)}
        </div>
        <div className="border-t px-5 py-3">
          <Cap>{advisor ? "Firm" : "Company"}</Cap>
          {kv("Name", c.company)}
          {kv("Type", c.companyType)}
          {kv("Location", c.location)}
          {kv("Website", c.website ? <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{c.website}</a> : null)}
        </div>
        <div className="border-t px-5 py-3 pb-5">
          <Cap>Connection</Cap>
          {kv("Connected", fmt(c.connectedAt))}
          {kv("How", advisor ? "Assigned by PitchSnack" : "NDA approved")}
          {!advisor && kv("Pipeline", <Link to="/marketplace/pipeline" className="text-blue-600 hover:underline">{c.pipelineStep} →</Link>)}
        </div>
      </div>
    </div>
  );
}
