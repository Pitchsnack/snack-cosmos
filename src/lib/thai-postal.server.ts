import { thaiProvinceName } from "./thai-address";
import postalData from "./thai-postal-data.json";

/**
 * Thailand Post sub-district/district/province/postcode table.
 * Source: earthchie/jquery.Thailand.js raw_database.json (MIT project), downloaded 2026-11-19.
 * https://github.com/earthchie/jquery.Thailand.js/blob/master/jquery.Thailand.js/database/raw_database/raw_database.json
 */
type PostalRow = [subdistrict: string, district: string, province: string, zipcode: string];
const ROWS = postalData as PostalRow[];

const compact = (value: string | null | undefined) => (value ?? "")
  .toLocaleLowerCase("th")
  .replace(/กรุงเทพฯ|กทม\.?/g, "กรุงเทพมหานคร")
  .replace(/^(แขวง|ตำบล|เขต|อำเภอ|จังหวัด|จ\.|ต\.|อ\.)\s*/, "")
  .replace(/[\s.,_-]/g, "")
  .trim();

/** Returns a postcode only when the supplied Thai address parts resolve to exactly one. */
export function inferThaiPostalCode(input: { subdistrict?: string | null; district?: string | null; province?: string | null }): string | null {
  const province = compact(thaiProvinceName(input.province));
  const district = compact(input.district);
  const subdistrict = compact(input.subdistrict);
  if (!province || !district) return null;
  let matches = ROWS.filter((row) => compact(row[2]) === province && compact(row[1]) === district);
  if (subdistrict) {
    const exact = matches.filter((row) => compact(row[0]) === subdistrict);
    if (!exact.length) return null;
    matches = exact;
  }
  const zips = [...new Set(matches.map((row) => String(row[3]).padStart(5, "0")))];
  return zips.length === 1 ? zips[0]! : null;
}
