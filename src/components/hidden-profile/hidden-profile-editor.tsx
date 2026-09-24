import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  COVER_ARTS,
  DEAL_TYPES,
  HIDDEN_FIELD_LABEL,
  OPEN_TO,
  decadeOf,
  exactMoney,
  missingForPublish,
  moneyRange,
  pickDraft,
  runIdentityCheck,
  staffRange,
  suggestCodeName,
  type EntryFacts,
  type HiddenDraft,
  type HiddenProfileRow,
  type HiddenTextField,
} from "@/lib/hidden-profile";
import { useHiddenProfileActions } from "@/hooks/use-hidden-profiles";
import { cn } from "@/lib/utils";

export function HiddenProfileEditor({
  row,
  facts,
  directoryDescription,
  onBack,
  autoPublish,
}: {
  row: HiddenProfileRow;
  facts: EntryFacts | undefined;
  directoryDescription?: string | null;
  onBack: () => void;
  autoPublish?: boolean;
}) {
  const [d, setD] = useState<HiddenDraft>(() => pickDraft(row));
  useEffect(() => setD(pickDraft(row)), [row.id, row.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
  const a = useHiddenProfileActions();
  const [confirm, setConfirm] = useState<null | "publish" | "unpublish">(autoPublish ? "publish" : null);
  const set = <K extends keyof HiddenDraft>(k: K, v: HiddenDraft[K]) => setD((p) => ({ ...p, [k]: v }));

  const findings = useMemo(() => (facts ? runIdentityCheck(d, facts) : []), [d, facts]);
  const missing = useMemo(() => missingForPublish(d), [d]);
  const byField = useMemo(() => {
    const m = new Map<HiddenTextField, string[]>();
    for (const f of findings) m.set(f.field, [...(m.get(f.field) ?? []), `"${f.term}" (${f.reason.toLowerCase()})`]);
    return m;
  }, [findings]);
  const canPublish = findings.length === 0 && missing.length === 0;
  const dirty = JSON.stringify(pickDraft(row)) !== JSON.stringify(d);
  const isLive = row.status === "live";
  const liveChanged = isLive && (row.has_unpublished_changes || dirty);
  const busy = a.save.isPending || a.publish.isPending || a.unpublish.isPending || a.discard.isPending;
  const payload = { startupId: row.startup_id, draft: { ...d, highlights: d.highlights.map((h) => h.trim()) } };
  const f = facts ?? ({} as EntryFacts);

  const flagCls = (k: HiddenTextField) => (byField.has(k) ? "border-destructive focus-visible:ring-destructive" : "");
  const Msg = ({ k }: { k: HiddenTextField }) =>
    byField.has(k) ? <p className="text-[11px] text-destructive">Could name the company: {byField.get(k)!.join(", ")}</p> : null;

  return (
    <div className="flex min-h-[60vh] flex-col">
      <div className="flex-1 space-y-5 pb-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to the hidden profile
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Edit hidden profile</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{isLive ? (liveChanged ? "Live · edited" : "Live") : "Draft"}</span>
        </div>

        <div className={cn("rounded-md border px-3 py-2 text-xs", findings.length ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400")}>
          {findings.length ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-medium"><AlertTriangle className="h-3.5 w-3.5" />Identity check: {findings.length} detail{findings.length === 1 ? "" : "s"} could name the company</div>
              <ul className="list-disc pl-5">
                {[...byField.keys()].map((k) => (
                  <li key={k}><a href={`#hp-${k}`} className="underline">{HIDDEN_FIELD_LABEL[k]}</a></li>
                ))}
              </ul>
            </div>
          ) : (
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />Identity check: Passed</span>
          )}
        </div>

        <Section n={1} title="Anonymous identity">
          <Field id="code_name" label="Code name (unique in the Marketplace)">
            <div className="flex gap-2">
              <Input id="hp-code_name" value={d.code_name} onChange={(e) => set("code_name", e.target.value)} className={flagCls("code_name")} />
              <Button type="button" variant="outline" onClick={() => set("code_name", suggestCodeName())}><Sparkles className="mr-1.5 h-3.5 w-3.5" />Suggest</Button>
            </div>
            <Msg k="code_name" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ref no."><Input value={row.ref_no} readOnly disabled /></Field>
            <Field label="Marketplace tab"><Input value="SME Takeover" readOnly disabled /></Field>
          </div>
          <Field label="Region (shown instead of the city)"><Input value={d.region ?? ""} onChange={(e) => set("region", e.target.value || null)} /></Field>
          <Field label="Sector image (never the company's photos)">
            <Select value={d.cover_art ?? ""} onValueChange={(v) => set("cover_art", v)}>
              <SelectTrigger><SelectValue placeholder="Pick a sector image" /></SelectTrigger>
              <SelectContent>{COVER_ARTS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </Section>

        <Section n={2} title="Teaser text">
          {directoryDescription && (
            <div className="rounded-md border border-dashed border-border bg-muted/30 p-2 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">Directory description — Admin only, don't reuse it: it names the company</div>
              {directoryDescription}
            </div>
          )}
          <Field label={`Headline (${d.headline.length}/120)`}>
            <Input id="hp-headline" maxLength={120} value={d.headline} onChange={(e) => set("headline", e.target.value)} className={flagCls("headline")} />
            <Msg k="headline" />
          </Field>
          <Field label={`Description (${d.description.length}/420)`}>
            <Textarea id="hp-description" maxLength={420} rows={4} value={d.description} onChange={(e) => set("description", e.target.value)} className={flagCls("description")} />
            <Msg k="description" />
          </Field>
          <Field label="Highlights (3 required)">
            <div id="hp-highlights" className="space-y-1.5">
              {d.highlights.map((h, i) => (
                <Input key={i} value={h} placeholder={`Highlight ${i + 1}${i < 3 ? "" : " (optional)"}`} onChange={(e) => set("highlights", d.highlights.map((x, j) => (j === i ? e.target.value : x)))} className={flagCls("highlights")} />
              ))}
            </div>
            <Msg k="highlights" />
          </Field>
          <Field label="Customers, described without names">
            <Textarea id="hp-customers_summary" rows={2} value={d.customers_summary} onChange={(e) => set("customers_summary", e.target.value)} className={flagCls("customers_summary")} />
            <Msg k="customers_summary" />
          </Field>
        </Section>

        <Section n={3} title="Deal terms">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Asking price (฿M)">
              <Input type="number" min={0} disabled={d.asking_price == null} value={d.asking_price ?? ""} onChange={(e) => set("asking_price", e.target.value === "" ? 0 : Number(e.target.value))} />
              <label className="mt-1 flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={d.asking_price == null} onChange={(e) => set("asking_price", e.target.checked ? null : 0)} /> Price on request
              </label>
            </Field>
            <Field label="Stake %"><Input type="number" min={1} max={100} value={d.stake_pct ?? ""} onChange={(e) => set("stake_pct", e.target.value === "" ? null : Number(e.target.value))} /></Field>
          </div>
          <Field label="Deal type">
            <Select value={d.deal_type ?? ""} onValueChange={(v) => set("deal_type", v)}>
              <SelectTrigger><SelectValue placeholder="Pick a deal type" /></SelectTrigger>
              <SelectContent>{DEAL_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {(["structure", "reason", "handover", "process"] as const).map((k) => (
            <Field key={k} label={HIDDEN_FIELD_LABEL[k]}>
              <Textarea id={`hp-${k}`} rows={2} value={d[k] ?? ""} onChange={(e) => set(k, e.target.value || null)} className={flagCls(k)} />
              <Msg k={k} />
            </Field>
          ))}
          <Field label="Open to">
            <div className="flex flex-wrap gap-3 text-sm">
              {OPEN_TO.map((o) => (
                <label key={o} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={d.open_to.includes(o)} onChange={(e) => set("open_to", e.target.checked ? [...d.open_to, o] : d.open_to.filter((x) => x !== o))} /> {o}
                </label>
              ))}
            </div>
          </Field>
        </Section>

        <Section n={4} title="Figures (read-only)">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase text-muted-foreground"><tr><th>Field</th><th>Exact</th><th>Buyers see</th></tr></thead>
            <tbody>
              {[
                ["Revenue", exactMoney(f.last_year_revenue), moneyRange(f.last_year_revenue)],
                ["EBITDA and margin", "From financials", "Range · about N%"],
                ["Employees", f.company_size, staffRange(f.company_size)],
                ["Founded", f.year_founded ? String(f.year_founded) : null, decadeOf(f.year_founded)],
                ["Location", [f.city, f.headquarters].filter(Boolean).join(", "), d.region],
                ["Photos", "Company photos", "Sector image"],
                ["Data room", "Documents", "Hidden until NDA"],
              ].map(([k, x, y]) => (
                <tr key={k as string} className="border-t border-border"><td className="py-1.5">{k}</td><td className="text-muted-foreground">{x || "—"}</td><td>{y || "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section n={5} title="Seller and NDA requests">
          <p className="text-xs text-muted-foreground">Seller account: none yet. On approval, contacts are exchanged as today.</p>
          <Field label="Who approves NDA requests">
            <Select value={d.nda_approver} onValueChange={(v) => set("nda_approver", v as "seller" | "admin")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin, for the seller</SelectItem>
                <SelectItem value="seller">The seller</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Section>

        {missing.length > 0 && (
          <p className="text-xs text-muted-foreground">Still needed to publish: {missing.join(", ")}.</p>
        )}
      </div>

      <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center gap-2 border-t border-border bg-background/95 px-5 py-3 backdrop-blur">
        {isLive && liveChanged && <span className="w-full text-xs text-muted-foreground">Your changes aren't published yet. Buyers still see the published version.</span>}
        {!isLive ? (
          <>
            <Button variant="outline" disabled={busy || !dirty} onClick={() => a.save.mutate(payload)}>Save draft</Button>
            <Button disabled={busy || !canPublish} onClick={() => setConfirm("publish")} className="ml-auto bg-accent text-accent-foreground hover:bg-accent/90">Publish to Marketplace</Button>
          </>
        ) : liveChanged ? (
          <>
            {dirty && <Button variant="outline" disabled={busy} onClick={() => a.save.mutate(payload)}>Save</Button>}
            <Button variant="ghost" disabled={busy} onClick={() => a.discard.mutate({ startupId: row.startup_id })}>Discard changes</Button>
            <Button disabled={busy || !canPublish} onClick={() => setConfirm("publish")} className="ml-auto bg-accent text-accent-foreground hover:bg-accent/90">Publish changes</Button>
          </>
        ) : (
          <>
            <Button variant="outline" disabled={busy} onClick={() => setConfirm("unpublish")}>Unpublish</Button>
            <Button variant="outline" asChild className="ml-auto"><Link to="/marketplace">View in Marketplace</Link></Button>
          </>
        )}
      </div>

      <AlertDialog open={confirm === "publish"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish {d.code_name} to SME Takeover?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p><strong>Buyers see:</strong> code name, sector image, region, headline, description, highlights, customers described, deal terms, and revenue and staff as ranges.</p>
                <p><strong>Hidden until the NDA:</strong> company name, logo, photos, website, email, LinkedIn, address, people's names, exact figures and the data room.</p>
                <p><strong>NDA requests approved by:</strong> {d.nda_approver === "seller" ? "the seller" : "Admin, for the seller"}.</p>
                <p className={canPublish ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}>Identity check: {canPublish ? "Passed" : "Not passed"}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={!canPublish} onClick={() => a.publish.mutate(payload)} className="bg-accent text-accent-foreground hover:bg-accent/90">Publish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === "unpublish"} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unpublish {row.live?.code_name ?? d.code_name}?</AlertDialogTitle>
            <AlertDialogDescription>Buyers can no longer find the listing, and it goes back to draft.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => a.unpublish.mutate({ startupId: row.startup_id })}>Unpublish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-semibold">{n}. {title}</h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { id?: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
