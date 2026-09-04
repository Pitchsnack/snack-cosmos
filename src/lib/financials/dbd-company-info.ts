/**
 * DBD Thai Company Info parsing (pure, no network).
 *
 * Reads the ข้อมูลนิติบุคคล / รายชื่อกรรมการ / ประเภทธุรกิจ blocks of a DBD
 * Data Warehouse company profile page. Values stay in Thai exactly as
 * published — nothing is translated, estimated or zero-filled. Anything the
 * page does not publish stays `null`.
 */

export interface DbdBusinessTh {
  code: string | null;
  descriptionTh: string | null;
  objectiveTh: string | null;
}

export interface DbdCompanyInfoTh {
  legalNameTh: string | null;
  registrationNumber: string | null;
  legalEntityTypeTh: string | null;
  legalEntityStatusTh: string | null;
  registrationDateThRaw: string | null;
  registrationDate: string | null;
  registeredCapitalThRaw: string | null;
  registeredCapitalThb: number | null;
  previousRegistrationNumber: string | null;
  businessGroupTh: string | null;
  businessSize: string | null;
  headOfficeAddressTh: string | null;
  website: string | null;
  authorizedSignatoryTh: string | null;
  submissionYearsBe: number[];
  directors: string[];
  registeredBusiness: DbdBusinessTh | null;
  latestBusiness: (DbdBusinessTh & { financialYearBe: number | null }) | null;
}

export const EMPTY_COMPANY_INFO_TH: DbdCompanyInfoTh = {
  legalNameTh: null,
  registrationNumber: null,
  legalEntityTypeTh: null,
  legalEntityStatusTh: null,
  registrationDateThRaw: null,
  registrationDate: null,
  registeredCapitalThRaw: null,
  registeredCapitalThb: null,
  previousRegistrationNumber: null,
  businessGroupTh: null,
  businessSize: null,
  headOfficeAddressTh: null,
  website: null,
  authorizedSignatoryTh: null,
  submissionYearsBe: [],
  directors: [],
  registeredBusiness: null,
  latestBusiness: null,
};

const THAI_MONTHS: Record<string, number> = {
  "ม.ค.": 1, "มกราคม": 1,
  "ก.พ.": 2, "กุมภาพันธ์": 2,
  "มี.ค.": 3, "มีนาคม": 3,
  "เม.ย.": 4, "เมษายน": 4,
  "พ.ค.": 5, "พฤษภาคม": 5,
  "มิ.ย.": 6, "มิถุนายน": 6,
  "ก.ค.": 7, "กรกฎาคม": 7,
  "ส.ค.": 8, "สิงหาคม": 8,
  "ก.ย.": 9, "กันยายน": 9,
  "ต.ค.": 10, "ตุลาคม": 10,
  "พ.ย.": 11, "พฤศจิกายน": 11,
  "ธ.ค.": 12, "ธันวาคม": 12,
};

/** "30 พ.ค. 2555" → "2012-05-30". Returns null when it cannot be read exactly. */
export function thaiDateToIso(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2})\s*([^\s\d]+)\s*(\d{4})/);
  if (!m) return null;
  const month = THAI_MONTHS[m[2]];
  if (!month) return null;
  let year = Number(m[3]);
  if (year > 2400) year -= 543;
  const day = Number(m[1]);
  if (!day || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "212,246,100.00 บาท" → 212246100. Returns null when no number is present. */
export function thaiAmountToNumber(raw: string | null): number | null {
  if (!raw) return null;
  const m = raw.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

const strip = (s: string) =>
  s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Keeps line structure — used for multi-line values such as the address. */
const stripLines = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();

const nullish = (v: string | null | undefined): string | null => {
  const t = (v ?? "").trim();
  if (!t) return null;
  if (/^[-–—]$/.test(t)) return null;
  if (t === "ไม่มีข้อมูล" || t === "- ไม่มีข้อมูล -") return null;
  return t;
};

interface HtmlTable {
  rows: { cells: string[]; rawCells: string[] }[];
}

function parseTables(html: string): HtmlTable[] {
  const out: HtmlTable[] = [];
  for (const t of html.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
    const rows: HtmlTable["rows"] = [];
    for (const r of t.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
      const raw = r.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) ?? [];
      if (!raw.length) continue;
      rows.push({ cells: raw.map(strip), rawCells: raw.map(stripLines) });
    }
    if (rows.length) out.push({ rows });
  }
  return out;
}

/** All label → value pairs found in two-column table rows across the page. */
function labelValueMap(tables: HtmlTable[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of tables) {
    for (const row of t.rows) {
      if (row.cells.length !== 2) continue;
      const label = row.cells[0].replace(/\s*:\s*$/, "").trim();
      if (!label) continue;
      if (!map.has(label)) map.set(label, row.rawCells[1]);
    }
  }
  return map;
}

function readLabel(map: Map<string, string>, labels: string[]): string | null {
  for (const label of labels) {
    const direct = map.get(label);
    const value = nullish(direct);
    if (value) return value;
  }
  // Fuzzy: a label cell may carry extra decoration.
  for (const [k, v] of map) {
    if (labels.some((l) => k.includes(l))) {
      const value = nullish(v);
      if (value) return value;
    }
  }
  return null;
}

/** Reads a value from the flattened page text using following labels as stops. */
function readText(text: string, labels: string[], stops: string[]): string | null {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stopRe = stops.map(esc).join("|");
  for (const label of labels) {
    const re = new RegExp(`${esc(label)}\\s*:?\\s*([\\s\\S]{1,300}?)\\s*(?=${stopRe}|$)`);
    const m = text.match(re);
    const value = nullish(m?.[1]);
    if (value) return value;
  }
  return null;
}

const KNOWN_LABELS = [
  "ชื่อนิติบุคคล",
  "เลขทะเบียนนิติบุคคล",
  "ประเภทนิติบุคคล",
  "สถานะนิติบุคคล",
  "วันที่จดทะเบียนจัดตั้ง",
  "ทุนจดทะเบียน",
  "เลขทะเบียนเดิม",
  "กลุ่มธุรกิจ",
  "ขนาดธุรกิจ",
  "ปีที่ส่งงบการเงิน",
  "ที่ตั้งสำนักงานใหญ่",
  "Website",
  "รายชื่อกรรมการ",
  "กรรมการลงชื่อผูกพัน",
  "ประเภทธุรกิจตอนจดทะเบียน",
  "ประเภทธุรกิจที่ส่งงบการเงินปีล่าสุด",
  "ประเภทธุรกิจ",
  "วัตถุประสงค์",
  "ข้อมูลนิติบุคคล",
];

function parseDirectors(tables: HtmlTable[]): string[] {
  for (const t of tables) {
    const header = t.rows[0]?.cells ?? [];
    const isDirectorTable = header.some((c) => c.includes("ชื่อกรรมการ"));
    if (!isDirectorTable) continue;
    const names: string[] = [];
    for (const row of t.rows.slice(1)) {
      const name = nullish(row.cells[row.cells.length - 1]);
      if (!name) continue;
      if (/^\d+$/.test(name)) continue;
      names.push(name.replace(/\/$/, "").trim());
    }
    if (names.length) return names;
  }
  return [];
}

/** Reads a ประเภทธุรกิจ / วัตถุประสงค์ pair from the section after `heading`. */
function parseBusinessBlock(html: string, heading: string): DbdBusinessTh | null {
  const idx = html.indexOf(heading);
  if (idx === -1) return null;
  const slice = html.slice(idx, idx + 6000);
  const tables = parseTables(slice);
  const map = labelValueMap(tables);
  let description = readLabel(map, ["ประเภทธุรกิจ"]);
  let objective = readLabel(map, ["วัตถุประสงค์"]);
  if (!description && !objective) {
    const text = strip(slice);
    description = readText(text, ["ประเภทธุรกิจ"], ["วัตถุประสงค์", ...KNOWN_LABELS]);
    objective = readText(text, ["วัตถุประสงค์"], KNOWN_LABELS);
  }
  if (!description && !objective) return null;
  const codeMatch = description?.match(/^(\d{4,6})\s*/);
  return {
    code: codeMatch ? codeMatch[1] : null,
    descriptionTh: description ? description.replace(/^(\d{4,6})\s*/, "").trim() || description : null,
    objectiveTh: objective,
  };
}

export function parseCompanyInfoTh(html: string): DbdCompanyInfoTh {
  const tables = parseTables(html);
  const map = labelValueMap(tables);
  const text = strip(html);

  const get = (labels: string[]) =>
    readLabel(map, labels) ?? readText(text, labels, KNOWN_LABELS);

  const registrationNumber =
    nullish(get(["เลขทะเบียนนิติบุคคล"])?.match(/\d[\d\s-]{10,}/)?.[0]?.replace(/\D/g, "") ?? null) ??
    nullish(text.match(/เลขทะเบียนนิติบุคคล\s*:?\s*(\d{13})/)?.[1] ?? null);

  const legalNameTh =
    nullish(text.match(/ชื่อนิติบุคคล\s*:?\s*([^:]{3,160}?)\s*เลขทะเบียนนิติบุคคล/)?.[1] ?? null) ??
    get(["ชื่อนิติบุคคล"]);

  const dateRaw = get(["วันที่จดทะเบียนจัดตั้ง", "วันที่จดทะเบียน"]);
  const capitalRaw = get(["ทุนจดทะเบียน"]);

  const yearsBlock = get(["ปีที่ส่งงบการเงิน"]) ?? "";
  const yearSet = new Set<number>();
  for (const m of yearsBlock.matchAll(/\b(25\d{2})\b/g)) yearSet.add(Number(m[1]));
  if (yearSet.size === 0) {
    for (const m of text.matchAll(/ปีที่ส่งงบการเงิน[^ก-๙]{0,10}((?:\s*25\d{2}){1,12})/g)) {
      for (const y of m[1].matchAll(/25\d{2}/g)) yearSet.add(Number(y[0]));
    }
  }
  const submissionYearsBe = [...yearSet].sort((a, b) => b - a);

  const website = (() => {
    const v = get(["Website", "เว็บไซต์"]);
    if (!v) return null;
    const m = v.match(/(https?:\/\/\S+|www\.\S+|[\w-]+\.[a-z]{2,}(?:\/\S*)?)/i);
    return m ? m[1] : null;
  })();

  return {
    legalNameTh,
    registrationNumber,
    legalEntityTypeTh: get(["ประเภทนิติบุคคล"]),
    legalEntityStatusTh: get(["สถานะนิติบุคคล"]),
    registrationDateThRaw: dateRaw,
    registrationDate: thaiDateToIso(dateRaw),
    registeredCapitalThRaw: capitalRaw,
    registeredCapitalThb: thaiAmountToNumber(capitalRaw),
    previousRegistrationNumber: get(["เลขทะเบียนเดิม"]),
    businessGroupTh: get(["กลุ่มธุรกิจ"]),
    businessSize: get(["ขนาดธุรกิจ"]),
    headOfficeAddressTh: get(["ที่ตั้งสำนักงานใหญ่"]),
    website,
    authorizedSignatoryTh: get(["กรรมการลงชื่อผูกพัน"]),
    submissionYearsBe,
    directors: parseDirectors(tables),
    registeredBusiness: parseBusinessBlock(html, "ประเภทธุรกิจตอนจดทะเบียน"),
    latestBusiness: (() => {
      const b = parseBusinessBlock(html, "ประเภทธุรกิจที่ส่งงบการเงินปีล่าสุด");
      if (!b) return null;
      return { ...b, financialYearBe: submissionYearsBe[0] ?? null };
    })(),
  };
}

/** True when at least one field carries real data — used to avoid empty writes. */
export function hasAnyCompanyInfo(info: DbdCompanyInfoTh): boolean {
  return (
    Boolean(
      info.legalNameTh ||
        info.registrationNumber ||
        info.legalEntityTypeTh ||
        info.legalEntityStatusTh ||
        info.registrationDateThRaw ||
        info.registeredCapitalThRaw ||
        info.previousRegistrationNumber ||
        info.businessGroupTh ||
        info.businessSize ||
        info.headOfficeAddressTh ||
        info.website ||
        info.authorizedSignatoryTh ||
        info.registeredBusiness ||
        info.latestBusiness,
    ) ||
    info.directors.length > 0 ||
    info.submissionYearsBe.length > 0
  );
}
