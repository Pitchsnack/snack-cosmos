import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck, Clock, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getMyVerification, submitVerification } from "@/lib/approvals.functions";
import { useHasSession } from "@/hooks/use-has-session";

export function useMyVerification() {
  const fn = useServerFn(getMyVerification);
  const enabled = useHasSession();
  return useQuery({ queryKey: ["my-verification"], queryFn: () => fn(), enabled, staleTime: 60_000 });
}

const TYPES = ["Private equity", "Family office", "Corporate", "Individual investor", "Search fund"];

/** Buyer setup's final step: submit for verification, then show the status. */
export function BuyerVerificationCard() {
  const { data, isLoading } = useMyVerification();
  const fn = useServerFn(submitVerification);
  const qc = useQueryClient();
  const req = data?.request as Record<string, any> | null | undefined;
  const [f, setF] = useState({ company_name: "", buyer_type: "", registration_no: "", work_email: "", website: "", linkedin: "" });
  useEffect(() => {
    if (req) setF({
      company_name: req.company_name ?? "", buyer_type: req.buyer_type ?? "", registration_no: req.registration_no ?? "",
      work_email: req.work_email ?? "", website: req.website ?? "", linkedin: req.linkedin ?? "",
    });
  }, [req]);
  const m = useMutation({
    mutationFn: () => fn({ data: { ...f, buyer_type: f.buyer_type || undefined, registration_no: f.registration_no || undefined, website: f.website || undefined, linkedin: f.linkedin || undefined } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-verification"] }); toast.success("Submitted for verification"); },
    onError: (e) => toast.error((e as Error).message),
  });
  if (isLoading) return null;
  const status = data?.verified ? "verified" : (req?.status as string | undefined);
  if (status === "verified")
    return <Banner icon={<ShieldCheck className="h-4 w-4" />} tone="border-emerald-200 bg-emerald-50 text-emerald-900" text="Verified buyer · you can request NDAs." />;
  if (status === "pending")
    return <Banner icon={<Clock className="h-4 w-4" />} tone="border-blue-200 bg-blue-50 text-blue-900" text="Pending verification. You can browse and save listings; NDA requests open once Admin verifies you (usually within 1 business day)." />;

  const domainDiffers = f.website && f.work_email.includes("@") &&
    f.work_email.split("@")[1].toLowerCase() !== f.website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  return (
    <div className="rounded-[14px] border border-border bg-card p-5">
      {status === "more_info" && <Banner icon={<AlertTriangle className="h-4 w-4" />} tone="mb-4 border-amber-200 bg-amber-50 text-amber-900" text={`More info needed: ${req?.decision_note ?? ""}`} />}
      {status === "declined" && <Banner icon={<XCircle className="h-4 w-4" />} tone="mb-4 border-red-200 bg-red-50 text-red-900" text={`Verification declined: ${req?.decision_note ?? ""}`} />}
      <h3 className="text-[15px] font-bold">Submit for verification</h3>
      <p className="mb-4 text-[13px] text-muted-foreground">Verified buyers can request NDAs. Admin checks your company and work email.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Company / fund name *"><Input value={f.company_name} onChange={set("company_name")} maxLength={200} /></Field>
        <Field label="Buyer type">
          <Select value={f.buyer_type} onValueChange={(v) => setF((p) => ({ ...p, buyer_type: v }))}>
            <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
            <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Registration number"><Input value={f.registration_no} onChange={set("registration_no")} maxLength={60} /></Field>
        <Field label="Company website"><Input value={f.website} onChange={set("website")} placeholder="https://" maxLength={255} /></Field>
        <Field label="Work email *">
          <Input type="email" value={f.work_email} onChange={set("work_email")} maxLength={255} />
          {domainDiffers && <p className="mt-1 text-[11.5px] text-amber-700">Email domain differs from the website — Admin may ask for more info.</p>}
        </Field>
        <Field label="LinkedIn"><Input value={f.linkedin} onChange={set("linkedin")} maxLength={255} /></Field>
      </div>
      <div className="mt-4 flex justify-end">
        <Button disabled={m.isPending || !f.company_name.trim() || !f.work_email.includes("@")} onClick={() => m.mutate()}>
          {m.isPending ? "Submitting…" : "Submit for verification"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-[12px]">{label}</Label>{children}</div>;
}
function Banner({ icon, tone, text }: { icon: React.ReactNode; tone: string; text: string }) {
  return <div className={`flex items-start gap-2 rounded-[10px] border px-3 py-2.5 text-[13px] ${tone}`}><span className="mt-0.5">{icon}</span>{text}</div>;
}
