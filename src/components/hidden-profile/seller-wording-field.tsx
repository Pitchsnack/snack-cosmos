import { useEffect, useRef } from 'react';
import { sellerWordingCount, sellerWordingError, singleLineSellerWording, type SellerWordingKind } from '@/lib/seller-listing-wording';
import { useTr } from '@/components/common/edit-info-popup';

export function SellerWordingCount({ value, kind, language }: { value: string; kind: SellerWordingKind; language: string }) {
  const L = useTr(); const c = sellerWordingCount(value, kind, language);
  return <span className={c.over ? 'seller-wording-count is-over' : 'seller-wording-count'}>{c.count} / {c.limit} {c.characters ? L('characters', 'ตัวอักษร') : L('words', 'คำ')}</span>;
}
export function SellerWordingMessage({ value, kind, language }: { value: string; kind: SellerWordingKind; language: string }) {
  const L = useTr(); const en = sellerWordingError(value, kind); const th = sellerWordingError(value, kind, 'th');
  return en ? <p className="seller-wording-error" role="alert">{L(en, th ?? en)}</p> : null;
}
export function SellerWordingInput({ id, value, onChange, kind, language, placeholder }: { id: string; value: string; onChange: (value: string) => void; kind: SellerWordingKind; language: string; placeholder: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const measure = () => {
      // A detached-value twin measures wrapping without changing the controlled input.
      const twin = el.cloneNode(false) as HTMLTextAreaElement;
      twin.removeAttribute('id'); twin.setAttribute('aria-hidden', 'true'); twin.tabIndex = -1;
      twin.style.position = 'absolute'; twin.style.visibility = 'hidden'; twin.style.pointerEvents = 'none';
      twin.style.width = `${el.getBoundingClientRect().width}px`; twin.style.height = 'auto';
      twin.value = value || placeholder;
      el.parentElement?.appendChild(twin);
      const height = twin.scrollHeight; twin.remove();
      el.style.height = `${height}px`;
    };
    measure(); window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [value, placeholder]);
  const over = sellerWordingCount(value, kind, language).over;
  return <textarea ref={ref} id={id} lang={language} value={value} rows={1} autoComplete="off" placeholder={placeholder} aria-invalid={over} className={`seller-wording-input ${kind === 'headline' ? 'is-headline' : ''} ${over ? 'is-over' : ''}`} onChange={e => onChange(singleLineSellerWording(e.target.value))} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} />;
}