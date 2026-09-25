import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Mail, Phone, Building2, MapPin, Globe, Linkedin, Pencil, Lock, Crown,
  Handshake, FileCheck, Calendar, Info, BadgeCheck,
} from "lucide-react";

import { useSessionContext } from "@/hooks/use-session-context";
import { usePersona } from "@/hooks/use-marketplace";
import { getMyActivity, saveMyProfile } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/my-page")({
  head: () => ({
    meta: [
      { title: "My Profile — Pitch Snack" },
      { name: "description", content: "What buyers and sellers see about you, and who can see your contact details." },
      { property: "og:title", content: "My Profile — Pitch Snack" },
      { property: "og:description", content: "What buyers and sellers see about you, and who can see your contact details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyPage,
});

const FONT = { fontFamily: "'DM Sans', system-ui, sans-serif" };

function href(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function MyPage() {
  const { data: session } = useSessionContext();
  const { persona } = usePersona();
  const buyer = persona === "buyer";
  const u = session?.user;
  const activityFn = useServerFn(getMyActivity);
  const { data: activity } = useQuery({ queryKey: ["my-activity"], queryFn: () => activityFn(), enabled: !!u });
  const [editing, setEditing] = useState<null | "profile" | "background">(null);

  const name = [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.email || "";
  const initials = ((u?.firstName?.[0] ?? "") + (u?.lastName?.[0] ?? "") || u?.email?.[0] || "?").toUpperCase().slice(0, 2);
  const location = [u?.city, u?.country].filter(Boolean).join(", ");
  const titleLine = [u?.title, u?.organisation].filter(Boolean);
  const memberSince = activity?.memberSince
    ? new Date(activity.memberSince).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
    : "—";

  const contacts: Array<{ icon: typeof Mail; label: string; value: string | null | undefined; link?: boolean; nda?: boolean }> = [
    { icon: MapPin, label: "Location", value: location },
    { icon: Globe, label: "Website", value: u?.website, link: true },
    { icon: Linkedin, label: "LinkedIn", value: u?.linkedin, link: true },
    { icon: Mail, label: "Email", value: u?.email, nda: true },
    { icon: Phone, label: "Phone", value: u?.phone, nda: true },
    { icon: Building2, label: "Organisation", value: u?.organisation },
  ];

  const background: Array<[string, string | null | undefined]> = [
    ["Industry focus", u?.industryFocus],
    ["Functional expertise", u?.functionalExpertise],
    ["Buyer type", u?.buyerType],
    ["Experience", u?.experience],
  ];

  return (
    <div className="mx-auto max-w-[1120px] text-[#0f1115]" style={FONT}>
      <h1 className="text-2xl font-bold tracking-[-0.02em]">My Profile</h1>
      <p className="mb-5 mt-1 text-sm text-[#6b7280]">
        {buyer
          ? "What sellers see about you when you request an NDA, and who can see your contact details."
          : "What buyers see about you, and who can see your contact details."}
      </p>

      {/* Header */}
      <div className="rounded-[14px] border border-[#E6E8EC] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,.04)]">
        <div className="flex flex-col gap-[22px] min-[721px]:flex-row">
          <div className="grid h-[88px] w-[88px] shrink-0 place-items-center rounded-[22px] bg-gradient-to-br from-[#f59e0b] to-[#b45309] text-[30px] font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 min-[721px]:flex-row min-[721px]:items-start min-[721px]:justify-between">
              <div className="min-w-0">
                <div className="text-[22px] font-bold tracking-[-0.01em]">
                  {name}
                  {u?.plan && (
                    <Link
                      to="/preferences"
                      title="Manage plan in Settings"
                      className="ml-1.5 inline-flex items-center gap-[3px] rounded-full border border-[#DDD0FB] bg-gradient-to-br from-[#F5F0FF] to-[#EDE4FF] px-1.5 py-0.5 align-[4px] text-[9.5px] font-bold uppercase tracking-[0.06em] text-[#6D28D9]"
                    >
                      <Crown className="h-2.5 w-2.5" />
                      {u.plan}
                    </Link>
                  )}
                </div>
                {(titleLine.length > 0 || u?.verified) && (
                  <div className="mt-[3px] flex flex-wrap items-center gap-2 text-[14.5px]">
                    {titleLine.map((t, i) => (
                      <span key={i} className="flex items-center gap-2">
                        {i > 0 && <span className="h-[3px] w-[3px] rounded-full bg-[#9ca3af]" />}
                        {t}
                      </span>
                    ))}
                    {u?.verified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F6EE] px-2 py-0.5 text-xs font-semibold text-[#166534]">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        {buyer ? "Verified buyer" : "Verified seller"}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <Button
                onClick={() => setEditing("profile")}
                className="w-full gap-1.5 bg-[#0f1115] text-white hover:bg-[#0f1115]/90 min-[721px]:w-auto"
                size="sm"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit profile
              </Button>
            </div>
            {u?.bio && <p className="mt-2.5 max-w-[640px] text-sm leading-relaxed text-[#6b7280]">{u.bio}</p>}
            <div className="mt-[18px] grid gap-x-6 gap-y-3 border-t border-[#E6E8EC] pt-[18px] min-[721px]:grid-cols-2 min-[1025px]:grid-cols-3">
              {contacts.filter((c) => c.value).map((c) => (
                <div key={c.label} className="flex min-w-0 items-start gap-2.5">
                  <div className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-[#f3f4f6] text-[#4b5563]">
                    <c.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11.5px] text-[#6b7280]">
                      {c.label}
                      {c.nda && (
                        <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-[#FEF3C7] px-[7px] py-0.5 text-[10.5px] font-semibold text-[#92400E]">
                          <Lock className="h-2.5 w-2.5" /> After NDA
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[13.5px] font-semibold">
                      {c.link ? (
                        <a href={href(c.value!)} target="_blank" rel="noreferrer" className="text-[#4338ca]">
                          {c.value!.replace(/^https?:\/\//i, "")}
                        </a>
                      ) : c.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Activity tiles */}
      <div className="relative mt-7 grid gap-3 min-[721px]:grid-cols-3">
        <div className="absolute -top-[18px] right-0.5 flex items-center gap-1 text-[11px] text-[#9CA3AF]">
          <Lock className="h-3 w-3" /> Tracked by Pitch Snack
        </div>
        <Tile icon={Handshake} tint="bg-[#e8f6ee] text-[#16a34a]" value={String(activity?.dealsClosed ?? 0)} label="Deals closed on Pitch Snack" />
        <Tile icon={FileCheck} tint="bg-[#eef0ff] text-[#4338ca]" value={String(activity?.ndas ?? 0)} label={buyer ? "NDAs signed" : "NDAs approved"} />
        <Tile icon={Calendar} tint="bg-[#f3f4f6] text-[#4b5563]" value={memberSince} label="Member since" date />
      </div>

      {buyer && (
        <div className="mt-4 rounded-[14px] border border-[#E6E8EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]">
          <div className="flex items-center justify-between border-b border-[#E6E8EC] px-5 py-4">
            <h3 className="text-[15px] font-bold">Buyer background</h3>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing("background")}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
          <div className="px-5 pb-2 pt-1">
            {background.filter(([, v]) => v).length === 0 && (
              <p className="py-3 text-[13.5px] text-[#6b7280]">Nothing added yet.</p>
            )}
            {background.filter(([, v]) => v).map(([l, v]) => (
              <div key={l} className="flex justify-between gap-4 border-b border-[#f0f1f3] py-3 text-[13.5px] last:border-0">
                <span className="text-[#6b7280]">{l}</span>
                <b className="text-right font-semibold">{v}</b>
              </div>
            ))}
          </div>
          <div className="flex gap-2 px-5 py-3.5 text-[12.5px] leading-relaxed text-[#6b7280]">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Shown to sellers when you request an NDA. Deal criteria (ticket size, stake, regions) live in My Mandate.
          </div>
        </div>
      )}

      <div className="mt-5 flex items-start gap-1.5 text-[11.5px] text-[#9CA3AF]">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        Name, title, organisation, location, website and LinkedIn are visible to {buyer ? "sellers" : "everyone"}. Email and phone are shared only after an NDA, at Exchange contact.
      </div>

      {editing && u && (
        <EditDialog mode={editing} user={u} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function Tile({ icon: Icon, tint, value, label, date }: { icon: typeof Mail; tint: string; value: string; label: string; date?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#E6E8EC] bg-white px-4 py-3.5">
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${tint}`}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div>
        <b className={date ? "block py-[3px] text-[15px] font-semibold" : "block text-xl leading-tight tracking-[-0.01em]"}>{value}</b>
        <small className="mt-0.5 block text-xs text-[#6b7280]">{label}</small>
      </div>
    </div>
  );
}

type U = NonNullable<NonNullable<ReturnType<typeof useSessionContext>["data"]>["user"]>;

const PROFILE_FIELDS: Array<[keyof U, string, boolean?]> = [
  ["firstName", "First name"], ["lastName", "Last name"], ["title", "Title"],
  ["organisation", "Organisation"], ["city", "City"], ["country", "Country"],
  ["website", "Website"], ["linkedin", "LinkedIn"], ["phone", "Phone"], ["bio", "Bio", true],
];
const BACKGROUND_FIELDS: Array<[keyof U, string]> = [
  ["industryFocus", "Industry focus"], ["functionalExpertise", "Functional expertise"],
  ["buyerType", "Buyer type (e.g. Family office, PE, Corporate)"], ["experience", "Experience (e.g. 20+ years)"],
];

function EditDialog({ mode, user, onClose }: { mode: "profile" | "background"; user: U; onClose: () => void }) {
  const fields = mode === "profile" ? PROFILE_FIELDS : BACKGROUND_FIELDS;
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(([k]) => [k, (user[k] as string | null) ?? ""])),
  );
  const [saving, setSaving] = useState(false);
  const save = useServerFn(saveMyProfile);
  const qc = useQueryClient();
  const submit = async () => {
    setSaving(true);
    try {
      await save({ data: form });
      await qc.invalidateQueries({ queryKey: ["session-context"] });
      toast.success("Profile saved");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" style={FONT}>
        <DialogHeader>
          <DialogTitle>{mode === "profile" ? "Edit profile" : "Edit buyer background"}</DialogTitle>
          <DialogDescription>Empty fields are hidden from your profile.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {mode === "profile" && (
            <div className="sm:col-span-2">
              <Label className="text-xs">Login email</Label>
              <div className="mt-1 flex items-center gap-1.5 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Lock className="h-3 w-3" /> {user.email}
              </div>
            </div>
          )}
          {fields.map(([k, label, long]) => (
            <div key={k} className={long || mode === "background" ? "sm:col-span-2" : ""}>
              <Label className="text-xs" htmlFor={`f-${k}`}>{label}</Label>
              {long ? (
                <Textarea id={`f-${k}`} className="mt-1" rows={3} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              ) : (
                <Input id={`f-${k}`} className="mt-1" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
