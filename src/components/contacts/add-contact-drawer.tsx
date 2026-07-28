import { useMemo, useState, type KeyboardEvent } from "react";
import { X, User, Mail, Phone, Briefcase, Users as UsersIcon, Building2, Globe, MapPin, ShieldCheck } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface AddContactDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingEmails?: string[];
  onSave?: (data: ContactFormData) => void;
}

export interface ContactFormData {
  fullName: string;
  workEmail: string;
  phone: string;
  position: string;
  roleOrDepartment: string;
  organisationName: string;
  website: string;
  location: string;
  tags: string[];
  notes: string;
}

const EMPTY: ContactFormData = {
  fullName: "",
  workEmail: "",
  phone: "",
  position: "",
  roleOrDepartment: "",
  organisationName: "",
  website: "",
  location: "",
  tags: [],
  notes: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/[^\s]*)?$/i;

export function AddContactDrawer({ open, onOpenChange, existingEmails = [], onSave }: AddContactDrawerProps) {
  const [form, setForm] = useState<ContactFormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormData, string>>>({});
  const [tagDraft, setTagDraft] = useState("");

  const set = <K extends keyof ContactFormData>(k: K, v: ContactFormData[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const canSubmit = useMemo(
    () => form.fullName.trim().length > 0 && EMAIL_RE.test(form.workEmail.trim()),
    [form.fullName, form.workEmail],
  );

  const reset = () => {
    setForm(EMPTY);
    setErrors({});
    setTagDraft("");
  };

  const handleTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const t = tagDraft.trim().replace(/,$/, "");
      if (t && !form.tags.includes(t)) set("tags", [...form.tags, t]);
      setTagDraft("");
    } else if (e.key === "Backspace" && !tagDraft && form.tags.length) {
      set("tags", form.tags.slice(0, -1));
    }
  };

  const removeTag = (t: string) => set("tags", form.tags.filter((x) => x !== t));

  const handleSubmit = () => {
    const next: typeof errors = {};
    if (!form.fullName.trim()) next.fullName = "Full name is required.";
    const email = form.workEmail.trim().toLowerCase();
    if (!email) next.workEmail = "Work email is required.";
    else if (!EMAIL_RE.test(email)) next.workEmail = "Enter a valid email address.";
    else if (existingEmails.map((e) => e.toLowerCase()).includes(email))
      next.workEmail = "A contact with this email already exists.";
    if (form.website.trim() && !URL_RE.test(form.website.trim()))
      next.website = "Enter a valid URL.";

    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    onSave?.(form);
    toast.success("Contact added");
    reset();
    onOpenChange(false);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl sm:rounded-l-2xl"
      >
        {/* Header (Sheet provides the close X in the top-right) */}
        <div className="border-b border-border bg-card px-6 py-5 pr-14">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Add Contact</h2>
          <p className="mt-1 text-sm text-muted-foreground">Add a new contact to your network.</p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Contact Details
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Full Name"
              required
              error={errors.fullName}
              icon={User}
              placeholder="Enter full name"
              value={form.fullName}
              onChange={(v) => set("fullName", v)}
            />
            <Field
              label="Work Email"
              required
              error={errors.workEmail}
              icon={Mail}
              type="email"
              placeholder="Enter work email"
              value={form.workEmail}
              onChange={(v) => set("workEmail", v)}
            />
            <Field
              label="Phone"
              icon={Phone}
              placeholder="Enter phone number"
              value={form.phone}
              onChange={(v) => set("phone", v)}
            />
            <Field
              label="Position"
              icon={Briefcase}
              placeholder="Enter position"
              value={form.position}
              onChange={(v) => set("position", v)}
            />
            <Field
              label="Role or Department"
              icon={UsersIcon}
              placeholder="Enter role or department"
              value={form.roleOrDepartment}
              onChange={(v) => set("roleOrDepartment", v)}
            />
            <Field
              label="Organisation Name"
              icon={Building2}
              placeholder="Enter organisation name"
              value={form.organisationName}
              onChange={(v) => set("organisationName", v)}
            />
            <Field
              label="Website"
              icon={Globe}
              placeholder="Enter website URL"
              value={form.website}
              onChange={(v) => set("website", v)}
              error={errors.website}
            />
            <Field
              label="Location"
              icon={MapPin}
              placeholder="Enter location"
              value={form.location}
              onChange={(v) => set("location", v)}
            />
          </div>

          {/* Tags */}
          <div className="mt-5">
            <Label className="mb-1.5 block text-sm font-medium text-foreground">Tags</Label>
            <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
              {form.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 border border-orange-200"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    className="rounded-full hover:bg-orange-100"
                    aria-label={`Remove ${t}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={handleTagKey}
                placeholder={form.tags.length ? "" : "Add tags..."}
                className="min-w-[8rem] flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Press Enter to add multiple tags</p>
          </div>

          {/* Notes */}
          <div className="mt-5">
            <Label className="mb-1.5 block text-sm font-medium text-foreground">Notes</Label>
            <Textarea
              rows={4}
              placeholder="Add notes about this contact..."
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">Visible to your organisation members</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border bg-card px-6 py-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"
          >
            Add Contact
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  required,
  error,
  icon: Icon,
  type = "text",
  placeholder,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  error?: string;
  icon: typeof User;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm font-medium text-foreground">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("pl-8", error && "border-red-400 focus-visible:ring-red-400")}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
