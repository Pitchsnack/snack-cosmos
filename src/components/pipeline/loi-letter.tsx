import {useRef} from 'react';
import {useTranslation} from '@/i18n/language';
import {letterClauses,type LetterTerms} from '@/lib/loi-document';
export function LoiLetter({terms,onRead,read=false,preview=false}:{terms:LetterTerms;onRead?:()=>void;read?:boolean;preview?:boolean}){
 const {language}=useTranslation();const th=language==='th';const ref=useRef<HTMLDivElement>(null);
 return <div><div ref={ref} className={preview?'loi-letter-preview':'loi-letter-reader'} tabIndex={0} aria-label={th?'หนังสือแสดงเจตจำนง':'Letter of intent'} onScroll={()=>{const el=ref.current;if(el&&el.scrollTop+el.clientHeight>=el.scrollHeight-4)onRead?.();}}><h3>{th?'หนังสือแสดงเจตจำนง':'Letter of intent'}</h3><ol>{letterClauses(terms,th).map(x=><li key={x.title}><b>{x.title}. </b>{x.text}</li>)}</ol></div>{!preview&&<p className={read?'loi-read-done':'loi-reader-hint'}>{read?(th?'✓ อ่านจนจบแล้ว':'✓ Read to the end'):(th?'เลื่อนอ่านจนถึงท้ายข้อความ':'Scroll to the end of the text.')}</p>}</div>;
}