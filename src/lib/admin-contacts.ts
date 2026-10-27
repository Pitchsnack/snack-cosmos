export const CONTACT_ROLES = ["buyer", "seller", "advisor"] as const;
export type AdminContactRole = (typeof CONTACT_ROLES)[number];
export type AdminContact = {
  id: string; name: string; role: AdminContactRole; title: string | null;
  email: string; phone: string | null; linkedin: string | null;
  location: string | null; website: string | null; status: string; joined: string;
  organisations: { id: string; name: string; ref: string | null; kind: AdminContactRole; status: string }[];
};
export function filterAdminContacts(rows: AdminContact[], role: string, status: string, search: string, sort: string) {
  const q = search.trim().toLocaleLowerCase();
  return rows.filter(c => (role === "all" || c.role === role) && (status === "all" || c.status === status) &&
    (!q || [c.name, c.email, c.phone, c.title, c.location, ...c.organisations.flatMap(o => [o.name, o.ref])].some(v => v?.toLocaleLowerCase().includes(q))))
    .sort((a, b) => sort === "recent" ? b.joined.localeCompare(a.joined) : sort === "company" ? (a.organisations[0]?.name || "").localeCompare(b.organisations[0]?.name || "") : a.name.localeCompare(b.name));
}