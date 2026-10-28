/** Buyer revenue bands (yearly, THB millions) — browser-safe, shared by the form and Admin review. */
export const REVENUE_BANDS: [string, string, number, number][] = [
  ["rv_lt100", "Below ฿100M", 0, 100],
  ["rv_100_300", "฿100M – 300M", 100, 300],
  ["rv_300_800", "฿300M – 800M", 300, 800],
  ["rv_800_1500", "฿800M – 1.5B", 800, 1500],
  ["rv_1500", "฿1.5B and above", 1500, Number.MAX_SAFE_INTEGER],
];

export const REVENUE_BAND_TH: Record<string, string> = {
  rv_lt100: "ต่ำกว่า ฿100 ล้าน",
  rv_100_300: "฿100 – 300 ล้าน",
  rv_300_800: "฿300 – 800 ล้าน",
  rv_800_1500: "฿800 ล้าน – 1.5 พันล้าน",
  rv_1500: "฿1.5 พันล้านขึ้นไป",
};

export const revenueBandLabel = (key: string | null | undefined) =>
  REVENUE_BANDS.find((b) => b[0] === key)?.[1] ?? null;
