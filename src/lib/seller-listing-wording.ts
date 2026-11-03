export type SellerWordingKind = 'name' | 'headline';
export function sellerWordingCount(value: string | null | undefined, kind: SellerWordingKind, language = 'en') {
  const text = (value ?? '').trim();
  const characters = text ? /[\u0E00-\u0E7F]/.test(text) : language === 'th';
  const limit = characters ? (kind === 'name' ? 50 : 100) : (kind === 'name' ? 7 : 15);
  const count = characters ? text.length : text ? text.split(/\s+/).length : 0;
  return { count, limit, characters, over: count > limit };
}
export function sellerWordingError(value: string | null | undefined, kind: SellerWordingKind, language = 'en') {
  const c = sellerWordingCount(value, kind, language);
  return c.over ? (language === 'th' ? `โปรดเขียนไม่เกิน ${c.limit} ${c.characters ? 'ตัวอักษร' : 'คำ'}` : `Keep it to ${c.limit} ${c.characters ? 'characters' : 'words'}.`) : null;
}
export const singleLineSellerWording = (value: string) => value.replace(/[\r\n]+/g, ' ');
export function sellerWordingChangedError(value: string | null | undefined, saved: string | null | undefined, kind: SellerWordingKind) {
  return (value ?? '').trim() === (saved ?? '').trim() ? null : sellerWordingError(value, kind);
}
export function needsSellerIdentityTour(row: { code_name?: string | null; suggested_listing_name?: string | null; headline?: string | null; headline_th?: string | null } | null, control: boolean) {
  return !(control ? row?.code_name : row?.suggested_listing_name)?.trim() || !(row?.headline?.trim() || row?.headline_th?.trim());
}