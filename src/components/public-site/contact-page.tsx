import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, Check, ChevronDown, CircleAlert, Lock, Mail, MessageCircleMore, Send } from "lucide-react";
import { toast } from "sonner";
import { sendContactEnquiry } from "@/lib/contact.functions";
import { Head } from "./public-home";
import { PublicShell, Rich, useHomeLang } from "./public-shell";
import { PrivacyLink } from "./privacy-notice";

const c = (en: string, th: string) => ({ en, th });
const C = {
  chip: c("Contact us: the PitchSnack team · **we reply within 48 hours**", "ติดต่อเรา: ทีมงาน PitchSnack · **ตอบกลับภายใน 48 ชั่วโมง**"),
  h1: c("Questions? Talk to the PitchSnack team.", "มีคำถาม?\nพูดคุยกับทีมงานของเรา"),
  intro: c("Whether you are thinking of selling, looking for a business to invest in, or an adviser who wants to join, send us your question with the form or email us directly. A person on the team replies, not a bot.",
    "ไม่ว่าท่านกำลังคิดจะขายกิจการ มองหากิจการเพื่อลงทุน หรือเป็นที่ปรึกษาที่อยากเข้าร่วม ส่งคำถามถึงเราผ่านแบบฟอร์ม หรืออีเมลถึงเราโดยตรง ทีมงานจะตอบกลับด้วยตัวเอง ไม่ใช่ระบบอัตโนมัติ"),
  q1: c("Email the team directly", "อีเมลถึงทีมงานโดยตรง"),
  q2: c("Send an enquiry", "ส่งคำถามผ่านแบบฟอร์ม"), q2s: c("Takes about 2 minutes", "ใช้เวลาประมาณ 2 นาที"),
  q3: c("Book a free 30-minute consultation", "นัดปรึกษาฟรี 30 นาที"), q3s: c("By video or phone, no commitment", "คุยทางวิดีโอหรือโทรศัพท์ ไม่มีข้อผูกมัด"),
  h2: c("Send us an enquiry", "ส่งคำถามถึงเรา"),
  lead: c("Fields marked * are required. We reply to the email you give us.", "ช่องที่มี * จำเป็นต้องกรอก เราจะตอบกลับทางอีเมลที่ท่านให้ไว้"),
  iam: c("I am", "ท่านคือ"),
  topic: c("What is it about?", "เรื่องที่ต้องการสอบถาม"), topicPh: c("Choose a topic", "เลือกหัวข้อ"),
  name: c("Full name", "ชื่อ-นามสกุล"), namePh: c("e.g. Somchai Jaidee", "เช่น สมชาย ใจดี"),
  company: c("Company or organisation", "บริษัทหรือองค์กร"), opt: c("(optional)", "(ไม่บังคับ)"),
  email: c("Email", "อีเมล"), phone: c("Phone", "เบอร์โทรศัพท์"),
  msg: c("Your message", "ข้อความ"), msgPh: c("Tell us briefly what you are looking for, or what we can help with.", "เล่าให้เราฟังสั้นๆ ว่าท่านกำลังมองหาอะไร หรือต้องการให้เราช่วยเรื่องใด"),
  amber: c("**No need to name your business or share figures yet.** If your plans are confidential, the sector and a rough size are enough. We ask for details once we have talked.",
    "**ยังไม่ต้องระบุชื่อกิจการหรือตัวเลขทางการเงิน** หากเรื่องของท่านเป็นความลับ เขียนเพียงอุตสาหกรรมและขนาดโดยประมาณก็พอ เราจะขอรายละเอียดเมื่อได้คุยกันแล้ว"),
  consentA: c("I agree that PitchSnack may use these details to reply to my enquiry, as set out in the ", "ข้าพเจ้ายินยอมให้ PitchSnack ใช้ข้อมูลนี้เพื่อตอบคำถามของข้าพเจ้า ตาม"),
  consentL: c("privacy notice", "ประกาศความเป็นส่วนตัว"), consentB: c(".", ""),
  send: c("Send enquiry", "ส่งคำถาม"), sending: c("Sending…", "กำลังส่ง…"), or: c("or email", "หรืออีเมลถึง"),
  fail: c("We couldn't send your enquiry. Please try again or email support@pitchsnack.com.", "ส่งคำถามไม่สำเร็จ กรุณาลองอีกครั้ง หรืออีเมลถึง support@pitchsnack.com"),
  ref: c("Reference", "เลขที่อ้างอิง"), again: c("Send another enquiry", "ส่งคำถามอีกเรื่อง"),
  quickH: c("Answers that may help sooner", "คำตอบที่อาจช่วยท่านได้เร็วกว่า"),
  quickP: c("Each group's most common questions are answered on its own page.", "คำถามที่พบบ่อยของแต่ละกลุ่มอยู่ในหน้าของกลุ่มนั้น"),
};
const ERR = {
  role: c("Please choose one", "กรุณาเลือกว่าท่านคือใคร"), topic: c("Please choose a topic", "กรุณาเลือกหัวข้อ"),
  name: c("Please enter your name", "กรุณากรอกชื่อของท่าน"), email: c("Please enter a valid email, like name@company.com", "กรุณากรอกอีเมลที่ถูกต้อง เช่น name@company.com"),
  phone: c("A phone number has 9 or 10 digits", "เบอร์โทรศัพท์ควรมี 9 ถึง 10 หลัก"), message: c("Please write at least 20 characters", "กรุณาเขียนข้อความอย่างน้อย 20 ตัวอักษร"),
  consent: c("Please tick this so we can reply to you", "กรุณาทำเครื่องหมายเพื่อให้เราตอบกลับท่านได้"),
};
const ROLES = [
  { v: "seller", l: c("A business owner looking to sell", "เจ้าของกิจการ / ที่ต้องการขาย"), topic: "selling" },
  { v: "buyer", l: c("A buyer or investor", "ผู้ซื้อ / นักลงทุน"), topic: "buying" },
  { v: "partner", l: c("An adviser or partner", "ที่ปรึกษา / พาร์ทเนอร์"), topic: "partner" },
  { v: "other", l: c("Something else", "อื่นๆ"), topic: "" },
] as const;
const TOPICS: [string, { en: string; th: string }][] = [
  ["selling", c("Selling my business", "การขายกิจการ")], ["buying", c("Buying or investing in a business", "การซื้อหรือลงทุนในกิจการ")],
  ["partner", c("Joining as a partner", "การเข้าร่วมเป็นพาร์ทเนอร์")], ["plans", c("Plans and billing", "แผนบริการและการชำระเงิน")],
  ["verification", c("Verification and badges", "การตรวจสอบและตราสัญลักษณ์")], ["account", c("My account and signing in", "บัญชีผู้ใช้และการเข้าสู่ระบบ")],
  ["press", c("Press and collaborations", "สื่อมวลชนและความร่วมมือ")], ["other", c("Something else", "เรื่องอื่นๆ")],
];
const CARDS = [
  { to: "/sellers#faq", h: c("For sellers", "สำหรับผู้ขาย"), p: c("How your name stays hidden, what it costs, and the steps from listing to signing.", "ชื่อกิจการถูกซ่อนอย่างไร ค่าบริการเท่าไร และขั้นตอนตั้งแต่ประกาศขายจนถึงวันลงนาม"), l: c("Questions sellers ask →", "คำถามจากผู้ขาย →") },
  { to: "/buyers#faq", h: c("For buyers", "สำหรับผู้ซื้อ"), p: c("How NDAs work, what you see before and after approval, and which plan fits.", "วิธีขอเซ็น NDA สิ่งที่ท่านเห็นก่อนและหลังอนุมัติ และแผนที่เหมาะกับท่าน"), l: c("Questions buyers ask →", "คำถามจากผู้ซื้อ →") },
  { to: "/partners#faq", h: c("For partners", "สำหรับพาร์ทเนอร์"), p: c("Who can join, how firms are verified, and joining your clients' deals.", "ใครสมัครได้ การตรวจสอบบริษัท และการเข้าร่วมดีลของลูกค้า"), l: c("Questions partners ask →", "คำถามจากพาร์ทเนอร์ →") },
];

type F = { role: string; topic: string; name: string; company: string; email: string; phone: string; message: string; consent: boolean; website: string };
const EMPTY: F = { role: "", topic: "", name: "", company: "", email: "", phone: "", message: "", consent: false, website: "" };
const ORDER: (keyof typeof ERR)[] = ["role", "topic", "name", "email", "phone", "message", "consent"];

function check(f: F, k: keyof typeof ERR): boolean {
  switch (k) {
    case "role": return !!f.role;
    case "topic": return !!f.topic;
    case "name": return f.name.trim().length >= 2;
    case "email": return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim());
    case "phone": { const d = f.phone.replace(/\D/g, ""); return !d || (d.length >= 8 && d.length <= 10); }
    case "message": return f.message.trim().length >= 20;
    case "consent": return f.consent;
  }
}

export function ContactPage() {
  return (
    <PublicShell current={null} talkHref="#enquiry" footCurrent="contact">
      <Hero />
      <section id="enquiry" className="ph-sec ph-grey"><div className="ph-wrap"><EnquiryCard /></div></section>
      <Quick />
    </PublicShell>
  );
}

function Hero() {
  const { t } = useHomeLang();
  const links = [
    { icon: Mail, h: "support@pitchsnack.com", s: t(C.q1), href: "mailto:support@pitchsnack.com" },
    { icon: MessageCircleMore, h: t(C.q2), s: t(C.q2s), href: "#enquiry" },
    { icon: CalendarCheck, h: t(C.q3), s: t(C.q3s), href: "/#close" },
  ];
  return (
    <section id="top" className="ph-hero">
      <div className="ph-hero-bg" aria-hidden />
      <div className="ph-wrap ph-hero-grid ct-hero">
        <p className="ph-chip"><Rich s={t(C.chip)} /></p>
        <div className="ph-hero-copy">
          <h1><Rich s={t(C.h1)} /></h1>
          <p className="ph-hero-intro">{t(C.intro)}</p>
        </div>
        <div className="ct-quick">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="ct-ql">
              <span className="ct-ql-ic"><l.icon size={19} /></span>
              <span><b>{l.h}</b><small>{l.s}</small></span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function Err({ id, msg }: { id: string; msg: string | null }) {
  if (!msg) return null;
  return <p id={id} className="ct-err"><CircleAlert size={14} />{msg}</p>;
}

function EnquiryCard() {
  const { t, lang } = useHomeLang();
  const send = useServerFn(sendContactEnquiry);
  const [f, setF] = useState<F>(EMPTY);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ reference: string; first: string; email: string } | null>(null);
  const sentRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (sent) sentRef.current?.focus(); }, [sent]);

  const err = (k: keyof typeof ERR) => (shown[k] && !check(f, k) ? t(ERR[k]) : null);
  const set = <K extends keyof F>(k: K, v: F[K]) => setF((p) => ({ ...p, [k]: v }));
  const blur = (k: keyof typeof ERR) => () => { if (k === "phone" ? f.phone : (f as any)[k]) setShown((s) => ({ ...s, [k]: true })); };
  const aria = (k: keyof typeof ERR) => ({ "aria-invalid": !!err(k) || undefined, "aria-describedby": err(k) ? `e-${k}` : undefined });

  const pickRole = (v: string) => {
    const r = ROLES.find((x) => x.v === v)!;
    setF((p) => ({ ...p, role: v, topic: p.topic || r.topic }));
    setShown((s) => ({ ...s, role: true }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShown(Object.fromEntries(ORDER.map((k) => [k, true])));
    const bad = ORDER.find((k) => !check(f, k));
    if (bad) {
      const el = formRef.current?.querySelector<HTMLElement>(`[data-f="${bad}"]`);
      el?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }
    setBusy(true);
    try {
      const r = await send({ data: {
        role: f.role as any, topic: f.topic as any, name: f.name.trim(), company: f.company.trim() || null, email: f.email.trim(),
        phone: f.phone.replace(/\D/g, "") || null, message: f.message.trim(), language: lang, consent: true, website: f.website || undefined,
      } });
      setSent(r);
    } catch {
      toast.error(t(C.fail));
    } finally { setBusy(false); }
  };

  if (sent) {
    return (
      <div className="ct-card ct-sent" ref={sentRef} tabIndex={-1}>
        <span className="ct-ok"><Check size={26} /></span>
        <h2>{lang === "th" ? `ขอบคุณ ${sent.first} เราได้รับคำถามของท่านแล้ว` : `Thank you, ${sent.first}. We have your enquiry.`}</h2>
        <p>{lang === "th"
          ? <>เราส่งสำเนาไปที่ <b>{sent.email}</b> แล้ว ทีมงานจะตอบกลับภายใน 48 ชั่วโมง หากไม่พบอีเมล กรุณาตรวจสอบในโฟลเดอร์จดหมายขยะ</>
          : <>We have sent a copy to <b>{sent.email}</b>. The team replies within 48 hours. If you can't find it, please check your spam folder.</>}</p>
        <span className="ct-ref">{t(C.ref)} <b>{sent.reference}</b></span>
        <button type="button" className="ct-again" onClick={() => { setF(EMPTY); setShown({}); setSent(null); }}>{t(C.again)}</button>
      </div>
    );
  }

  const req = <span className="ct-req" aria-hidden>*</span>;
  const opt = <span className="ct-opt">{t(C.opt)}</span>;
  return (
    <div className="ct-card">
      <h2>{t(C.h2)}</h2>
      <p className="ct-lead">{t(C.lead)}</p>
      <form ref={formRef} noValidate onSubmit={submit} className="ct-form">
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="ct-hp" aria-hidden value={f.website} onChange={(e) => set("website", e.target.value)} />
        <div className="ct-box">
          <fieldset className="ct-field">
            <legend className="ct-label">{t(C.iam)}{req}</legend>
            <div className="ct-tiles" role="radiogroup" aria-required {...aria("role")}>
              {ROLES.map((r, i) => {
                const parts = t(r.l).split(" / ");
                return (
                  <label key={r.v} className={`ct-tile is-${r.v}${f.role === r.v ? " is-on" : ""}`}>
                    <input type="radio" name="role" value={r.v} checked={f.role === r.v} onChange={() => pickRole(r.v)} data-f={i === 0 ? "role" : undefined} />
                    <span>{parts.map((p, j) => <span key={j} className="ct-nw">{p}{j < parts.length - 1 ? (lang === "th" && r.v === "seller" ? "" : " / ") : ""}</span>)}</span>
                  </label>
                );
              })}
            </div>
            <Err id="e-role" msg={err("role")} />
          </fieldset>
        </div>
        <div className="ct-box">
          <div className="ct-field">
            <label className="ct-label" htmlFor="ct-topic">{t(C.topic)}{req}</label>
            <div className="ct-select">
              <select id="ct-topic" data-f="topic" value={f.topic} onChange={(e) => { set("topic", e.target.value); setShown((s) => ({ ...s, topic: true })); }} onBlur={blur("topic")} {...aria("topic")}>
                <option value="" disabled>{t(C.topicPh)}</option>
                {TOPICS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
              </select>
              <ChevronDown size={16} />
            </div>
            <Err id="e-topic" msg={err("topic")} />
          </div>
          <div className="ct-pair">
            <div className="ct-field">
              <label className="ct-label" htmlFor="ct-name">{t(C.name)}{req}</label>
              <input id="ct-name" data-f="name" autoComplete="name" placeholder={t(C.namePh)} value={f.name} onChange={(e) => set("name", e.target.value)} onBlur={blur("name")} {...aria("name")} />
              <Err id="e-name" msg={err("name")} />
            </div>
            <div className="ct-field">
              <label className="ct-label" htmlFor="ct-company">{t(C.company)} {opt}</label>
              <input id="ct-company" autoComplete="organization" value={f.company} onChange={(e) => set("company", e.target.value)} />
            </div>
          </div>
          <div className="ct-pair">
            <div className="ct-field">
              <label className="ct-label" htmlFor="ct-email">{t(C.email)}{req}</label>
              <input id="ct-email" data-f="email" type="email" autoComplete="email" placeholder="name@company.com" value={f.email} onChange={(e) => set("email", e.target.value)} onBlur={blur("email")} {...aria("email")} />
              <Err id="e-email" msg={err("email")} />
            </div>
            <div className="ct-field">
              <label className="ct-label" htmlFor="ct-phone">{t(C.phone)} {opt}</label>
              <div className="ct-phone"><span>+66</span>
                <input id="ct-phone" data-f="phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="81 234 5678" value={f.phone} onChange={(e) => set("phone", e.target.value.replace(/[^\d\s-]/g, ""))} onBlur={blur("phone")} {...aria("phone")} />
              </div>
              <Err id="e-phone" msg={err("phone")} />
            </div>
          </div>
          <div className="ct-field">
            <label className="ct-label" htmlFor="ct-msg">{t(C.msg)}{req}</label>
            <textarea id="ct-msg" data-f="message" maxLength={2000} placeholder={t(C.msgPh)} value={f.message} onChange={(e) => set("message", e.target.value)} onBlur={blur("message")} {...aria("message")} />
            <div className="ct-msg-foot"><Err id="e-message" msg={err("message")} /><span className="ct-count">{f.message.length.toLocaleString("en-US")} / 2,000</span></div>
          </div>
        </div>
        <p className="ct-amber"><Lock size={17} /><span><Rich s={t(C.amber)} /></span></p>
        <div className="ct-field">
          <label className="ct-consent">
            <input type="checkbox" data-f="consent" checked={f.consent} onChange={(e) => { set("consent", e.target.checked); setShown((s) => ({ ...s, consent: true })); }} {...aria("consent")} />
            <span>{t(C.consentA)}<PrivacyLink className="ct-link">{t(C.consentL)}</PrivacyLink>{t(C.consentB)}</span>
          </label>
          <Err id="e-consent" msg={err("consent")} />
        </div>
        <div className="ct-send">
          <button type="submit" className="ph-red ct-btn" disabled={busy}><Send size={16} />{busy ? t(C.sending) : t(C.send)}</button>
          <span>{t(C.or)} <a href="mailto:support@pitchsnack.com" className="ct-link">support@pitchsnack.com</a></span>
        </div>
      </form>
    </div>
  );
}

function Quick() {
  const { t } = useHomeLang();
  return (
    <section id="quick" className="ph-sec ph-white">
      <div className="ph-wrap">
        <Head h={t(C.quickH)} intro={t(C.quickP)} />
        <div className="ct-cards">
          {CARDS.map((k) => (
            <a key={k.to} href={k.to} className="ct-qc"><b>{t(k.h)}</b><span>{t(k.p)}</span><em>{t(k.l)}</em></a>
          ))}
        </div>
      </div>
    </section>
  );
}
