/** After Done on "The seller has received your NDA request": mini cards fly into the menu. Browser-only, DOM-driven. */
export type FlightOptions = {
  listingId: string;
  name: string;
  /** Invitation the server linked the request to; card 2 flies only when set. */
  invitationId: string | null;
  /** Request sent from My watchlist itself: no card 1. */
  fromWatchlist?: boolean;
  alreadySaved?: boolean;
  /** Centre of where the pop-up was, captured before it closed. */
  fallback: { x: number; y: number };
  text: { added: string; inList: string; inv: string; waiting: string; view: string; toast: string; toastBoth: string; requested: string };
  go: (to: { to: string; search?: Record<string, string> }) => void;
  toast: (msg: string, view: () => void) => void;
};

const played = new Set<string>();
const STAR = '<svg viewBox="0 0 24 24" width="18" height="18" fill="#F59E0B" stroke="#D97706" stroke-width="1.5" stroke-linejoin="round"><path d="M12 2.5l2.95 6 6.55.95-4.75 4.6 1.12 6.5L12 17.5l-5.87 3.05 1.12-6.5L2.5 9.45l6.55-.95z"/></svg>';
const SEND = (c: string, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const visible = (el: Element | null): el is HTMLElement => {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
};
const centre = (el: Element) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
const target = (key: string) => Array.from(document.querySelectorAll<HTMLElement>(`[data-flight-target="${key}"]`)).find(visible) ?? null;

function sourceCover(listingId: string) {
  const src = Array.from(document.querySelectorAll<HTMLElement>(`[data-flight-src="${listingId}"]`)).find(visible);
  if (!src) return null;
  const cover = Array.from(src.querySelectorAll<HTMLElement>(".overflow-hidden, img")).find((e) => e.getBoundingClientRect().height >= 40) ?? src;
  return visible(cover) ? cover : src;
}

function layer() {
  let l = document.getElementById("nda-flight-layer");
  if (!l) { l = document.createElement("div"); l.id = "nda-flight-layer"; l.setAttribute("aria-hidden", "true"); document.body.appendChild(l); }
  return l;
}

function miniCard(o: FlightOptions, kind: 1 | 2, cover: HTMLElement | null) {
  const c = document.createElement("div");
  c.className = "nda-flight-card";
  c.style.zIndex = kind === 1 ? "2" : "1";
  const thumb = document.createElement("div");
  thumb.className = "nda-flight-thumb";
  const img = cover?.tagName === "IMG" ? cover as HTMLImageElement : cover?.querySelector("img");
  if (img?.src) thumb.style.backgroundImage = `url("${img.src}")`;
  else if (cover) { const clone = cover.cloneNode(true) as HTMLElement; clone.removeAttribute("data-flight-src"); clone.className += " nda-flight-clone"; thumb.appendChild(clone); }
  const icon = document.createElement("span"); icon.className = "nda-flight-icon"; icon.innerHTML = kind === 1 ? STAR : SEND("#fff");
  thumb.appendChild(icon);
  const body = document.createElement("div"); body.className = "nda-flight-body";
  body.innerHTML = `<b>${esc(o.name)}</b><span class="nda-flight-chip" data-kind="${kind}">${esc(kind === 1 ? o.text.requested : o.text.waiting)}</span>`;
  c.append(thumb, body);
  return c;
}

/** Quadratic Bézier from a to b; control halfway across, `lift` px above the higher end. */
function curve(a: { x: number; y: number }, b: { x: number; y: number }, lift: number) {
  const cx = (a.x + b.x) / 2, cy = Math.min(a.y, b.y) - lift;
  return (t: number) => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * cx + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * cy + t * t * b.y });
}

function fly(card: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }, lift: number, offset: { x: number; y: number }, startScale: number, delayIn: number, delayFly: number) {
  const W = 224, H = 58;
  card.style.left = `${-W / 2}px`; card.style.top = `${-H / 2}px`;
  const start = { x: from.x + offset.x, y: from.y + offset.y };
  const tf = (p: { x: number; y: number }, s: number) => `translate(${p.x}px, ${p.y}px) scale(${s})`;
  card.style.opacity = "0"; card.style.transform = tf(start, .9);
  card.animate([{ transform: tf({ x: start.x, y: start.y + 6 }, .9), opacity: 0 }, { transform: tf(start, startScale), opacity: 1 }], { duration: 160, delay: delayIn, fill: "forwards", easing: "ease-out" });
  const path = curve(start, to, lift);
  const frames: Keyframe[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    frames.push({ offset: t, transform: tf(path(t), startScale + (0.2 - startScale) * t), opacity: t <= .85 ? 1 : 1 - (t - .85) / .15 });
  }
  const anim = card.animate(frames, { duration: 720, delay: delayFly, fill: "forwards", easing: "ease-in-out" });
  anim.onfinish = () => card.remove();
}

function hit(el: HTMLElement | null, cls: string) {
  if (!el) return;
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 1600);
}

function plusOne(item: HTMLElement, rail: boolean) {
  const p = document.createElement("span"); p.className = "nda-flight-plus"; p.textContent = "+1"; p.setAttribute("aria-hidden", "true");
  if (rail) p.dataset.rail = "";
  item.appendChild(p); setTimeout(() => p.remove(), 1200);
}

function tooltips(o: FlightOptions, rows: { item: HTMLElement; holder: HTMLElement; kind: 1 | 2 }[], onGone: () => void) {
  const region = document.createElement("div"); region.className = "nda-flight-tips"; region.setAttribute("role", "status");
  let hover = 0, timer = 0;
  const hide = () => { region.classList.remove("is-in"); setTimeout(() => { region.remove(); onGone(); }, 200); };
  const arm = () => { clearTimeout(timer); timer = window.setTimeout(() => { if (!hover) hide(); }, 4000); };
  for (const r of rows) {
    const ir = r.item.getBoundingClientRect(), hr = r.holder.getBoundingClientRect();
    const tip = document.createElement("div"); tip.className = "nda-flight-tip";
    tip.style.left = `${hr.right + 12}px`; tip.style.top = `${ir.top}px`; tip.style.height = `${Math.max(ir.height, 36)}px`;
    tip.innerHTML = r.kind === 1
      ? `<span class="nda-flight-tip-icon">${STAR.replace(/18/g, "15")}</span><span class="nda-flight-tip-text"><b>${esc(o.alreadySaved ? o.text.inList : o.text.added)}</b>.</span>`
      : `<span class="nda-flight-tip-icon">${SEND("#A5B4FC", 15)}</span><span class="nda-flight-tip-text"><b>${esc(o.text.inv)}</b><span>, ${esc(o.text.waiting)}.</span></span>`;
    // Screen readers hear "…. NDA Invitations, Waiting for the seller."; sighted users see the "·" form.
    const sep = tip.querySelector(".nda-flight-tip-text > span"); if (sep) sep.innerHTML = `<span aria-hidden="true"> · </span><span class="sr-only">, </span>${esc(o.text.waiting)}<span class="sr-only">.</span>`;
    tip.querySelectorAll(".nda-flight-tip-text").forEach((t) => t.innerHTML = t.innerHTML.replace(/<\/b>\.<\/span>$/, '</b><span class="sr-only">.</span></span>'));
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "nda-flight-view"; btn.textContent = o.text.view;
    btn.onclick = () => { clearTimeout(timer); hide(); o.go(r.kind === 1 ? { to: "/marketplace/favourites", search: { id: o.listingId } } : { to: "/marketplace/pipeline/invitations", search: { open: o.invitationId! } }); };
    tip.appendChild(btn);
    region.appendChild(tip);
  }
  region.addEventListener("pointerenter", () => { hover++; clearTimeout(timer); });
  region.addEventListener("pointerleave", () => { hover = Math.max(0, hover - 1); arm(); });
  region.addEventListener("focusin", () => { hover++; clearTimeout(timer); });
  region.addEventListener("focusout", () => { hover = Math.max(0, hover - 1); arm(); });
  document.body.appendChild(region);
  requestAnimationFrame(() => region.classList.add("is-in"));
  arm();
}

/** Plays once per request. Call right after the pop-up closes (Done or Esc). */
export function playNdaFlight(o: FlightOptions) {
  const key = `${o.listingId}:${o.invitationId ?? ""}`;
  if (played.has(key)) return; played.add(key);
  const card1 = !o.fromWatchlist, card2 = !!o.invitationId;
  if (!card1 && !card2) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cover = sourceCover(o.listingId);
  const from = cover ? centre(cover) : o.fallback;
  const watch = target("watchlist");

  // Small screens: menu is a drawer; one card to the menu button, a toast instead of tooltips.
  if (!watch) {
    const btn = target("menu-button");
    const msg = card2 ? o.text.toastBoth : o.text.toast;
    const view = () => o.go({ to: "/marketplace/favourites", search: { id: o.listingId } });
    if (btn && !reduced) {
      const c = miniCard(o, 1, cover); layer().appendChild(c);
      fly(c, from, centre(btn), 140, { x: 0, y: -6 }, 1.04, 180, 340);
    }
    setTimeout(() => {
      if (btn) { btn.classList.add("nda-flight-dot"); setTimeout(() => btn.classList.remove("nda-flight-dot"), 3000); }
      o.toast(msg, view);
    }, reduced ? 0 : 1060);
    return;
  }

  const railMode = !!watch.closest("[data-flight-rail]");
  if (card2) window.dispatchEvent(new CustomEvent("ps-flight-pipeline", { detail: "open" }));

  // Positions are read after the sub-menu or flyout has opened.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const inv = card2 ? target("invitations") : null;
    if (inv && !railMode) {
      const scroller = inv.closest<HTMLElement>("[data-flight-scroll]") ?? inv.closest<HTMLElement>("nav");
      if (scroller) {
        const sr = scroller.getBoundingClientRect(), ir = inv.getBoundingClientRect(), wr = watch.getBoundingClientRect();
        if (ir.bottom > sr.bottom) scroller.scrollTop += Math.min(ir.bottom - sr.bottom + 8, Math.max(0, wr.top - sr.top));
      }
    }
    const watchStar = watch.querySelector<HTMLElement>("svg") ?? watch;
    const land1 = () => {
      hit(watch, "nda-flight-hit"); hit(watchStar, "nda-flight-star");
      if (!reduced) plusOne(watch, railMode);
    };
    const land2 = () => { if (inv) hit(inv, "nda-flight-hit-inv"); };
    const showTips = () => {
      const rows: { item: HTMLElement; holder: HTMLElement; kind: 1 | 2 }[] = [];
      const menu = watch.closest<HTMLElement>("aside, nav") ?? watch;
      if (card1) rows.push({ item: watch, holder: menu, kind: 1 });
      if (inv) rows.push({ item: inv, holder: inv.closest<HTMLElement>(".pipeline-flyout") ?? inv.closest<HTMLElement>("aside, nav") ?? inv, kind: 2 });
      tooltips(o, rows, () => { if (railMode && card2) window.dispatchEvent(new CustomEvent("ps-flight-pipeline", { detail: "close" })); });
    };
    if (reduced) { if (card1) land1(); land2(); showTips(); return; }
    const l = layer();
    if (card1) { const c = miniCard(o, 1, cover); l.appendChild(c); fly(c, from, centre(watchStar), 140, { x: 0, y: -6 }, 1.04, 180, 340); setTimeout(land1, 1060); }
    if (inv) {
      const c = miniCard(o, 2, cover); l.appendChild(c);
      const label = inv.querySelector("span") ?? inv;
      fly(c, from, centre(label), 90, card1 ? { x: 14, y: 6 } : { x: 0, y: -6 }, 1, card1 ? 300 : 180, card1 ? 460 : 340);
      setTimeout(land2, card1 ? 1180 : 1060);
    }
    setTimeout(showTips, inv && card1 ? 1180 : 1060);
  }));
}
