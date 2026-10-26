import { Building2 } from 'lucide-react';

export function DealCompanyChip({ name }: { name?: string | null }) {
  if (!name?.trim()) return null;
  return <span className="hub-pill deal-company-chip" data-tone="muted"><Building2 size={13} aria-hidden="true" /><span>{name}</span></span>;
}