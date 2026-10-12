// Shared soft-launch code rules (browser-safe). Status is worked out, never stored.
export type CodeRole = 'seller' | 'buyer' | 'advisor' | 'any';
export type AccessCode = {
  id: string; code: string; client_name: string; invite_email: string | null; role: CodeRole;
  free_plan: string | null; free_months: number; max_accounts: number; ends_on: string | null;
  switched_off_at: string | null; switched_off_by: string | null; note: string | null;
  invite_sent_at: string | null; invite_sent_by: string | null; created_by: string; created_at: string;
};
export type CodeStatus = 'active' | 'ending' | 'ended' | 'off';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function makeCode(): string {
  const b = new Uint8Array(8); crypto.getRandomValues(b);
  const s = Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join('');
  return `PS-${s.slice(0, 4)}-${s.slice(4)}`;
}
export const CODE_RE = /^PS-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;
/** Today in Asia/Bangkok as YYYY-MM-DD. */
export function bkkToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now);
}
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export function daysLeft(c: Pick<AccessCode, 'ends_on'>, today = bkkToday()): number | null {
  if (!c.ends_on) return null;
  return Math.round((Date.parse(c.ends_on) - Date.parse(today)) / 86400000);
}
export function codeStatus(c: AccessCode, today = bkkToday()): CodeStatus {
  if (c.switched_off_at) return 'off';
  const d = daysLeft(c, today);
  if (d !== null && d < 0) return 'ended';
  if (d !== null && d <= 7) return 'ending';
  return 'active';
}
/** Last free day: the day before the same date {months} after the sign-up day, clamped to month end. */
export function lastFreeDay(signupIso: string, months: number): string {
  const [y, m, d] = signupIso.split('-').map(Number);
  const tm = m - 1 + months; const ty = y + Math.floor(tm / 12); const mm = tm % 12;
  const dim = new Date(Date.UTC(ty, mm + 1, 0)).getUTCDate();
  if (d > dim) return new Date(Date.UTC(ty, mm, dim)).toISOString().slice(0, 10);
  return addDays(new Date(Date.UTC(ty, mm, d)).toISOString().slice(0, 10), -1);
}
const MON_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MON_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
export function dateEn(iso: string) { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return `${d} ${MON_EN[m - 1]} ${y}`; }
export function dateTh(iso: string) { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return `${d} ${MON_TH[m - 1]} ${y + 543}`; }

export type InviteInput = { client: string; code: string; role: CodeRole; max: number; endsOn: string | null; planName: string | null; months: number };
const ROLE_TH = { seller: 'ผู้ขาย', buyer: 'ผู้ซื้อ', advisor: 'ที่ปรึกษา' } as const;
export function inviteText(i: InviteInput, lang: 'th' | 'en'): string[] {
  const link = `https://pitchsnack.com/?invite=${i.code}`;
  if (lang === 'th') {
    const free = i.planName == null ? null : i.role === 'any'
      ? `ทุกบัญชีที่สร้างด้วยรหัสนี้ใช้แผนหลักของบทบาทนั้นได้ฟรี ${i.months} เดือน นับจากวันที่สร้างบัญชี ไม่ต้องผูกบัตร จากนั้นท่านเลือกแผนที่ต้องการได้`
      : `บัญชี${ROLE_TH[i.role]}ที่สร้างด้วยรหัสนี้ใช้แผน ${i.planName} ได้ฟรี ${i.months} เดือน นับจากวันที่สร้างบัญชี (บทบาทอื่นใช้แผนหลักของบทบาทนั้น) ไม่ต้องผูกบัตร จากนั้นท่านเลือกแผนที่ต้องการได้`;
    return ['คำเชิญทดลองใช้งาน PitchSnack', `เรียน ทีมงาน ${i.client}`,
      `PitchSnack ขอเชิญ ${i.client} ร่วมทดลองใช้งานตลาดกลางซื้อขายกิจการ ก่อนเปิดให้บริการทั่วไป`,
      '1. เปิด pitchsnack.com', `2. กรอกรหัสเข้าใช้งาน ${i.code}`, '3. สร้างบัญชีของท่าน', `เปิด PitchSnack: ${link}`,
      `รหัสนี้ใช้สร้างบัญชีได้ ${i.max} บัญชี${i.endsOn ? ` และใช้ได้ถึงวันที่ ${dateTh(i.endsOn)}` : ''} กรุณาใช้รหัสภายในบริษัทของท่านเท่านั้น`,
      ...(free ? [free] : []), 'หากมีคำถาม ตอบกลับอีเมลนี้ได้เลย', 'ทีมงาน PitchSnack'];
  }
  const mo = i.months === 1 ? '1 month' : `${i.months} months`;
  const free = i.planName == null ? null : i.role === 'any'
    ? `Each account made with it gets its role’s usual plan free for ${mo} from the day it’s made, with no card needed. After that, you choose a plan.`
    : `Each ${i.role} account made with it gets ${i.planName} free for ${mo} from the day it’s made (other roles get their own usual plan), with no card needed. After that, you choose a plan.`;
  return ['Your invitation to try PitchSnack', `Dear ${i.client} team,`,
    `PitchSnack invites ${i.client} to try the marketplace before it opens to everyone.`,
    '1. Go to pitchsnack.com', `2. Enter the access code ${i.code}`, '3. Create your account', `Open PitchSnack: ${link}`,
    `The code works for ${i.max === 1 ? '1 account' : `${i.max} accounts`}${i.endsOn ? ` until ${dateEn(i.endsOn)}` : ''}. Please keep it within your company.`,
    ...(free ? [free] : []), 'Any questions? Just reply to this email.', 'The PitchSnack team'];
}
export const inviteCopy = (i: InviteInput) => [...inviteText(i, 'th'), '', ...inviteText(i, 'en')].join('\n');
