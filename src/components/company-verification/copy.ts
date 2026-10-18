import { useTranslation } from '@/i18n/language';
import strings from './copy.json';
export function useVerificationCopy() {
  const {language}=useTranslation();
  return (en:string,th?:string,vars:Record<string,string|number>={})=>{
    let value=language==='th'?(th??(strings as Record<string,string>)[en]??en):en;
    for(const [k,v] of Object.entries(vars))value=value.replaceAll(`{${k}}`,String(v));
    return value;
  };
}
export const CHECK_WORDS = [
 ['Found in the company register','พบในทะเบียนบริษัท'],
 ['The name matches your business profile','ชื่อตรงกับข้อมูลธุรกิจของท่าน'],
 ['Active, with its filings up to date','ยังดำเนินกิจการและยื่นงบการเงินครบถ้วน'],
 ['Registered capital','ทุนจดทะเบียน'],
 ['Directors, and who can sign','กรรมการและผู้มีอำนาจลงนาม'],
 ['You can act for the company','ท่านมีอำนาจดำเนินการแทนบริษัท'],
] as const;
export function dateText(date:string|null,thai=false){return date?new Date(date).toLocaleDateString(thai?'th-TH':'en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'}):'—';}
export function useVerificationDate(){const {language}=useTranslation();return (date:string|null)=>dateText(date,language==='th');}
