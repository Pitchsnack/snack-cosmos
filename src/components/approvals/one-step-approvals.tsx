import { RegAdminBox } from "@/components/approvals/reg-admin-box";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ClipboardCheck, Clock, ExternalLink, Languages, Pencil, ShieldCheck, TriangleAlert, User } from "lucide-react";
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
import { licenceName } from "@/lib/advisor-licences";
import { CredMark } from "@/components/advisor/advisor-verification";
import type { OneStepItem, OneStepKind, ReviewRow } from "@/lib/one-step.server";
import { approvalDate, approvalFullDate, approvalWaitingDays } from "@/lib/approval-date";
import { useTranslation } from "@/i18n/language";
import { StandardListingCard } from "@/components/marketplace/standard-listing-card";
import { StandardInvestorCard } from "@/components/marketplace/standard-investor-card";
import type { CardInvestor } from "@/components/marketplace/buyer-browse-card";
import { isCorporateBuyer } from "@/lib/investor-browse";
import { FirmCard } from "@/components/advisor/advisor-firm-card";
import type { PublicListing } from "@/lib/public-listing";
import type { FavPrivate } from "@/lib/favourites.functions";
import type { SellerFavPrivate } from "@/lib/investor-browse.functions";
import { bandText } from "@/lib/investor-bands";
import { bandOf as priceBandOf } from "@/lib/asking-price";
import type { AdvisorFirm } from "@/lib/advisor-firm";
import { getSellerSetup } from "@/lib/seller-setup.functions";
import { getStartupFinancials, type StartupFinancials } from "@/lib/financials.functions";
import { getBuyerInvestorById } from "@/lib/buyer-investor.functions";
import { getAdvisorFirmForAdmin } from "@/lib/advisor-firm.functions";
import { DbdStorePanel } from "./dbd-store-panel";
import { IdentityReviewPanel, useIdentityReview } from "./identity-review-panel";

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
        <span className="os-queue-name"><span className="os-tile">{initials(i.name)}</span><strong>{i.name}</strong>{!!i.identityCount && <span className="os-identity-dot" role="img" aria-label={t("Identity check needs review")} title={t("Identity check needs review")} />}</span>
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
    name: item.kind === "advisor" ? item.name : item.draft?.name ?? item.suggestedName ?? "",
    headline: item.kind === "advisor" ? "" : item.draft?.headline ?? item.suggestedHeadline ?? "",
    headlineTh: item.kind === "advisor" ? "" : item.draft?.headlineTh ?? item.publishedHeadlineTh ?? item.suggestedHeadlineTh ?? "",
    texts,
  };
}
const bkkTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

function ReviewPanel({ item, onDone, guard }: { item: OneStepItem; onDone: () => void; guard: MutableRefObject<((go: () => void) => void) | null> }) {
  const { t, language, setLanguage } = useTranslation();
  const qc = useQueryClient();
  const decide = useServerFn(decideOneStep), mark = useServerFn(markReviewCheck), saveFn = useServerFn(saveOneStepReview);
  const identityKind = item.kind === "buyer" ? "buyer" as const : "seller" as const;
  const identityQuery = useIdentityReview(identityKind, item.kind === "advisor" ? null : item.id);
  const identityRemaining = item.kind === "advisor" ? 0 : identityQuery.data?.findings.length ?? item.identityCount ?? 0;
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
  const wantMissing = invalid && item.kind === "buyer" && !headline.trim() && !headlineTh.trim();
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
      setName(n => item.kind === "advisor" ? item.name : n === (old.suggestedName ?? "") ? item.suggestedName ?? "" : n);
      setHeadline(h => h === (old.suggestedHeadline ?? "") ? item.suggestedHeadline ?? "" : h);
      setHeadlineTh(h => h === (old.publishedHeadlineTh ?? old.suggestedHeadlineTh ?? "") ? item.publishedHeadlineTh ?? item.suggestedHeadlineTh ?? "" : h);
    }
    setSavedAt(item.savedAt);
  }, [item]);

  const r = item.review, first = (item.person ?? "").split(" ")[0] || item.name;
  const fill = (text: string, values: Record<string, string> = {}) => Object.entries({ name: item.name, "first name": first, ref: item.ref, "listing name": item.kind === "advisor" ? item.name : name, ...values }).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), t(text));
  const browse = item.kind === "seller" ? "Browse listings" : item.kind === "buyer" ? "Browse investors" : "Browse advisors";
  const badge = item.kind === "seller" ? "Certified" : item.kind === "buyer" ? "Verified investor" : "Verified advisor";
  const email = item.kind === "seller" ? "Your listing is approved" : "Your profile is approved";
  const rewritten = item.kind !== "advisor" && (name.trim() !== (item.suggestedName ?? "").trim() || headline.trim() !== (item.suggestedHeadline ?? "").trim() || headlineTh.trim() !== (item.suggestedHeadlineTh ?? "").trim() && !!(item.suggestedHeadlineTh ?? "").trim());
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
      void qc.invalidateQueries({ queryKey: ["identity-review", identityKind, item.id] });
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
    if (action === "approve") { setInvalid(true); if (item.kind === "seller" && (!name.trim() || !headline.trim() && !headlineTh.trim())) return;
      // Every investor card shows Wants to buy: publishing waits for the published text in either language.
      if (item.kind === "buyer" && !headline.trim() && !headlineTh.trim()) { setTab("translation"); setTimeout(() => document.getElementById("os-published-want-en")?.focus(), 60); return; } }
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
    await qc.invalidateQueries({ queryKey: ["identity-review", identityKind, item.id] });
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
    realName: item.kind === "advisor" ? item.name : pick(company?.en ?? r.card.realName, company?.th),
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
      {item.kind !== "advisor" && <section><div className="os-section-head"><div><h3>{t("Listing name and headline")}</h3><p className="os-muted">{t(description)}</p></div><div className="os-summary">
        <div role="group" aria-label={t("Texts in")} className="text-lang-switch" title={t("The language of the headline and the cards. The listing name is the same in both.")}><span className="text-lang-lab">{t("Texts in")}</span>{(["en", "th"] as const).map(k => <button key={k} type="button" lang={k} aria-pressed={lang === k} onClick={() => { setLang(k); setLanguage(k); }} className={`text-lang-opt ${lang === k ? "is-on" : ""}`}>{k === "en" ? "English" : "ไทย"}</button>)}</div>
        <span className={`os-chip ${rewritten ? "os-blue" : "os-grey"}`}>{t(rewritten ? "Rewritten" : `Same as the ${item.kind}'s`)}</span></div></div>
        <table className="os-table os-name-table"><thead><tr><th>{t("Detail")}</th><th>{t(`The ${item.kind} suggested`)}</th><th>{t("Published as")}</th></tr></thead><tbody>
          <tr><td>{t("Listing name")}</td><td data-label={t(`The ${item.kind} suggested`)}>{item.suggestedName || t("Not given")}</td><td data-label={t("Published as")}><Input aria-label={t("Published listing name")} maxLength={120} value={name} onChange={e => setName(e.target.value)} aria-invalid={invalid && !name.trim()} />{invalid && !name.trim() && <p className="text-destructive">{t("Write a listing name.")}</p>}</td></tr>
          <tr><td>{t("Headline")} {tag(lang)}</td><td data-label={t(`The ${item.kind} suggested`)} lang={lang}>{sugHeadline || <span className="os-not-given">{t(lang === "th" ? "Not given in Thai" : "Not given in English")}</span>}</td><td data-label={t("Published as")}><Textarea lang={lang} aria-label={t("Published headline")} rows={2} maxLength={120} value={pubValue} placeholder={!pubValue && pubOther ? t(lang === "th" ? "No Thai yet. Thai readers see the English." : "No English yet. English readers see the Thai.") : undefined} onChange={e => (lang === "th" ? setHeadlineTh : setHeadline)(e.target.value)} aria-invalid={item.kind !== "buyer" && invalid && !headline.trim() && !headlineTh.trim()} />{item.kind !== "buyer" && invalid && !headline.trim() && !headlineTh.trim() && <p className="text-destructive">{t("Write a headline.")}</p>}</td></tr>
        </tbody></table>
      </section>}
      <section>{!r.individual && <RegAdminBox kind={item.kind as "seller" | "buyer" | "advisor"} id={item.id} onChanged={() => void qc.invalidateQueries({ queryKey: KEY })} />}{!r.individual && <DbdStorePanel reg={r.dbd.registrationNo} initial={r.dbd} onChanged={() => void qc.invalidateQueries({ queryKey: KEY })} />}
        <div className="os-section-head"><div><h3>{t("Verification")}</h3><p className="os-muted">{r.individual ? t("An individual investor: no registration number to verify with.") : fill("Verify with registration number {number}.", { number: r.registrationNo ?? "—" })}</p></div><div className="os-summary">{!!matches && <span className="os-chip os-green"><Check size={13} />{fill("{n} match", { n: String(matches) })}</span>}{!!manual && <span className="os-chip os-grey">{fill("{n} to check by hand", { n: String(manual) })}</span>}{!!differing && <span className="os-chip os-warn">{fill(differing === 1 ? "{n} differs" : "{n} differ", { n: String(differing) })}</span>}</div></div>
        <table className="os-table"><thead><tr><th>{t("Detail")}</th><th>{t(`From the ${item.kind}`)}</th><th>{t("Company verification")}</th><th>{t("Result")}</th></tr></thead><tbody>{r.verification.map(v => { const from = v.from || (v.key === "name" ? company?.th : v.key === "address" ? address?.th : null) || null; return <tr key={v.key} className={v.result === "differs" || v.result === "not_given" ? "os-diff-row" : ""}>
          <td>{t(v.label)}</td><td data-label={t(`From the ${item.kind}`)} className={!from ? "os-muted" : ""}>{reviewText(from, t, language) || t("Not given")}</td><td data-label={t("Company verification")}>{reviewText(v.found, t, language)}{v.source && <small>{t(v.source)}</small>}{v.link && <a href={v.link} target="_blank" rel="noreferrer">{t("Open the site")}<ExternalLink size={12} /></a>}</td><td data-label={t("Result")}><span className={v.checked && v.result === "by_hand" || v.result === "match" ? "os-result-ok" : v.result === "differs" || v.result === "not_given" ? "os-result-warn" : "os-muted"}>{v.result === "match" || v.result === "by_hand" && v.checked ? <Check size={14} /> : (v.result === "differs" || v.result === "not_given") && <TriangleAlert size={14} />}{t(v.result === "by_hand" && v.checked ? "Checked" : v.resultLabel ?? "By hand")}</span>{v.result === "by_hand" && !v.checked && <Button variant="outline" size="sm" disabled={check.isPending} onClick={() => check.mutate(v.key)}>{t("Mark checked")}</Button>}</td>
        </tr>; })}</tbody></table>
        <div className="os-visual"><h4>{t("For a visual check")}</h4><div>{[["Name", r.personName || pName?.th || item.person], ["Position", r.personTitle || pTitle?.th], ["Email address", r.email], ["Contact number", r.phone]].map(([label, value]) => <div key={label}><span>{t(label ?? "")}</span><strong className={!value ? "os-muted" : ""}>{value || t("Not given")}</strong></div>)}</div></div>
      </section>
      {item.kind !== "advisor" && <IdentityReviewPanel kind={identityKind} itemId={item.id} beforeAction={async () => { if (dirtyRef.current) await doSave(true); }} onChanged={() => void qc.invalidateQueries({ queryKey: KEY })} />}
      {item.kind === "advisor" && !!r.credentials?.length && <section><h3>{t("Licences and credentials")}</h3><ul className="divide-y divide-border">{r.credentials.map(c => <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"><span className="min-w-0 break-words">{licenceName(c, language === "th")}{c.note && <span className="block text-xs text-muted-foreground">{c.note}</span>}</span><CredMark status={c.status} /></li>)}</ul></section>}
      <section><h3>{t(item.kind === "seller" ? "What buyers will see" : item.kind === "buyer" ? "What sellers will see" : "What sellers and buyers will see")}</h3><div className="os-previews"><Preview item={item} name={name} card={card} rows={rows} lang={lang} exclusive={false} />{item.kind !== "advisor" && <Preview item={item} name={name} card={card} rows={rows} lang={lang} exclusive />}</div></section>
    </div> : <div className="os-body">
      <section><div className="os-section-head"><div><h3 className="os-tr-title">{t("Translation")}</h3><p className="os-tr-intro">{fill(item.kind === "advisor" ? "The company and contact details and every text {first name} wrote, in English and in Thai." : "The company and contact details, the published headline and every text {first name} wrote, in English and in Thai.")} {fill(setupTh ? "{first name} set up their account in Thai, so the Thai is in their own words." : "{first name} set up their account in English, so the English is in their own words.")} {t(readers)}</p></div>
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
              <td data-label={t("English")}>{enEditable ? <textarea id={key === PUBLISHED ? "os-published-want-en" : undefined} aria-invalid={key === PUBLISHED && wantMissing ? true : undefined} aria-describedby={key === PUBLISHED && wantMissing ? "os-published-want-missing" : undefined} className="os-tr-box" rows={1} maxLength={row.list ? undefined : row.max} value={row.en} placeholder={t("Type the English")} onChange={e => setEn(e.target.value)} aria-label={`${rowLabel(row)} · English`} /> : row.list ? <ol className="os-tr-list">{row.en.split("\n").filter(x => x.trim()).map((x, i) => <li key={i}>{x}</li>)}</ol> : <span className="os-tr-en">{row.en}</span>}{key === PUBLISHED && wantMissing && <p id="os-published-want-missing" className="buyer-description-error">{t("⚠ Missing: Wants to buy")}</p>}</td>
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
      {dialog === "approve" ? <><p id="os-dialog-description" className="sr-only">{t("Verify and publish")}</p><ul className="ap-will">{dirty && <li><Check size={16} />{t("Your unsaved changes are saved first.")}</li>}<li><Check size={16} />{fill("{name} gets the {badge} badge.", { badge: t(badge) })}</li><li><Check size={16} />{fill(item.kind === "seller" ? '{ref} goes live in Browse listings as "{listing name}", where buyers can find it and request an NDA.' : item.kind === "buyer" ? '{ref} goes live in Browse investors as "{listing name}", where sellers can find and invite it.' : '{ref} goes live in Browse advisors as "{listing name}", where sellers and buyers can find it.')}</li>{item.kind !== "advisor" && <li><Check size={16} />{fill(item.kind === "seller" ? "{first name} can connect with buyers." : "NDAs open for {first name}.")}</li>}<li><Check size={16} />{fill(`{first name} gets one email: "${email}".`)}</li></ul>{!!stillOpen.length && <p className="os-note">{fill("Still open: {list}. You can verify anyway, or go back and check.", { list: stillOpen.map(v => `${t(v.label)} (${t(v.result === "by_hand" ? "check by hand" : (v.resultLabel ?? "differs").toLowerCase())})`).join(" · ") })}</p>}{!!identityRemaining && <p className="os-note">{fill("Identity check: {n} identifying words still need review. You can publish anyway, or go back and fix them.", { n: String(identityRemaining) })}</p>}
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
type PreviewProps = { item: OneStepItem; name: string; card: CardText; rows: TrRow[]; lang: TextLang; exclusive: boolean };
const selectedText = (rows: TrRow[], key: string, lang: TextLang) => {
  const row = rows.find(r => r.key === key);
  return row ? (lang === "th" ? row.th.trim() || row.en.trim() : row.en.trim() || row.th.trim()) : "";
};
const selectedList = (rows: TrRow[], key: string, lang: TextLang) => selectedText(rows, key, lang).split("\n").map(value => value.trim()).filter(Boolean);
const editedList = (rows: TrRow[], key: string, lang: TextLang, fallback: string[]) => rows.some(row => row.key === key) ? selectedList(rows, key, lang) : fallback;
function PreviewMessage({ error }: { error?: unknown }) {
  const { t } = useTranslation();
  return <p className="os-muted" role={error ? "alert" : undefined}>{error ? error instanceof Error ? error.message : String(error) : t("Loading…")}</p>;
}
function latestRevenue(fin: StartupFinancials | null) {
  if (!fin) return { fy: null, revenue: null, growthPct: null };
  const fy = fin.years.length ? Math.max(...fin.years) : null;
  const rows = fin.income.filter(row => row.fiscal_year === fy);
  const revenue = rows.find(row => row.item_code === "total_revenue") ?? rows.find(row => row.item_code === "revenue_sales_services") ?? null;
  return { fy, revenue: revenue?.amount == null ? null : Number(revenue.amount), growthPct: revenue?.percent_change ?? null };
}
const shortUsd = (value: unknown) => {
  const n = Number(value);
  if (value == null || value === "" || !Number.isFinite(n)) return null;
  const f = (x: number) => String(Math.round(x * 10) / 10);
  return n >= 1e9 ? `${f(n / 1e9)}B` : n >= 1e6 ? `${f(n / 1e6)}M` : n.toLocaleString("en-US");
};
const usdRange = (lo: unknown, hi?: unknown) => {
  const a = shortUsd(lo), b = shortUsd(hi);
  return a && b ? `US$${a} – ${b}` : a || b ? `US$${a || b}` : null;
};
const usdMoney = (value: string | null) => value == null || value === "" ? null : Number.isFinite(Number(value)) ? `US$ ${Number(value).toLocaleString("en-US")}` : value;

function SellerPreview({ item, name, card, rows, lang, exclusive }: PreviewProps) {
  const id = item.review.directoryId ?? undefined;
  const setupFn = useServerFn(getSellerSetup), financialsFn = useServerFn(getStartupFinancials);
  const setupQuery = useQuery({ queryKey: ["one-step-seller-card", id], queryFn: () => setupFn({ data: { id: id! } }), enabled: !!id, staleTime: 30_000 });
  const financialsQuery = useQuery({ queryKey: ["one-step-seller-financials", id], queryFn: () => financialsFn({ data: { startupId: id! } }), enabled: !!id, staleTime: 30_000 });
  if (!id || setupQuery.isPending || financialsQuery.isPending) return <PreviewMessage />;
  if (setupQuery.error || !setupQuery.data) return <PreviewMessage error={setupQuery.error ?? new Error("Business unavailable")} />;
  const setup = setupQuery.data, fin = latestRevenue(financialsQuery.data ?? null), thai = lang === "th";
  const firstPhoto = setup.media.slots.find(slot => !!slot.url)?.url ?? null;
  const productTags = editedList(rows, "product_tags", lang, thai ? setup.productTagsTh : setup.productTags);
  const marketTags = editedList(rows, "market_tags", lang, thai ? setup.marketTagsTh : setup.marketTags);
  const highlights = editedList(rows, "highlights", lang, thai ? setup.highlightsTh : setup.highlights);
  const customerProfile = selectedText(rows, "customers", lang);
  const listing: PublicListing = {
    headline: card.headline || name, description: card.description ?? "", productTags, marketTags,
    revenueBand: setup.rev, location: setup.city || null, typeFounded: null, employees: setup.size,
    certifications: setup.iso, sector: setup.sector, subSector: null, verified: false, certified: false,
    hasFinancials: (financialsQuery.data?.statements.length ?? 0) > 0,
    codeName: setup.listing.name || name, refNo: setup.listing.refNo || item.review.card.ref,
    coverUrl: firstPhoto, coverArt: setup.listing.cover, coverImage: null, publicImageId: null,
    live: false, publishedAt: null, newDays: null, highlights, customerProfile,
    th: {
      headline: thai ? card.headline : setup.listing.headlineTh,
      description: thai ? card.description ?? "" : setup.listing.descriptionTh,
      highlights: thai ? highlights : setup.highlightsTh,
      customerProfile: thai ? customerProfile : "",
      productTags: thai ? productTags : setup.productTagsTh,
      marketTags: thai ? marketTags : setup.marketTagsTh,
    },
  };
  const privateData: Omit<FavPrivate, "ndaApprovedAt" | "ndaValidUntil"> = {
    companyName: card.realName || setup.name, description: (thai ? setup.longDescriptionTh || setup.shortDescriptionTh : setup.longDescription || setup.shortDescription) || null,
    employees: setup.size, legalNameEn: null, legalNameTh: setup.registeredName || null, regNo: setup.reg || null,
    website: setup.web || null, location: setup.city || null, founded: setup.year || null,
    fy: fin.fy, revenue: fin.revenue, netProfit: null, growthPct: fin.growthPct,
    logoPath: setup.media.logoUrl, photoUrl: firstPhoto, email: setup.contact.email || null,
  };
  return <StandardListingCard l={listing} deal={{ dealType: setup.listing.deal, askingPrice: setup.listing.price, priceBand: priceBandOf(setup.listing.price) }} privateData={exclusive ? privateData : null} publicOnly={!exclusive} status={exclusive ? "approved" : "hidden"} />;
}

function BuyerPreview({ item, name, card, lang, exclusive }: PreviewProps) {
  const id = item.review.directoryId ?? undefined;
  const read = useServerFn(getBuyerInvestorById);
  const query = useQuery({ queryKey: ["one-step-buyer-card", id], queryFn: () => read({ data: { id: id! } }), enabled: !!id, staleTime: 30_000 });
  if (!id || query.isPending) return <PreviewMessage />;
  if (query.error || !query.data) return <PreviewMessage error={query.error} />;
  if (!query.data.ok) return <PreviewMessage error={new Error("Investor unavailable")} />;
  const d = query.data.data, i = d.investor, b = d.buyer, thai = lang === "th";
  const investor: CardInvestor & { managed?: boolean; coverUrl?: string | null; status?: string; newDays?: number | null } = {
    refNo: b.ref_no || item.review.card.ref, codeName: b.published_listing_name || name, name: null,
    type: i.investor_type, publishedListingName: b.published_listing_name,
    publishedHeadline: card.headline, publishedHeadlineTh: thai ? card.headline : b.published_headline_th,
    city: i.city, country: i.country, description: card.description, descriptionTh: thai ? card.description : b.description_th,
    sectors: i.preferred_industries, stages: i.preferred_stages, dealTypes: b.deal_types, geography: b.geography,
    verified: d.verification.status === "verified", proofOfFunds: false,
    ticketLabel: bandText(i.ticket_band), aumLabel: bandText(i.aum_band), revLabel: bandText(i.revenue_min_band),
    ticketBand: i.ticket_band, aumBand: i.aum_band, revBand: i.revenue_min_band,
    relation: b.relation, actsFor: i.acts_for_types, coverUrl: null,
    status: exclusive ? "approved" : "hidden", newDays: null,
  };
  const privateData: Omit<SellerFavPrivate, "ndaApprovedAt" | "ndaValidUntil"> = {
    investor_name: card.realName || i.investor_name, investor_type: i.investor_type, acts_for_types: i.acts_for_types,
    country: i.country, city: i.city, website_url: i.website_url, linkedin_url: i.linkedin_url, email: i.email,
    year_founded: i.year_founded, aum: i.aum, min_ticket_size: i.min_ticket_size, max_ticket_size: i.max_ticket_size,
    revenue_min_m: i.revenue_min_m, revenue_max_m: i.revenue_max_m,
    short_description: i.short_description, short_description_th: i.short_description_th,
    long_description: null, long_description_th: null,
    private_description: b.private_description || null, private_description_th: b.private_description_th || null,
    keywords: i.keywords, investment_focus: i.investment_focus,
    preferred_stages: i.preferred_stages, preferred_industries: i.preferred_industries,
    logo_signed_url: i.logo_signed_url, aum_band: i.aum_band, ticket_band: i.ticket_band, revenue_min_band: i.revenue_min_band,
    people: d.people, media: i.media.map(m => ({ slot: m.slot, image_signed_url: m.url })),
    linked_startups: i.portfolio_links.map(x => ({ id: x.id, startup_name: x.name, logo_signed_url: null })),
  };
  const ticketExact = usdRange(i.min_ticket_size, i.max_ticket_size) ?? ([i.min_ticket_size, i.max_ticket_size].filter(Boolean).join(" – ") || null);
  const aumExact = i.aum_exact_usd == null ? usdRange(i.aum) ?? usdMoney(i.aum) : usdRange(i.aum_exact_usd);
  const exactFigures = {
    figures: [
      { label: "Ticket size", value: ticketExact ?? bandText(i.ticket_band) },
      ...(b.relation === "individual" || b.relation === "agent" ? [] : [{ label: isCorporateBuyer(i.investor_type) ? "Group revenue" : "AUM", value: aumExact ?? bandText(i.aum_band) }]),
    ],
    fit: { label: "Min. target revenue", value: i.revenue_min_m == null ? bandText(i.revenue_min_band) : `฿ ${Math.round(Number(i.revenue_min_m) * 1e6).toLocaleString("en-US")}` },
  };
  return exclusive ? <StandardInvestorCard i={investor} privateData={privateData} exactFigures={exactFigures} /> : <StandardInvestorCard i={investor} />;
}

function AdvisorPreview({ card, item, lang }: PreviewProps) {
  const id = item.review.directoryId ?? undefined;
  const read = useServerFn(getAdvisorFirmForAdmin);
  const query = useQuery({ queryKey: ["one-step-advisor-card", id], queryFn: () => read({ data: { id: id! } }), enabled: !!id, staleTime: 30_000 });
  if (!id || query.isPending) return <PreviewMessage />;
  if (query.error || !query.data) return <PreviewMessage error={query.error} />;
  const firm: AdvisorFirm = {
    ...query.data, name: card.realName || query.data.name,
    description: card.description, descriptionTh: lang === "th" ? card.description : query.data.descriptionTh,
  };
  return <FirmCard f={firm} preview noStatus />;
}

function Preview(props: PreviewProps) {
  const { t } = useTranslation(), { item, lang, exclusive } = props;
  return <div lang={lang}><h4>{t(exclusive ? "Exclusive view" : "Listing view")}{lang === "th" && <span className="os-lang-tag is-th os-cap-tag">ไทย</span>}</h4>{item.kind === "seller" ? <SellerPreview {...props} /> : item.kind === "buyer" ? <BuyerPreview {...props} /> : <AdvisorPreview {...props} />}</div>;
}
function reviewText(value: string | null, t: (s: string) => string, language: "en" | "th"): string | null {
  if (!value) return value;
  if (value.startsWith("Registered on ")) return t("Registered on {date}").replace("{date}", approvalFullDate(value.slice(14), language));
  let result = t(value);
  if (result !== value) return result;
  if (value.startsWith("Ticket size ")) return t("Ticket size {band}").replace("{band}", t(value.slice(12)));
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
