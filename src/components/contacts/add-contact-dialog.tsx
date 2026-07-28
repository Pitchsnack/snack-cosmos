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
  const [fullName, setFullName] = useState("");
  const [workEmail, setWorkEmail] = useState("");

  const reset = () => {
    setFullName("");
    setWorkEmail("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !workEmail.trim()) {
      toast.error("Full Name and Work Email are required");
      return;
    }
    toast.success(`${fullName} added to your contacts`);
    reset();
    onOpenChange(false);
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
                    onChange={(e) => setFullName(e.target.value)}
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
                    onChange={(e) => setWorkEmail(e.target.value)}
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
                  <Input id="ac-phone" placeholder="Enter phone number" className="pl-9" maxLength={40} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ac-position">Position</Label>
                <div className="relative">
                  <FieldIcon Icon={Briefcase} />
                  <Input id="ac-position" placeholder="Enter position" className="pl-9" maxLength={120} />
                </div>
              </div>
            </div>

            {/* Row 3: Role/Dept */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ac-role">Role or Department</Label>
                <div className="relative">
                  <FieldIcon Icon={UsersIcon} />
                  <Input id="ac-role" placeholder="Enter role or department" className="pl-9" maxLength={120} />
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
                  <Input id="ac-org" placeholder="Enter organisation name" className="pl-9" maxLength={160} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ac-website">Website</Label>
                <div className="relative">
                  <FieldIcon Icon={Globe} />
                  <Input id="ac-website" placeholder="Enter website URL" className="pl-9" maxLength={255} />
                </div>
              </div>
            </div>

            {/* Row 5: Location */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ac-location">Location</Label>
                <div className="relative">
                  <FieldIcon Icon={MapPin} />
                  <Input id="ac-location" placeholder="Enter location" className="pl-9" maxLength={160} />
                </div>
              </div>
            </div>

            {/* Row 5: Contact Type / Status / Source */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Contact Type</Label>
                <Select>
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
                <Select>
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
                <Select>
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
                <Input id="ac-tags" placeholder="Add tags..." className="pl-9" maxLength={255} />
              </div>
              <p className="text-xs text-muted-foreground">Press Enter to add multiple tags</p>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="ac-notes">Notes</Label>
              <div className="relative">
                <StickyNote className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="ac-notes"
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
            <Button type="submit" className="bg-orange-500 text-white hover:bg-orange-600">
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              Add Contact
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
