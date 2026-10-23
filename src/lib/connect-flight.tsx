import { createRoot } from 'react-dom/client';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createConnectFlightGuard } from './connect-flight-state';

const claim = createConnectFlightGuard();
type Options = {
  invitationId: string; investorRef: string;
  fallback: { x: number; y: number };
  text: { invitations: string; sent: string; view: string };
  view: () => void;
  toast: (message: string, view: () => void) => void;
};
const visible = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
};
const target = (key: string) => Array.from(document.querySelectorAll<HTMLElement>(`[data-flight-target="${key}"]`)).find(visible);
const centre = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

function flight(o: Options, cover: HTMLElement | undefined, from: Options['fallback'], to: Options['fallback']) {
  const layer = document.createElement('div');
  layer.className = 'connect-flight-layer'; layer.setAttribute('aria-hidden', 'true');
  const card = document.createElement('div'); card.className = 'connect-flight-card';
  const thumb = document.createElement('div'); thumb.className = 'connect-flight-thumb';
  if (cover) {
    const clone = cover.cloneNode(true) as HTMLElement;
    clone.removeAttribute('data-connect-cover'); clone.className += ' connect-flight-clone';
    clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    thumb.appendChild(clone);
  }
  const icon = document.createElement('span'); icon.className = 'connect-flight-icon';
  const iconRoot = createRoot(icon); iconRoot.render(<Send size={18}/>); thumb.appendChild(icon);
  const body = document.createElement('div'); body.className = 'connect-flight-body';
  const name = document.createElement('b'); name.textContent = `${cover?.dataset.connectType || o.investorRef} · ${o.investorRef}`;
  const pill = document.createElement('span'); pill.className = 'connect-flight-chip'; pill.textContent = o.text.sent;
  body.append(name, pill); card.append(thumb, body); layer.appendChild(card); document.body.appendChild(layer);
  const transform = (x: number, y: number, scale: number) => `translate(${x - 112}px, ${y - 29}px) scale(${scale})`;
  card.style.opacity = '0';
  card.animate([{ transform: transform(from.x, from.y + 6, .9), opacity: 0 }, { transform: transform(from.x, from.y, 1.04), opacity: 1 }], { duration: 160, delay: 180, fill: 'forwards', easing: 'ease-out' });
  const cx = (from.x + to.x) / 2, cy = Math.min(from.y, to.y) - 140;
  const frames: Keyframe[] = Array.from({ length: 25 }, (_, i) => {
    const t = i / 24, u = 1 - t;
    return { offset: t, transform: transform(u*u*from.x + 2*u*t*cx + t*t*to.x, u*u*from.y + 2*u*t*cy + t*t*to.y, 1.04 - .84*t), opacity: t <= .85 ? 1 : (1-t)/.15 };
  });
  card.animate(frames, { duration: 720, delay: 340, fill: 'forwards', easing: 'ease-in-out' }).onfinish = () => { iconRoot.unmount(); layer.remove(); };
}

function tooltip(o: Options, item: HTMLElement, rail: boolean) {
  const holder = item.closest<HTMLElement>('.pipeline-flyout, #app-sidebar-nav, aside, nav') ?? item;
  const r = item.getBoundingClientRect(), h = holder.getBoundingClientRect();
  const tip = document.createElement('div'); tip.className = 'connect-flight-tip'; tip.setAttribute('role', 'status');
  tip.style.left = `${h.right + 12}px`; tip.style.top = `${r.top}px`; tip.style.minHeight = `${Math.max(r.height, 34)}px`;
  document.body.appendChild(tip);
  const root = createRoot(tip); let timer = 0, gone = false;
  const hide = () => {
    if (gone) return; gone = true; clearTimeout(timer); tip.classList.remove('is-in');
    setTimeout(() => { root.unmount(); tip.remove(); if (rail) window.dispatchEvent(new CustomEvent('ps-flight-pipeline', { detail: 'close' })); }, 200);
    window.removeEventListener('resize', hide);
  };
  const arm = () => { clearTimeout(timer); timer = window.setTimeout(hide, 4000); };
  tip.addEventListener('pointerenter', () => clearTimeout(timer));
  tip.addEventListener('pointerleave', arm);
  tip.addEventListener('focusin', () => clearTimeout(timer));
  tip.addEventListener('focusout', () => { if (!tip.matches(':hover')) arm(); });
  window.addEventListener('resize', hide);
  root.render(<><Send size={15}/><span><b>{o.text.invitations}</b><span className="connect-flight-sub"> · {o.text.sent}</span></span><Button variant="ghost" className="connect-flight-view" onClick={() => { hide(); o.view(); }}>{o.text.view}</Button></>);
  requestAnimationFrame(() => tip.classList.add('is-in')); arm();
}

/** After successful What's next dismissal only; no writes or count changes. */
export function playConnectFlight(o: Options) {
  if (!claim(o.invitationId)) return;
  const covers = Array.from(document.querySelectorAll<HTMLElement>('[data-connect-cover]')).filter(el => el.dataset.connectCover === o.investorRef && visible(el) && !el.closest('[role="dialog"]'));
  const cover = covers[0], from = cover ? centre(cover) : o.fallback;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const menu = target('menu-button');
  if (menu) {
    if (!reduced) flight(o, cover, from, centre(menu));
    setTimeout(() => { menu.classList.add('connect-flight-dot'); setTimeout(() => menu.classList.remove('connect-flight-dot'), 3000); o.toast(`${o.text.invitations} · ${o.text.sent}`, o.view); }, reduced ? 180 : 1060);
    return;
  }
  window.dispatchEvent(new CustomEvent('ps-flight-pipeline', { detail: 'open' }));
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const item = target('invitations');
    if (!item) { o.toast(`${o.text.invitations} · ${o.text.sent}`, o.view); return; }
    item.scrollIntoView({ block: 'nearest' });
    const label = item.querySelector<HTMLElement>('span') ?? item;
    const rail = !!item.closest('.pipeline-flyout');
    if (!reduced) flight(o, cover, from, centre(label));
    setTimeout(() => {
      if (!item.isConnected || !visible(item)) return;
      item.classList.add('connect-flight-hit'); setTimeout(() => item.classList.remove('connect-flight-hit'), 1600);
      tooltip(o, item, rail);
    }, reduced ? 180 : 1060);
  }));
}