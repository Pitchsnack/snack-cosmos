/**
 * Pure parsing helpers shared by the DBD test scraper and its unit tests.
 *
 * Nothing here performs I/O, so the parser can be tested against saved
 * fixtures instead of repeatedly hitting the live DBD website.
 */

/** Parses a DBD table cell into a number. Missing data must stay `null`. */
export function parseDbdNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = String(raw)
    .replace(/\u00a0/g, " ")
    .trim();
  if (!s) return null;
  // dash / em dash / n-dash / "N/A" style placeholders mean "no value"
  if (/^[-–—]+$/.test(s) || /^(n\/?a|na|ไม่มีข้อมูล)$/i.test(s)) return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1).trim();
  }
  s = s.replace(/,/g, "").replace(/\s/g, "");
  if (!s || !/^\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Units DBD may print above a statement table. */
export type DbdUnit = "baht" | "thousand_baht" | "million_baht";

export function detectDbdUnit(text: string | null | undefined): DbdUnit | null {
  if (!text) return null;
  if (/ล้านบาท|million\s*baht/i.test(text)) return "million_baht";
  if (/พันบาท|thousand\s*baht/i.test(text)) return "thousand_baht";
  if (/บาท|baht/i.test(text)) return "baht";
  return null;
}

/** Explicit, tested unit normalisation to plain Baht. */
export function toBaht(value: number, unit: DbdUnit | null): number {
  switch (unit) {
    case "thousand_baht":
      return value * 1_000;
    case "million_baht":
      return value * 1_000_000;
    default:
      return value;
  }
}

export function normalizeRegisteredNumber(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = String(v).replace(/[\s-]/g, "").trim();
  return s || null;
}

export function normalizeRegisteredName(v: string | null | undefined): string {
  return String(v ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en");
}

export function parseFiscalYear(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = String(raw).match(/(\d{4})/);
  if (!m) return null;
  let year = Number(m[1]);
  // DBD prints Buddhist-era years (พ.ศ.) — convert when clearly BE.
  if (year > 2400) year -= 543;
  return year >= 1900 && year <= 2999 ? year : null;
}

/**
 * Central DBD row-label → SnackPortal2 item-code mapping.
 *
 * Labels are only added here once they have been observed on the rendered DBD
 * page. Unknown labels are reported as warnings rather than guessed.
 */
export const DBD_LABEL_MAP: Record<string, { group: "income" | "position"; code: string }> = {
  // ---- Income statement -------------------------------------------------
  "รายได้จากการขายและบริการ": { group: "income", code: "revenue_sales_services" },
  "รายได้รวม": { group: "income", code: "total_revenue" },
  "ต้นทุนขาย": { group: "income", code: "cost_of_goods_sold" },
  "กำไรขั้นต้น": { group: "income", code: "gross_profit_loss" },
  "ค่าใช้จ่ายในการขายและบริหาร": { group: "income", code: "selling_admin_expenses" },
  "รวมค่าใช้จ่าย": { group: "income", code: "total_expenses" },
  "ดอกเบี้ยจ่าย": { group: "income", code: "interest_expenses" },
  "กำไร (ขาดทุน) ก่อนภาษี": { group: "income", code: "profit_loss_before_income_tax" },
  "ภาษีเงินได้": { group: "income", code: "income_tax_expense" },
  "กำไรสุทธิ": { group: "income", code: "net_profit_loss" },
  "กำไร (ขาดทุน) สุทธิ": { group: "income", code: "net_profit_loss" },
  // ---- Financial position ------------------------------------------------
  "ลูกหนี้การค้าสุทธิ": { group: "position", code: "accounts_receivable" },
  "สินค้าคงเหลือ": { group: "position", code: "inventories" },
  "รวมสินทรัพย์หมุนเวียน": { group: "position", code: "total_current_assets" },
  "ที่ดิน อาคารและอุปกรณ์": { group: "position", code: "property_plant_equipment" },
  "รวมสินทรัพย์ไม่หมุนเวียน": { group: "position", code: "total_non_current_assets" },
  "สินทรัพย์รวม": { group: "position", code: "total_assets" },
  "รวมหนี้สินหมุนเวียน": { group: "position", code: "total_current_liabilities" },
  "รวมหนี้สินไม่หมุนเวียน": { group: "position", code: "total_non_current_liabilities" },
  "หนี้สินรวม": { group: "position", code: "total_liabilities" },
  "ส่วนของผู้ถือหุ้น": { group: "position", code: "equity" },
  "รวมหนี้สินและส่วนของผู้ถือหุ้น": { group: "position", code: "total_liabilities_equity" },
};

export function mapDbdLabel(label: string) {
  const key = String(label ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return DBD_LABEL_MAP[key] ?? null;
}
