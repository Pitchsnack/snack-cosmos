import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Reader } from '@/components/pipeline/pipeline-dialogs';
import { STANDARD_NDA_TEXT } from '@/config/standard-nda';
import { requestNda } from '@/lib/pipeline.functions';
import { useHomeLang } from './public-shell';

/** Uses the existing legal text, consent and request handler; server verification and plan limits remain authoritative. */
export function DiscoveryNda({listingId,onClose,onDone}:{listingId:string;onClose:()=>void;onDone:()=>void}) {
 const {lang}=useHomeLang();const th=lang==='th';const [tick,setTick]=useState(false),[reading,setReading]=useState(false),[busy,setBusy]=useState(false);const request=useServerFn(requestNda);
 const consent=th?'ข้าพเจ้าได้อ่าน NDA และตกลงตามเงื่อนไข':'I have read the NDA and agree to its terms.';
 return <><Dialog open onOpenChange={o=>!o&&onClose()}><DialogContent className="discovery-light"><DialogTitle>{th?'ลงนาม NDA และส่งคำขอ':'Sign the NDA and send your request'}</DialogTitle><DialogDescription>{th?'NDA แบบร่วมกันมาตรฐานของ PitchSnack อายุ 2 ปี ผู้ขายจะเห็นโปรไฟล์ของท่านและอนุมัติ':'PitchSnack’s standard mutual NDA, for 2 years. The seller sees your profile and approves it.'}</DialogDescription><Button variant="link" onClick={()=>setReading(true)}>{th?'อ่าน NDA':'Read the NDA'}</Button><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={tick} onChange={e=>setTick(e.target.checked)}/>{consent}</label><div className="discovery-auth-actions"><Button variant="outline" onClick={onClose}>{th?'ยกเลิก':'Cancel'}</Button><Button disabled={!tick||busy} onClick={async()=>{setBusy(true);try{await request({data:{listingId,consent}});toast.success(th?'ลงนาม NDA แล้ว ผู้ขายได้รับคำขอ NDA ของท่านแล้ว':'NDA signed. The seller has received your NDA request.');onDone();}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}}}>{th?'ลงนามและขอ NDA':'Sign and request NDA'}</Button></div></DialogContent></Dialog>{reading&&<Reader title="NDA" body={STANDARD_NDA_TEXT} onClose={()=>setReading(false)}/>}</>;
}