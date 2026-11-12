import { THAI_PROVINCES_77 } from "@/lib/investor-bands";

/** The register's one-line Thai address, split into the wizards' address fields. Browser-safe. */
export type SplitAddr = { street: string; unit: string; district: string; province: string; postal: string };

const TH_PROVINCES = "กรุงเทพมหานคร|อำนาจเจริญ|อ่างทอง|บึงกาฬ|บุรีรัมย์|ฉะเชิงเทรา|ชัยนาท|ชัยภูมิ|จันทบุรี|เชียงใหม่|เชียงราย|ชลบุรี|ชุมพร|กาฬสินธุ์|กำแพงเพชร|กาญจนบุรี|ขอนแก่น|กระบี่|ลำปาง|ลำพูน|เลย|ลพบุรี|แม่ฮ่องสอน|มหาสารคาม|มุกดาหาร|นครนายก|นครปฐม|นครพนม|นครราชสีมา|นครสวรรค์|นครศรีธรรมราช|น่าน|นราธิวาส|หนองบัวลำภู|หนองคาย|นนทบุรี|ปทุมธานี|ปัตตานี|พังงา|พัทลุง|พะเยา|เพชรบูรณ์|เพชรบุรี|พิจิตร|พิษณุโลก|พระนครศรีอยุธยา|แพร่|ภูเก็ต|ปราจีนบุรี|ประจวบคีรีขันธ์|ระนอง|ราชบุรี|ระยอง|ร้อยเอ็ด|สระแก้ว|สกลนคร|สมุทรปราการ|สมุทรสาคร|สมุทรสงคราม|สระบุรี|สตูล|สิงห์บุรี|ศรีสะเกษ|สงขลา|สุโขทัย|สุพรรณบุรี|สุราษฎร์ธานี|สุรินทร์|ตาก|ตรัง|ตราด|อุบลราชธานี|อุดรธานี|อุทัยธานี|อุตรดิตถ์|ยะลา|ยโสธร".split("|");
const PROV_EN: Record<string, string> = Object.fromEntries(TH_PROVINCES.map((t, i) => [t, THAI_PROVINCES_77[i]!]));

/**
 * Splits e.g. "99/1 หมู่ที่ 3 ถนนสุขุมวิท แขวงคลองตัน เขตคลองเตย กรุงเทพมหานคร 10110".
 * Street keeps house number, moo and road; sub-district goes to the second line; any part not found stays empty.
 */
export function splitThaiAddress(raw: string | null | undefined): SplitAddr {
  const out: SplitAddr = { street: "", unit: "", district: "", province: "", postal: "" };
  let s = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return out;
  const pc = /(\d{5})\s*$/.exec(s);
  if (pc) { out.postal = pc[1]!; s = s.slice(0, pc.index).trim(); }
  // Province: "จังหวัดX", "จ.X" or a bare province name (Bangkok has no prefix).
  const pv = /(?:จังหวัด|จ\.)\s*([^\s]+)\s*$/.exec(s);
  if (pv && PROV_EN[pv[1]!]) { out.province = PROV_EN[pv[1]!]!; s = s.slice(0, pv.index).trim(); }
  else {
    const name = TH_PROVINCES.find((p) => s.endsWith(p));
    if (name) { out.province = PROV_EN[name]!; s = s.slice(0, s.length - name.length).trim(); }
    else if (/(?:กรุงเทพฯ|กทม\.?)\s*$/.test(s)) { out.province = "Bangkok"; s = s.replace(/(?:กรุงเทพฯ|กทม\.?)\s*$/, "").trim(); }
  }
  const dt = /(?:เขต|อำเภอ|อ\.)\s*([^\s]+)\s*$/.exec(s);
  if (dt) { out.district = dt[1]!; s = s.slice(0, dt.index).trim(); }
  const sd = /(?:แขวง|ตำบล|ต\.)\s*([^\s]+)\s*$/.exec(s);
  if (sd) { out.unit = `${/^(?:แขวง)/.test(sd[0]) ? "แขวง" : "ตำบล"}${sd[1]}`; s = s.slice(0, sd.index).trim(); }
  out.street = s;
  return out;
}
