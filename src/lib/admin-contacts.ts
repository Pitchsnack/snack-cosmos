export const CONTACT_ROLES = ["buyer", "seller", "advisor"] as const;
export type AdminContactRole = (typeof CONTACT_ROLES)[number];
export type AdminContact = {
  id: string; name: string; role: AdminContactRole; title: string | null;
  email: string; phone: string | null; linkedin: string | null;
  location: string | null; website: string | null; status: string; joined: string;
  lastActive: string | null; connections: number;
  organisations: { id: string; name: string; ref: string | null; kind: AdminContactRole; status: string }[];
};
export const CONTACT_STATUSES = ['Live', 'In review', 'Draft', 'Verified', 'Checking', 'No profile yet'] as const;
export function contactProfileStatus(c: Pick<AdminContact, 'organisations'>): string {
  if (!c.organisations.length) return 'No profile yet';
  const states = c.organisations.map(o => o.kind === 'advisor' ? o.status === 'verified' ? 'Verified' : ['pending', 'more_info'].includes(o.status) ? 'Checking' : 'Draft' : ['live', 'live_edits_pending', 'approved'].includes(o.status) ? 'Live' : ['in_review', 'pending'].includes(o.status) ? 'In review' : 'Draft');
  return ['Live', 'Verified', 'In review', 'Checking', 'Draft'].find(s => states.includes(s)) || 'Draft';
}
export function activeContactNda(p: {status: string; nda_approved_at: string | null; nda_expires_at?: string | null}, now = Date.now()) {
  return !!p.nda_approved_at && !['declined', 'withdrawn', 'revoked', 'ended'].includes(p.status) && (p.nda_expires_at ? Date.parse(p.nda_expires_at) : Date.parse(p.nda_approved_at) + 730 * 864e5) > now;
}
export function contactActiveAge(value: string | null, now = Date.now()) {
  if (!value) return null;
  const day = (v: number) => Math.floor((v + 7 * 36e5) / 864e5);
  const n = Math.max(0, day(now) - day(Date.parse(value)));
  return n < 2 ? {unit: n === 0 ? 'today' : 'yesterday', n} : n < 7 ? {unit: 'days', n} : n < 30 ? {unit: 'weeks', n: Math.floor(n / 7)} : {unit: 'months', n: Math.floor(n / 30)};
}
export function filterAdminContacts(rows: AdminContact[], role: string, status: string, search: string, sort: string, type = 'all') {
  const q = search.trim().toLocaleLowerCase();
  return rows.filter(c => (role === "all" || c.role === role) && (type === 'all' || c.role === type) && (status === "all" || contactProfileStatus(c) === status) &&
    (!q || [c.name, c.email, c.phone, c.title, c.location, ...c.organisations.flatMap(o => [o.name, o.ref])].some(v => v?.toLocaleLowerCase().includes(q))))
    .sort((a, b) => sort === 'active' ? (b.lastActive || '').localeCompare(a.lastActive || '') : sort === "recent" ? b.joined.localeCompare(a.joined) : sort === "company" ? (a.organisations[0]?.name || "").localeCompare(b.organisations[0]?.name || "") : a.name.localeCompare(b.name));
}