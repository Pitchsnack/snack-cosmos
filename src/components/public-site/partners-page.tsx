import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PublicPlanCards } from "@/components/plans/plan-card";
import { useNavigate } from "@tanstack/react-router";
import { PublicShell, useHomeLang } from "./public-shell";
import bodyHtml from "./partners-body.html?raw";
import pageCss from "./partners.css?raw";

/**
 * Public For partners page. Its sections are drawn in their own shadow root so
 * the page's styles never touch the homepage, For buyers or For sellers parts;
 * the shared top bar, language and footer come from PublicShell.
 */
export function PartnersPage() {
  return (
    <PublicShell current="partners" talkHref="#start">
      <PartnersBody />
    </PublicShell>
  );
}

function PartnersBody() {
  const host = useRef<HTMLDivElement>(null);
  const [plansHost, setPlansHost] = useState<Element | null>(null);
  const { lang } = useHomeLang();
  const navigate = useNavigate();

  useEffect(() => {
    const el = host.current;
    if (!el || el.shadowRoot) return;
    const root = el.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${pageCss}</style>${bodyHtml}`;
    const grid = root.querySelector("#plans .pb-grid");
    if (grid) {
      grid.querySelectorAll("article.pb-plan").forEach(p => p.remove());
      const mount = document.createElement("div");
      mount.style.display = "contents";
      grid.prepend(mount);
      setPlansHost(mount);
    }

    // Links: in-page anchors scroll inside the page, site links use the router.
    root.addEventListener("click", (e) => {
      const a = (e.target as HTMLElement).closest("a");
      const href = a?.getAttribute("href");
      if (!a || !href) return;
      if (href.startsWith("#")) {
        const t = root.getElementById(href.slice(1));
        if (t) { e.preventDefault(); t.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }
      } else if (href.startsWith("/") && !(e as MouseEvent).metaKey && !(e as MouseEvent).ctrlKey) {
        e.preventDefault();
        const [path, search] = href.split("?");
        navigate({ to: path ?? "/", search: search ? Object.fromEntries(new URLSearchParams(search)) : undefined } as never);
      }
    });

    // Hero picture switcher: dots show one picture each, the caption follows.
    const art = root.getElementById("ptart");
    if (art) {
      const pics = art.querySelectorAll(".pt-pic"), dots = art.querySelectorAll(".pt-dot"), caps = art.querySelectorAll(".pt-cap > span");
      const show = (n: number) => pics.forEach((p, i) => {
        const on = i === n;
        p.classList.toggle("on", on);
        if (on) p.removeAttribute("inert"); else p.setAttribute("inert", "");
        dots[i]?.setAttribute("aria-pressed", on ? "true" : "false");
        caps[i]?.classList.toggle("cur", on);
      });
      dots.forEach((d, n) => d.addEventListener("click", () => show(n)));
    }
    // Four promises: pointing at a promise or its badge lights both.
    const b = root.getElementById("ch-b");
    if (b) {
      const rows = b.querySelectorAll(".chb-row"), badges = b.querySelectorAll(".chb-b");
      const light = (k: number) => { rows.forEach((r, j) => r.classList.toggle("is-on", j === k)); badges.forEach((r, j) => r.classList.toggle("is-on", j === k)); };
      [rows, badges].forEach((list) => list.forEach((x, n) => { x.addEventListener("mouseenter", () => light(n)); x.addEventListener("mouseleave", () => light(-1)); }));
    }
    // Sample firm card: Show more / Show less.
    const card = root.getElementById("adc"), tog = card?.querySelector(".adc-tog");
    tog?.addEventListener("click", () => { const on = card?.classList.toggle("open"); tog.setAttribute("aria-expanded", on ? "true" : "false"); });

    // Top bar "Start a conversation" (#start) lives outside the shadow root.
    const onDocClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.('a[href="#start"]');
      if (a) { e.preventDefault(); root.getElementById("start")?.scrollIntoView({ behavior: "smooth" }); }
    };
    document.addEventListener("click", onDocClick);
    if (location.hash) root.getElementById(location.hash.slice(1))?.scrollIntoView();
    return () => document.removeEventListener("click", onDocClick);
  }, [navigate]);

  // Language: the shell's setting shows the matching text.
  useEffect(() => {
    const root = host.current?.shadowRoot;
    if (!root) return;
    host.current?.setAttribute("lang", lang);
    root.querySelectorAll("[data-lang]").forEach((n) => n.classList.toggle("on", n.getAttribute("data-lang") === lang));
    root.querySelectorAll("[data-label-th]").forEach((n) => n.setAttribute("aria-label", n.getAttribute(`data-label-${lang}`) ?? ""));
  }, [lang]);

  return <div ref={host} id="partners-page">{plansHost && createPortal(<PublicPlanCards role="advisor" />, plansHost)}</div>;
}
