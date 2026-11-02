import {useCallback,useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {MoveHorizontal} from 'lucide-react';
import {useTranslation} from '@/i18n/language';

/**
 * The width at which every report lays out with no overlaps (the width it has
 * after Expand). Below it the report body keeps its layout and scrolls
 * sideways inside its own box instead of squeezing; the page never scrolls.
 */
export const REPORT_MIN_WIDTH=1040;

/**
 * Shared sideways-scroll wrapper for every report body. The report's own
 * header (title, Expand, Export PDF, year picker, unit tag) stays outside;
 * everything from the company card down goes inside. Shows a one-line note
 * and soft edge fades only while there is more to scroll to.
 */
export function ReportScroll({children,expandHint=false}:{children:ReactNode;expandHint?:boolean}){
 const {language}=useTranslation();const th=language==='th';
 const ref=useRef<HTMLDivElement>(null);
 const [st,setSt]=useState({more:false,left:false,right:false});
 const update=useCallback(()=>{const el=ref.current;if(!el)return;const more=el.scrollWidth>el.clientWidth+1;setSt({more,left:more&&el.scrollLeft>2,right:more&&el.scrollLeft<el.scrollWidth-el.clientWidth-2});},[]);
 useEffect(()=>{const el=ref.current;if(!el)return;update();const ro=new ResizeObserver(update);ro.observe(el);if(el.firstElementChild)ro.observe(el.firstElementChild);window.addEventListener('resize',update);return ()=>{ro.disconnect();window.removeEventListener('resize',update);};},[update]);
 const phone=typeof window!=='undefined'&&window.matchMedia('(max-width:639px)').matches;
 const note=th?(expandHint&&!phone?'เลื่อนไปด้านข้างเพื่อดูรายงานฉบับเต็ม หรือกดขยาย':'เลื่อนไปด้านข้างเพื่อดูรายงานฉบับเต็ม'):(expandHint&&!phone?'Scroll sideways to see the whole report, or click Expand.':'Scroll sideways to see the whole report.');
 return <div className="rs-wrap">
  {st.more&&<p className="rs-note"><MoveHorizontal size={15} aria-hidden/>{note}</p>}
  <div className="rs-box">
   <div className="rs" ref={ref} onScroll={update} tabIndex={0} role="region" aria-label={th?'รายงาน เลื่อนด้านข้างได้':'Report, scrolls sideways'}><div className="rs-body">{children}</div></div>
   <span className={`rs-fade rs-fade-l${st.left?' on':''}`} aria-hidden/>
   <span className={`rs-fade rs-fade-r${st.right?' on':''}`} aria-hidden/>
  </div>
 </div>;
}
