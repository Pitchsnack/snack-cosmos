/**
 * Company Info editor — the manual correction form for the DBD registry record.
 *
 * Presentation only: it writes through `saveCompanyInfoTh`, which never clears
 * the DBD provenance columns. Empty stays empty; nothing is invented.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveCompanyInfoTh } from "@/lib/company-info.functions";
import type { CompanyInfoTh } from "@/lib/company-info";

type Draft = CompanyInfoTh;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-start gap-4 border-b border-[#EEF0F3] py-2.5 last:border-b-0">
      <div className="pt-1.5 text-[13px] text-[#636C80]">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function CompanyInfoEditor({
  startupId,
  info,
  onCancel,
  onSaved,
}: {
  startupId: string;
  info: CompanyInfoTh;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(saveCompanyInfoTh);
  const [draft, setDraft] = useState<Draft>(info);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const text = (key: keyof Draft, placeholder?: string) => (
    <Input
      value={(draft[key] as string | null) ?? ""}
      placeholder={placeholder}
      onChange={(e) => set(key, (e.target.value || null) as Draft[typeof key])}
      className="h-9 text-[13px]"
    />
  );

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          startupId,
          info: {
            legalNameTh: draft.legalNameTh,
            registrationNumber: draft.registrationNumber,
            legalEntityTypeTh: draft.legalEntityTypeTh,
            legalEntityStatusTh: draft.legalEntityStatusTh,
            registrationDateThRaw: draft.registrationDateThRaw,
            registeredCapitalThRaw: draft.registeredCapitalThRaw,
            previousRegistrationNumber: draft.previousRegistrationNumber,
            businessGroupTh: draft.businessGroupTh,
            businessSize: draft.businessSize,
            headOfficeAddressTh: draft.headOfficeAddressTh,
            website: draft.website,
            authorizedSignatoryTh: draft.authorizedSignatoryTh,
            submissionYearsBe: draft.submissionYearsBe,
            directors: draft.directors
              .filter((d) => d.nameTh.trim())
              .map((d) => ({ nameTh: d.nameTh.trim() })),
            registeredBusiness: draft.registeredBusiness,
            latestBusiness: draft.latestBusiness,
          },
        },
      }),
    onSuccess: () => {
      toast.success("Company info saved.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-[10px] border border-[#E3E6EB] bg-white p-5">
          <h3 className="mb-2 text-[15px] font-semibold text-[#1A1F2B]">Registration record</h3>
          <Field label="Registered name">{text("legalNameTh")}</Field>
          <Field label="Registration no.">{text("registrationNumber")}</Field>
          <Field label="Juristic type">{text("legalEntityTypeTh")}</Field>
          <Field label="Status">{text("legalEntityStatusTh")}</Field>
          <Field label="Registered date">{text("registrationDateThRaw", "30 พ.ค. 2555")}</Field>
          <Field label="Registered capital">{text("registeredCapitalThRaw")}</Field>
          <Field label="Last registered ID">{text("previousRegistrationNumber")}</Field>
          <Field label="Business group">{text("businessGroupTh")}</Field>
          <Field label="Business size">{text("businessSize")}</Field>
          <Field label="Website">{text("website")}</Field>
          <Field label="Head office">
            <Textarea
              value={draft.headOfficeAddressTh ?? ""}
              onChange={(e) => set("headOfficeAddressTh", e.target.value || null)}
              className="min-h-[74px] text-[13px]"
            />
          </Field>
          <Field label="Filing years (BE)">
            <Input
              value={draft.submissionYearsBe.join(", ")}
              placeholder="2568, 2567, 2566"
              onChange={(e) =>
                set(
                  "submissionYearsBe",
                  e.target.value
                    .split(/[^0-9]+/)
                    .map(Number)
                    .filter((n) => n >= 2400 && n <= 2699),
                )
              }
              className="h-9 text-[13px]"
            />
          </Field>
        </section>

        <div className="flex flex-col gap-5">
          <section className="rounded-[10px] border border-[#E3E6EB] bg-white p-5">
            <h3 className="mb-3 text-[15px] font-semibold text-[#1A1F2B]">Directors</h3>
            <div className="flex flex-col gap-2">
              {draft.directors.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-6 text-center font-mono text-[12px] text-[#8B93A5]">
                    {i + 1}
                  </span>
                  <Input
                    value={d.nameTh}
                    onChange={(e) =>
                      setDraft((prev) => {
                        const next = [...prev.directors];
                        next[i] = { ...next[i], nameTh: e.target.value };
                        return { ...prev, directors: next };
                      })
                    }
                    className="h-9 text-[13px]"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={i === 0}
                    onClick={() =>
                      setDraft((prev) => {
                        const next = [...prev.directors];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        return { ...prev, directors: next };
                      })
                    }
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={i === draft.directors.length - 1}
                    onClick={() =>
                      setDraft((prev) => {
                        const next = [...prev.directors];
                        [next[i + 1], next[i]] = [next[i], next[i + 1]];
                        return { ...prev, directors: next };
                      })
                    }
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        directors: prev.directors.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    directors: [
                      ...prev.directors,
                      { displayOrder: prev.directors.length + 1, nameTh: "" },
                    ],
                  }))
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add director
              </Button>
            </div>
            <div className="mt-4">
              <div className="mb-1.5 text-[13px] text-[#636C80]">Signing authority</div>
              <Textarea
                value={draft.authorizedSignatoryTh ?? ""}
                onChange={(e) => set("authorizedSignatoryTh", e.target.value || null)}
                className="min-h-[74px] text-[13px]"
              />
            </div>
          </section>

          <section className="rounded-[10px] border border-[#E3E6EB] bg-white p-5">
            <h3 className="mb-3 text-[15px] font-semibold text-[#1A1F2B]">Business activity</h3>
            <Field label="TSIC (at registration)">
              <Input
                value={draft.registeredBusiness.code ?? ""}
                onChange={(e) =>
                  set("registeredBusiness", {
                    ...draft.registeredBusiness,
                    code: e.target.value || null,
                  })
                }
                className="h-9 text-[13px]"
              />
            </Field>
            <Field label="Activity (at registration)">
              <Textarea
                value={draft.registeredBusiness.descriptionTh ?? ""}
                onChange={(e) =>
                  set("registeredBusiness", {
                    ...draft.registeredBusiness,
                    descriptionTh: e.target.value || null,
                  })
                }
                className="min-h-[60px] text-[13px]"
              />
            </Field>
            <Field label="Objective (at registration)">
              <Textarea
                value={draft.registeredBusiness.objectiveTh ?? ""}
                onChange={(e) =>
                  set("registeredBusiness", {
                    ...draft.registeredBusiness,
                    objectiveTh: e.target.value || null,
                  })
                }
                className="min-h-[60px] text-[13px]"
              />
            </Field>
            <Field label="TSIC (latest filing)">
              <Input
                value={draft.latestBusiness.code ?? ""}
                onChange={(e) =>
                  set("latestBusiness", { ...draft.latestBusiness, code: e.target.value || null })
                }
                className="h-9 text-[13px]"
              />
            </Field>
            <Field label="Activity (latest filing)">
              <Textarea
                value={draft.latestBusiness.descriptionTh ?? ""}
                onChange={(e) =>
                  set("latestBusiness", {
                    ...draft.latestBusiness,
                    descriptionTh: e.target.value || null,
                  })
                }
                className="min-h-[60px] text-[13px]"
              />
            </Field>
            <Field label="Objective (latest filing)">
              <Textarea
                value={draft.latestBusiness.objectiveTh ?? ""}
                onChange={(e) =>
                  set("latestBusiness", {
                    ...draft.latestBusiness,
                    objectiveTh: e.target.value || null,
                  })
                }
                className="min-h-[60px] text-[13px]"
              />
            </Field>
          </section>
        </div>
      </div>
    </div>
  );
}
