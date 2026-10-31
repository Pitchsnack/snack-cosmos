import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';

/** Larger view of the open report. Buyer: covers the Reports pop-up. Seller: covers the page area. */
export function HubExpandBox({anchor,title,tag,sub,icon,onClose,children,closeLabel,closeTip}:{anchor:HTMLElement|null;title:ReactNode;tag:ReactNode;sub:string;icon:ReactNode;onClose:()=>void;children:ReactNode;closeLabel:string;closeTip:string}){
 const box=useRef<HTMLDivElement>(null);const close=useRef<HTMLButtonElement>(null);
 const dialog=anchor?.closest('.hub-dialog') as HTMLElement|null;
 const [rect,setRect]=useState<{top:number;left:number;width:number;height:number}|null>(null);
 useLayoutEffect(()=>{
  const measure=()=>{
   if(dialog){setRect({top:dialog.scrollTop,left:0,width:dialog.clientWidth,height:dialog.clientHeight});return;}
   const page=(anchor?.closest('.hub-page')?.parentElement??document.body) as HTMLElement;const r=page.getBoundingClientRect();
   const top=Math.max(r.top,0)+16,left=r.left+16;setRect({top,left,width:Math.max(r.width-32,0),height:window.innerHeight-top-16});
  };
  measure();window.addEventListener('resize',measure);
  const lock=dialog??document.body;const prev=lock.style.overflow;lock.style.overflow='hidden';
  return()=>{window.removeEventListener('resize',measure);lock.style.overflow=prev;};
 },[anchor,dialog]);
 useEffect(()=>{close.current?.focus();
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){if(document.querySelector('[data-radix-menu-content]'))return;e.preventDefault();e.stopImmediatePropagation();onClose();return;}
   if(e.key==='Tab'&&box.current){const f=[...box.current.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x=>!x.hasAttribute('disabled'));if(!f.length)return;const first=f[0],last=f[f.length-1];
    if(!box.current.contains(document.activeElement)){e.preventDefault();first.focus();}else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  };
  window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);
 },[onClose]);
 const node=<div ref={box} className="hub-expand" data-in={dialog?'dialog':'page'} role="dialog" aria-modal="true" aria-labelledby="hub-expand-title" style={rect?(dialog?{position:'absolute',top:rect.top,left:0,width:rect.width,height:rect.height}:{position:'fixed',...rect}):{visibility:'hidden'}}>
  <header className="hub-expand-head"><span className="hub-expand-tile">{icon}</span><div className="hub-expand-heading"><div className="hub-expand-titlerow"><h2 id="hub-expand-title">{title}</h2>{tag}</div><p>{sub}</p></div><button ref={close} type="button" className="hub-expand-close" aria-label={closeLabel} title={closeTip} onClick={onClose}><X size={18}/></button></header>
  <div className="hub-expand-body">{children}</div>
 </div>;
 return dialog?createPortal(node,dialog):createPortal(node,document.body);
}
