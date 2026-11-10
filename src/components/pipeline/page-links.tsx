import {useEffect,useRef} from 'react';
import {Link} from '@tanstack/react-router';
import {usePipelineWorkspace} from '@/hooks/use-pipeline-workspace';
import {useTranslation} from '@/i18n/language';
import {PIPELINE_PAGES,type PipelinePageKey} from '@/lib/pipeline-pages';

/** The sidebar's labels, badge rules and query cache, presented as page links. */
export function PipelinePageLinks({page}:{page:PipelinePageKey}){
 const {counts,newInv,fresh}=usePipelineWorkspace();
 const {language}=useTranslation();const th=language==='th';
 const values=[newInv,counts.all,counts.watch,counts.history,fresh];
 const root=useRef<HTMLElement>(null);
 useEffect(()=>{
  const nav=root.current;const current=nav?.querySelector<HTMLElement>('[aria-current="page"]');
  if(!nav||!current)return;
  if(current.offsetLeft<nav.scrollLeft)nav.scrollLeft=current.offsetLeft;
  else if(current.offsetLeft+current.offsetWidth>nav.scrollLeft+nav.clientWidth)nav.scrollLeft=current.offsetLeft+current.offsetWidth-nav.clientWidth;
 },[page,language]);
 return <nav ref={root} className="pipeline-page-links" aria-label={th?'หน้าในไปป์ไลน์':'Pipeline pages'}>
  {PIPELINE_PAGES.map(([key,en,thai],i)=><Link key={key} to={key==='invitations'?'/marketplace/pipeline/invitations':key==='all-deals'?'/marketplace/pipeline/all-deals':key==='watchlist'?'/marketplace/pipeline/watchlist':key==='history'?'/marketplace/pipeline/history':'/marketplace/pipeline/reports'} className="pipeline-page-link" aria-current={key===page?'page':undefined} activeOptions={{exact:true}}><span>{th?thai:en}</span>{(values[i]>0||i===1)&&<span className={i===0||i===4?'pipeline-count-pill':'pipeline-count-number'}>{values[i]}</span>}</Link>)}
 </nav>;
}