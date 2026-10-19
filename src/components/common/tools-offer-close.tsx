import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/language';
export function ToolsOfferClose({ onClose }: { onClose: () => void }) {
  const { language } = useTranslation();
  const label = language === 'th' ? 'ปิด' : 'Close';
  return <Button type="button" variant="unstyled" size="unstyled" className="tools-offer-close" aria-label={label} title={label} onClick={onClose}><X size={18} strokeWidth={2.2} /></Button>;
}
