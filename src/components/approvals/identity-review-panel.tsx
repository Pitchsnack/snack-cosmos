import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Pencil, ShieldCheck, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/i18n/language";
import { fixIdentityFinding, getIdentityReview } from "@/lib/identity-review.functions";
import type { IdentityFinding, IdentityReviewKind, IdentityReviewResult } from "@/lib/identity-review";

export function useIdentityReview(kind: IdentityReviewKind, itemId: string | null | undefined) {
  const fn = useServerFn(getIdentityReview);
  return useQuery({
    queryKey: ["identity-review", kind, itemId],
    queryFn: () => fn({ data: { kind, id: itemId! } }),
    enabled: !!itemId,
    staleTime: 0,
  });
}
function translatedLabel(label: string, t: (s: string) => string) {
  const [base, suffix] = label.split(" · ");
  return `${t(base)}${suffix ? ` · ${suffix}` : ""}`;
}
function actionLabel(finding: IdentityFinding, t: (s: string) => string) {
  const replacement = /^Change to "(.*)"$/.exec(finding.suggestion)?.[1];
  return replacement === undefined ? t("Remove it") : t('Change to "{word}"').replace("{word}", replacement);
}
function context(value: string, finding: IdentityFinding) {
  const from = Math.max(0, finding.start - 65), to = Math.min(value.length, finding.end + 65);
  return { before: `${from ? "…" : ""}${value.slice(from, finding.start)}`, after: `${value.slice(finding.end, to)}${to < value.length ? "…" : ""}` };
}
function FlaggedSentence({ value, finding, fixed = false }: { value: string; finding: IdentityFinding; fixed?: boolean }) {
  const { t } = useTranslation(), c = context(value, finding);
  return <span className="identity-sentence">{c.before}<mark className={fixed ? "identity-fixed" : "identity-hit"}>{fixed ? finding.replacement || t("Removed") : finding.term}</mark>{c.after}{fixed && <small>{t("was")} “{finding.term}”</small>}</span>;
}
function HighlightedValue({ value, findings, fixed }: { value: string; findings: IdentityFinding[]; fixed: IdentityFinding[] }) {
  const ranges = [
    ...findings.map(f => ({ start: f.start, end: f.end, fixed: false, id: f.id })),
    ...fixed.filter(f => f.replacement).map(f => {
      const start = value.toLowerCase().indexOf(f.replacement.toLowerCase());
      return { start, end: start < 0 ? -1 : start + f.replacement.length, fixed: true, id: `fixed-${f.id}` };
    }).filter(r => r.start >= 0),
  ].sort((a, b) => a.start - b.start);
  if (!ranges.length) return <>{value}</>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    parts.push(value.slice(cursor, range.start), <mark className={range.fixed ? "identity-fixed" : "identity-hit"} key={range.id}>{value.slice(range.start, range.end)}</mark>);
    cursor = range.end;
  }
  parts.push(value.slice(cursor));
  return <>{parts}</>;
}

export function IdentityReviewPanel({ kind, itemId, beforeAction, onChanged }: {
  kind: IdentityReviewKind;
  itemId: string;
  /** Save other unsaved Admin review fields before a direct identity fix. */
  beforeAction?: () => Promise<void> | void;
  onChanged?: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const query = useIdentityReview(kind, itemId);
  const fix = useServerFn(fixIdentityFinding);
  const [editing, setEditing] = useState<IdentityFinding | null>(null);
  const [value, setValue] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const editButtons = useRef(new Map<string, HTMLButtonElement>());
  const review = query.data;
  const key = ["identity-review", kind, itemId];
  const mutation = useMutation({
    mutationFn: async ({ finding, custom }: { finding: IdentityFinding; custom?: string }) => {
      await beforeAction?.();
      return fix({ data: { kind, id: itemId, findingId: finding.id, ...(custom === undefined ? {} : { value: custom }) } });
    },
    onSuccess: (result, input) => {
      qc.setQueryData(key, result);
      void qc.invalidateQueries({ queryKey: ["one-step-approvals"] });
      onChanged?.();
      setEditing(null);
      toast.success(t("Identity wording updated. The change is logged."));
      if (input.custom === undefined) setTimeout(() => heading.current?.focus(), 0);
      else setTimeout(() => editButtons.current.get(input.finding.id)?.focus(), 0);
    },
    onError: (error: Error) => toast.error(t(error.message)),
  });
  useEffect(() => {
    if (!editing || !review) return;
    setValue(review.fields[editing.field] ?? "");
    const timer = window.setTimeout(() => {
      area.current?.focus();
      area.current?.setSelectionRange(editing.start, editing.end);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (query.isLoading) return <section aria-label={t("Identity check")}><h3>{t("Identity check")}</h3><p className="os-muted">{t("Loading…")}</p></section>;
  if (query.error) return <section aria-label={t("Identity check")}><h3>{t("Identity check")}</h3><p className="text-destructive">{(query.error as Error).message}</p></section>;
  if (!review) return null;
  const unresolved = review.findings, fixed = review.fixed;
  const affected = [...new Set([...unresolved, ...fixed].map(f => f.field))];
  return <section className="identity-review" aria-labelledby={`identity-${itemId}`}>
    <div className="os-section-head"><div><h3 ref={heading} tabIndex={-1} id={`identity-${itemId}`}>{t("Identity check")}</h3><p className="os-muted">{t("These words could identify the company before an NDA.")}</p></div><div className="os-summary">
      <span className={`os-chip ${unresolved.length ? "os-warn" : "os-green"}`}>{unresolved.length ? unresolved.length === 1 ? t("1 to check") : t("{n} to check").replace("{n}", String(unresolved.length)) : <><Check size={13} />{t("Nothing found")}</>}</span>
      {!!fixed.length && <span className="os-chip os-green">{t("{n} fixed").replace("{n}", String(fixed.length))}</span>}
    </div></div>
    {!unresolved.length && !fixed.length ? <p className="identity-clear"><ShieldCheck size={16} />{t("Nothing found")}</p> : <>
      <div className="identity-findings" role="list">
        {unresolved.map(finding => <div className="identity-finding" role="listitem" key={finding.id}>
          <div className="identity-finding-text"><FlaggedSentence value={review.fields[finding.field] ?? ""} finding={finding} /><small>{t(finding.reason)} · {translatedLabel(finding.label, t)}</small></div>
          <div className="identity-finding-actions"><div><Button type="button" size="sm" variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate({ finding })}><WandSparkles size={14} />{actionLabel(finding, t)}</Button><Button type="button" size="sm" variant="outline" ref={el => { if (el) editButtons.current.set(finding.id, el); }} disabled={mutation.isPending} onClick={() => setEditing(finding)}><Pencil size={14} />{t("Edit")}</Button></div></div>
        </div>)}
        {fixed.map(finding => <div className="identity-finding is-fixed" role="listitem" key={`fixed-${finding.id}`}>
          <div className="identity-finding-text"><FlaggedSentence value={review.originalFields[finding.field] ?? ""} finding={finding} fixed /><small>{t(finding.reason)} · {translatedLabel(finding.label, t)}</small></div>
          <span className="os-result-ok"><Check size={14} />{t("Fixed")}</span>
        </div>)}
      </div>
      <div className="identity-preview"><h4>{t("Public text preview")}</h4>{affected.map(field => <div key={field}><span>{translatedLabel(unresolved.find(f => f.field === field)?.label ?? fixed.find(f => f.field === field)?.label ?? field, t)}</span><p>{<HighlightedValue value={review.fields[field] ?? ""} findings={unresolved.filter(f => f.field === field)} fixed={fixed.filter(f => f.field === field)} />}</p></div>)}</div>
    </>}
    <Dialog open={!!editing} onOpenChange={open => { if (!open && !mutation.isPending) setEditing(null); }}><DialogContent className="max-w-[720px]" aria-describedby="identity-edit-description">
      <DialogTitle>{editing ? translatedLabel(editing.label, t) : t("Edit")}</DialogTitle>
      <DialogDescription id="identity-edit-description">{editing ? `${t(editing.reason)} · ${t("The flagged words are selected. Save only changes this public field; the change is logged.")}` : ""}</DialogDescription>
      <Textarea ref={area} rows={7} value={value} onChange={e => setValue(e.target.value)} lang={editing?.field.endsWith("_th") ? "th" : "en"} />
      <div className="os-actions"><Button variant="outline" disabled={mutation.isPending} onClick={() => setEditing(null)}>{t("Cancel")}</Button><Button disabled={mutation.isPending || !editing} onClick={() => editing && mutation.mutate({ finding: editing, custom: value })}>{t("Save")}</Button></div>
    </DialogContent></Dialog>
  </section>;
}
