import {useRef} from 'react';
import {FileSignature} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {useTranslation} from '@/i18n/language';
export function LoiConfirmation({title,children,action,decline=false,busy,onCancel,onConfirm}:{title:string;children:React.ReactNode;action:string;decline?:boolean;busy:boolean;onCancel:()=>void;onConfirm:()=>void}){
 const {t}=useTranslation();const cancel=useRef<HTMLButtonElement>(null);
 return <Dialog open onOpenChange={o=>{if(!o&&!busy)onCancel();}}><DialogContent className="loi-confirmation" onOpenAutoFocus={e=>{e.preventDefault();cancel.current?.focus();}}><div className="loi-confirmation-heading"><span className="loi-confirmation-icon" data-danger={decline}><FileSignature size={21}/></span><div><DialogTitle>{title}</DialogTitle><DialogDescription asChild><div className="loi-confirmation-copy">{children}</div></DialogDescription></div></div><div className="loi-confirmation-actions"><Button ref={cancel} variant="outline" disabled={busy} onClick={onCancel}>{t('Cancel')}</Button><Button variant={decline?'destructive':'default'} disabled={busy} onClick={onConfirm}>{action}</Button></div></DialogContent></Dialog>;
}