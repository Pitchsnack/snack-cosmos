import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Users,
  Briefcase,
  Handshake,
  UserPlus,
  MapPin,
  Search,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
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
import { cn } from "@/lib/utils";
import { ContactsPage } from "./contacts.index";

export const Route = createFileRoute("/_authenticated/connections")({
  head: () => ({
    meta: [
      { title: "Connections — SnackPortal2" },
      {
        name: "description",
        content:
          "Manage your investors, master agents, and partner connections in SnackPortal2.",
      },
      { property: "og:title", content: "Connections — SnackPortal2" },
      {
        property: "og:description",
        content:
          "Relationship management dashboard for investors, master agents, and partners.",
      },
    ],
  }),
  component: ConnectionsTabsPage,
});

function ConnectionsTabsPage() {
  const [tab, setTab] = useState<"connections" | "contacts">("connections");
  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-1 rounded-xl bg-muted p-1">
        {([
          { key: "connections", label: "My Connections" },
          { key: "contacts", label: "My Contacts" },
        ] as const).map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-all",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tab === "connections" ? <ConnectionsPage /> : <ContactsPage />}
    </div>
  );
}

type ConnType = "Investor" | "Master Agent" | "Partner";
type ConnStatus = "Connected" | "Pending";

interface Connection {
  id: string;
  name: string;
  contact: string;
  initials: string;
  avatarTone: string;
  type: ConnType;
  location: string;
  about: string;
  status: ConnStatus;
  mutual: number;
}

const CONNECTIONS: Connection[] = [
  {
    id: "1",
    name: "GreenFuture Ventures",
    contact: "John Mitchell",
    initials: "GV",
    avatarTone: "bg-slate-800 text-white",
    type: "Investor",
    location: "San Francisco, CA",
    about: "Early-stage VC investing in climate technology and sustainability.",
    status: "Connected",
    mutual: 12,
  },
  {
    id: "2",
    name: "Impact Network",
    contact: "Sarah Chen",
    initials: "IN",
    avatarTone: "bg-violet-200 text-violet-900",
    type: "Master Agent",
    location: "New York, NY",
    about: "Global network of investors backing impact-driven startups.",
    status: "Connected",
    mutual: 8,
  },
  {
    id: "3",
    name: "AgriFuture Capital",
    contact: "David Lee",
    initials: "AG",
    avatarTone: "bg-emerald-700 text-white",
    type: "Partner",
    location: "Chicago, IL",
    about: "Strategic partners for agriculture tech and food systems.",
    status: "Connected",
    mutual: 15,
  },
  {
    id: "4",
    name: "Blue Horizon Ventures",
    contact: "Michael Brown",
    initials: "BV",
    avatarTone: "bg-slate-700 text-white",
    type: "Investor",
    location: "Austin, TX",
    about: "Growth equity firm focused on enterprise SaaS companies.",
    status: "Pending",
    mutual: 5,
  },
  {
    id: "5",
    name: "Sustainable Growth Fund",
    contact: "Emily Davis",
    initials: "SC",
    avatarTone: "bg-pink-200 text-pink-900",
    type: "Investor",
    location: "Boston, MA",
    about: "Backing scalable solutions for a sustainable future.",
    status: "Pending",
    mutual: 3,
  },
  {
    id: "6",
    name: "TechAlpha Partners",
    contact: "Robert Kim",
    initials: "TA",
    avatarTone: "bg-teal-700 text-white",
    type: "Partner",
    location: "Seattle, WA",
    about: "Advisory and go-to-market partner for deep tech startups.",
    status: "Connected",
    mutual: 7,
  },
  {
    id: "7",
    name: "NextFrontier Capital",
    contact: "Lisa Patel",
    initials: "NF",
    avatarTone: "bg-purple-300 text-purple-900",
    type: "Investor",
    location: "Miami, FL",
    about: "Investing in frontier technologies and emerging markets.",
    status: "Pending",
    mutual: 4,
  },
  {
    id: "8",
    name: "Nordic Angel Collective",
    contact: "Anna Lindqvist",
    initials: "NA",
    avatarTone: "bg-sky-200 text-sky-900",
    type: "Master Agent",
    location: "Stockholm, SE",
    about: "Angel syndicate connecting Nordic founders with global capital.",
    status: "Connected",
    mutual: 9,
  },
];

type TabKey = "All" | "Investors" | "Master Agents" | "Partners" | "Pending";
const TABS: TabKey[] = ["All", "Investors", "Master Agents", "Partners", "Pending"];

function typeBadgeClass(type: ConnType) {
  switch (type) {
    case "Investor":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Master Agent":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "Partner":
      return "bg-orange-50 text-orange-700 border-orange-200";
  }
}

function statusBadgeClass(status: ConnStatus) {
  return status === "Connected"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-amber-50 text-amber-700 border-amber-200";
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
          tone,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
      </div>
    </div>
  );
}

function ConnectionsPage() {
  const [tab, setTab] = useState<TabKey>("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("recent");
  const [pageSize, setPageSize] = useState("20");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CONNECTIONS.filter((c) => {
      if (tab === "Investors" && c.type !== "Investor") return false;
      if (tab === "Master Agents" && c.type !== "Master Agent") return false;
      if (tab === "Partners" && c.type !== "Partner") return false;
      if (tab === "Pending" && c.status !== "Pending") return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.contact.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        c.about.toLowerCase().includes(q)
      );
    });
  }, [tab, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Connections</h1>
        <p className="mt-1 text-sm text-muted-foreground">200 total connections</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={Users}
          label="Total Connections"
          value={200}
          tone="bg-violet-100 text-violet-600"
        />
        <SummaryCard
          icon={Briefcase}
          label="Investors"
          value={120}
          tone="bg-emerald-100 text-emerald-600"
        />
        <SummaryCard
          icon={Handshake}
          label="Master Agents"
          value={35}
          tone="bg-sky-100 text-sky-600"
        />
        <SummaryCard
          icon={UserPlus}
          label="Partners"
          value={45}
          tone="bg-orange-100 text-orange-600"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((t) => {
            const active = t === tab;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-card text-foreground hover:bg-muted/50",
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search connections..."
              className="h-9 w-64 pl-8"
            />
          </div>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Sort by: Recently Added</SelectItem>
              <SelectItem value="name">Sort by: Name</SelectItem>
              <SelectItem value="mutual">Sort by: Mutual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Connection</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>About</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Mutual</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  No connections match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id} className="hover:bg-muted/20">
                  <TableCell>
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
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.contact}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={typeBadgeClass(c.type)}>
                      {c.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {c.location}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-sm text-sm text-muted-foreground">
                    {c.about}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusBadgeClass(c.status)}>
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      {c.mutual}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {c.status === "Connected" ? (
                        <Button variant="outline" size="sm" className="h-8">
                          View profile
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 border-primary/40 text-primary hover:bg-primary/5 hover:text-primary"
                        >
                          Request referral
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Showing 1–{filtered.length} of 200</span>
            <Select value={pageSize} onValueChange={setPageSize}>
              <SelectTrigger className="h-8 w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span>rows per page</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 gap-1">
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            {[1, 2, 3].map((n) => (
              <Button
                key={n}
                variant={n === 1 ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-8 w-8 p-0",
                  n === 1 && "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {n}
              </Button>
            ))}
            <span className="px-1 text-sm text-muted-foreground">…</span>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
              10
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1">
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
