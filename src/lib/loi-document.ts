import type { DealSide } from './loi-workflow';
const ones=['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const tens=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
export function englishAmount(n:number):string{
 if(!n)return 'Zero';if(n>=1e12)return englishAmount(Math.floor(n/1e12))+' trillion'+(n%1e12?' '+englishAmount(n%1e12).toLowerCase():'');if(n>=1e9)return englishAmount(Math.floor(n/1e9))+' billion'+(n%1e9?' '+englishAmount(n%1e9).toLowerCase():'');if(n>=1e6)return englishAmount(Math.floor(n/1e6))+' million'+(n%1e6?' '+englishAmount(n%1e6).toLowerCase():'');if(n>=1000)return englishAmount(Math.floor(n/1000))+' thousand'+(n%1000?' '+englishAmount(n%1000).toLowerCase():'');if(n>=100)return englishAmount(Math.floor(n/100))+' hundred'+(n%100?' and '+englishAmount(n%100).toLowerCase():'');const w=n<20?ones[n]:tens[Math.floor(n/10)]+(n%10?'-'+ones[n%10]:'');return w.charAt(0).toUpperCase()+w.slice(1);
}
export function thaiAmount(n:number):string{
 const digits=['','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
 const group=(x:number)=>{const str=String(x);let out='';for(let i=0;i<str.length;i++){const d=Number(str[i]),pos=str.length-i-1;if(!d)continue;out+=(pos===1?(d===1?'':d===2?'ยี่':digits[d]):pos===0&&d===1&&x>1?'เอ็ด':digits[d])+['','สิบ','ร้อย','พัน','หมื่น','แสน'][pos];}return out;};
 if(!n)return 'ศูนย์บาทถ้วน';const read=(x:number):string=>x>=1e6?read(Math.floor(x/1e6))+'ล้าน'+(x%1e6?group(x%1e6):''):group(x);return read(Math.round(n))+'บาทถ้วน';
}
export type LetterTerms={amount:number;days:number;conditions:string;from:DealSide;ref:string|null;sentAt?:string|null;decision?:string};
export function letterClauses(p:LetterTerms,th:boolean){
 const amount=p.amount.toLocaleString('en-GB');const sender=p.from==='seller';
 const titles=th?['ธุรกรรมที่เสนอ','สิ่งตอบแทน','การตรวจสอบสถานะกิจการ','เงื่อนไข','สิทธิ์เจรจาแต่เพียงผู้เดียว','ผลผูกพัน','การรักษาความลับ','การลงนามและการบันทึก']:['Proposed transaction','Consideration','Due diligence','Conditions','Exclusivity','Binding effect','Confidentiality','Signatures and records'];
 const date=p.sentAt?new Date(p.sentAt).toLocaleDateString(th?'th-TH':'en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'}):th?'ลงนามอิเล็กทรอนิกส์เมื่อส่ง':'e-signature applied on send';
 const text=th?[
 `${sender?'ผู้ขายเสนอขายกิจการของตน':'ผู้ซื้อเสนอซื้อกิจการของผู้ขาย'} (ประกาศ ${p.ref??'—'}) ${sender?'ให้แก่ผู้ซื้อ ':''}ในราคาเบื้องต้น ฿${amount} (${thaiAmount(p.amount)})`,
 'ชำระเป็นเงินสดเมื่อปิดการซื้อขาย โดยขึ้นอยู่กับผลการตรวจสอบสถานะกิจการและข้อตกลงฉบับสุดท้าย',
 'ตรวจสอบด้านการเงิน กฎหมาย และการค้า ผ่านห้องข้อมูลของ PitchSnack',p.conditions||'ไม่มีเงื่อนไขเพิ่มเติม',
 `นับจากวันที่ยอมรับ ผู้ขายให้สิทธิ์เจรจาแต่เพียงผู้เดียวแก่ผู้ซื้อเป็นเวลา ${p.days} วัน`,
 'ไม่มีผลผูกพัน ยกเว้นเรื่องสิทธิ์เจรจาแต่เพียงผู้เดียวและการรักษาความลับ','เป็นไปตาม NDA ระหว่างคู่สัญญา',
 `โดย${sender?'ผู้ขาย':'ผู้ซื้อ'}: ${date} การตัดสินใจของ${sender?'ผู้ซื้อ':'ผู้ขาย'}: ${p.decision||'ยังไม่ได้ตัดสินใจ'}`
 ]:[`The ${sender?'Seller proposes to sell its business':'Buyer proposes to buy the Seller’s business'} (Listing ${p.ref??'—'})${sender?' to the Buyer':''} for an indicative price of ฿${amount} (${englishAmount(p.amount)} baht).`,
 'Cash at completion, subject to due diligence and final agreement.','Financial, legal and commercial review through the PitchSnack data room.',p.conditions||'No further conditions stated.',
 `From acceptance the Seller grants the Buyer ${p.days} days of exclusivity.`,'Non-binding, except for exclusivity and confidentiality.','Under the NDA between the parties.',
 `By the ${sender?'Seller':'Buyer'}: ${p.sentAt?'e-signature, ':''}${date}. ${sender?'Buyer':'Seller'} decision: ${p.decision||'Not decided yet'}.`];
 return titles.map((title,i)=>({title,text:text[i]}));
}