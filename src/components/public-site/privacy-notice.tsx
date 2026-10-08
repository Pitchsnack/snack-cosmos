import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { privacyConfig } from "@/config/privacy";
import { PRIVACY_DOC, type Two } from "./privacy-doc";
import { useHomeLang } from "./public-shell";

/** The Privacy notice document, shared by the pop-up and /privacy. */
export function PrivacyDoc() {
  const { lang } = useHomeLang();
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (_, k) => (privacyConfig as any)[k]?.[lang] ?? "");
  const text = (s: string): ReactNode[] =>
    fill(s).split(/([\w.+-]+@pitchsnack\.com)/).map((p, i) => (i % 2 ? <a key={i} href={`mailto:${p}`}>{p}</a> : p));
  const item = (it: Two) => {
    const s = it[lang];
    const basis = s.match(/^(.*?)\s*(\((?:legal basis|ฐานทางกฎหมาย):.*\))$/);
    if (basis) return <>{text(basis[1])} <span className="pv-basis">{basis[2]}</span></>;
    const c = s.indexOf(": ");
    if (c > 0 && c < 48 && !s.slice(0, c).includes("(") && !s.includes("@")) return <><b>{s.slice(0, c)}:</b> {text(s.slice(c + 2))}</>;
    return text(s);
  };
  const last = PRIVACY_DOC.length - 1;
  return (
    <article className="pv-doc" lang={lang}>
      {PRIVACY_DOC.map((b, i) => {
        if (b.k === "ul") return <ul key={i}>{b.items.map((it, j) => <li key={j}>{item(it)}</li>)}</ul>;
        if (b.k === "title") return <h1 key={i}>{b[lang]}</h1>;
        if (b.k === "h") return <h2 key={i}>{b[lang]}</h2>;
        if (i === 1) return <p key={i} className="pv-date">{fill(b[lang])}</p>;
        if (i === last) return <p key={i} className="pv-end">{b[lang]}</p>;
        return <p key={i}>{text(b[lang])}</p>;
      })}
    </article>
  );
}

/** A link to /privacy whose normal click opens the notice in a pop-up instead. */
export function PrivacyLink({ children, className }: { children: ReactNode; className?: string }) {
  const { lang } = useHomeLang();
  const [open, setOpen] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);
  const link = useRef<HTMLAnchorElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const x = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      if (body.current) body.current.scrollTop = 0;
      x.current?.focus();
      const prev = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
      return () => { document.documentElement.style.overflow = prev; };
    }
    if (!open && d.open) d.close();
  }, [open]);
  const close = () => setOpen(false);
  const th = lang === "th";
  return (
    <>
      <a ref={link} href="/privacy" className={className}
        onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); setOpen(true); }}>{children}</a>
      <dialog ref={dlg} className="pv-dialog" aria-label={th ? "ประกาศความเป็นส่วนตัว" : "Privacy notice"}
        onClose={() => { setOpen(false); link.current?.focus(); }}
        onClick={(e) => { if (e.target === dlg.current) close(); }}>
        {open && <div className="pv-frame">
          <div className="pv-bar">
            <a href="/privacy" target="_blank" rel="noopener">{th ? "เปิดเป็นหน้าเต็ม" : "Open as a full page"}</a>
            <button ref={x} type="button" className="pv-x" aria-label={th ? "ปิด" : "Close"} onClick={close}><X size={18} /></button>
          </div>
          <div ref={body} className="pv-body"><PrivacyDoc /></div>
          <div className="pv-foot"><button type="button" onClick={close}>{th ? "ปิด" : "Close"}</button></div>
        </div>}
      </dialog>
    </>
  );
}
