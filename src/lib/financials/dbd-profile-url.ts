const BASE = "https://datawarehouse.dbd.go.th";

/**
 * The register prefixes the 13-digit registration number with its entity-type
 * digit (the registration number's fourth digit) in company profile URLs.
 */
export function dbdProfilePath(registeredNumber: string): string {
  const number = registeredNumber.trim();
  if (!/^\d{13}$/.test(number)) throw new Error("A 13-digit registration number is required.");
  return `/company/profile/${number[3]}${number}`;
}

export function dbdProfileUrl(registeredNumber: string): string {
  return `${BASE}${dbdProfilePath(registeredNumber)}`;
}
