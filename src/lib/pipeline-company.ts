/** Select only the deal's own organisation, without identity/type fallbacks. */
export function dealCompanyName(seller: boolean, company: string | null | undefined, firm: string | null | undefined): string | null {
  return (seller ? company : firm)?.trim() || null;
}