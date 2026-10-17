import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invitationInfo, acceptAsNewAccount, acceptInvitation } from "@/lib/profile-handover.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { HandoverKind } from "@/lib/handover-parts";
import logoAsset from "@/assets/pitchsnack-logo.png.asset.json";
const logo = (logoAsset as { url: string }).url;

export const Route = createFileRoute("/handover/$token")({
  head: () => ({
    meta: [
      { title: "Accept your profile invitation — PitchSnack" },
      { name: "description", content: "Accept the PitchSnack profile prepared for you, check it and send it for approval." },
      { property: "og:title", content: "Accept your profile invitation — PitchSnack" },
      { property: "og:description", content: "Accept the PitchSnack profile prepared for you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HandoverAccept,
});

type L = "en" | "th";
const WORD: Record<HandoverKind, Record<L, string>> = {
  startup: { en: "business profile", th: "โปรไฟล์ธุรกิจ" },
  investor: { en: "investor profile", th: "โปรไฟล์นักลงทุน" },
  firm: { en: "advisor firm profile", th: "โปรไฟล์บริษัทที่ปรึกษา" },
};
const T = {
  title: { en: (w: string) => `Your ${w} is ready`, th: (w: string) => `${w}ของคุณพร้อมแล้ว` },
  lead: { en: (by: string) => `${by} prepared it for you. Accept to take it over, check each part and send it for approval.`, th: (by: string) => `${by} เตรียมไว้ให้คุณแล้ว กดยอมรับเพื่อรับเป็นเจ้าของ ตรวจทุกส่วน แล้วส่งให้อนุมัติ` },
  email: { en: "Invited email", th: "อีเมลที่ได้รับเชิญ" },
  expires: { en: "Link valid until", th: "ลิงก์ใช้ได้ถึง" },
  first: { en: "First name", th: "ชื่อ" }, last: { en: "Last name", th: "นามสกุล" },
  pw: { en: "Password (8+ characters)", th: "รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)" },
  news: { en: "Send me PitchSnack news", th: "ส่งข่าวสารจาก PitchSnack ให้ฉัน" },
  terms: { en: "By accepting you agree to the Terms and Privacy policy.", th: "เมื่อยอมรับ คุณตกลงตามข้อกำหนดและนโยบายความเป็นส่วนตัว" },
  create: { en: "Create account and accept", th: "สร้างบัญชีและยอมรับ" },
  signin: { en: "Sign in to accept", th: "เข้าสู่ระบบเพื่อยอมรับ" },
  hasAcc: { en: "This email already has a PitchSnack account.", th: "อีเมลนี้มีบัญชี PitchSnack แล้ว" },
  accept: { en: "Accept profile", th: "ยอมรับโปรไฟล์" },
  wrong: { en: (e: string) => `You're signed in with another email. Sign out and use ${e}.`, th: (e: string) => `คุณเข้าสู่ระบบด้วยอีเมลอื่น กรุณาออกจากระบบแล้วใช้ ${e}` },
  signout: { en: "Sign out", th: "ออกจากระบบ" },
  invalid: { en: "This link doesn't work.", th: "ลิงก์นี้ใช้ไม่ได้" },
  invalidB: { en: "It may have been replaced by a newer invitation. Ask the person who invited you.", th: "อาจมีคำเชิญใหม่แทนแล้ว กรุณาติดต่อผู้ที่เชิญคุณ" },
  used: { en: "This invitation was already accepted.", th: "คำเชิญนี้ถูกยอมรับแล้ว" },
  usedB: { en: "Sign in to see your profile in My Company.", th: "เข้าสู่ระบบเพื่อดูโปรไฟล์ใน My Company" },
  expired: { en: "This invitation has expired.", th: "คำเชิญนี้หมดอายุแล้ว" },
  expiredB: { en: "Ask for a new one at support@pitchsnack.com.", th: "ขอคำเชิญใหม่ได้ที่ support@pitchsnack.com" },
  login: { en: "Sign in", th: "เข้าสู่ระบบ" },
  done: { en: "Done — the profile is yours.", th: "เรียบร้อย โปรไฟล์นี้เป็นของคุณแล้ว" },
};

function HandoverAccept() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const info = useServerFn(invitationInfo);
  const createAcc = useServerFn(acceptAsNewAccount);
  const accept = useServerFn(acceptInvitation);
  const valid = /^[a-f0-9]{48}$/.test(token);
  const q = useQuery({ queryKey: ["handover-invite", token], queryFn: () => info({ data: { token } }), enabled: valid, retry: false });
  const [lang, setLang] = useState<L>("en");
  const [me, setMe] = useState<string | null | undefined>(undefined);
  const [f, setF] = useState({ first: "", last: "", pw: "", news: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMe(data.user?.email ?? null)); }, []);
  const d = q.data;
  useEffect(() => {
    if (d && "language" in d && d.language) setLang(d.language);
    if (d?.state === "open") setF((x) => ({ ...x, first: x.first || d.firstName || "", last: x.last || d.lastName || "" }));
  }, [d]);

  const goHome = async () => { await qc.invalidateQueries(); toast.success(T.done[lang]); navigate({ to: "/marketplace/my-company" }); };

  const doCreate = async (e: React.FormEvent) => {
    e.preventDefault(); if (d?.state !== "open") return;
    setBusy(true);
    try {
      const r = await createAcc({ data: { token, password: f.pw, firstName: f.first, lastName: f.last, news: f.news } });
      const { error } = await supabase.auth.signInWithPassword({ email: r.email, password: f.pw });
      if (error) throw error;
      await goHome();
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };
  const doAccept = async () => {
    setBusy(true);
    try { await accept({ data: { token } }); await goHome(); }
    catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };

  const shell = (body: React.ReactNode) => (
    <main className="grid min-h-screen place-items-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <img src={logo} alt="PitchSnack" className="h-5 w-auto" />
          <div className="flex rounded-md border text-xs">
            {(["en", "th"] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
                className={`px-2.5 py-1 font-semibold ${lang === l ? "bg-foreground text-background" : "text-muted-foreground"}`}>{l === "en" ? "EN" : "ไทย"}</button>
            ))}
          </div>
        </div>
        {body}
      </div>
    </main>
  );
  const notice = (h: string, b: string, cta = true) => shell(<>
    <h1 className="text-xl font-semibold">{h}</h1><p className="mt-2 text-sm text-muted-foreground">{b}</p>
    {cta && <Button asChild className="mt-6 w-full"><Link to="/login">{T.login[lang]}</Link></Button>}
  </>);

  if (!valid || q.error || d?.state === "invalid") return notice(T.invalid[lang], T.invalidB[lang], false);
  if (!d || me === undefined) return shell(<p className="text-sm text-muted-foreground">…</p>);
  if (d.state === "used") return notice(T.used[lang], T.usedB[lang]);
  if (d.state === "expired") return notice(T.expired[lang], T.expiredB[lang], false);

  const w = WORD[d.kind][lang];
  const dt = new Date(d.expires).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
  const head = <>
    <h1 className="text-2xl font-semibold tracking-tight">{T.title[lang](w)}</h1>
    <p className="mt-2 text-sm text-muted-foreground">{T.lead[lang](d.sentBy)}</p>
    <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg bg-muted/60 p-3 text-sm">
      <dt className="text-muted-foreground">{T.email[lang]}</dt><dd className="break-all font-medium">{d.email}</dd>
      <dt className="text-muted-foreground">{T.expires[lang]}</dt><dd className="font-medium">{dt}</dd>
    </dl>
  </>;

  if (me) {
    const same = me.toLowerCase() === d.email.toLowerCase();
    return shell(<>{head}
      {same ? <Button className="mt-6 w-full" disabled={busy} onClick={doAccept}>{T.accept[lang]}</Button>
        : <><p className="mt-5 text-sm text-destructive">{T.wrong[lang](d.email)}</p>
          <Button variant="outline" className="mt-3 w-full" onClick={async () => { await supabase.auth.signOut(); setMe(null); }}>{T.signout[lang]}</Button></>}
    </>);
  }
  if (d.hasAccount) return shell(<>{head}
    <p className="mt-5 text-sm">{T.hasAcc[lang]}</p>
    <Button asChild className="mt-3 w-full"><Link to="/login" search={{ redirect: `/handover/${token}`, email: d.email }}>{T.signin[lang]}</Link></Button>
  </>);

  return shell(<>{head}
    <form onSubmit={doCreate} className="mt-6 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="hf">{T.first[lang]}</Label><Input id="hf" required value={f.first} onChange={(e) => setF({ ...f, first: e.target.value })} /></div>
        <div><Label htmlFor="hl">{T.last[lang]}</Label><Input id="hl" required value={f.last} onChange={(e) => setF({ ...f, last: e.target.value })} /></div>
      </div>
      <div><Label htmlFor="hp">{T.pw[lang]}</Label><Input id="hp" type="password" minLength={8} required autoComplete="new-password" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.news} onChange={(e) => setF({ ...f, news: e.target.checked })} />{T.news[lang]}</label>
      <p className="text-xs text-muted-foreground">{T.terms[lang]}</p>
      <Button type="submit" className="w-full" disabled={busy}>{T.create[lang]}</Button>
    </form>
  </>);
}
