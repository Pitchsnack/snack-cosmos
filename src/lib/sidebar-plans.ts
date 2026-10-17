import type { PlanRecord } from './plan-editor';
import { sc, type ShareLang } from '@/i18n/sidebar-share';
export const COMPLETION_FEE_MINIMUM_THB=350000;
export const SHARE_EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function canShare(role:string|null|undefined) { return role==='seller'||role==='buyer'||role==='advisor'; }
export function nextSidebarPlan(plans:PlanRecord[], current:PlanRecord|null) { return [...plans].filter(p=>p.status==='live'&&(!current||(p.role===current.role&&p.sort>current.sort))).sort((a,b)=>a.sort-b.sort)[0]??null; }
export function canRequestPlan(role:string|null, current:PlanRecord|null, plan:PlanRecord) {return canShare(role)&&plan.role===role&&plan.status==='live'&&plan.id!==current?.id;}
export function upgradeLine(p:PlanRecord,lang:ShareLang,current:PlanRecord|null) {
 const th=lang==='th';const n=p.requests_n??'—',cap=p.value_cap_thb_m??'—';
 if(!current) return th?'เปิดดูประกาศขายและขอทำ NDA':'Open listings and request NDAs';
 if(p.role==='seller'&&p.key==='promo')return th?`ส่งคำขอติดต่อได้ และค่าธรรมเนียมลดลงเหลือ ${p.completion_fee_pct??'—'}%`:`Send contact requests, with a lower ${p.completion_fee_pct??'—'}% fee`;
 if(p.role==='seller'&&p.key==='pro')return th?`คำขอติดต่อ ${n} ครั้งต่อปี`:`${n} contact requests a year`;
 if(p.role==='seller'&&p.key==='exec')return th?'ผู้จัดการดูแลเฉพาะ และคำขอไม่จำกัด':'A dedicated manager and unlimited requests';
 if(p.role==='buyer'&&p.key==='investor')return th?`กิจการมูลค่าไม่เกิน ${cap} ล้านบาท และคำขอ NDA ${n} ครั้งต่อปี`:`Businesses up to THB ${cap}m and ${n} NDA requests a year`;
 if(p.role==='buyer'&&['inst','institutional'].includes(p.key))return th?'กิจการทุกขนาด และคำขอไม่จำกัด':'Businesses of any size and unlimited requests';
 if(p.role==='advisor'&&p.key==='pro')return th?`กิจการทุกขนาด และดูแลลูกค้าได้สูงสุด ${p.clients_n??'—'} ราย`:`Businesses of any size and up to ${p.clients_n??'—'} clients`;
 return p.card_text?.[lang]?.intent??'';
}
export function sidebarPlanFeatures(p:PlanRecord,lang:ShareLang):{text:string;on:boolean}[] {
 const th=lang==='th',cap=p.value_cap_thb_m??'—',n=p.requests_n??'—', fee=p.completion_fee_pct==null?'—':Number(p.completion_fee_pct).toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:4});
 const unit=(v:number|null|undefined,en:string)=>`${v??'—'} ${en}${v===1?'':'s'}`;
 const val=(under=false,list=false)=>th?`${list?'ลงขาย':''}กิจการมูลค่า${under?'ต่ำกว่า':'ไม่เกิน'} ${cap} ล้านบาท`:`${list?'List a business':'Businesses'} ${under?'under':'up to'} THB ${cap}m`;
 const any=th?'กิจการทุกมูลค่า':p.role==='seller'?'Any business value':'Businesses of any value';
 const feeText=th?`ค่าธรรมเนียมเมื่อปิดดีล ${fee}%`:`Completion fee ${fee}%`;
 const requests=th?`คำขอติดต่อ ${n} ครั้ง${p.term_months===12?'ต่อปี':'ต่อรอบ'}`:`${n} contact requests ${p.term_months===12?'a year':'a term'}`;
 const verification=th?'รวมการตรวจสอบบริษัท':'Company verification included';const room=th?'Teaser และ Data room':'Teaser and data room';
 let rows:(string|{text:string;on:boolean})[]=[];
 if(p.role==='seller') {
 if(p.key==='entry')rows=[val(true,true),feeText,th?'รับคำขอติดต่อ':'Receive contact requests',{text:th?'ส่งคำขอติดต่อ':'Send contact requests',on:false},th?`ตรวจสอบบริษัท ${Number(p.verification_price_thb??0).toLocaleString('en-US')} บาท`:`Company verification ${Number(p.verification_price_thb??0).toLocaleString('en-US')} THB`];
 else if(['promo','pro'].includes(p.key))rows=[val(false,true),feeText,requests,room,verification];
 else if(p.key==='exec')rows=[any,feeText,th?'คำขอติดต่อไม่จำกัด':'Unlimited contact requests',th?'ผู้จัดการดูแลเฉพาะ':'Dedicated manager',th?'วิดีโอประเมินมูลค่าและการเยี่ยมชมกิจการ':'Valuation video and site visit'];
 } else if(p.role==='buyer') {
 const seats=th?`${p.mandates_n??'—'} mandate · ผู้ใช้ ${p.users_n??'—'} คน`:`${unit(p.mandates_n,'mandate')} · ${unit(p.users_n,'user')}`;
 if(p.key==='basic')rows=[val(true),th?'ค้นหาแบบ Verified':'Verified search',th?'ซื้อคำขอ NDA เป็นแพ็กเกจ':'NDA requests bought in bundles',seats];
 else if(p.key==='investor')rows=[val(),th?`คำขอ NDA ${n} ครั้งต่อปี`:`${n} NDA requests a year`,th?'รายชื่อกิจการที่ตรงความต้องการ':'Matched shortlists',th?'รายงานคัดกรองและรายงานบริษัท':'Screening and company reports',seats];
 else if(['inst','institutional'].includes(p.key))rows=[any,th?'คำขอ NDA ไม่จำกัด':'Unlimited NDA requests',th?'หลาย mandate':'Several mandates',th?'ผู้ใช้หลายคน':'Several users',th?'รายงานตามที่ตกลง':'Reports as agreed'];
 } else if(p.role==='advisor'&&['basic','pro'].includes(p.key))rows=[p.key==='basic'?val(true):any,requests,th?`ดูแลลูกค้า${p.key==='pro'?'ได้สูงสุด':''} ${p.clients_n??'—'} ราย`:`Act for ${p.key==='pro'?'up to ':''}${unit(p.clients_n,'client')}`,th?`ผู้ใช้ ${p.users_n??'—'} คน`:unit(p.users_n,'user'),th?'ตรา Verified advisor':'Verified advisor badge'];
 if(!rows.length)rows=p.card_text?.[lang]?.points??[];
 return rows.map(r=>typeof r==='string'?{text:r,on:true}:r);
}
export function planRequestText(current:PlanRecord|null,plan:PlanRecord,lang:ShareLang){return sc(current?'request':'requestFirst',lang,{current:current?.name??'',plan:plan.name});}
export function invitationEmailMatches(invited:string,actual:string){return invited.trim().toLowerCase()===actual.trim().toLowerCase();}
