import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Clock, ExternalLink, Lock, Pencil, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DECISION_REASONS, decideOneStep, listOneStepApprovals, markReviewCheck } from "@/lib/approvals-one-step.functions";
import type { OneStepItem, OneStepKind, ReviewRow } from "@/lib/one-step.server";
import { approvalDate, approvalFullDate, approvalWaitingDays } from "@/lib/approval-date";
import { useTranslation } from "@/i18n/language";
import { SectorArt } from "@/components/hidden-profile/bits";
import { DbdStorePanel } from "./dbd-store-panel";

const KEY = ["one-step-approvals"];
const DEFAULT_NOTE = "Your business details do not match the registered company number. Please check and confirm the information before submitting.";
const QUEUE = {
  seller: ["Sellers to verify and publish", "One review per seller: what buyers will see, and the checks on the company and its owner. Oldest first.", "No sellers are waiting. New ones show here when they submit their listing."],
  buyer: ["Buyers to verify and publish", "One review per buyer: what sellers will see, and the checks on the firm. Oldest first.", "No buyers are waiting. New ones show here when they submit their profile."],
  advisor: ["Advisors to verify and publish", "One review per firm: what sellers and buyers will see, and the checks on the firm. Oldest first.", "No advisors are waiting. New ones show here when they submit their profile."],
};
export function useOneStepApprovals() {
  const fn = useServerFn(listOneStepApprovals);
  return useQuery({ queryKey: KEY, queryFn: () => fn(), staleTime: 15_000 });
}
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase(); }
function Status({ item }: { item: OneStepItem }) {
  const { t, language } = useTranslation();
  return <span className={`os-chip ${item.chip === "sent_back" ? "os-warn" : "os-blue"}`}><Clock size={13} />{item.chip === "sent_back" ? `${t("Changes requested")} · ${t("Sent back {date}").replace("{date}", approvalDate(item.sentBackAt, language))}` : `${t("Waiting")} · ${t("first check")}`}</span>;
}
export function OneStepApprovals({ kind, openId, onOpen }: { kind: OneStepKind; openId?: string; onOpen?: (id: string | undefined) => void }) {
  const { t, language } = useTranslation();
  const { data, isLoading, error } = useOneStepApprovals();
  const items = data?.[kind === "seller" ? "sellers" : kind === "buyer" ? "buyers" : "advisors"] ?? [];
  const [sel, setSel] = useState<string | null>(openId ?? null);
  useEffect(() => { if (openId !== undefined) setSel(openId ?? null); }, [openId]);
  const current = items.find(i => i.id === sel);
  const pick = (id: string | null) => { setSel(id); onOpen?.(id ?? undefined); };
  const waiting = (iso: string | null) => { const n = approvalWaitingDays(iso); return n ? t(n === 1 ? "waiting {n} day" : "waiting {n} days").replace("{n}", String(n)) : t("waiting today"); };
  return <div className="os-split">
    <aside className="os-queue"><h2>{t(QUEUE[kind][0])}</h2><p className="os-muted">{t(QUEUE[kind][1])}</p>
      {error ? <p className="text-destructive">{(error as Error).message}</p> : isLoading ? <p>{t("Loading…")}</p> : !items.length ? <p className="os-empty">{t(QUEUE[kind][2])}</p> : items.map(i => <Button variant="unstyled" size="unstyled" key={i.id} className="os-queue-item" aria-pressed={sel === i.id} onClick={() => pick(i.id)}>
        <span className="os-queue-name"><span className="os-tile">{initials(i.name)}</span><strong>{i.name}</strong></span>
        <span className="os-muted">{[i.ref, t(i.type ?? ""), t(i.place ?? "")].filter(Boolean).join(" · ")}</span>
        <span className={approvalWaitingDays(i.submittedAt) && i.chip === "waiting" ? "os-late" : "os-muted"}>{i.chip === "sent_back" ? `${t("Sent back {date}").replace("{date}", approvalDate(i.sentBackAt, language))} · ${t(`waiting for the ${kind}`)}` : `${t("Submitted {date}").replace("{date}", approvalDate(i.submittedAt, language))} · ${waiting(i.submittedAt)}`}</span><Status item={i} />
      </Button>)}
    </aside>
    <div className="os-review">{current ? <ReviewPanel key={current.id} item={current} onDone={() => pick(null)} /> : <p className="os-empty">{t("Choose a profile on the left to review it.")}</p>}</div>
  </div>;
}
function ReviewPanel({ item, onDone }: { item: OneStepItem; onDone: () => void }) {
  const { t, language } = useTranslation();
  const qc = useQueryClient();
  const decide = useServerFn(decideOneStep), mark = useServerFn(markReviewCheck);
  const [name, setName] = useState(item.suggestedName ?? "");
  const [headline, setHeadline] = useState(item.suggestedHeadline ?? "");
  const [dialog, setDialog] = useState<"approve" | "request_changes" | "decline" | null>(null);
  const [reasons, setReasons] = useState<string[]>([]), [note, setNote] = useState(t(DEFAULT_NOTE));
  const [invalid, setInvalid] = useState(false), [reasonError, setReasonError] = useState("");
  const r = item.review, first = (item.person ?? "").split(" ")[0] || item.name;
  const fill = (text: string, values: Record<string, string> = {}) => Object.entries({ name: item.name, "first name": first, ref: item.ref, "listing name": name, ...values }).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), t(text));
  const browse = item.kind === "seller" ? "Browse listings" : item.kind === "buyer" ? "Browse investors" : "Browse advisors";
  const badge = item.kind === "seller" ? "Certified" : item.kind === "buyer" ? "Verified investor" : "Verified advisor";
  const email = item.kind === "seller" ? "Your listing is approved" : "Your profile is approved";
  const rewritten = name.trim() !== (item.suggestedName ?? "").trim() || headline.trim() !== (item.suggestedHeadline ?? "").trim();
  const matches = r.verification.filter(v => v.result === "match" || v.result === "by_hand" && v.checked).length;
  const manual = r.verification.filter(v => v.result === "by_hand" && !v.checked).length;
  const differing = r.verification.filter(v => v.result === "differs" || v.result === "not_given").length;
  const stillOpen = r.verification.filter(v => v.result !== "not_needed" && v.result !== "match" && !(v.result === "by_hand" && v.checked));
  const act = useMutation({
    mutationFn: (action: "approve" | "request_changes" | "decline") => decide({ data: { kind: item.kind, id: item.id, action, publishedName: name, publishedHeadline: headline, reasons, note: note.trim() || undefined } }),
    onSuccess: (_, action) => {
      toast.success(action === "approve" ? fill(`Verified and published. {name} is live in ${browse}.`) : action === "request_changes" ? fill("Request sent to {first name}.") : fill("{name} is declined. {first name} gets an email with the reasons."));
      setDialog(null); void qc.invalidateQueries({ queryKey: KEY }); void qc.invalidateQueries({ queryKey: ["approvals"] }); void qc.invalidateQueries({ queryKey: ["admin-approval-counts"] }); onDone();
    }, onError: (e: Error) => toast.error(t(e.message)),
  });
  const check = useMutation({ mutationFn: (row: string) => mark({ data: { kind: item.kind, id: item.id, row } }), onSuccess: () => { toast.success(t("Marked checked.")); void qc.invalidateQueries({ queryKey: KEY }); }, onError: (e: Error) => toast.error(t(e.message)) });
  const open = (action: "approve" | "request_changes" | "decline") => {
    if (action === "approve") { setInvalid(true); if (!name.trim() || !headline.trim()) return; }
    setReasons([]); setNote(t(DEFAULT_NOTE)); setReasonError(""); setDialog(action);
  };
  const submit = () => {
    if (!dialog) return;
    if (dialog !== "approve" && !reasons.length) { setReasonError(t("Choose at least one reason.")); return; }
    if (dialog !== "approve" && reasons.includes("Another reason") && !note.trim()) { setReasonError(fill("Say what the other reason is, so {first name} knows what to fix.")); return; }
    act.mutate(dialog);
  };
  const dirPath = item.kind === "seller" ? `/startups/${r.directoryId}` : item.kind === "buyer" ? `/investors/${r.directoryId}` : `/advisors/?view=split&selected=${encodeURIComponent(r.directoryId ?? "")}`;
  const description = item.kind === "seller" ? "The seller suggests them. You write the version buyers see in Browse listings." : item.kind === "buyer" ? "The buyer suggests them. You write the version sellers see in Browse investors." : "The advisor suggests them. You write the version sellers and buyers see in Browse advisors.";
  const footer = item.kind === "seller" ? 'Verify and publish verifies {name}, puts {ref} in Browse listings with the Certified badge, and lets {first name} connect with buyers. {first name} gets one email: "Your listing is approved".' : item.kind === "buyer" ? 'Verify and publish verifies {name}, puts {ref} in Browse investors with the Verified investor badge, and opens NDAs for {first name}. {first name} gets one email: "Your profile is approved".' : 'Verify and publish verifies {name} and puts {ref} in Browse advisors with the Verified advisor badge. {first name} gets one email: "Your profile is approved".';
  return <article className="os-panel">
    <header className="os-header"><span className="os-tile">{initials(item.name)}</span><div className="os-heading"><Status item={item} /><h2>{item.name}</h2><p className="os-muted">{[item.ref, t(item.type ?? ""), t(item.place ?? "")].filter(Boolean).join(" · ")} · {fill("submitted {date} by {name}", { date: approvalDate(item.submittedAt, language), name: item.person ?? t("Not given") })} · {approvalWaitingDays(item.submittedAt) ? fill(approvalWaitingDays(item.submittedAt) === 1 ? "waiting {n} day" : "waiting {n} days", { n: String(approvalWaitingDays(item.submittedAt)) }) : t("waiting today")}</p></div><div className="os-actions"><Button variant="outline" className="os-decline" disabled={act.isPending} onClick={() => open("decline")}>{t("Decline")}</Button><Button variant="outline" disabled={act.isPending} onClick={() => open("request_changes")}>{t("Request changes")}</Button><Button className="os-approve" disabled={act.isPending} onClick={() => open("approve")}><Check size={16} />{t("Verify and publish")}</Button></div></header>
    <div className="os-directory"><span>{fill("The full record is in {directory}.", { directory: t(r.directory) })}</span>{r.directoryId && <a href={dirPath}>{fill("Open in {directory}", { directory: t(r.directory) })}<ExternalLink size={14} /></a>}</div>
    <div className="os-body">
      {item.chip === "sent_back" && <div className="os-note"><b>{fill("You asked for changes on {date}.", { date: approvalDate(item.sentBackAt, language) })}</b> {fill("It comes back as waiting when {first name} submits again.")} {item.decisionNote && <blockquote>{item.decisionNote}</blockquote>}</div>}
      <section><div className="os-section-head"><div><h3>{t("Listing name and headline")}</h3><p className="os-muted">{t(description)}</p></div><span className={`os-chip ${rewritten ? "os-blue" : "os-grey"}`}>{t(rewritten ? "Rewritten" : `Same as the ${item.kind}'s`)}</span></div>
        <table className="os-table os-name-table"><thead><tr><th>{t("Detail")}</th><th>{t(`The ${item.kind} suggested`)}</th><th>{t("Published as")}</th></tr></thead><tbody>
          <tr><td>{t("Listing name")}</td><td data-label={t(`The ${item.kind} suggested`)}>{item.suggestedName || t("Not given")}</td><td data-label={t("Published as")}><Input aria-label={t("Published listing name")} maxLength={120} value={name} onChange={e => setName(e.target.value)} aria-invalid={invalid && !name.trim()} />{invalid && !name.trim() && <p className="text-destructive">{t("Write a listing name.")}</p>}</td></tr>
          <tr><td>{t("Headline")}</td><td data-label={t(`The ${item.kind} suggested`)}>{item.suggestedHeadline || t("Not given")}</td><td data-label={t("Published as")}><Textarea aria-label={t("Published headline")} rows={2} maxLength={120} value={headline} onChange={e => setHeadline(e.target.value)} aria-invalid={invalid && !headline.trim()} />{invalid && !headline.trim() && <p className="text-destructive">{t("Write a headline.")}</p>}</td></tr>
        </tbody></table>
      </section>
      <section>{!r.individual && <DbdStorePanel reg={r.dbd.registrationNo} initial={r.dbd} onChanged={() => void qc.invalidateQueries({ queryKey: KEY })} />}
        <div className="os-section-head"><div><h3>{t("Verification")}</h3><p className="os-muted">{r.individual ? t("An individual investor: no registration number to verify with.") : fill("Verify with registration number {number}.", { number: r.registrationNo ?? "—" })}</p></div><div className="os-summary">{!!matches && <span className="os-chip os-green"><Check size={13} />{fill("{n} match", { n: String(matches) })}</span>}{!!manual && <span className="os-chip os-grey">{fill("{n} to check by hand", { n: String(manual) })}</span>}{!!differing && <span className="os-chip os-warn">{fill(differing === 1 ? "{n} differs" : "{n} differ", { n: String(differing) })}</span>}</div></div>
        <table className="os-table"><thead><tr><th>{t("Detail")}</th><th>{t(`From the ${item.kind}`)}</th><th>{t("Company verification")}</th><th>{t("Result")}</th></tr></thead><tbody>{r.verification.map(v => <tr key={v.key} className={v.result === "differs" || v.result === "not_given" ? "os-diff-row" : ""}>
          <td>{t(v.label)}</td><td data-label={t(`From the ${item.kind}`)} className={!v.from ? "os-muted" : ""}>{reviewText(v.from, t, language) || t("Not given")}</td><td data-label={t("Company verification")}>{reviewText(v.found, t, language)}{v.source && <small>{t(v.source)}</small>}{v.link && <a href={v.link} target="_blank" rel="noreferrer">{t("Open the site")}<ExternalLink size={12} /></a>}</td><td data-label={t("Result")}><span className={v.checked && v.result === "by_hand" || v.result === "match" ? "os-result-ok" : v.result === "differs" || v.result === "not_given" ? "os-result-warn" : "os-muted"}>{v.result === "match" || v.result === "by_hand" && v.checked ? <Check size={14} /> : (v.result === "differs" || v.result === "not_given") && <TriangleAlert size={14} />}{t(v.result === "by_hand" && v.checked ? "Checked" : v.resultLabel ?? "By hand")}</span>{v.result === "by_hand" && !v.checked && <Button variant="outline" size="sm" disabled={check.isPending} onClick={() => check.mutate(v.key)}>{t("Mark checked")}</Button>}</td>
        </tr>)}</tbody></table>
        <div className="os-visual"><h4>{t("For a visual check")}</h4><div>{[["Name", r.personName ?? item.person], ["Position", r.personTitle], ["Email address", r.email], ["Contact number", r.phone]].map(([label, value]) => <div key={label}><span>{t(label ?? "")}</span><strong className={!value ? "os-muted" : ""}>{value || t("Not given")}</strong></div>)}</div></div>
      </section>
      <section><h3>{t(item.kind === "seller" ? "What buyers will see" : item.kind === "buyer" ? "What sellers will see" : "What sellers and buyers will see")}</h3><div className="os-previews"><Preview item={item} name={name} headline={headline} exclusive={false} />{item.kind !== "advisor" && <Preview item={item} name={name} headline={headline} exclusive />}</div></section>
    </div><footer className="os-footer">{fill(footer, { name: item.person ?? item.name })}</footer>
    <Dialog open={!!dialog} onOpenChange={v => !v && setDialog(null)}><DialogContent className="max-w-[660px]" aria-describedby="os-dialog-description"><DialogTitle>{dialog === "approve" ? fill("Verify and publish {name}?") : dialog === "decline" ? fill("Decline {name}?") : t("Request changes")}</DialogTitle>
      {dialog === "approve" ? <><p id="os-dialog-description" className="sr-only">{t("Verify and publish")}</p><ul className="ap-will"><li><Check size={16} />{fill("{name} gets the {badge} badge.", { badge: t(badge) })}</li><li><Check size={16} />{fill(item.kind === "seller" ? '{ref} goes live in Browse listings as "{listing name}", where buyers can find it and request an NDA.' : item.kind === "buyer" ? '{ref} goes live in Browse investors as "{listing name}", where sellers can find and invite it.' : '{ref} goes live in Browse advisors as "{listing name}", where sellers and buyers can find it.')}</li>{item.kind !== "advisor" && <li><Check size={16} />{fill(item.kind === "seller" ? "{first name} can connect with buyers." : "NDAs open for {first name}.")}</li>}<li><Check size={16} />{fill(`{first name} gets one email: "${email}".`)}</li></ul>{!!stillOpen.length && <p className="os-note">{fill("Still open: {list}. You can verify anyway, or go back and check.", { list: stillOpen.map(v => `${t(v.label)} (${t(v.result === "by_hand" ? "check by hand" : (v.resultLabel ?? "differs").toLowerCase())})`).join(" · ") })}</p>}</> : <>
        <p id="os-dialog-description" className="os-muted">{fill(dialog === "request_changes" ? `{first name} gets an email and sees your note on My Company. The ${item.kind === "seller" ? "listing" : "profile"} stays hidden until it's verified and published.` : item.kind === "seller" ? "The listing stays hidden, and {first name} can't connect with buyers. {first name} gets an email with the reasons and can register again." : item.kind === "buyer" ? "The profile stays hidden, and {first name} can't sign NDAs. {first name} gets an email with the reasons and can register again." : "The profile stays hidden from Browse advisors. {first name} gets an email with the reasons and can register again.")}</p>
        <div><h4>{t("Reasons")}</h4><p className="os-muted">{t("Choose one or more")}</p><div className="os-reasons">{DECISION_REASONS.map(reason => <label key={reason}><input type="checkbox" checked={reasons.includes(reason)} onChange={e => setReasons(p => e.target.checked ? [...p, reason] : p.filter(x => x !== reason))} />{t(reason)}</label>)}</div></div>
        <label className="os-note-label" htmlFor="os-note">{fill("Note to {first name}")} <span className="os-muted">{t(reasons.includes("Another reason") ? "Required for Another reason" : "Optional")}</span></label><Textarea id="os-note" rows={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder={fill("What should {first name} change, and why?")} />{reasonError && <p role="alert" className="text-destructive">{reasonError}</p>}
      </>}
      <div className="os-actions"><Button variant="outline" onClick={() => setDialog(null)}>{t("Cancel")}</Button><Button className={dialog === "approve" ? "os-approve" : dialog === "decline" ? "os-decline-solid" : ""} disabled={act.isPending} onClick={submit}>{dialog === "approve" && <Check size={16} />}{t(dialog === "approve" ? "Verify and publish" : dialog === "decline" ? "Decline" : "Send request")}</Button></div>
    </DialogContent></Dialog>
  </article>;
}
function Preview({ item, name, headline, exclusive }: { item: OneStepItem; name: string; headline: string; exclusive: boolean }) {
  const { t } = useTranslation(), c = item.review.card;
  return <div><h4>{t(exclusive ? "Exclusive view" : "Listing view")}</h4><div className="os-preview-card"><div className="os-cover"><SectorArt sector={c.sector ?? c.type} /><span className={`os-chip ${exclusive ? "os-green" : "os-grey"}`}>{exclusive && <Lock size={12} />}{t(exclusive ? "Exclusive view" : item.kind === "advisor" ? "Open to sellers and buyers" : item.kind === "seller" ? "Identity hidden" : "Name hidden")}</span></div><div className="os-preview-content"><h3>{exclusive || item.kind === "advisor" ? c.realName : name || t("Your listing name")}</h3><p className="os-muted">{[exclusive ? name : null, c.ref, t(c.type ?? ""), t(c.place ?? "")].filter(Boolean).join(" · ")}</p><strong>{headline}</strong><p>{c.description}</p><dl>{c.figs.map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd>{t(value)}</dd></div>)}</dl>{exclusive && <div className="os-exclusive">{[["Website", c.website], ["Address", c.address], ["Founded", c.founded], [item.kind === "seller" ? "Owner" : "Contact", c.contact]].filter(([, v]) => !!v).map(([label, value]) => <div key={label}><span>{t(label ?? "")}</span><strong>{value}</strong></div>)}</div>}</div></div></div>;
}
function reviewText(value: string | null, t: (s: string) => string, language: "en" | "th"): string | null {
  if (!value) return value;
  if (value.startsWith("Registered on ")) return t("Registered on {date}").replace("{date}", approvalFullDate(value.slice(14), language));
  let result = t(value);
  if (result !== value) return result;
  if (value.startsWith("Directors: ")) return t("Directors: {names}").replace("{names}", value.slice(11));
  const director = value.match(/^(.*), (who submitted the profile|the owner in About Owner)$/);
  if (director) return t(`{name}, ${director[2]}`).replace("{name}", director[1]);
  const revenue = value.match(/^(.*?) in (\d{4})(.*)$/);
  if (revenue) result = t("{band} in {year}").replace("{band}", t(revenue[1])).replace("{year}", String(Number(revenue[2]) + (language === "th" ? 543 : 0))) + revenue[3].replace(" · the owner's story: ", language === "th" ? " · เรื่องราวของเจ้าของ: " : " · the owner's story: ");
  const filed = value.match(/^(.*?) in the (\d{4}) accounts filed with DBD$/);
  if (filed) result = t("{amount} in the {year} accounts filed with DBD").replace("{amount}", filed[1]).replace("{year}", String(Number(filed[2]) + (language === "th" ? 543 : 0)));
  if (language === "th" && !revenue && !filed) result = result.replace(/\b(19\d{2}|20\d{2})\b/g, y => String(Number(y) + 543)).replace(" · the owner's story: ", " · เรื่องราวของเจ้าของ: ");
  return result;
}
