import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import type { GlobalStartup, GlobalStartupStatus } from "@/lib/api-gateway/global-startups";

export interface GlobalStartupFormValues {
  name: string;
  sector: string | null;
  stage: string | null;
  description: string | null;
  website: string | null;
  tags: string[];
  status: GlobalStartupStatus;
}

const STAGES = ["Pre-Seed", "Seed", "Series A", "Series B", "Series C", "Growth", "Other"];

export function GlobalStartupForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
  submitLabel = "Save",
}: {
  initial?: Partial<GlobalStartup>;
  onSubmit: (values: GlobalStartupFormValues) => void;
  onCancel?: () => void;
  submitting?: boolean;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<GlobalStartupFormValues>({
    name: initial?.name ?? "",
    sector: initial?.sector ?? null,
    stage: initial?.stage ?? null,
    description: initial?.description ?? null,
    website: initial?.website ?? null,
    tags: initial?.tags ?? [],
    status: (initial?.status as GlobalStartupStatus) ?? "draft",
  });
  const [tagInput, setTagInput] = useState("");

  const update = <K extends keyof GlobalStartupFormValues>(
    k: K,
    v: GlobalStartupFormValues[K],
  ) => setValues((p) => ({ ...p, [k]: v }));

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || values.tags.includes(t)) return;
    update("tags", [...values.tags, t].slice(0, 20));
    setTagInput("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!values.name.trim()) return;
        onSubmit(values);
      }}
      className="space-y-4"
    >
      <Field label="Name *">
        <Input
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          maxLength={255}
          required
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Sector">
          <Input
            value={values.sector ?? ""}
            onChange={(e) => update("sector", e.target.value || null)}
          />
        </Field>
        <Field label="Stage">
          <Select
            value={values.stage ?? "__none"}
            onValueChange={(v) => update("stage", v === "__none" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">—</SelectItem>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Website">
        <Input
          value={values.website ?? ""}
          onChange={(e) => update("website", e.target.value || null)}
          placeholder="https://…"
        />
      </Field>

      <Field label="Description">
        <Textarea
          value={values.description ?? ""}
          onChange={(e) => update("description", e.target.value || null)}
          rows={4}
          maxLength={5000}
        />
      </Field>

      <Field label="Tags">
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Add a tag and press Enter"
          />
          <Button type="button" variant="outline" onClick={addTag}>
            Add
          </Button>
        </div>
        {values.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {values.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs"
              >
                {t}
                <button
                  type="button"
                  onClick={() =>
                    update(
                      "tags",
                      values.tags.filter((x) => x !== t),
                    )
                  }
                  className="rounded-full p-0.5 hover:bg-background"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </Field>

      <Field label="Status">
        <Select
          value={values.status}
          onValueChange={(v) => update("status", v as GlobalStartupStatus)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="recommended">Recommended</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting || !values.name.trim()}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
