import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, FileText, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { loiParties, sendLoi, type LoiParty } from "@/lib/pipeline.functions";

const TH = { fontFamily: "'Noto Sans Thai', 'DM Sans', sans-serif" };
const GROTESK = { fontFamily: "'Space Grotesk', 'DM Sans', sans-serif" };

/* ---------- number → British English words ---------- */
const ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES = ["", "thousand", "million", "billion", "trillion"];
function under1000(n: number, andIfSmall: boolean) {
  const h = Math.floor(n / 100),
    r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} hundred`);
  if (r) {
    const t = r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? `-${ONES[r % 10]}` : "");
    parts.push((h || andIfSmall ? "and " : "") + t);
  }
  return parts.join(" ");
}
export function toWords(n: number): string {
  if (!n) return "Zero";
  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  const out: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (!groups[i]) continue;
    const w = under1000(groups[i], i === 0 && out.length > 0 && groups[i] < 100);
    out.push(SCALES[i] ? `${w} ${SCALES[i]}` : w);
  }
  const s = out.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const withCommas = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function PartyName({ p }: { p?: LoiParty }) {
  if (!p) return <span className="text-[#9CA3AF]">…</span>;
  return (
    <span className="inline">
      {p.nameTh && (
        <span style={TH} className="font-semibold text-[#151A28]">
          {p.nameTh}
        </span>
      )}
      {p.nameEn && (
        <span
          className={
            p.nameTh ? "ml-1.5 text-[11px] text-[#6B7280]" : "font-semibold text-[#151A28]"
          }
        >
          {p.nameTh ? p.nameEn.toUpperCase() : p.nameEn}
        </span>
      )}
      {!p.nameTh && !p.nameEn && <span className="font-semibold text-[#151A28]">{p.short}</span>}
    </span>
  );
}
const regLine = (p?: LoiParty) => (
  <>
    Company registration no. <b className="font-semibold text-[#151A28]">{p?.regNo || "—"}</b>
  </>
);

const TERMS = `1. Nature. This letter of intent sets out the buyer's indicative, non-binding proposal to acquire an interest in the seller's business.
2. Binding effect. Nothing in this letter creates a legally binding obligation to complete a transaction, except the clauses on exclusivity and confidentiality.
3. Exclusivity. If the seller accepts, the seller will not solicit or negotiate with other buyers for the number of days stated, starting on the day of acceptance.
4. Confidentiality. This letter and everything shared under it stay confidential under the parties' signed NDA.
5. Due diligence. Any final offer depends on satisfactory financial, legal and commercial due diligence and on a definitive agreement.
6. Authority. The person sending this letter confirms they are authorised to act for the buyer.
7. Record. PitchSnack stores the letter, who agreed to it and when, and shows the same letter to both parties.
8. Governing law. This letter is governed by the laws of Thailand.`;

export function SendLoiDialog({
  id,
  onClose,
  onSent,
}: {
  id: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const fetchParties = useServerFn(loiParties);
  const send = useServerFn(sendLoi);
  const { data } = useQuery({
    queryKey: ["pipeline", "loi-parties", id],
    queryFn: () => fetchParties({ data: { id } }),
  });
  const [price, setPrice] = useState("");
  const [days, setDays] = useState("60");
  const [cond, setCond] = useState("");
  const [tick, setTick] = useState(false);
  const [terms, setTerms] = useState(false);
  const [letter, setLetter] = useState(false);
  const [busy, setBusy] = useState(false);
  const priceRef = useRef<HTMLInputElement>(null);

  const digits = price.replace(/\D/g, "");
  const amount = digits ? Number(digits) : 0;
  const n = Number(days) || 0;
  const buyerShort = data?.buyer.short ?? "the buyer";
  const consent = `I have read the letter of intent and agree to its Terms & Conditions, and I'm authorised to send this on behalf of ${buyerShort}.`;

  const onPrice = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    const before = el.value.slice(0, caret).replace(/\D/g, "").length;
    const d = el.value
      .replace(/\D/g, "")
      .replace(/^0+(?=\d)/, "")
      .slice(0, 15);
    const f = withCommas(d);
    setPrice(f);
    requestAnimationFrame(() => {
      if (!priceRef.current) return;
      let pos = 0,
        seen = 0;
      while (pos < f.length && seen < before) {
        if (/\d/.test(f[pos])) seen++;
        pos++;
      }
      priceRef.current.setSelectionRange(pos, pos);
    });
  };

  const submit = async () => {
    if (!tick) return;
    if (!amount) {
      toast.error("Enter an indicative price");
      priceRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      await send({
        data: {
          id,
          amount,
          exclusivityDays: Math.min(365, Math.max(0, Math.round(n))),
          conditions: cond.trim() || undefined,
          consent,
        },
      });
      toast.success("Letter of intent sent · waiting for the seller");
      onSent();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const label = "mb-1.5 block text-[13px] font-medium text-[#151A28]";
  const field =
    "w-full rounded-[10px] border border-[#DCDFE5] bg-white px-3 text-[14px] text-[#151A28] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20";
  const outlineBtn =
    "inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[#DCDFE5] bg-white px-3.5 text-[13.5px] font-medium text-[#151A28] hover:bg-[#F8F9FB]";

  return (
    <>
      <Dialog
        open
        onOpenChange={(o) => {
          if (!o && !letter) onClose();
        }}
      >
        <DialogContent
          className="flex max-h-[calc(100vh-32px)] w-[560px] max-w-[calc(100vw-24px)] flex-col gap-0 overflow-hidden rounded-2xl border border-[#DCDFE5] p-0 [&>button]:hidden"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: "0 24px 64px rgba(16,24,40,.28),0 4px 12px rgba(16,24,40,.12)",
          }}
          onEscapeKeyDown={(e) => {
            if (letter) e.preventDefault();
          }}
        >
          <div className="flex items-start gap-3 px-6 pt-5">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[19px] font-semibold text-[#151A28]">
                Send a letter of intent
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-[13.5px] text-[#6B7280]">
                Non-binding. The seller can accept or decline.
              </DialogDescription>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 text-[#6B7280] hover:bg-[#F8F9FB]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-4">
            <div className="rounded-[12px] border border-[#E5E7EB] bg-[#F8F9FB] px-4 text-[13px]">
              {(
                [
                  ["From", data?.buyer, null],
                  ["To", data?.seller, data?.listingCode],
                ] as const
              ).map(([k, p, code], i) => (
                <div
                  key={k}
                  className={`flex gap-3 py-2.5 ${i ? "border-t border-[#E5E7EB]" : ""}`}
                >
                  <span className="w-[42px] flex-none pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                    {k}
                  </span>
                  <div className="min-w-0 flex-1 leading-snug">
                    <div>
                      <PartyName p={p} />
                    </div>
                    <div className="mt-0.5 text-[12px] text-[#6B7280]">
                      {regLine(p)}
                      {code && (
                        <>
                          {" "}
                          · Listing <b className="font-semibold text-[#151A28]">{code}</b>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <label className={label} htmlFor="loi-price">
                Indicative price (฿)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#6B7280]">
                  ฿
                </span>
                <input
                  id="loi-price"
                  ref={priceRef}
                  inputMode="numeric"
                  autoComplete="off"
                  value={price}
                  onChange={onPrice}
                  placeholder="120,000,000"
                  className={`${field} h-10 pl-7`}
                />
              </div>
              {amount > 0 && (
                <div className="mt-1 text-[12.5px] italic text-[#6B7280]">
                  in words: {toWords(amount)} baht
                </div>
              )}
            </div>

            <div className="mt-3.5">
              <label className={label} htmlFor="loi-days">
                Exclusivity (days)
              </label>
              <input
                id="loi-days"
                type="number"
                min={0}
                max={365}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className={`${field} h-10 w-[120px]`}
              />
            </div>

            <div className="mt-3.5">
              <label className={label} htmlFor="loi-cond">
                Conditions
              </label>
              <textarea
                id="loi-cond"
                rows={3}
                value={cond}
                onChange={(e) => setCond(e.target.value)}
                placeholder="Anything the seller should know: due-diligence scope, financing, timeline…"
                className={`${field} resize-y py-2`}
              />
            </div>

            <div className="mt-4 rounded-[12px] border border-[#E5E7EB] px-[14px] py-3 text-[13px] text-[#151A28]">
              <div className="flex items-start gap-3">
                <input
                  id="loi-consent"
                  type="checkbox"
                  checked={tick}
                  onChange={(e) => setTick(e.target.checked)}
                  className="mt-0.5 h-4 w-4 flex-none accent-[#111827]"
                />
                <div className="min-w-0">
                  <label htmlFor="loi-consent">
                    I have read the{" "}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setLetter(true);
                      }}
                      className="text-[#2563EB] hover:underline"
                    >
                      letter of intent
                    </button>{" "}
                    and agree to its{" "}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setTerms((v) => !v);
                      }}
                      aria-expanded={terms}
                      className="text-[#2563EB] hover:underline"
                    >
                      Terms &amp; Conditions
                    </button>
                    , and I'm authorised to send this on behalf of {buyerShort}.
                  </label>
                  <div className="mt-1 text-[12px] text-[#6B7280]">
                    The letter is non-binding, except exclusivity and confidentiality.
                  </div>
                </div>
              </div>
              {terms && (
                <div className="mt-3 max-h-[200px] overflow-y-auto whitespace-pre-line rounded-[10px] border border-[#E5E7EB] bg-[#FCFCFD] px-3 py-2.5 text-[12.5px] leading-relaxed text-[#4B5263]">
                  {TERMS}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-[#E5E7EB] px-6 py-3 sm:flex-row sm:items-center">
            <span
              className={`min-w-0 flex-1 truncate whitespace-nowrap text-[12.5px] ${tick ? "text-[#6B7280]" : "text-[#94560A]"}`}
            >
              {tick
                ? `If accepted, exclusivity runs for ${n} days.`
                : "Agree to the Terms & Conditions to send."}
            </span>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setLetter(true)} className={outlineBtn}>
                <FileText className="h-4 w-4" />
                View letter
              </button>
              <button type="button" onClick={onClose} className={outlineBtn}>
                Cancel
              </button>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={tick ? -1 : 0}>
                      <button
                        type="button"
                        disabled={!tick || busy}
                        onClick={submit}
                        className="inline-flex h-9 items-center rounded-[10px] bg-[#192957] px-4 text-[13.5px] font-semibold text-white hover:bg-[#101D43] disabled:cursor-not-allowed disabled:bg-[#C7CBD6]"
                      >
                        {busy ? "Sending…" : "Send"}
                      </button>
                    </span>
                  </TooltipTrigger>
                  {!tick && <TooltipContent>Tick the box to send</TooltipContent>}
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {letter && (
        <LetterPreview
          onBack={() => setLetter(false)}
          buyer={data?.buyer}
          seller={data?.seller}
          code={data?.listingCode ?? null}
          price={amount}
          days={n}
          cond={cond.trim()}
          buyerShort={buyerShort}
        />
      )}
    </>
  );
}

function LetterPreview({
  onBack,
  buyer,
  seller,
  code,
  price,
  days,
  cond,
  buyerShort,
}: {
  onBack: () => void;
  buyer?: LoiParty;
  seller?: LoiParty;
  code: string | null;
  price: number;
  days: number;
  cond: string;
  buyerShort: string;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onBack();
      }
    };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [onBack]);
  const today = new Date()
    .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    .replace("Sept", "Sep");
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex gap-4 border-t border-[#E5E7EB] py-2.5 text-[13px] first:border-t-0">
      <span className="w-[120px] flex-none text-[#6B7280]">{k}</span>
      <div className="min-w-0 flex-1 text-[#151A28]">{v}</div>
    </div>
  );
  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[60] grid place-items-center p-3"
      style={{ background: "rgba(17,24,39,.45)", fontFamily: "'DM Sans', sans-serif" }}
      onClick={onBack}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Letter of intent preview"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[calc(100vh-24px)] w-[640px] max-w-full flex-col overflow-hidden rounded-2xl border border-[#DCDFE5] bg-white"
        style={{ boxShadow: "0 24px 64px rgba(16,24,40,.28)" }}
      >
        <div className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-2.5">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] font-medium text-[#151A28] hover:bg-[#F8F9FB]"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to editing
          </button>
          <span className="rounded-full bg-[#FFF4DC] px-2.5 py-0.5 text-[11.5px] font-semibold text-[#94560A]">
            Draft · not yet sent
          </span>
          <button
            onClick={onBack}
            aria-label="Close"
            className="ml-auto rounded-md p-1 text-[#6B7280] hover:bg-[#F8F9FB]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
          <div className="flex items-center justify-between text-[12px]">
            <span style={GROTESK} className="text-[15px] font-bold text-[#192957]">
              PitchSnack
            </span>
            <span className="inline-flex items-center gap-1 text-[#6B7280]">
              <Lock className="h-3.5 w-3.5" />
              Confidential under the NDA
            </span>
          </div>
          <h2 style={GROTESK} className="mt-5 text-[26px] font-semibold text-[#151A28]">
            Letter of intent
          </h2>
          <div className="mt-4 rounded-[12px] border border-[#E5E7EB] px-4">
            {row(
              "From",
              <>
                <PartyName p={buyer} />
                <div className="text-[12px] text-[#6B7280]">{regLine(buyer)}</div>
              </>,
            )}
            {row(
              "To",
              <>
                <PartyName p={seller} />
                <div className="text-[12px] text-[#6B7280]">
                  {regLine(seller)}
                  {code && (
                    <>
                      {" "}
                      · Listing <b className="font-semibold text-[#151A28]">{code}</b>
                    </>
                  )}
                </div>
              </>,
            )}
            {row("Date", `${today} · draft`)}
          </div>
          <div className="mt-4 rounded-[12px] border border-[#E5E7EB] px-4">
            {row(
              "Consideration",
              price ? (
                <>
                  <span style={GROTESK} className="text-[18px] font-semibold">
                    ฿{withCommas(String(price))}
                  </span>{" "}
                  · cash consideration
                  <div className="text-[12px] italic text-[#6B7280]">{toWords(price)} baht</div>
                </>
              ) : (
                <span className="text-[#9CA3AF]">Not entered yet</span>
              ),
            )}
            {row("Exclusivity", `${days} days from the seller's acceptance`)}
            {row(
              "Conditions",
              cond ? (
                <span className="whitespace-pre-line">{cond}</span>
              ) : (
                <span className="text-[#9CA3AF]">None stated</span>
              ),
            )}
            {row("Confidentiality", "Under the parties' signed NDA")}
            {row("Binding", "Non-binding, except exclusivity and confidentiality")}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
            <div className="rounded-[12px] border border-[#E5E7EB] p-3">
              <div className="text-[11px] uppercase tracking-wide text-[#9CA3AF]">By the buyer</div>
              <div className="mt-1 font-semibold">{buyerShort}</div>
              <div className="text-[12px] text-[#6B7280]">e-signature applied on send</div>
            </div>
            <div className="rounded-[12px] border border-[#E5E7EB] p-3">
              <div className="text-[11px] uppercase tracking-wide text-[#9CA3AF]">
                Seller decision
              </div>
              <div className="mt-1 font-semibold">Not decided yet</div>
            </div>
          </div>
        </div>
        <div className="flex items-start gap-1.5 border-t border-[#E5E7EB] bg-[#F8F9FB] px-6 py-3 text-[12px] text-[#6B7280]">
          <Lock className="mt-0.5 h-3.5 w-3.5 flex-none" />
          Both parties see the same letter, stored by PitchSnack. This is a draft preview — it is
          sent only when you tick the box and choose Send.
        </div>
      </div>
    </div>
  );
}
