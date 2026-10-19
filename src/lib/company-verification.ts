export type VerificationStatus = 'not_ordered' | 'waiting_payment' | 'checking' | 'certified' | 'needs_fix';
export type VerificationCheck = { key: number; result: 'match' | 'mismatch'; detail: string | null; source: string | null };
export type VerificationDirector = { nameTh: string; nameEn: string | null; role: string | null; canSignAlone: boolean; isSeller: boolean };
export type VerificationRecord = {
  nameTh: string | null; nameEn: string | null; profileName: string | null; registration: string | null;
  type: string | null; status: string | null; registeredDate: string | null; capital: string | null;
  size: string | null; formerName: string | null; nameChangedOn: string | null; shares: string | null;
  par: string | null; fiscalYearEnd: string | null; businessType: string | null; tsic: string | null;
  objective: string | null; address: string | null; auditor: string | null; latestFiling: string | null;
  signingTh: string | null; signingEn: string | null; sellerRole: string | null; directors: VerificationDirector[];
};
export type VerificationState = {
  companyId: string; company: string; code: string | null; ref: string | null; logo: string | null;
  status: VerificationStatus; included: boolean; startedAt: string | null; readyBy: string | null;
  checkedAt: string | null; affidavitOn: string | null; buyer: boolean;
  plan: string | null; mode: string; allowance: number; left: number; termEnd: string | null;
  price: number | null; vatPct: number; businessDays: number; recheckDays: number;
  access: { via: string; openedAt: string | null; requestedAt: string | null; until: string | null } | null;
  payment: { status: string; total: number; ref: string; at: string | null } | null;
  email: string | null; viewer: string; firm: string; record: VerificationRecord | null; checks: VerificationCheck[];
  /** Admin views are read-only: never shown the offer or Pay. */
  isAdmin: boolean;
};
export function verificationNdaValid(p: { status: string; nda_approved_at: string | null; nda_expires_at?: string | null } | null, now = Date.now()) {
  if (!p?.nda_approved_at || ['declined','withdrawn','revoked','ended'].includes(p.status)) return false;
  const end = p.nda_expires_at ? Date.parse(p.nda_expires_at) : Date.parse(p.nda_approved_at) + 730 * 86400000;
  return Number.isFinite(end) && end > now;
}
export function verificationTotals(amount: number, vatPct: number) {
  const vat = Math.round(amount * vatPct) / 100;
  return { amount, vat, total: Math.round((amount + vat) * 100) / 100 };
}
export function verificationDue(from: string, days: number) {
  const d = new Date(from); let n = 0;
  while (n < days) { d.setUTCDate(d.getUTCDate() + 1); const local = new Date(d.getTime() + 7 * 3600000); if (![0,6].includes(local.getUTCDay())) n++; }
  return d.toISOString();
}
export function verificationResult(checks: VerificationCheck[]): VerificationStatus {
  if (checks.length !== 6 || new Set(checks.map(c => c.key)).size !== 6 || checks.some(c => c.key < 1 || c.key > 6)) return 'checking';
  return checks.every(c => c.result === 'match') ? 'certified' : 'needs_fix';
}