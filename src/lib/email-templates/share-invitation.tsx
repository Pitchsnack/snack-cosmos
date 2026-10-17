import * as React from 'react';
import {Body,Button,Container,Head,Heading,Html,Img,Link,Preview,Section,Text} from '@react-email/components';
import type {TemplateEntry} from './registry';
import {shareEmailCopy,type ShareLang} from '@/i18n/sidebar-share';
function ShareInvitation({name='PitchSnack member',email='',url='https://pitchsnack.com/signup',lang='en'}:{name?:string;email?:string;url?:string;lang?:ShareLang}){
 const c=(k:keyof typeof shareEmailCopy)=>shareEmailCopy[k][lang==='th'?1:0];
 return <Html lang={lang}><Head/><Preview>{c('subject').replace('{name}',name)}</Preview><Body style={main}><Container style={card}><Section style={bar}><Img src="https://pitchsnack.com/email/pitchsnack-logo-white.png" width="117" height="20" alt="PitchSnack"/></Section><Section style={inner}><Heading style={title}>{name} <em>{c('invited')}</em> {c('joinTitle')}</Heading><Text style={body}>{c('body')}</Text><Button href={url} style={button}>{c('join')}</Button><Text style={hint}>{c('hint')}</Text></Section><Section style={footer}><Text style={footerText}>{c('because')} {name} <em>{c('invited')}</em> <Link href={`mailto:${email}`} style={link}>{email}</Link>. {c('ignore')}</Text><Link href="https://www.pitchsnack.com" style={{...link,fontWeight:600,fontSize:'12.5px'}}>www.pitchsnack.com</Link></Section></Container></Body></Html>;
}
export const template={component:ShareInvitation,subject:(d:Record<string,any>)=>shareEmailCopy.subject[d.lang==='th'?1:0].replace('{name}',d.name||'PitchSnack member'),displayName:'Share invitation'} satisfies TemplateEntry;
const main={backgroundColor:'#ffffff',fontFamily:'"DM Sans", Arial, sans-serif',padding:'24px 12px'};
const card={maxWidth:'580px',backgroundColor:'#ffffff',border:'1px solid #E9EBF0',borderRadius:'12px',overflow:'hidden' as const};
const bar={backgroundColor:'#1E3E56',padding:'16px 24px'};
const inner={padding:'24px 18px'};
const title={fontSize:'21px',fontWeight:700,color:'#151A28',lineHeight:'1.3',margin:'0'};
const body={fontSize:'14.5px',color:'#3A4152',lineHeight:'1.6',margin:'10px 0 20px'};
const button={backgroundColor:'#1E2A4A',color:'#ffffff',fontSize:'15px',fontWeight:600,borderRadius:'10px',padding:'13px 22px',textDecoration:'none'};
const hint={fontSize:'12.5px',color:'#6A7181',margin:'10px 0 0'};
const footer={borderTop:'1px solid #E9EBF0',padding:'16px 24px'};
const footerText={fontSize:'12px',color:'#8A90A0',lineHeight:'1.55',margin:'0 0 8px'};
const link={color:'#2563EB',textDecoration:'underline'};
