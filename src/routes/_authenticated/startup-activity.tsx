import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Eye,
  Users,
  Star,
  Mail,
  Download,
  Calendar,
  ChevronRight,
  FileText,
  MessageSquare,
  UserPlus,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/startup-activity")({
  head: () => ({
    meta: [
      { title: "Startup Activity — SnackPortal2" },
      { name: "description", content: "Track investor engagement and plan your next moves." },
      { property: "og:title", content: "Startup Activity — SnackPortal2" },
      { property: "og:description", content: "Track investor engagement and plan your next moves." },
    ],
  }),
  component: StartupActivityPage,
});

type Interest = "High" | "Medium" | "Low";
type Fit = "Excellent" | "Very Good" | "Good" | "Review";

const RECENT_VIEWERS = [
  { name: "Daniel Lee", role: "Partner", org: "Sequoia Capital", type: "VC", date: "May 31, 2025", time: "10:24 AM", interest: "High" as Interest, lastContact: "May 28, 2025", action: "Re-contact", reason: "Share traction update" },
  { name: "Sarah Chen", role: "Principal", org: "Andreessen Horowitz", type: "VC", date: "May 30, 2025", time: "4:15 PM", interest: "High" as Interest, lastContact: "May 27, 2025", action: "Re-contact", reason: "Request intro" },
  { name: "Michael Patel", role: "Partner", org: "Foundation Capital", type: "VC", date: "May 28, 2025", time: "11:03 AM", interest: "Medium" as Interest, lastContact: "May 20, 2025", action: "Send update", reason: "Share product progress" },
  { name: "Jessica Kim", role: "Investor", org: "Tiger Global", type: "VC", date: "May 27, 2025", time: "2:41 PM", interest: "Medium" as Interest, lastContact: "May 21, 2025", action: "Re-contact", reason: "Answer open questions" },
  { name: "Robert Wilson", role: "Partner", org: "Bessemer Venture Partners", type: "VC", date: "May 26, 2025", time: "9:12 AM", interest: "High" as Interest, lastContact: "May 25, 2025", action: "Re-contact", reason: "Follow up on fit" },
];

const FOLLOW_UPS = [
  { name: "Daniel Lee", org: "Sequoia Capital", interest: "High" as Interest, lastContact: "May 28, 2025", reason: "High intent on key sections", action: "Re-contact" },
  { name: "Sarah Chen", org: "Andreessen Horowitz", interest: "High" as Interest, lastContact: "May 27, 2025", reason: "Viewed deck & traction", action: "Re-contact" },
  { name: "Robert Wilson", org: "Bessemer Venture Partners", interest: "High" as Interest, lastContact: "May 25, 2025", reason: "Strong fit, waiting on intro", action: "Re-contact" },
  { name: "Michael Patel", org: "Foundation Capital", interest: "Medium" as Interest, lastContact: "May 20, 2025", reason: "Viewed overview & traction", action: "Send update" },
  { name: "Jessica Kim", org: "Tiger Global", interest: "Medium" as Interest, lastContact: "May 21, 2025", reason: "Interested in product", action: "Re-contact" },
];

const NEXT_STEPS = [
  { icon: TrendingUp, title: "Re-contact 4 high-interest investors", desc: "They viewed key sections and haven't heard from you recently." },
  { icon: Sparkles, title: "Share a traction update", desc: "Your last update was over 7 days ago for 6 investors." },
  { icon: UserPlus, title: "Request warm introductions", desc: "Ask 3 investors for intros to relevant funds." },
  { icon: FileText, title: "Complete your profile", desc: "Add financials and roadmap to increase credibility." },
];

const TOP_INVESTORS = [
  { rank: 1, name: "Daniel Lee", org: "Sequoia Capital", interest: "High" as Interest, fit: "Excellent" as Fit },
  { rank: 2, name: "Sarah Chen", org: "Andreessen Horowitz", interest: "High" as Interest, fit: "Excellent" as Fit },
  { rank: 3, name: "Robert Wilson", org: "Bessemer Venture Partners", interest: "High" as Interest, fit: "Very Good" as Fit },
  { rank: 4, name: "Jessica Kim", org: "Tiger Global", interest: "Medium" as Interest, fit: "Very Good" as Fit },
  { rank: 5, name: "Michael Patel", org: "Foundation Capital", interest: "Medium" as Interest, fit: "Good" as Fit },
];

const RECENT_ACTIVITY = [
  { icon: Eye, text: "Sequoia Capital viewed your profile", detail: "Viewed key sections: Overview, Traction, Team", when: "Today, 10:24 AM" },
  { icon: Mail, text: "Email opened by Andreessen Horowitz", detail: "Subject: Follow-up on AppMan", when: "Yesterday, 4:15 PM" },
  { icon: Users, text: "Tiger Global viewed your pitch deck", detail: "Deck viewed in full", when: "May 27, 2:41 PM" },
  { icon: MessageSquare, text: "Note added about Bessemer Venture Partners", detail: "Strong interest in product roadmap", when: "May 26, 9:12 AM" },
  { icon: CheckCircle2, text: "Follow-up task completed", detail: "Sent traction update to Foundation Capital", when: "May 25, 5:30 PM" },
];

function InterestBadge({ level }: { level: Interest }) {
  const styles = {
    High: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Medium: "bg-amber-50 text-amber-700 border-amber-200",
    Low: "bg-slate-50 text-slate-600 border-slate-200",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", styles[level])}>
      {level}
    </span>
  );
}

function FitBadge({ fit }: { fit: Fit }) {
  const styles = {
    Excellent: "bg-emerald-50 text-emerald-700 border-emerald-200",
    "Very Good": "bg-blue-50 text-blue-700 border-blue-200",
    Good: "bg-slate-50 text-slate-600 border-slate-200",
    Review: "bg-orange-50 text-orange-700 border-orange-200",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", styles[fit])}>
      {fit}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").slice(0, 2).map((p) => p[0]).join("");
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 to-orange-200 text-[10px] font-semibold text-orange-700">
      {initials}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  delta,
  desc,
  linkText,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
  delta?: string;
  desc: string;
  linkText?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div className="mt-1 text-3xl font-semibold text-slate-900">{value}</div>
          {delta && (
            <div className="mt-1 text-xs text-emerald-600">
              <span className="font-semibold">{delta}</span> <span className="text-slate-500">vs Apr 1 – Apr 30, 2025</span>
            </div>
          )}
          <div className="mt-2 text-xs text-slate-500">{desc}</div>
          {linkText && (
            <button className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:underline">
              {linkText} <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StartupActivityPage() {
  const [selectedViewer, setSelectedViewer] = useState<typeof RECENT_VIEWERS[number] | null>(null);

  return (
    <div className="-mx-8 -my-10 min-h-screen bg-white px-8 py-10">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Startup Activity</h1>
          <p className="mt-1 text-sm text-slate-500">Track investor engagement and plan your next moves.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            <Download className="h-4 w-4" /> Export
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            May 1 – May 31, 2025 <Calendar className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={Eye} label="Total Profile Views" value="128" delta="+24%" desc="Investors who viewed your profile this period" />
        <SummaryCard icon={Users} label="Unique Viewers" value="56" delta="+18%" desc="Distinct investors who viewed your profile" />
        <SummaryCard icon={Star} label="Active Investor Interest" value="23" desc="Investors showing high or medium interest" linkText="View interested investors" />
        <SummaryCard icon={Mail} label="Pending Follow-ups" value="11" desc="Investors to re-contact in the next 7 days" linkText="View follow-up list" />
      </div>

      {/* Recent Viewers + High-Priority Follow-ups */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Recent Profile Viewers */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Recent Profile Viewers</h2>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-3 font-medium">Viewer</th>
                  <th className="pb-2 pr-3 font-medium">Company</th>
                  <th className="pb-2 pr-3 font-medium">Type</th>
                  <th className="pb-2 pr-3 font-medium">Date Viewed</th>
                  <th className="pb-2 pr-3 font-medium">Interest</th>
                  <th className="pb-2 pr-3 font-medium">Last Contact</th>
                  <th className="pb-2 font-medium">Next Action</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_VIEWERS.map((v) => (
                  <tr
                    key={v.name}
                    onClick={() => setSelectedViewer(v)}
                    className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50/50"
                  >
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={v.name} />
                        <span className="font-medium text-slate-900">{v.name}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-slate-600">{v.org}</td>
                    <td className="py-3 pr-3 text-xs text-slate-500">{v.type}</td>
                    <td className="py-3 pr-3 text-xs text-slate-600">
                      <div>{v.date}</div>
                      <div className="text-slate-400">{v.time}</div>
                    </td>
                    <td className="py-3 pr-3"><InterestBadge level={v.interest} /></td>
                    <td className="py-3 pr-3 text-xs text-slate-600">{v.lastContact}</td>
                    <td className="py-3">
                      <div className="text-xs font-medium text-orange-600">{v.action}</div>
                      <div className="text-[11px] text-slate-500">{v.reason}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-center">
            <button className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:underline">
              View all viewers <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* High-Priority Follow-ups */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">High-Priority Follow-ups</h2>
            <span className="inline-flex items-center rounded-md bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
              {FOLLOW_UPS.length}
            </span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-2 font-medium">Investor</th>
                  <th className="pb-2 pr-2 font-medium">Interest</th>
                  <th className="pb-2 pr-2 font-medium">Last</th>
                  <th className="pb-2 font-medium">Why & Next Step</th>
                </tr>
              </thead>
              <tbody>
                {FOLLOW_UPS.map((f) => (
                  <tr key={f.name} className="border-b border-slate-50 last:border-0">
                    <td className="py-3 pr-2">
                      <div className="flex items-center gap-2">
                        <Avatar name={f.name} />
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-slate-900">{f.name}</div>
                          <div className="truncate text-[10px] text-slate-500">{f.org}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-2"><InterestBadge level={f.interest} /></td>
                    <td className="py-3 pr-2 text-[11px] text-slate-600">{f.lastContact}</td>
                    <td className="py-3">
                      <div className="text-[11px] text-slate-600">{f.reason}</div>
                      <button className="mt-0.5 text-xs font-medium text-orange-600 hover:underline">{f.action}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-center">
            <button className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:underline">
              View full follow-up list <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom row: Next Steps + Top Investors + Recent Activity */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Suggested Next Steps */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Suggested Next Steps</h2>
          <ul className="mt-4 space-y-2">
            {NEXT_STEPS.map((s) => (
              <li key={s.title}>
                <button className="flex w-full items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-left transition-colors hover:border-orange-200 hover:bg-orange-50/40">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900">{s.title}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{s.desc}</div>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 text-center">
            <button className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:underline">
              View outreach playbook <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Top Interested Investors */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Top Interested Investors</h2>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500">
                <th className="pb-2 pr-2 font-medium">Rank</th>
                <th className="pb-2 pr-2 font-medium">Investor</th>
                <th className="pb-2 pr-2 font-medium">Interest</th>
                <th className="pb-2 font-medium">Fit</th>
              </tr>
            </thead>
            <tbody>
              {TOP_INVESTORS.map((t) => (
                <tr key={t.rank} className="border-b border-slate-50 last:border-0">
                  <td className="py-3 pr-2 text-sm font-semibold text-slate-500">{t.rank}</td>
                  <td className="py-3 pr-2">
                    <div className="text-xs font-medium text-slate-900">{t.name}</div>
                    <div className="text-[10px] text-slate-500">{t.org}</div>
                  </td>
                  <td className="py-3 pr-2"><InterestBadge level={t.interest} /></td>
                  <td className="py-3"><FitBadge fit={t.fit} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 text-center">
            <button className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:underline">
              View full rankings <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Recent Activity</h2>
          <ul className="mt-4 space-y-3">
            {RECENT_ACTIVITY.map((a, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                  <a.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-medium text-slate-900">{a.text}</div>
                    <div className="shrink-0 text-[10px] text-slate-400">{a.when}</div>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">{a.detail}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 text-center">
            <button className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:underline">
              View all activity <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <div>All times are shown in your local time zone</div>
        <div>Data updates every 15 minutes</div>
        <div>Privacy &amp; Terms</div>
      </div>

      {/* Viewer detail panel */}
      {selectedViewer && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <div className="flex-1 bg-slate-900/30" onClick={() => setSelectedViewer(null)} />
          <div className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 p-5">
              <div className="flex items-center gap-3">
                <Avatar name={selectedViewer.name} />
                <div>
                  <div className="text-base font-semibold text-slate-900">{selectedViewer.name}</div>
                  <div className="text-xs text-slate-500">{selectedViewer.role} — {selectedViewer.org}</div>
                </div>
              </div>
              <button onClick={() => setSelectedViewer(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5 text-sm">
              <Row label="Connection status" value="Not connected" />
              <Row label="First profile view" value="May 12, 2025" />
              <Row label="Most recent view" value={`${selectedViewer.date} · ${selectedViewer.time}`} />
              <Row label="Total views" value="7" />
              <Row label="Sections viewed" value="Overview, Traction, Team, Deck" />
              <Row label="Previous communication" value={`Last: ${selectedViewer.lastContact}`} />
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Interest level</span>
                <InterestBadge level={selectedViewer.interest} />
              </div>
              <div>
                <div className="text-xs text-slate-500">Reason for interest level</div>
                <div className="mt-1 text-xs text-slate-700">Repeated views on key sections and recent return after update.</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Recommended next action</div>
                <div className="mt-1 text-sm font-medium text-orange-600">{selectedViewer.action} — {selectedViewer.reason}</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <button className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-medium text-white hover:bg-orange-600">Re-contact</button>
                <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Create follow-up task</button>
                <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Request introduction</button>
                <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">View investor profile</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-50 pb-2 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-right text-xs font-medium text-slate-900">{value}</span>
    </div>
  );
}
