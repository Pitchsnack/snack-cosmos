import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ClipboardCheck, Clock, ExternalLink, Languages, Lock, Pencil, ShieldCheck, TriangleAlert, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DECISION_REASONS, decideOneStep, listOneStepApprovals, markReviewCheck, saveOneStepReview } from "@/lib/approvals-one-step.functions";
import { rowState, trCounts, type TrRow } from "@/lib/review-translation";
import { TextLangProvider, useTextLang, type TextLang } from "@/components/common/text-lang";
import { TabRow } from "@/components/common/edit-info-popup";
import { StartupEditPopup } from "@/components/startups/startup-edit-popup";
import { InvestorEditPopup } from "@/components/investors/investor-edit-popup";
import { AdvisorEditPopup } from "@/components/advisor/advisor-edit-popup";
import type { OneStepItem, OneStepKind, ReviewRow } from "@/lib/one-step.server";
import { approvalDate, approvalFullDate, approvalWaitingDays } from "@/lib/approval-date";
import { useTranslation } from "@/i18n/language";
import { TH } from "@/i18n/th";
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
  const guard = useRef<((go: () => void) => void) | null>(null);
  const pick = (id: string | null) => { const go = () => { setSel(id); onOpen?.(id ?? undefined); }; if (id !== sel && guard.current) guard.current(go); else go(); };
  const waiting = (iso: string | null) => { const n = approvalWaitingDays(iso); return n ? t(n === 1 ? "waiting {n} day" : "waiting {n} days").replace("{n}", String(n)) : t("waiting today"); };
  return <div className="os-split">
    <aside className="os-queue"><h2>{t(QUEUE[kind][0])}</h2><p className="os-muted">{t(QUEUE[kind][1])}</p>
      {error ? <p className="text-destructive">{(error as Error).message}</p> : isLoading ? <p>{t("Loading…")}</p> : !items.length ? <p className="os-empty">{t(QUEUE[kind][2])}</p> : items.map(i => <Button variant="unstyled" size="unstyled" key={i.id} className="os-queue-item" aria-pressed={sel === i.id} onClick={() => pick(i.id)}>
        <span className="os-queue-name"><span className="os-tile">{initials(i.name)}</span><strong>{i.name}</strong></span>
        <span className="os-muted">{[i.ref, t(i.type ?? ""), t(i.place ?? "")].filter(Boolean).join(" · ")}</span>
        <span className={approvalWaitingDays(i.submittedAt) && i.chip === "waiting" ? "os-late" : "os-muted"}>{i.chip === "sent_back" ? `${t("Sent back {date}").replace("{date}", approvalDate(i.sentBackAt, language))} · ${t(`waiting for the ${kind}`)}` : `${t("Submitted {date}").replace("{date}", approvalDate(i.submittedAt, language))} · ${waiting(i.submittedAt)}`}</span><Status item={i} />
      </Button>)}
    </aside>
    <div className="os-review">{current ? <TextLangProvider key={current.id}><ReviewPanel item={current} guard={guard} onDone={() => { setSel(null); onOpen?.(undefined); }} /></TextLangProvider> : <p className="os-empty">{t("Choose a profile on the left to review it.")}</p>}</div>
  </div>;
}
type Texts = Record<string, { en: string; th: string }>;
type Saved = { name: string; headline: string; headlineTh: string; texts: Texts };
const PUBLISHED = "published_headline";

function savedOf(item: OneStepItem): Saved {
  const texts: Texts = {};
  for (const r of item.translation) if (r.key !== PUBLISHED) texts[r.key] = { en: r.en, th: r.th };
  return {
    name: item.draft?.name ?? item.suggestedName ?? "",
    headline: item.draft?.headline ?? item.suggestedHeadline ?? "",
    headlineTh: item.draft?.headlineTh ?? item.publishedHeadlineTh ?? item.suggestedHeadlineTh ?? "",
    texts,
  };
}
const bkkTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

function ReviewPanel({ item, onDone, guard }: { item: OneStepItem; onDone: () => void; guard: MutableRefObject<((go: () => void) => void) | null> }) {
  const { t, language } = useTranslation();
  const qc = useQueryClient();
  const decide = useServerFn(decideOneStep), mark = useServerFn(markReviewCheck), saveFn = useServerFn(saveOneStepReview);
  const { lang, setLang } = useTextLang();
  const [saved, setSaved] = useState<Saved>(() => savedOf(item));
  const [name, setName] = useState(saved.name);
  const [headline, setHeadline] = useState(saved.headline);
  const [headlineTh, setHeadlineTh] = useState(saved.headlineTh);
  const [texts, setTexts] = useState<Texts>(saved.texts);
  const [savedAt, setSavedAt] = useState<string | null>(item.savedAt);
  const [tab, setTab] = useState<"review" | "translation">("review");
  const [editing, setEditing] = useState(false);
  const [leave, setLeave] = useState<null | { go: () => void; stay?: () => void }>(null);
  const [dialog, setDialog] = useState<"approve" | "request_changes" | "decline" | null>(null);
  const [reasons, setReasons] = useState<string[]>([]), [note, setNote] = useState(t(DEFAULT_NOTE));
  const [invalid, setInvalid] = useState(false), [reasonError, setReasonError] = useState("");
  const editBtn = useRef<HTMLButtonElement>(null);

  // A refetch (after Edit information's Save) brings new saved values: take them, and keep the published
  // name/headline following the suggestion while they were still the same as it.
  const prevItem = useRef(item);
  useEffect(() => {
    const old = prevItem.current; prevItem.current = item;
    if (old === item) return;
    const next = savedOf(item);
    setSaved(next);
    setTexts(cur => { const merged: Texts = { ...next.texts }; for (const k of Object.keys(cur)) if (old.translation.find(r => r.key === k && (r.en !== cur[k].en || r.th !== cur[k].th))) merged[k] = cur[k]; return merged; });
    if (!item.draft) {
      setName(n => n === (old.suggestedName ?? "") ? item.suggestedName ?? "" : n);
      setHeadline(h => h === (old.suggestedHeadline ?? "") ? item.suggestedHeadline ?? "" : h);
      setHeadlineTh(h => h === (old.publishedHeadlineTh ?? old.suggestedHeadlineTh ?? "") ? item.publishedHeadlineTh ?? item.suggestedHeadlineTh ?? "" : h);
    }
    setSavedAt(item.savedAt);
  }, [item]);

  const r = item.review, first = (item.person ?? "").split(" ")[0] || item.name;
  const fill = (text: string, values: Record<string, string> = {}) => Object.entries({ name: item.name, "first name": first, ref: item.ref, "listing name": name, ...values }).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), t(text));
  const browse = item.kind === "seller" ? "Browse listings" : item.kind === "buyer" ? "Browse investors" : "Browse advisors";
  const badge = item.kind === "seller" ? "Certified" : item.kind === "buyer" ? "Verified investor" : "Verified advisor";
  const email = item.kind === "seller" ? "Your listing is approved" : "Your profile is approved";
  const rewritten = name.trim() !== (item.suggestedName ?? "").trim() || headline.trim() !== (item.suggestedHeadline ?? "").trim() || headlineTh.trim() !== (item.suggestedHeadlineTh ?? "").trim() && !!(item.suggestedHeadlineTh ?? "").trim();
  const matches = r.verification.filter(v => v.result === "match" || v.result === "by_hand" && v.checked).length;
  const manual = r.verification.filter(v => v.result === "by_hand" && !v.checked).length;
  const differing = r.verification.filter(v => v.result === "differs" || v.result === "not_given").length;
  const stillOpen = r.verification.filter(v => v.result !== "not_needed" && v.result !== "match" && !(v.result === "by_hand" && v.checked));

  // ---- Translation rows, live
  const rows: TrRow[] = useMemo(() => item.translation.map(row => row.key === PUBLISHED ? { ...row, en: headline, th: headlineTh } : { ...row, ...(texts[row.key] ?? {}) }), [item.translation, texts, headline, headlineTh]);
  const counts = trCounts(rows);
  const rowLabel = (row: TrRow) => { const [base, who] = row.label.split(" · "); return who ? `${t(base)} · ${who}` : t(row.label); };

  // ---- Unsaved changes
  const changes: string[] = [];
  if (name.trim() !== saved.name.trim()) changes.push(t("Listing name"));
  if (headline.trim() !== saved.headline.trim()) changes.push(t("Headline (English)"));
  if (headlineTh.trim() !== saved.headlineTh.trim()) changes.push(t("Headline (Thai)"));
  for (const row of item.translation) {
    if (row.key === PUBLISHED) continue;
    const cur = texts[row.key], was = saved.texts[row.key];
    if (!cur || !was) continue;
    if (cur.en.trim() !== was.en.trim()) changes.push(fill("{row} (English)", { row: rowLabel(row) }));
    if (cur.th.trim() !== was.th.trim()) changes.push(fill("{row} (Thai)", { row: rowLabel(row) }));
  }
  const dirty = changes.length > 0;
  const dirtyRef = useRef(false); dirtyRef.current = dirty;
  const bypass = useRef(false);

  const save = useMutation({
    mutationFn: () => saveFn({ data: {
      kind: item.kind, id: item.id, publishedName: name, publishedHeadline: headline, publishedHeadlineTh: headlineTh,
      texts: item.translation.filter(row => row.key !== PUBLISHED && texts[row.key]).map(row => ({ key: row.key, th: texts[row.key].th, ...(row.enLocked || saved.texts[row.key]?.en.trim() ? {} : { en: texts[row.key].en }) })),
    } }),
    onSuccess: (res) => {
      dirtyRef.current = false;
      setSaved({ name, headline, headlineTh, texts }); setSavedAt(res.savedAt);
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: Error) => toast.error(t(e.message)),
  });
  const doSave = async (quiet = false) => { await save.mutateAsync(); if (!quiet) toast.success(fill("Saved. {name} isn't verified yet.")); };
  const discard = () => { dirtyRef.current = false; setName(saved.name); setHeadline(saved.headline); setHeadlineTh(saved.headlineTh); setTexts(saved.texts); toast.success(t("Changes discarded.")); };

  // Leaving with unsaved changes asks first: the queue (guard), Approvals tabs and other pages (router), and the browser tab.
  useEffect(() => { guard.current = (go) => { if (!dirtyRef.current) go(); else setLeave({ go }); }; return () => { guard.current = null; }; }, [guard]);
  const blocker = useBlocker({ shouldBlockFn: () => dirtyRef.current && !bypass.current, withResolver: true, enableBeforeUnload: () => dirtyRef.current }) as unknown as { status: "blocked" | "idle"; proceed: () => void; reset: () => void };
  useEffect(() => { if (blocker.status === "blocked") setLeave({ go: () => { bypass.current = true; blocker.proceed(); setTimeout(() => { bypass.current = false; }, 0); }, stay: () => blocker.reset() }); }, [blocker.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const stay = () => { leave?.stay?.(); setLeave(null); };

  const act = useMutation({
    mutationFn: async (action: "approve" | "request_changes" | "decline") => {
      if (action === "approve" && dirty) await save.mutateAsync();
      return decide({ data: { kind: item.kind, id: item.id, action, publishedName: name, publishedHeadline: headline, publishedHeadlineTh: headlineTh, reasons, note: note.trim() || undefined } });
    },
    onSuccess: (_, action) => {
      dirtyRef.current = false;
      toast.success(action === "approve" ? fill(`Verified and published. {name} is live in ${browse}.`) : action === "request_changes" ? fill("Request sent to {first name}.") : fill("{name} is declined. {first name} gets an email with the reasons."));
      setDialog(null); void qc.invalidateQueries({ queryKey: KEY }); void qc.invalidateQueries({ queryKey: ["approvals"] }); void qc.invalidateQueries({ queryKey: ["admin-approval-counts"] }); onDone();
    }, onError: (e: Error) => toast.error(t(e.message)),
  });
  const check = useMutation({ mutationFn: (row: string) => mark({ data: { kind: item.kind, id: item.id, row } }), onSuccess: () => { toast.success(t("Marked checked.")); void qc.invalidateQueries({ queryKey: KEY }); }, onError: (e: Error) => toast.error(t(e.message)) });
  const open = (action: "approve" | "request_changes" | "decline") => {
    if (action === "approve") { setInvalid(true); if (!name.trim() || !headline.trim() && !headlineTh.trim()) return; }
    setReasons([]); setNote(t(DEFAULT_NOTE)); setReasonError(""); setDialog(action);
  };
  const submit = () => {
    if (!dialog) return;
    if (dialog !== "approve" && !reasons.length) { setReasonError(t("Choose at least one reason.")); return; }
    if (dialog !== "approve" && reasons.includes("Another reason") && !note.trim()) { setReasonError(fill("Say what the other reason is, so {first name} knows what to fix.")); return; }
    act.mutate(dialog);
  };

  // Edit information: unsaved review changes are saved first, so the pop-up shows them.
  const openEdit = async () => { if (dirty) { try { await doSave(true); } catch { return; } } setEditing(true); };
  const before = useRef<string>("");
  useEffect(() => { if (editing) before.current = JSON.stringify(item.translation) + item.suggestedName + item.suggestedHeadline; }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps
  const closeEdit = async () => {
    setEditing(false);
    await qc.invalidateQueries({ queryKey: KEY });
    const fresh = (qc.getQueryData(KEY) as any)?.[item.kind === "seller" ? "sellers" : item.kind === "buyer" ? "buyers" : "advisors"]?.find((i: OneStepItem) => i.id === item.id) as OneStepItem | undefined;
    if (fresh && JSON.stringify(fresh.translation) + fresh.suggestedName + fresh.suggestedHeadline !== before.current) toast.success(t("Saved. The review shows the new details."));
    setTimeout(() => editBtn.current?.focus(), 0);
  };

  // ---- Missing-language note for Verify and publish
  const lacking = (want: "th" | "en") => rows.filter(row => { const st = rowState(row); return want === "th" ? st === "no_th" : st === "no_en"; }).sort((a, b) => Number(b.key === PUBLISHED) - Number(a.key === PUBLISHED)).map(row => {
    const label = row.key === PUBLISHED ? t("Headline") : rowLabel(row);
    if (want === "th" && row.list) { const n = row.en.split("\n").filter(x => x.trim()).length, k = row.th.split("\n").filter(x => x.trim()).length; if (k > 0) return fill("{row} ({k} of {n} in Thai)", { row: label, k: String(k), n: String(n) }); }
    return label;
  });
  const noTh = lacking("th"), noEn = lacking("en");

  const dirPath = item.kind === "seller" ? `/startups/${r.directoryId}` : item.kind === "buyer" ? `/investors/${r.directoryId}` : `/advisors/?view=split&selected=${encodeURIComponent(r.directoryId ?? "")}`;
  const description = item.kind === "seller" ? "The seller suggests them. You write the version buyers see in Browse listings." : item.kind === "buyer" ? "The buyer suggests them. You write the version sellers see in Browse investors." : "The advisor suggests them. You write the version sellers and buyers see in Browse advisors.";
  const footer = item.kind === "seller" ? 'Verify and publish verifies {name}, puts {ref} in Browse listings with the Certified badge, and lets {first name} connect with buyers. {first name} gets one email: "Your listing is approved".' : item.kind === "buyer" ? 'Verify and publish verifies {name}, puts {ref} in Browse investors with the Verified investor badge, and opens NDAs for {first name}. {first name} gets one email: "Your profile is approved".' : 'Verify and publish verifies {name} and puts {ref} in Browse advisors with the Verified advisor badge. {first name} gets one email: "Your profile is approved".';
  const setupTh = item.setupLanguage === "th";
  const sugHeadline = lang === "th" ? item.suggestedHeadlineTh : item.suggestedHeadline;
  const pubValue = lang === "th" ? headlineTh : headline;
  const pubOther = lang === "th" ? headline : headlineTh;
  const tag = (l: TextLang) => <span className={`os-lang-tag ${l === "th" ? "is-th" : ""}`}>{l === "th" ? "TH" : "EN"}</span>;
  const readers = item.kind === "seller" ? "Buyers read the one in their app's language, or the other when it's missing." : item.kind === "buyer" ? "Sellers read the one in their app's language, or the other when it's missing." : "Sellers and buyers read the one in their app's language, or the other when it's missing.";
  const pick = (en: string | null | undefined, th: string | null | undefined) => lang === "th" ? (th?.trim() || en || null) : (en?.trim() || th || null);
  const company = rows.find(x => x.key === "company_name"), address = rows.find(x => x.key === "address"), pName = rows.find(x => x.key === "person_name"), pTitle = rows.find(x => x.key === "person_title"), desc = rows.find(x => x.key === "description");
  const card = {
    headline: pick(headline, headlineTh) ?? "",
    description: pick(desc?.en ?? r.card.description, desc?.th) ?? null,
    realName: pick(company?.en ?? r.card.realName, company?.th),
    address: pick(address?.en ?? r.card.address, address?.th),
    contact: [pick(pName?.en, pName?.th), pick(pTitle?.en, pTitle?.th)].filter(Boolean).join(" · ") || r.card.contact,
  };

  return <article className="os-panel">
    <header className="os-header"><span className="os-tile">{initials(item.name)}</span><div className="os-heading"><div className="os-chips"><Status item={item} />
      <span className="os-setup" title={fill("The language {first name} set up their account in, at sign-up.")}>{t("Account Setup in")}<span className={`os-setup-pill ${setupTh ? "is-th" : ""}`} lang={setupTh ? "th" : "en"}>{setupTh ? "ไทย" : "English"}</span></span></div>
      <h2>{item.name}</h2><p className="os-muted">{[item.ref, t(item.type ?? ""), t(item.place ?? "")].filter(Boolean).join(" · ")} · {fill("submitted {date} by {name}", { date: approvalDate(item.submittedAt, language), name: item.person ?? t("Not given") })} · {approvalWaitingDays(item.submittedAt) ? fill(approvalWaitingDays(item.submittedAt) === 1 ? "waiting {n} day" : "waiting {n} days", { n: String(approvalWaitingDays(item.submittedAt)) }) : t("waiting today")}{savedAt && <span className="os-saved"> · {fill("saved {time}, not verified", { time: bkkTime(savedAt) })}</span>}</p></div>
      <div className="os-actions"><Button variant="outline" className="os-decline" disabled={act.isPending} onClick={() => open("decline")}>{t("Decline")}</Button><Button variant="outline" disabled={act.isPending} onClick={() => open("request_changes")}>{t("Request changes")}</Button><Button className="os-approve" disabled={act.isPending} onClick={() => open("approve")}><Check size={16} />{t("Verify and publish")}</Button></div></header>
    <div className="os-directory"><span>{fill("The full record is in {directory}.", { directory: t(r.directory) })}</span>{r.directoryId && <span className="os-directory-links"><button ref={editBtn} type="button" className="os-edit-btn" disabled={save.isPending} onClick={() => void openEdit()}><Pencil size={15} />{t("Edit information")}</button><a href={dirPath}>{fill("Open in {directory}", { directory: t(r.directory) })}<ExternalLink size={14} /></a></span>}</div>
    {item.chip === "sent_back" && <div className="os-body os-body-note"><div className="os-note"><b>{fill("You asked for changes on {date}.", { date: approvalDate(item.sentBackAt, language) })}</b> {fill("It comes back as waiting when {first name} submits again.")} {item.decisionNote && <blockquote>{item.decisionNote}</blockquote>}</div></div>}
    <div className="os-tabs"><TabRow idBase={`os-${item.id}`} label={t("Review")} value={tab} onChange={setTab} tabs={[
      { key: "review", label: t("Review"), icon: <ClipboardCheck size={16} /> },
      { key: "translation", label: t("Translation"), icon: <Languages size={16} />, after: counts.open ? <span className="os-tr-count" title={fill("{n} still need their Thai or English", { n: String(counts.open) })}>{counts.open}</span> : <span className="os-tr-done" title={t("Every text is in both languages")}><Check size={14} /></span> },
    ]} /></div>
    <div role="tabpanel" id={`os-${item.id}-panel`} aria-labelledby={`os-${item.id}-tab-${tab}`}>
    {tab === "review" ? <div className="os-body">
      <section><div className="os-section-head"><div><h3>{t("Listing name and headline")}</h3><p className="os-muted">{t(description)}</p></div><div className="os-summary">
        <div role="group" aria-label={t("Texts in")} className="text-lang-switch" title={t("The language of the headline and the cards. The listing name is the same in both.")}><span className="text-lang-lab">{t("Texts in")}</span>{(["en", "th"] as const).map(k => <button key={k} type="button" lang={k} aria-pressed={lang === k} onClick={() => setLang(k)} className={`text-lang-opt ${lang === k ? "is-on" : ""}`}>{k === "en" ? "English" : "ไทย"}</button>)}</div>
        <span className={`os-chip ${rewritten ? "os-blue" : "os-grey"}`}>{t(rewritten ? "Rewritten" : `Same as the ${item.kind}'s`)}</span></div></div>
        <table className="os-table os-name-table"><thead><tr><th>{t("Detail")}</th><th>{t(`The ${item.kind} suggested`)}</th><th>{t("Published as")}</th></tr></thead><tbody>
          <tr><td>{t("Listing name")}</td><td data-label={t(`The ${item.kind} suggested`)}>{item.suggestedName || t("Not given")}</td><td data-label={t("Published as")}><Input aria-label={t("Published listing name")} maxLength={120} value={name} onChange={e => setName(e.target.value)} aria-invalid={invalid && !name.trim()} />{invalid && !name.trim() && <p className="text-destructive">{t("Write a listing name.")}</p>}</td></tr>
          <tr><td>{t("Headline")} {tag(lang)}</td><td data-label={t(`The ${item.kind} suggested`)} lang={lang}>{sugHeadline || <span className="os-not-given">{t(lang === "th" ? "Not given in Thai" : "Not given in English")}</span>}</td><td data-label={t("Published as")}><Textarea lang={lang} aria-label={t("Published headline")} rows={2} maxLength={120} value={pubValue} placeholder={!pubValue && pubOther ? t(lang === "th" ? "No Thai yet. Thai readers see the English." : "No English yet. English readers see the Thai.") : undefined} onChange={e => (lang === "th" ? setHeadlineTh : setHeadline)(e.target.value)} aria-invalid={invalid && !headline.trim() && !headlineTh.trim()} />{invalid && !headline.trim() && !headlineTh.trim() && <p className="text-destructive">{t("Write a headline.")}</p>}</td></tr>
        </tbody></table>
      </section>
      <section>{!r.individual && <DbdStorePanel reg={r.dbd.registrationNo} initial={r.dbd} onChanged={() => void qc.invalidateQueries({ queryKey: KEY })} />}
        <div className="os-section-head"><div><h3>{t("Verification")}</h3><p className="os-muted">{r.individual ? t("An individual investor: no registration number to verify with.") : fill("Verify with registration number {number}.", { number: r.registrationNo ?? "—" })}</p></div><div className="os-summary">{!!matches && <span className="os-chip os-green"><Check size={13} />{fill("{n} match", { n: String(matches) })}</span>}{!!manual && <span className="os-chip os-grey">{fill("{n} to check by hand", { n: String(manual) })}</span>}{!!differing && <span className="os-chip os-warn">{fill(differing === 1 ? "{n} differs" : "{n} differ", { n: String(differing) })}</span>}</div></div>
        <table className="os-table"><thead><tr><th>{t("Detail")}</th><th>{t(`From the ${item.kind}`)}</th><th>{t("Company verification")}</th><th>{t("Result")}</th></tr></thead><tbody>{r.verification.map(v => { const from = v.from || (v.key === "name" ? company?.th : v.key === "address" ? address?.th : null) || null; return <tr key={v.key} className={v.result === "differs" || v.result === "not_given" ? "os-diff-row" : ""}>
          <td>{t(v.label)}</td><td data-label={t(`From the ${item.kind}`)} className={!from ? "os-muted" : ""}>{reviewText(from, t, language) || t("Not given")}</td><td data-label={t("Company verification")}>{reviewText(v.found, t, language)}{v.source && <small>{t(v.source)}</small>}{v.link && <a href={v.link} target="_blank" rel="noreferrer">{t("Open the site")}<ExternalLink size={12} /></a>}</td><td data-label={t("Result")}><span className={v.checked && v.result === "by_hand" || v.result === "match" ? "os-result-ok" : v.result === "differs" || v.result === "not_given" ? "os-result-warn" : "os-muted"}>{v.result === "match" || v.result === "by_hand" && v.checked ? <Check size={14} /> : (v.result === "differs" || v.result === "not_given") && <TriangleAlert size={14} />}{t(v.result === "by_hand" && v.checked ? "Checked" : v.resultLabel ?? "By hand")}</span>{v.result === "by_hand" && !v.checked && <Button variant="outline" size="sm" disabled={check.isPending} onClick={() => check.mutate(v.key)}>{t("Mark checked")}</Button>}</td>
        </tr>; })}</tbody></table>
        <div className="os-visual"><h4>{t("For a visual check")}</h4><div>{[["Name", r.personName || pName?.th || item.person], ["Position", r.personTitle || pTitle?.th], ["Email address", r.email], ["Contact number", r.phone]].map(([label, value]) => <div key={label}><span>{t(label ?? "")}</span><strong className={!value ? "os-muted" : ""}>{value || t("Not given")}</strong></div>)}</div></div>
      </section>
      <section><h3>{t(item.kind === "seller" ? "What buyers will see" : item.kind === "buyer" ? "What sellers will see" : "What sellers and buyers will see")}</h3><div className="os-previews"><Preview item={item} name={name} card={card} lang={lang} exclusive={false} />{item.kind !== "advisor" && <Preview item={item} name={name} card={card} lang={lang} exclusive />}</div></section>
    </div> : <div className="os-body">
      <section><div className="os-section-head"><div><h3 className="os-tr-title">{t("Translation")}</h3><p className="os-tr-intro">{fill("The company and contact details, the published headline and every text {first name} wrote, in English and in Thai.")} {fill(setupTh ? "{first name} set up their account in Thai, so the Thai is in their own words." : "{first name} set up their account in English, so the English is in their own words.")} {t(readers)}</p></div>
        <div className="os-summary">{!!counts.both && <span className="os-chip os-green"><Check size={13} />{fill("{n} in both", { n: String(counts.both) })}</span>}{!!counts.noTh && <span className="os-chip os-warn">{fill("{n} without Thai", { n: String(counts.noTh) })}</span>}{!!counts.noEn && <span className="os-chip os-warn">{fill("{n} without English", { n: String(counts.noEn) })}</span>}</div></div>
        <table className="os-table os-tr-table"><thead><tr><th>{t("Text")}</th>{(["en", "th"] as const).map(l => <th key={l}>{t(l === "en" ? "English" : "Thai")} {tag(l)}{(l === "th") === setupTh && <span className="os-setup-who" title={fill(setupTh ? "{first name} set up their account in Thai" : "{first name} set up their account in English")}><User size={11} />{first}</span>}</th>)}<th>{t("Result")}</th></tr></thead><tbody>
          {(["company", "texts"] as const).map(group => [<tr key={group} className="os-tr-group"><td colSpan={4}>{t(group === "company" ? "COMPANY AND CONTACT" : "PROFILE TEXTS")}</td></tr>, ...rows.filter(row => row.group === group && (row.key !== "suggested_headline")).map(row => {
            const st = rowState(row), key = row.key;
            const setEn = (v: string) => key === PUBLISHED ? setHeadline(v) : setTexts(p => ({ ...p, [key]: { ...p[key], en: v } }));
            const setTh = (v: string) => key === PUBLISHED ? setHeadlineTh(v) : setTexts(p => ({ ...p, [key]: { ...p[key], th: v } }));
            const enEditable = key === PUBLISHED || !row.enLocked && !saved.texts[key]?.en.trim();
            const nEn = row.en.split("\n").filter(x => x.trim()).length, nTh = row.th.split("\n").filter(x => x.trim()).length;
            const src = key === "company_name" ? "From About Company" : key === "address" ? "From the Address tab" : key === "person_name" || key === "person_title" ? "From My Profile" : null;
            return <tr key={key} className={st !== "both" && st !== "empty" ? "os-diff-row" : ""}>
              <td><b>{key === PUBLISHED ? t("Published headline") : rowLabel(row)}</b>{src && <small>{t(src)}</small>}</td>
              <td data-label={t("English")}>{enEditable ? <textarea className="os-tr-box" rows={1} maxLength={row.list ? undefined : row.max} value={row.en} placeholder={t("Type the English")} onChange={e => setEn(e.target.value)} aria-label={`${rowLabel(row)} · English`} /> : row.list ? <ol className="os-tr-list">{row.en.split("\n").filter(x => x.trim()).map((x, i) => <li key={i}>{x}</li>)}</ol> : <span className="os-tr-en">{row.en}</span>}</td>
              <td data-label={t("Thai")}><textarea lang="th" className="os-tr-box" rows={1} maxLength={row.list ? undefined : row.max} value={row.th} placeholder={t(row.list ? "Type the Thai, one per line" : "Type the Thai")} onChange={e => setTh(e.target.value)} aria-label={`${rowLabel(row)} · Thai`} /></td>
              <td data-label={t("Result")}>{st === "both" ? <span className="os-result-ok"><Check size={14} />{t("In both")}</span> : st === "empty" ? <span className="os-muted">—</span> : <span className="os-result-warn"><TriangleAlert size={14} />{st === "no_en" ? t("No English yet") : row.list && nTh > 0 ? fill("{k} of {n} in Thai", { k: String(nTh), n: String(nEn) }) : t("No Thai yet")}</span>}</td>
            </tr>;
          })])}
        </tbody></table>
        <p className="os-tr-foot">{fill("Press Save to keep what you type here without verifying. It's saved to {first name}'s profile: the same texts as Edit information.")}</p>
      </section>
    </div>}
    </div>
    <footer className="os-footer">{fill(footer, { name: item.person ?? item.name })}</footer>
    {dirty && <div className="os-savebar" role="region" aria-label={fill("Unsaved changes ({n})", { n: String(changes.length) })}>
      <div className="os-savebar-text"><b><span className="os-savebar-dot" />{fill("Unsaved changes ({n})", { n: String(changes.length) })}</b><span>{fill("Save keeps them without verifying: {changes}.", { changes: changes.slice(0, 3).join(", ") + (changes.length > 3 ? fill(" and {n} more", { n: String(changes.length - 3) }) : "") })}</span></div>
      <div className="os-savebar-actions"><button type="button" className="os-sb-discard" onClick={discard}>{t("Discard")}</button><button type="button" className="os-sb-save" disabled={save.isPending} onClick={() => void doSave()}>{t("Save")}</button></div>
    </div>}
    {editing && r.directoryId && (item.kind === "seller" ? <StartupEditPopup id={r.directoryId} initialView="public" initialTab="identity" onClose={() => void closeEdit()} /> : item.kind === "buyer" ? <InvestorEditPopup id={r.directoryId} initialView="public" onClose={() => void closeEdit()} /> : <AdvisorEditPopup id={r.directoryId} onClose={() => void closeEdit()} />)}
    <Dialog open={!!leave} onOpenChange={v => !v && stay()}><DialogContent className="os-leave max-w-[420px]" aria-describedby="os-leave-d"><DialogTitle>{fill("Save your changes to {name}?")}</DialogTitle><p id="os-leave-d" className="os-muted">{t("You changed this review and haven't saved it. Saving doesn't verify it.")}</p>
      <div className="os-leave-actions"><Button variant="outline" onClick={stay}>{t("Keep editing")}</Button><Button variant="outline" onClick={() => { const go = leave?.go; dirtyRef.current = false; setLeave(null); discard(); go?.(); }}>{t("Discard")}</Button><Button className="os-sb-save" disabled={save.isPending} onClick={async () => { const go = leave?.go; try { await doSave(); } catch { return; } setLeave(null); go?.(); }}>{t("Save")}</Button></div>
    </DialogContent></Dialog>
    <Dialog open={!!dialog} onOpenChange={v => !v && setDialog(null)}><DialogContent className="max-w-[660px]" aria-describedby="os-dialog-description"><DialogTitle>{dialog === "approve" ? fill("Verify and publish {name}?") : dialog === "decline" ? fill("Decline {name}?") : t("Request changes")}</DialogTitle>
      {dialog === "approve" ? <><p id="os-dialog-description" className="sr-only">{t("Verify and publish")}</p><ul className="ap-will">{dirty && <li><Check size={16} />{t("Your unsaved changes are saved first.")}</li>}<li><Check size={16} />{fill("{name} gets the {badge} badge.", { badge: t(badge) })}</li><li><Check size={16} />{fill(item.kind === "seller" ? '{ref} goes live in Browse listings as "{listing name}", where buyers can find it and request an NDA.' : item.kind === "buyer" ? '{ref} goes live in Browse investors as "{listing name}", where sellers can find and invite it.' : '{ref} goes live in Browse advisors as "{listing name}", where sellers and buyers can find it.')}</li>{item.kind !== "advisor" && <li><Check size={16} />{fill(item.kind === "seller" ? "{first name} can connect with buyers." : "NDAs open for {first name}.")}</li>}<li><Check size={16} />{fill(`{first name} gets one email: "${email}".`)}</li></ul>{!!stillOpen.length && <p className="os-note">{fill("Still open: {list}. You can verify anyway, or go back and check.", { list: stillOpen.map(v => `${t(v.label)} (${t(v.result === "by_hand" ? "check by hand" : (v.resultLabel ?? "differs").toLowerCase())})`).join(" · ") })}</p>}
        {(noTh.length > 0 || noEn.length > 0) && <div className="os-note">{noTh.length > 0 && <p><b>{t("Still without Thai:")}</b> {fill("{rows}. Thai readers see the English there.", { rows: noTh.join(", ") })}</p>}{noEn.length > 0 && <p><b>{t("Still without English:")}</b> {fill("{rows}. English readers see the Thai there.", { rows: noEn.join(", ") })}</p>}<p>{t(noTh.length && noEn.length ? "You can verify anyway, or go back and add them." : noTh.length ? "You can verify anyway, or go back and add the Thai." : "You can verify anyway, or go back and add the English.")}</p></div>}</> : <>
        <p id="os-dialog-description" className="os-muted">{fill(dialog === "request_changes" ? `{first name} gets an email and sees your note on My Company. The ${item.kind === "seller" ? "listing" : "profile"} stays hidden until it's verified and published.` : item.kind === "seller" ? "The listing stays hidden, and {first name} can't connect with buyers. {first name} gets an email with the reasons and can register again." : item.kind === "buyer" ? "The profile stays hidden, and {first name} can't sign NDAs. {first name} gets an email with the reasons and can register again." : "The profile stays hidden from Browse advisors. {first name} gets an email with the reasons and can register again.")}</p>
        <div><h4>{t("Reasons")}</h4><p className="os-muted">{t("Choose one or more")}</p><div className="os-reasons">{DECISION_REASONS.map(reason => <label key={reason}><input type="checkbox" checked={reasons.includes(reason)} onChange={e => setReasons(p => e.target.checked ? [...p, reason] : p.filter(x => x !== reason))} />{t(reason)}</label>)}</div></div>
        <label className="os-note-label" htmlFor="os-note">{fill("Note to {first name}")} <span className="os-muted">{t(reasons.includes("Another reason") ? "Required for Another reason" : "Optional")}</span></label><Textarea id="os-note" rows={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder={fill("What should {first name} change, and why?")} />{reasonError && <p role="alert" className="text-destructive">{reasonError}</p>}
      </>}
      <div className="os-actions"><Button variant="outline" onClick={() => setDialog(null)}>{t("Cancel")}</Button><Button className={dialog === "approve" ? "os-approve" : dialog === "decline" ? "os-decline-solid" : ""} disabled={act.isPending} onClick={submit}>{dialog === "approve" && <Check size={16} />}{t(dialog === "approve" ? "Verify and publish" : dialog === "decline" ? "Decline" : "Send request")}</Button></div>
    </DialogContent></Dialog>
  </article>;
}
type CardText = { headline: string; description: string | null; realName: string | null; address: string | null; contact: string | null };
function Preview({ item, name, card, lang, exclusive }: { item: OneStepItem; name: string; card: CardText; lang: TextLang; exclusive: boolean }) {
  const { t: appT } = useTranslation(), c = item.review.card;
  // The cards follow the review's Texts in switch, as a reader with the app in that language sees them.
  const t = (s: string) => lang === "th" ? TH[s] ?? s : s;
  return <div lang={lang}><h4>{appT(exclusive ? "Exclusive view" : "Listing view")}{lang === "th" && <span className="os-lang-tag is-th os-cap-tag">ไทย</span>}</h4><div className="os-preview-card"><div className="os-cover"><SectorArt sector={c.sector ?? c.type} /><span className={`os-chip ${exclusive ? "os-green" : "os-grey"}`}>{exclusive && <Lock size={12} />}{t(exclusive ? "Exclusive view" : item.kind === "advisor" ? "Open to sellers and buyers" : item.kind === "seller" ? "Identity hidden" : "Name hidden")}</span></div><div className="os-preview-content"><h3>{exclusive || item.kind === "advisor" ? card.realName : name || t("Your listing name")}</h3><p className="os-muted">{[exclusive ? name : null, c.ref, t(c.type ?? ""), t(c.place ?? "")].filter(Boolean).join(" · ")}</p><strong>{card.headline}</strong><p>{card.description}</p><dl>{c.figs.map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd>{t(value)}</dd></div>)}</dl>{exclusive && <div className="os-exclusive">{[["Website", c.website], ["Address", card.address], ["Founded", c.founded], [item.kind === "seller" ? "Owner" : "Contact", card.contact]].filter(([, v]) => !!v).map(([label, value]) => <div key={label}><span>{t(label ?? "")}</span><strong>{value}</strong></div>)}</div>}</div></div></div>;
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
