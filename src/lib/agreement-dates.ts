const DAY = 86_400_000;
const bangkokDayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Calendar-day index, independent of the browser's time zone and time of day. */
export function bangkokDay(value: string | number | Date): number | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = bangkokDayFormat.formatToParts(date);
  const part = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return Date.UTC(part('year'), part('month') - 1, part('day')) / DAY;
}

export function agreementTiming(start: string | null, end: string | null, today: number) {
  const first = start ? bangkokDay(start) : null;
  const last = end ? bangkokDay(end) : null;
  if (first === null || last === null) return null;
  const daysLeft = last - today;
  const termDays = last - first;
  return { daysLeft, termDays, tone: daysLeft < 0 ? 'ended' : daysLeft <= 14 ? 'soon' : 'active', progress: termDays > 0 ? Math.max(0, Math.min(1, (today - first) / termDays)) : today >= last ? 1 : 0 } as const;
}

export function nextBangkokMidnight(now: number): number {
  const day = bangkokDay(now);
  return day === null ? now + DAY : (day + 1) * DAY - 7 * 3_600_000;
}

export function showsAgreements(p: { status: string; ndaApprovedAt: string | null; loiAcceptedAt: string | null }) {
  return p.status === 'active' && !!p.ndaApprovedAt && !!p.loiAcceptedAt;
}

export function agreementDate(value: string | number, thai: boolean) {
  return new Intl.DateTimeFormat(thai ? 'th-TH' : 'en-GB', { timeZone: 'Asia/Bangkok', calendar: 'gregory', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)).replace('Sept', 'Sep');
}