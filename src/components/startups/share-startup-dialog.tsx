import { useMemo, useState } from "react";
import {
  Users,
  Mail,
  Search,
  X,
  Send,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Info,
  Link2,
  MessageSquare,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  SHARE_CONTACT_FILTERS,
  initialsOf,
  isValidEmail,
  searchShareContacts,
  type ShareContact,
  type ShareContactFilter,
} from "@/lib/contacts/share-contacts";

const MESSAGE_MAX = 500;

export interface ShareStartupTarget {
  name: string;
  tagline?: string | null;
  location?: string | null;
  website?: string | null;
  logoUrl?: string | null;
}

type Tab = "internal" | "email";
type Phase = "idle" | "sharing" | "success";

export function ShareStartupDialog({
  open,
  onOpenChange,
  startup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startup: ShareStartupTarget;
}) {
  const [tab, setTab] = useState<Tab>("internal");
  const [phase, setPhase] = useState<Phase>("idle");
  const [sharedCount, setSharedCount] = useState(0);

  // Internal tab
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ShareContactFilter>("All Contacts");
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  // Email tab
  const [emails, setEmails] = useState<string[]>([]);
  const [emailDraft, setEmailDraft] = useState("");
  const [subject, setSubject] = useState(
    `Check out ${startup.name}${startup.tagline ? ` – ${startup.tagline}` : ""}`,
  );
  const [emailMessage, setEmailMessage] = useState(
    "Hi,\nI'd like to share our startup profile with you.\nYou can view more details using the link below.",
  );
  const [allowRequest, setAllowRequest] = useState(true);
  const [pickFromContacts, setPickFromContacts] = useState(false);

  const results = useMemo(() => searchShareContacts(query, filter), [query, filter]);
  const visible = query.trim() || showAll ? results : results.filter((c) => c.frequent);

  function reset() {
    setPhase("idle");
    setSelected([]);
    setMessage("");
    setQuery("");
    setShowAll(false);
    setEmails([]);
    setEmailDraft("");
    setPickFromContacts(false);
  }

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) setTimeout(reset, 200);
  }

  function toggle(id: string) {
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function commitEmailDraft(raw: string) {
    const parts = raw
      .split(/[\s,;]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const valid = parts.filter(isValidEmail);
    if (valid.length) setEmails((p) => [...new Set([...p, ...valid])]);
    setEmailDraft(parts.length && !valid.length ? raw.trim() : "");
  }

  async function submit(count: number) {
    setPhase("sharing");
    await new Promise((r) => setTimeout(r, 900));
    setSharedCount(count);
    setPhase("success");
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
        <DialogHeader className="space-y-1 border-b border-border/60 px-6 pb-4 pt-6">
          <DialogTitle className="text-xl tracking-tight">Share {startup.name}</DialogTitle>
          <DialogDescription>Choose how you want to share your startup.</DialogDescription>
        </DialogHeader>

        {phase === "sharing" ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Sharing…</p>
            <p className="text-xs text-muted-foreground">Please wait</p>
          </div>
        ) : phase === "success" ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <CheckCircle2 className="h-11 w-11 text-emerald-500" />
            <p className="text-base font-semibold">Shared successfully!</p>
            <p className="text-sm text-muted-foreground">
              Your startup has been shared with {sharedCount}{" "}
              {sharedCount === 1 ? "recipient" : "recipients"}.
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" onClick={() => reset()}>
                Share again
              </Button>
              <Button onClick={() => close(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="grid grid-cols-2 border-b border-border/60">
              <TabButton
                active={tab === "internal"}
                onClick={() => setTab("internal")}
                icon={<Users className="h-4 w-4" />}
                title="Share within SnackPortal2"
                subtitle="For SnackPortal2 members"
              />
              <TabButton
                active={tab === "email"}
                onClick={() => setTab("email")}
                icon={<Mail className="h-4 w-4" />}
                title="Share via Email"
                subtitle="For non-SnackPortal2 members"
              />
            </div>

            {tab === "internal" ? (
              <div className="space-y-4 px-6 py-5">
                <div>
                  <h3 className="text-sm font-semibold">Select from your contacts</h3>
                  <p className="text-xs text-muted-foreground">
                    Search and select from your saved contacts.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search your contacts by name, company or email..."
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={filter}
                    onValueChange={(v) => setFilter(v as ShareContactFilter)}
                  >
                    <SelectTrigger className="sm:w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHARE_CONTACT_FILTERS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {query.trim() || showAll ? "Contacts" : "Frequently contacted"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {showAll ? "Show frequent only" : "View All Contacts →"}
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {visible.length === 0 ? (
                    <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
                      No contacts match your search.
                    </p>
                  ) : (
                    visible.map((c) => (
                      <ContactCard
                        key={c.id}
                        contact={c}
                        checked={selected.includes(c.id)}
                        onToggle={() => toggle(c.id)}
                      />
                    ))
                  )}
                </div>

                <div>
                  <Label className="flex items-center gap-1.5 text-xs">
                    <MessageSquare className="h-3.5 w-3.5" /> Add a personal message (optional)
                  </Label>
                  <Textarea
                    value={message}
                    maxLength={MESSAGE_MAX}
                    rows={3}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Hi, I thought you might be interested in learning more about our startup."
                    className="mt-2"
                  />
                  <div className="mt-1 text-right text-xs text-muted-foreground">
                    {message.length}/{MESSAGE_MAX}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
                  <Button variant="outline" onClick={() => close(false)}>
                    Cancel
                  </Button>
                  <Button
                    disabled={selected.length === 0}
                    onClick={() => submit(selected.length)}
                    className="gap-2"
                  >
                    <Send className="h-4 w-4" /> Share ({selected.length})
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 px-6 py-5">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Mail className="h-4 w-4" /> Share via Email (Non-members)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Send your startup profile link to people who are not on SnackPortal2.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Email Addresses</Label>
                    <button
                      type="button"
                      onClick={() => setPickFromContacts((v) => !v)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Add from Contacts
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md border border-border/70 p-2">
                    {emails.map((e) => (
                      <span
                        key={e}
                        className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
                      >
                        {e}
                        <button
                          type="button"
                          aria-label={`Remove ${e}`}
                          onClick={() => setEmails((p) => p.filter((x) => x !== e))}
                        >
                          <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                        </button>
                      </span>
                    ))}
                    <input
                      value={emailDraft}
                      onChange={(e) => setEmailDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "," || e.key === " ") {
                          e.preventDefault();
                          commitEmailDraft(emailDraft);
                        }
                      }}
                      onBlur={() => commitEmailDraft(emailDraft)}
                      onPaste={(e) => {
                        e.preventDefault();
                        commitEmailDraft(e.clipboardData.getData("text"));
                      }}
                      placeholder="Add more emails..."
                      className="min-w-[10rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>

                  {pickFromContacts && (
                    <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border/70">
                      {searchShareContacts("", "All Contacts").map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setEmails((p) => [...new Set([...p, c.email])])}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-muted/40"
                        >
                          <span>
                            {c.name}
                            <span className="text-muted-foreground"> · {c.email}</span>
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {c.type}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-xs">
                    Subject <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label className="text-xs">
                    Personal Message <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    value={emailMessage}
                    maxLength={MESSAGE_MAX}
                    rows={4}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    className="mt-2"
                  />
                  <div className="mt-1 text-right text-xs text-muted-foreground">
                    {emailMessage.length}/{MESSAGE_MAX}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={allowRequest}
                    onCheckedChange={(v) => setAllowRequest(Boolean(v))}
                  />
                  Allow recipients to request full information
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        Recipients can view the shared public information first and request
                        additional startup information from you. Restricted information is never
                        exposed automatically.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </label>

                {/* Shared link preview */}
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Shared startup link preview{" "}
                    <span className="font-normal normal-case">(For Email Recipients)</span>
                  </p>
                  <div className="mt-3 flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {startup.logoUrl ? (
                          <img
                            src={startup.logoUrl}
                            alt=""
                            className="h-8 w-8 rounded object-contain"
                          />
                        ) : (
                          <span className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary">
                            {initialsOf(startup.name)}
                          </span>
                        )}
                        <span className="truncate text-base font-semibold">{startup.name}</span>
                      </div>
                      {startup.tagline && (
                        <p className="text-sm text-muted-foreground">{startup.tagline}</p>
                      )}
                      {startup.location && (
                        <p className="text-xs text-muted-foreground">{startup.location}</p>
                      )}
                      {startup.website && (
                        <p className="text-xs text-muted-foreground">{startup.website}</p>
                      )}
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-48">
                      <Button size="sm" disabled className="w-full">
                        Request Full Information
                      </Button>
                      <Button size="sm" variant="outline" disabled className="w-full">
                        Sign in to SnackPortal2
                      </Button>
                      <p className="text-center text-[11px] text-muted-foreground">
                        Don&apos;t have an account?{" "}
                        <span className="font-medium text-primary">Create Account</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
                  <Button variant="outline" onClick={() => close(false)}>
                    Cancel
                  </Button>
                  <Button
                    disabled={emails.length === 0}
                    onClick={() => submit(emails.length)}
                    className="gap-2"
                  >
                    <Send className="h-4 w-4" /> Send Email
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 border-t border-border/60 bg-muted/20 px-6 py-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>
                <span className="font-medium text-foreground">Secure Sharing</span> — You stay in
                control. You can manage shared access and revoke it at any time from Startup
                Settings.
              </span>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-0.5 border-b-2 px-4 py-3 text-center transition-colors",
        active
          ? "border-primary bg-primary/[0.04] text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        {icon} {title}
      </span>
      <span className="text-xs font-normal text-muted-foreground">{subtitle}</span>
    </button>
  );
}

function ContactCard({
  contact,
  checked,
  onToggle,
}: {
  contact: ShareContact;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
        checked ? "border-primary bg-primary/[0.04]" : "border-border hover:bg-muted/30",
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
        {initialsOf(contact.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{contact.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {[contact.position, contact.organisation].filter(Boolean).join(" at ")}
        </span>
        <span className="mt-1 flex items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px]">
            {contact.type}
          </Badge>
          {contact.connected ? (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Connected</span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Link2 className="h-3 w-3" /> Not connected
            </span>
          )}
        </span>
      </span>
      <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={`Select ${contact.name}`} />
    </label>
  );
}
