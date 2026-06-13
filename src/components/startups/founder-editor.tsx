import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

export interface FounderDraft {
  full_name: string;
  position?: string | null;
  linkedin_url?: string | null;
  bio?: string | null;
}

interface Props {
  value: FounderDraft[];
  onChange: (next: FounderDraft[]) => void;
}

export function FounderEditor({ value, onChange }: Props) {
  const update = (i: number, patch: Partial<FounderDraft>) =>
    onChange(value.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  return (
    <div className="space-y-3">
      {value.map((f, i) => (
        <div key={i} className="grid gap-2 rounded-md border border-border bg-background p-3 md:grid-cols-2">
          <Input placeholder="Full name *" value={f.full_name} onChange={(e) => update(i, { full_name: e.target.value })} />
          <Input placeholder="Position (CEO, CTO…)" value={f.position ?? ""} onChange={(e) => update(i, { position: e.target.value })} />
          <Input placeholder="LinkedIn URL" value={f.linkedin_url ?? ""} onChange={(e) => update(i, { linkedin_url: e.target.value })} className="md:col-span-2" />
          <Textarea placeholder="Short bio" rows={2} value={f.bio ?? ""} onChange={(e) => update(i, { bio: e.target.value })} className="md:col-span-2" />
          <div className="md:col-span-2 flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-4 w-4 mr-1" /> Remove
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { full_name: "" }])}>
        <Plus className="h-4 w-4 mr-1" /> Add founder
      </Button>
    </div>
  );
}
