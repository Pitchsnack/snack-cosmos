import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UA = { "user-agent": "Mozilla/5.0 (compatible; PitchsnackLinkCheck/1.0)" };

function privateV4(ip: string) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p as [number, number, number, number];
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
}
function privateV6(ip: string) {
  const s = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (s === "::" || s === "::1") return true;
  const m = s.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (m) return privateV4(m[1]!);
  return /^(fc|fd|fe8|fe9|fea|feb|ff|2001:db8|64:ff9b)/.test(s);
}

/** Resolves the host over DNS-over-HTTPS and refuses private/reserved addresses. */
async function hostIsPublic(host: string): Promise<boolean> {
  const h = host.replace(/^\[|\]$/g, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return !privateV4(h);
  if (h.includes(":")) return !privateV6(h);
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local") || !h.includes(".")) return false;
  const ips: string[] = [];
  for (const type of ["A", "AAAA"]) {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(h)}&type=${type}`, {
      headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(3000),
    });
    const j = (await r.json()) as { Answer?: { type: number; data: string }[] };
    for (const a of j.Answer ?? []) if (a.type === 1 || a.type === 28) ips.push(a.data);
  }
  if (!ips.length) return false;
  return ips.every((ip) => (ip.includes(":") ? !privateV6(ip) : !privateV4(ip)));
}

function decode(s: string) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " } as Record<string, string>)[e]!);
}

async function readTitle(res: Response): Promise<string | null> {
  const reader = res.body?.getReader();
  if (!reader) return null;
  let buf = new Uint8Array(0);
  while (buf.length < 200_000) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    const n = new Uint8Array(buf.length + value.length); n.set(buf); n.set(value, buf.length); buf = n;
    if (/<\/title>/i.test(new TextDecoder().decode(buf))) break;
  }
  void reader.cancel().catch(() => {});
  const m = new TextDecoder().decode(buf.slice(0, 200_000)).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  const t = decode(m[1]!).replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > 80 ? `${t.slice(0, 79)}…` : t;
}

async function tryUrl(start: URL, deadline: number): Promise<{ ok: boolean; title?: string | null }> {
  let url = start;
  for (let hop = 0; hop <= 5; hop++) {
    if (!/^https?:$/.test(url.protocol)) return { ok: false };
    if (url.port && url.port !== "80" && url.port !== "443") return { ok: false };
    if (url.username || url.password) return { ok: false };
    if (!(await hostIsPublic(url.hostname))) return { ok: false };
    const left = deadline - Date.now();
    if (left <= 0) throw new Error("timeout");
    const res = await fetch(url.toString(), { method: "GET", redirect: "manual", headers: UA, signal: AbortSignal.timeout(left) });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      void res.body?.cancel().catch(() => {});
      if (!loc) return { ok: false };
      url = new URL(loc, url);
      continue;
    }
    if (res.status >= 200 && res.status < 300) return { ok: true, title: await readTitle(res).catch(() => null) };
    void res.body?.cancel().catch(() => {});
    return { ok: false };
  }
  return { ok: false };
}

// Best-effort per-user limit: 10 checks a minute (kept in this server instance's memory only).
const hits = new Map<string, number[]>();

/**
 * Check website: answers "working" (with the page title), "not_working", or "unchecked".
 * Signed-in users only; saves nothing.
 */
export const checkWebsiteReachable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ url: z.string().trim().min(1).max(2048) }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: boolean; status: "working" | "not_working" | "unchecked"; title: string | null }> => {
    const now = Date.now();
    const list = (hits.get(context.userId) ?? []).filter((t) => now - t < 60_000);
    if (list.length >= 10) return { ok: false, status: "unchecked", title: null };
    list.push(now); hits.set(context.userId, list);

    const raw = data.url.trim();
    let first: URL;
    try { first = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return { ok: false, status: "not_working", title: null }; }
    const deadline = now + 8000;
    try {
      let r: { ok: boolean; title?: string | null };
      try { r = await tryUrl(first, deadline); }
      catch (e) {
        if ((e as Error).message === "timeout" || first.protocol !== "https:" || /^[a-z]+:\/\//i.test(raw)) throw e;
        const alt = new URL(first.toString()); alt.protocol = "http:";
        r = await tryUrl(alt, deadline);
      }
      return r.ok ? { ok: true, status: "working", title: r.title ?? null } : { ok: false, status: "not_working", title: null };
    } catch (e) {
      const msg = (e as Error)?.name ?? "";
      return /Timeout|Abort/i.test(msg) || (e as Error).message === "timeout"
        ? { ok: false, status: "unchecked", title: null }
        : { ok: false, status: "not_working", title: null };
    }
  });
