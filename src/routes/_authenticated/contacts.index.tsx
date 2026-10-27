import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  Building2,
  User as UserIcon,
  List as ListIcon,
  Search,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Mail,
  Phone,
  MapPin,
  Tag as TagIcon,
  Link2,
  Calendar,
  Copy,
  X,
  Sparkles,
  PenSquare,
  StickyNote,
  Clock,
  Bell,
  TrendingUp,
  Filter,
  Check,
  ScanLine,

} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUserContacts, listPlatformContacts, updateUserContact, type UserContact, type PlatformMember } from "@/lib/user-contacts.functions";
import { AddContactDialog } from "@/components/contacts/add-contact-dialog";

export const Route = createFileRoute("/_authenticated/contacts/")({
  head: () => ({
    meta: [
      { title: "Contacts — SnackPortal2" },
      {
        name: "description",
        content:
          "Manage PitchSnack connections, personal contacts, lists, and AI-assisted outreach in SnackPortal2.",
      },
      { property: "og:title", content: "Contacts — SnackPortal2" },
      {
        property: "og:description",
        content:
          "Lightweight contact management for communication, notes, and follow-ups.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactsPage,
});

type ContactSource =
  | "PitchSnack Connection"
  | "My Contact"
  | "Imported"
  | "Referral"
  | "Introduction"
  | "Name Card";
type ContactStatus = "Active" | "Warm" | "Cold" | "Follow-Up Due" | "Do Not Contact";
type ContactType = "PitchSnack Connection" | "My Contact";

interface Contact {
  id: string;
  name: string;
  role: string;
  initials: string;
  avatarTone: string;
  company: string;
  companyInitial: string;
  companyTone: string;
  type: ContactType;
  status: ContactStatus;
  lastContact: string;
  email: string;
  phone: string;
  location: string;
  source: ContactSource;
  connectedDate: string;
  tags: string[];
  note: {
    text: string;
    author: string;
    date: string;
  };
  lastActivity: { when: string; subject: string };
  nextAction: { title: string; date: string };
  connectionId?: string;
  memberRole?: "Seller" | "Buyer" | "Advisor";
}

function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
}
function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
}
function toContact(u: UserContact): Contact {
  return {
    id: u.id,
    name: u.fullName,
    role: [u.position, u.department].filter(Boolean).join(" · "),
    initials: initialsOf(u.fullName),
    avatarTone: "bg-muted text-foreground",
    company: u.company ?? "—",
    companyInitial: (u.company ?? "?")[0]!.toUpperCase(),
    companyTone: "bg-muted text-muted-foreground",
    type: u.contactType,
    status: u.status,
    lastContact: u.lastContactedAt ? fmtDate(u.lastContactedAt) : "—",
    email: u.email ?? "—",
    phone: u.phone ?? "—",
    location: u.location ?? "—",
    source: u.source as ContactSource,
    connectedDate: fmtDate(u.createdAt),
    tags: u.tags,
    note: { text: u.notes ?? "", author: "You", date: fmtDate(u.updatedAt) },
    lastActivity: { when: u.lastContactedAt ? fmtDate(u.lastContactedAt) : "No activity yet", subject: "—" },
    nextAction: { title: u.nextAction ?? "None set", date: u.nextActionAt ? fmtDate(u.nextActionAt) : "—" },
  };
}

function memberToContact(m: PlatformMember): Contact {
  return {
    id: `m:${m.id}`, name: m.fullName, role: m.memberRole, initials: initialsOf(m.fullName),
    avatarTone: "bg-muted text-foreground", company: m.company ?? "—",
    companyInitial: (m.company ?? "?")[0]!.toUpperCase(), companyTone: "bg-muted text-muted-foreground",
    type: "PitchSnack Connection", status: m.status === "Suspended" || m.status === "Locked" ? "Do Not Contact" : "Active",
    lastContact: "—", email: m.email ?? "—", phone: "—", location: m.location || "—",
    source: "PitchSnack Connection", connectedDate: fmtDate(m.joinedAt), tags: [m.memberRole],
    note: { text: "", author: "", date: "—" }, lastActivity: { when: "No activity yet", subject: "—" },
    nextAction: { title: "None set", date: "—" }, memberRole: m.memberRole,
  };
}
const ROLE_PILLS = ["All", "Sellers", "Buyers", "Advisors", "External"] as const;
type RolePill = (typeof ROLE_PILLS)[number];

const TABS = ["All", "PitchSnack Connections", "My Contacts", "Lists"] as const;
type TabKey = (typeof TABS)[number];

function statusBadgeClass(status: ContactStatus) {
  switch (status) {
    case "Active":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Warm":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Cold":
      return "bg-slate-100 text-slate-600 border-slate-200";
    case "Follow-Up Due":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "Do Not Contact":
      return "bg-rose-50 text-rose-700 border-rose-200";
  }
}

function typeBadgeClass(type: ContactType) {
  return type === "PitchSnack Connection"
    ? "bg-orange-50 text-orange-700 border-orange-200"
    : "bg-blue-50 text-blue-700 border-blue-200";
}

function statusDot(status: ContactStatus) {
  switch (status) {
    case "Active":
      return "bg-emerald-500";
    case "Warm":
      return "bg-amber-500";
    case "Cold":
      return "bg-slate-400";
    case "Follow-Up Due":
      return "bg-orange-500";
    case "Do Not Contact":
      return "bg-rose-500";
  }
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  delta,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  delta?: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
        </div>
      </div>
    </div>
  );
}

export function ContactsPage() {
  const [tab, setTab] = useState<TabKey>("All");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [sort, setSort] = useState("recent");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fetchContacts = useServerFn(listUserContacts);
  const { data: rows, isLoading } = useQuery({ queryKey: ["user-contacts"], queryFn: () => fetchContacts() });
  const fetchMembers = useServerFn(listPlatformContacts);
  const { data: members } = useQuery({ queryKey: ["platform-contacts"], queryFn: () => fetchMembers() });
  const [rolePill, setRolePill] = useState<RolePill>("All");
  const CONTACTS = useMemo(
    () => [...(members ?? []).map(memberToContact), ...(rows ?? []).map(toContact)],
    [rows, members],
  );
  const qc = useQueryClient();
  const updateFn = useServerFn(updateUserContact);
  const setDnc = useMutation({
    mutationFn: (id: string) => updateFn({ data: { id, status: "Do Not Contact" } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["user-contacts"] }); toast.success("Marked Do Not Contact"); },
    onError: () => toast.error("Could not update contact"),
  });
  const counts = {
    total: CONTACTS.length,
    ps: CONTACTS.filter((c) => c.type === "PitchSnack Connection").length,
    mine: CONTACTS.filter((c) => c.type === "My Contact").length,
  };
  const [copied, setCopied] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CONTACTS.filter((c) => {
      if (tab === "PitchSnack Connections" && c.type !== "PitchSnack Connection") return false;
      if (tab === "My Contacts" && c.type !== "My Contact") return false;
      if (tab === "Lists") return false;
      if (rolePill === "External" && c.memberRole) return false;
      if (rolePill !== "All" && rolePill !== "External" && c.memberRole !== rolePill.slice(0, -1)) return false;
      if (type !== "all" && c.type !== type) return false;
      if (status !== "all" && c.status !== status) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [CONTACTS, tab, search, type, status, rolePill]);

  const selected = useMemo(
    () => CONTACTS.find((c) => c.id === selectedId) ?? null,
    [CONTACTS, selectedId],
  );

  const copy = (label: string, value: string) => {
    void navigator.clipboard?.writeText(value).catch(() => {});
    setCopied(label);
    toast.success(`${label} copied`);
    setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Contacts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your network and relationships.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/contacts/quick-add">
              <ScanLine className="mr-1 h-4 w-4" />
              &nbsp;Add Name Card
            </Link>
          </Button>
          <div className="flex">
            <Button className="rounded-r-none" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Add Contact
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="rounded-l-none border-l border-primary-foreground/20 px-2">
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/contacts/quick-add">Quick Add (scan business card)</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setAddOpen(true)}>Add contact manually</DropdownMenuItem>
                <DropdownMenuItem>Import contacts</DropdownMenuItem>
                <DropdownMenuItem>Create contact list</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={Users} label="Total Contacts" value={String(counts.total)} />
        <SummaryCard icon={Building2} label="PitchSnack Connections" value={String(counts.ps)} />
        <SummaryCard icon={UserIcon} label="My Contacts" value={String(counts.mine)} />
        <SummaryCard icon={ListIcon} label="Lists" value="0" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-border">
        {TABS.map((t) => {
          const active = t === tab;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "-mb-px border-b-2 px-1 py-2.5 text-sm transition-colors",
                active
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          );
        })}
      </div>

      {/* Split layout */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Left: filters + list */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts..."
                className="h-9 w-56 pl-8"
              />
            </div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="PitchSnack Connection">PitchSnack</SelectItem>
                <SelectItem value="My Contact">My Contact</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Warm">Warm</SelectItem>
                <SelectItem value="Cold">Cold</SelectItem>
                <SelectItem value="Follow-Up Due">Follow-Up Due</SelectItem>
                <SelectItem value="Do Not Contact">Do Not Contact</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              More Filters
            </Button>
            <div className="ml-auto">
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="h-9 w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Sort: Recently Updated</SelectItem>
                  <SelectItem value="name">Sort: Name</SelectItem>
                  <SelectItem value="company">Sort: Company</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {ROLE_PILLS.map((r) => (
              <Button key={r} size="sm" variant={rolePill === r ? "default" : "outline"} className="h-7 rounded-full px-3 text-xs" onClick={() => setRolePill(r)}>
                {r}
              </Button>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm">
            {tab === "Lists" ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                <ListIcon className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
                <div className="font-medium text-foreground">No lists yet</div>
                <div>Create a list to group contacts for outreach.</div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>Contact</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Contact</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-12 text-center text-sm text-muted-foreground"
                      >
                        {isLoading
                          ? "Loading contacts…"
                          : search
                          ? "No contacts match your search"
                          : "No contacts yet — add your first contact"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((c) => {
                      const isSel = c.id === selectedId;
                      return (
                        <TableRow
                          key={c.id}
                          onClick={() => setSelectedId(c.id)}
                          className={cn(
                            "relative cursor-pointer",
                            isSel
                              ? "bg-orange-50/60 hover:bg-orange-50/80"
                              : "hover:bg-muted/30",
                          )}
                        >
                          <TableCell className="relative">
                            {isSel && (
                              <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" />
                            )}
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                                  c.avatarTone,
                                )}
                              >
                                {c.initials}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium leading-tight">{c.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {c.role}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className={cn(
                                  "flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-semibold",
                                  c.companyTone,
                                )}
                              >
                                {c.companyInitial}
                              </div>
                              <span className="text-sm">{c.company}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={typeBadgeClass(c.type)}>
                              {c.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "gap-1.5 font-normal",
                                statusBadgeClass(c.status),
                              )}
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  statusDot(c.status),
                                )}
                              />
                              {c.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {c.lastContact}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>View details</DropdownMenuItem>
                                <DropdownMenuItem>Draft email</DropdownMenuItem>
                                <DropdownMenuItem>Add to list</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-rose-600" disabled={!!c.memberRole} onSelect={() => setDnc.mutate(c.id)}>
                                  Mark Do Not Contact
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
              <div className="text-sm text-muted-foreground">
                Showing {filtered.length} of {CONTACTS.length}
              </div>

            </div>
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          {!selected ? (
            <div className="flex h-64 flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <UserIcon className="mb-2 h-6 w-6 text-muted-foreground/60" />
              <div className="font-medium text-foreground">Select a contact</div>
              <div>Choose a contact to view details and outreach history.</div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-semibold",
                    selected.avatarTone,
                  )}
                >
                  {selected.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold leading-tight">
                    {selected.name}
                  </div>
                  <div className="text-sm text-muted-foreground">{selected.role}</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold",
                        selected.companyTone,
                      )}
                    >
                      {selected.companyInitial}
                    </div>
                    <span className="text-sm font-medium">{selected.company}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSelectedId(null)}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 border-primary/40 text-primary hover:bg-primary/5 hover:text-primary"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      AI Assist
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem>Draft introduction email</DropdownMenuItem>
                    <DropdownMenuItem>Draft cold email</DropdownMenuItem>
                    <DropdownMenuItem>Draft follow-up</DropdownMenuItem>
                    <DropdownMenuItem>Draft reply</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Summarise contact history</DropdownMenuItem>
                    <DropdownMenuItem>Recommend next action</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5"
                  disabled={selected.status === "Do Not Contact"}
                  title={
                    selected.status === "Do Not Contact"
                      ? "Contact is marked Do Not Contact"
                      : undefined
                  }
                >
                  <PenSquare className="h-3.5 w-3.5" />
                  Draft Email
                </Button>
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  <StickyNote className="h-3.5 w-3.5" />
                  Add Note
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Log activity</DropdownMenuItem>
                    <DropdownMenuItem>Add to list</DropdownMenuItem>
                    <DropdownMenuItem>Share contact</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-rose-600" disabled={!!selected.memberRole} onSelect={() => setDnc.mutate(selected.id)}>
                      Mark Do Not Contact
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Info */}
              <div className="space-y-2.5 text-sm">
                <InfoRow
                  icon={Mail}
                  label="Email"
                  value={selected.email}
                  onCopy={() => copy("Email", selected.email)}
                  copied={copied === "Email"}
                />
                <InfoRow
                  icon={Phone}
                  label="Phone"
                  value={selected.phone}
                  onCopy={() => copy("Phone", selected.phone)}
                  copied={copied === "Phone"}
                />
                <InfoRow icon={MapPin} label="Location" value={selected.location} />
                <div className="flex items-center gap-3">
                  <div className="flex w-24 items-center gap-2 text-muted-foreground">
                    <Link2 className="h-3.5 w-3.5" />
                    <span>Source</span>
                  </div>
                  <div className="flex flex-1 items-center gap-2">
                    <Badge
                      variant="outline"
                      className="bg-orange-50 text-orange-700 border-orange-200 font-normal"
                    >
                      {selected.source}
                    </Badge>
                    {selected.connectionId && (
                      <Link
                        to="/connections"
                        className="text-xs text-primary underline-offset-2 hover:underline"
                      >
                        View connection
                      </Link>
                    )}
                  </div>
                </div>
                <InfoRow icon={Calendar} label="Connected" value={selected.connectedDate} />
                <div className="flex items-start gap-3">
                  <div className="flex w-24 items-center gap-2 pt-1 text-muted-foreground">
                    <TagIcon className="h-3.5 w-3.5" />
                    <span>Tags</span>
                  </div>
                  <div className="flex flex-1 flex-wrap items-center gap-1.5">
                    {selected.tags.map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="bg-muted/60 font-normal text-foreground/80"
                      >
                        {t}
                      </Badge>
                    ))}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-6 w-6 rounded-full"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                    Notes
                  </div>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                  >
                    View all
                  </button>
                </div>
                {selected.note.text ? (<div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="line-clamp-3 text-sm text-foreground/90">
                    {selected.note.text}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Added by {selected.note.author} · {selected.note.date}
                    </span>
                    <button
                      type="button"
                      className="rounded p-0.5 hover:bg-muted"
                      aria-label="Note actions"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>) : (<div className="text-sm text-muted-foreground">No notes yet.</div>)}
              </div>

              {/* Last contact + Next action */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Last Contact
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    {selected.lastActivity.when}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Re: {selected.lastActivity.subject}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7 w-full text-xs"
                  >
                    View History
                  </Button>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Bell className="h-3.5 w-3.5" />
                    Next Action
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    {selected.nextAction.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selected.nextAction.date}
                  </div>
                  <Button
                    size="sm"
                    className="mt-2 h-7 w-full bg-orange-100 text-xs text-orange-700 hover:bg-orange-200"
                  >
                    Set Reminder
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <AddContactDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  onCopy,
  copied,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex w-24 items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className="flex flex-1 items-center justify-between gap-2">
        <span className="truncate text-foreground/90">{value}</span>
        {onCopy && (
          <button
            type="button"
            onClick={onCopy}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Copy ${label.toLowerCase()}`}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
