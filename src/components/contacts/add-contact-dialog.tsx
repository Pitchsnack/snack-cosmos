import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User as UserIcon,
  Mail,
  Phone,
  Briefcase,
  Users as UsersIcon,
  Building2,
  Globe,
  MapPin,
  Tag as TagIcon,
  StickyNote,
  Circle,
  CheckCircle2,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createUserContact, type UserContactInput } from "@/lib/user-contacts.functions";

const TYPE_MAP = { pitchsnack: "PitchSnack Connection", my: "My Contact" } as const;
const STATUS_MAP = { active: "Active", warm: "Warm", cold: "Cold", "follow-up": "Follow-Up Due", dnc: "Do Not Contact" } as const;
const SOURCE_MAP = { pitchsnack: "PitchSnack Connection", my: "My Contact", imported: "Imported", referral: "Referral", introduction: "Introduction" } as const;

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function FieldIcon({ Icon }: { Icon: typeof UserIcon }) {
  return (
    <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
  );
}

export function AddContactDialog({ open, onOpenChange }: AddContactDialogProps) {
  const empty = { fullName: "", email: "", phone: "", position: "", department: "", company: "", website: "", location: "", type: "my", status: "active", source: "my", tags: "", notes: "" };
  const [f, setF] = useState(empty);
  const fullName = f.fullName;
  const workEmail = f.email;
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const qc = useQueryClient();
  const create = useServerFn(createUserContact);
  const save = useMutation({
    mutationFn: (data: UserContactInput) => create({ data }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["user-contacts"] });
      toast.success(`${c.fullName} added to your contacts`);
      reset();
      onOpenChange(false);
    },
    onError: () => toast.error("Could not save contact. Check the email address and try again."),
  });

  const reset = () => setF(empty);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !workEmail.trim()) {
      toast.error("Full name and work email are required");
      return;
    }
    save.mutate({
      fullName: f.fullName, email: f.email, phone: f.phone, position: f.position, department: f.department,
      company: f.company, website: f.website, location: f.location,
      contactType: TYPE_MAP[f.type as keyof typeof TYPE_MAP], status: STATUS_MAP[f.status as keyof typeof STATUS_MAP],
      source: SOURCE_MAP[f.source as keyof typeof SOURCE_MAP],
      tags: f.tags.split(",").map((x) => x.trim()).filter(Boolean),
      notes: f.notes,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-0">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-xl">Add Contact</DialogTitle>
            <DialogDescription>Add a new contact to your network.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-6 py-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Contact Details
            </h3>

            {/* Row 1: Full Name / Work Email */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ac-name">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <FieldIcon Icon={UserIcon} />
                  <Input
                    id="ac-name"
                    value={fullName}
                    onChange={set("fullName")}
                    placeholder="Enter full name"
                    className="pl-9"
                    maxLength={100}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ac-email">
                  Work Email <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <FieldIcon Icon={Mail} />
                  <Input
                    id="ac-email"
                    type="email"
                    value={workEmail}
                    onChange={set("email")}
                    placeholder="Enter work email"
                    className="pl-9"
                    maxLength={255}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Phone / Position */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ac-phone">Phone Number</Label>
                <div className="relative">
                  <FieldIcon Icon={Phone} />
                  <Input id="ac-phone" value={f.phone} onChange={set("phone")} placeholder="Enter phone number" className="pl-9" maxLength={40} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ac-position">Position</Label>
                <div className="relative">
                  <FieldIcon Icon={Briefcase} />
                  <Input id="ac-position" value={f.position} onChange={set("position")} placeholder="Enter position" className="pl-9" maxLength={120} />
                </div>
              </div>
            </div>

            {/* Row 3: Role/Dept */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ac-role">Role or Department</Label>
                <div className="relative">
                  <FieldIcon Icon={UsersIcon} />
                  <Input id="ac-role" value={f.department} onChange={set("department")} placeholder="Enter role or department" className="pl-9" maxLength={120} />
                </div>
              </div>
            </div>

            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Organisation Details
            </h3>

            {/* Row 4: Organisation / Website */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ac-org">Organisation Name</Label>
                <div className="relative">
                  <FieldIcon Icon={Building2} />
                  <Input id="ac-org" value={f.company} onChange={set("company")} placeholder="Enter organisation name" className="pl-9" maxLength={160} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ac-website">Website</Label>
                <div className="relative">
                  <FieldIcon Icon={Globe} />
                  <Input id="ac-website" value={f.website} onChange={set("website")} placeholder="Enter website URL" className="pl-9" maxLength={255} />
                </div>
              </div>
            </div>

            {/* Row 5: Location */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ac-location">Location</Label>
                <div className="relative">
                  <FieldIcon Icon={MapPin} />
                  <Input id="ac-location" value={f.location} onChange={set("location")} placeholder="Enter location" className="pl-9" maxLength={160} />
                </div>
              </div>
            </div>

            {/* Row 5: Contact Type / Status / Source */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Contact Type</Label>
                <Select value={f.type} onValueChange={(v) => setF((s) => ({ ...s, type: v }))}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Select type" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pitchsnack">PitchSnack Connection</SelectItem>
                    <SelectItem value="my">My Contact</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={f.status} onValueChange={(v) => setF((s) => ({ ...s, status: v }))}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <Circle className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Select status" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                    <SelectItem value="cold">Cold</SelectItem>
                    <SelectItem value="follow-up">Follow-Up Due</SelectItem>
                    <SelectItem value="dnc">Do Not Contact</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select value={f.source} onValueChange={(v) => setF((s) => ({ ...s, source: v }))}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Select source" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pitchsnack">PitchSnack Connection</SelectItem>
                    <SelectItem value="my">My Contact</SelectItem>
                    <SelectItem value="imported">Imported</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="introduction">Introduction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <Label htmlFor="ac-tags">Tags</Label>
              <div className="relative">
                <FieldIcon Icon={TagIcon} />
                <Input id="ac-tags" value={f.tags} onChange={set("tags")} placeholder="Add tags..." className="pl-9" maxLength={255} />
              </div>
              <p className="text-xs text-muted-foreground">Separate tags with commas</p>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="ac-notes">Notes</Label>
              <div className="relative">
                <StickyNote className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="ac-notes"
                  value={f.notes}
                  onChange={set("notes")}
                  placeholder="Add notes about this contact..."
                  className="min-h-[110px] pl-9"
                  maxLength={1000}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border bg-muted/30 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              Add Contact
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
