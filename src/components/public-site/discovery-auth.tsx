import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, FileText, Lock, Send, Share2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { readDiscoveryPending, writeDiscoveryPending, type DiscoveryPending } from '@/lib/discovery';
import { DC } from './discovery-copy';
import { toast } from 'sonner';
import '@/styles/public-discovery.css';

export function useDiscoveryPending() {
 const [pending,setPending]=useState<DiscoveryPending|null>(null);
 useEffect(()=>{ const update=()=>setPending(readDiscoveryPending()); update(); window.addEventListener('ps-discovery-pending',update); return()=>window.removeEventListener('ps-discovery-pending',update); },[]);
 return pending;
}
export function DiscoveryWaiting({ lang, signup, role }: {lang:'en'|'th';signup?:boolean;role?:string|null}) {
 const p=useDiscoveryPending(); if(!p)return null; const t=(c:{en:string;th:string})=>c[lang]; const th=lang==='th';
 const Icon=p.action==='apply'?Send:p.action==='nda'?FileText:Share2;
 const title=p.action==='apply'?DC.waitApply:p.action==='nda'?DC.waitNda:DC.waitShare;
 const text=p.action==='share' ? (th?`ท่านกำลังแชร์ ${p.name} · ${p.ref} ให้ ${p.email} คำเชิญจะส่งออกทันทีที่ท่านเข้าสู่ระบบ`:`You’re sharing ${p.name} · ${p.ref} with ${p.email}. It goes out as soon as you’re in.`) : (th?`${p.name} · ${p.ref} จะเปิดขึ้นทันทีที่ท่านเข้าสู่ระบบเพื่อให้ท่าน${p.action==='apply'?'สมัครได้':'ลงนาม NDA ได้'}`:`${p.name} · ${p.ref} opens as soon as you’re in, so you can ${p.action==='apply'?'apply':'sign the NDA'}.`);
 return <><div className="discovery-wait"><Icon size={18}/><div><b>{t(title)}</b><p>{text}</p>{signup&&p.action!=='share'&&<p>{th?(p.action==='apply'?'หากต้องการสมัคร กรุณาลงทะเบียนในฐานะเจ้าของกิจการ':'หากต้องการขอ NDA กรุณาลงทะเบียนเป็นผู้ซื้อ'):(p.action==='apply'?'To apply, sign up as a business owner.':'To request an NDA, sign up as a buyer.')}</p>}</div></div>{signup&&role&&((p.action==='apply'&&role!=='seller')||(p.action==='nda'&&role!=='buyer'))&&<p className="discovery-role-note">{p.action==='apply'?t(DC.onlySeller):t(DC.onlyBuyer)}</p>}</>;
}
export function DiscoveryBack({lang}:{lang:'en'|'th'}) {
 const p=useDiscoveryPending(); const nav=useNavigate(); if(!p)return null;
 return <Button variant="unstyled" className="lg-back" onClick={()=>{writeDiscoveryPending(null);toast(p.action==='share'?(lang==='th'?'ยังไม่ได้ส่ง กรุณาเข้าสู่ระบบเพื่อแชร์ประกาศ':'Not sent. Log in to share.'):p.action==='apply'?(lang==='th'?'กรุณาเข้าสู่ระบบเพื่อสมัครประกาศรับซื้อ':'Log in to apply to a buy order.'):(lang==='th'?'กรุณาเข้าสู่ระบบเพื่อขอ NDA':'Log in to request an NDA.'));nav({to:'/discovery',hash:p.ref.toLowerCase()});}}><ArrowLeft size={17}/>{DC.back[lang]}</Button>;
}
export function DiscoveryLoginPrompt({lang}:{lang:'en'|'th'}) {
 const p=useDiscoveryPending(); const [open,setOpen]=useState(false); const nav=useNavigate();
 useEffect(()=>{if(p&&sessionStorage.getItem('ps-discovery-prompt')==='1'){sessionStorage.removeItem('ps-discovery-prompt');setOpen(true);}},[p]);
 if(!p||!open)return null; const t=(c:{en:string;th:string})=>c[lang];
 return <Dialog open onOpenChange={setOpen}><DialogContent className="discovery-login-dialog"><div className="discovery-prompt-lock"><Lock size={20}/></div><DialogTitle>{t(p.action==='apply'?DC.loginApply:p.action==='nda'?DC.loginNda:DC.loginShare)}</DialogTitle><DialogDescription>{p.action==='share'?(lang==='th'?`หากต้องการส่ง${p.tab==='sale'?'ประกาศนี้':'คำขอของผู้ซื้อนี้'}ให้ ${p.email} กรุณาเข้าสู่ระบบ PitchSnack หรือสร้างบัญชีฟรี ระบบจะเก็บคำเชิญไว้และส่งทันทีที่ท่านเข้าสู่ระบบ`:`To send this ${p.tab==='sale'?'listing':'buyer request'} to ${p.email}, log in to PitchSnack or create a free account. Your invitation is kept and goes out as soon as you’re in.`):t(p.action==='apply'?DC.applyText:DC.ndaText)}</DialogDescription><div className="discovery-pending-item"><b>{p.name} · {p.ref}</b><p>{p.action==='share'?`${lang==='th'?'ถึง':'To'}: ${p.email}`:p.meta}</p></div><div className="discovery-auth-actions"><Button variant="outline" onClick={()=>{setOpen(false);nav({to:'/login',search:{redirect:'/discovery'}});}}>{t(DC.login)}</Button><Button onClick={()=>setOpen(false)}>{t(DC.create)}</Button></div></DialogContent></Dialog>;
}