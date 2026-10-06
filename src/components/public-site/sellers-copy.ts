/** Bilingual copy for the public For sellers page (/sellers). */
type C = { en: string; th: string };
const c = (en: string, th: string): C => ({ en, th });

export const S_HERO = {
  chip: c("For Business Owners Looking to Sell · no exclusivity · **withdraw at any time**", "สำหรับเจ้าของกิจการที่ต้องการขาย · ไม่มีสัญญาผูกขาด · **ถอนตัวได้ทุกเมื่อ**"),
  h1: c("Sell on your terms. Private until you choose otherwise.", "ขายกิจการตามเงื่อนไขของท่าน\nเป็นความลับ\nจนกว่าท่านจะเลือกเปิดเผย"),
  intro: c("Verified buyers see an anonymous profile, and you approve each one before your name is shared. No exclusivity, nothing owed if you do not sell, and your verified financials and valuation cost a one-time fee in the tens of thousands of baht, not an adviser’s retainer.", "ผู้ซื้อที่ผ่านการตรวจสอบเห็นเพียงโปรไฟล์ไม่ระบุชื่อ ท่านเป็นผู้อนุมัติทุกรายก่อนเปิดเผยชื่อ ไม่มีสัญญาผูกขาด ไม่มีค่าใช้จ่ายหากไม่ได้ขาย และรายงานการเงินกับการประเมินมูลค่ามีราคาเพียงหลักหมื่นบาท"),
  red: c("List your business free", "ลงประกาศฟรี"),
  outline: c("See the owner plans", "ดูแผนสำหรับเจ้าของกิจการ"),
};

export const S_PROMISES = {
  h2: c("Four promises to every Business owner", "สี่คำมั่นต่อเจ้าของกิจการ"),
  intro: c("On every plan, including the free one.", "ทุกแผน รวมถึงแผนฟรี"),
  cards: [
    { img: "/images/promises/promise-eye-padlock.webp", h: c("Private by default", "ไม่เปิดเผยตัวตนเป็นค่าเริ่มต้น"), x: c("Buyers see a code name, a sector and a revenue range. Never your name, address or exact figures.", "ผู้ซื้อเห็นชื่อโครงการ อุตสาหกรรม และช่วงรายได้ ไม่เห็นชื่อ ที่อยู่ หรือตัวเลขจริง") },
    { img: "/images/promises/promise-nda-shield.webp", h: c("Confidential at every step", "เป็นความลับทุกขั้นตอน"), x: c("Every buyer is verified and signs an NDA before your name is shared.", "ผู้ซื้อทุกรายผ่านการตรวจสอบ และต้องลงนาม NDA ก่อนได้เห็นชื่อกิจการ") },
    { img: "/images/promises/promise-road.webp", h: c("No lock-in", "ไม่มีสัญญาผูกขาด"), x: c("No exclusivity and no minimum term. Withdraw your listing or stop a conversation at any time, with nothing owed.", "ไม่มีระยะผูกมัด ถอนประกาศหรือหยุดการพูดคุยได้ทุกเมื่อ โดยไม่มีค่าใช้จ่าย") },
    { img: "/images/promises/promise-charts.webp", h: c("Low-cost financials and valuation", "ข้อมูลการเงินและมูลค่าราคาประหยัด"), x: c("A verified financial report for ฿10,000 and an estimated valuation for ฿15,000, one-time.", "รายงานการเงินที่ตรวจแล้ว ฿10,000 และการประเมินมูลค่า ฿15,000 ชำระครั้งเดียว") },
  ],
};

export const S_PRIVACY = {
  eyebrow: c("Privacy and confidentiality", "ความเป็นส่วนตัวและความลับ"),
  h2: c("You decide who knows, and when", "ท่านเป็นผู้เลือกว่าใครจะได้รู้ และรู้เมื่อไร"),
  intro: c("Your business customers, company’s employees and your competitors never see that the business is for sale. Your business remains confidential and every step needs your approval.", "ลูกค้าของกิจการ พนักงานของบริษัท และคู่แข่งของท่านจะไม่เห็นว่ากิจการกำลังมองหาผู้ซื้อ กิจการของท่านยังคงเป็นความลับ และทุกขั้นตอนต้องได้รับการอนุมัติจากท่าน"),
  ticks: [
    c("No name, logo or photo of your premises on the listing", "ไม่มีชื่อ โลโก้ หรือรูปสถานที่จริงบนประกาศ"),
    c("Every buyer is identity-checked against the register", "ผู้ซื้อทุกรายผ่านการยืนยันตัวตนกับทะเบียน"),
    c("Reports are never sent automatically; you share them buyer by buyer", "รายงานการเงินไม่ถูกส่งอัตโนมัติ ท่านแชร์ให้ผู้ซื้อเป็นรายๆ"),
    c("Revoke access at any time", "ยกเลิกการแชร์ได้ทุกเมื่อ"),
  ],
  steps: [
    [c("Anonymous profile", "โปรไฟล์ไม่ระบุชื่อ"), c("Code name, sector, region and a revenue range", "ชื่อโครงการ อุตสาหกรรม ภูมิภาค และช่วงรายได้")],
    [c("A buyer asks, you approve", "ผู้ซื้อขอติดต่อ ท่านอนุมัติ"), c("You see the verified buyer profile before you decide", "ท่านเห็นโปรไฟล์ผู้ซื้อที่ตรวจแล้ว ก่อนตัดสินใจ")],
    [c("NDA signed, name shared", "ลงนาม NDA แล้วจึงเปิดชื่อ"), c("Your name and contacts open to that buyer only", "ชื่อกิจการและผู้ติดต่อเปิดให้เฉพาะผู้ซื้อรายนั้น")],
    [c("Data room when you are ready", "ห้องข้อมูลเปิดเมื่อท่านพร้อม"), c("Financial report and valuation, shared one buyer at a time", "รายงานการเงินและการประเมินมูลค่า แชร์ทีละราย")],
  ] as [C, C][],
};

export const S_LOCK = {
  h2: c("No lock-in. Withdraw at any time.", "ไม่มีสัญญาผูกขาด ถอนตัวได้ทุกเมื่อ"),
  intro: c("Selling your business should be your decision, not a contract’s.", "การขายกิจการควรเป็นการตัดสินใจของท่าน ไม่ใช่ของสัญญา"),
  cards: [
    [c("0", "0"), c("Exclusivity", "สัญญาผูกขาด"), c("Keep talking to advisers or buyers outside PitchSnack as you like.", "ท่านพูดคุยกับที่ปรึกษาหรือผู้ซื้อรายอื่นนอก PitchSnack ได้ตามปกติ")],
    [c("Any time", "ทุกเมื่อ"), c("To withdraw", "ถอนประกาศ"), c("Hide or withdraw the listing whenever you like. Buyers stop seeing it.", "ซ่อนหรือถอนประกาศได้ตลอด ผู้ซื้อจะไม่เห็นประกาศอีก")],
    [c("฿0", "฿0"), c("If you do not sell", "หากไม่ได้ขาย"), c("The completion fee is charged only when a transaction completes.", "ค่าธรรมเนียมเมื่อปิดดีลเรียกเก็บเฉพาะเมื่อธุรกรรมเสร็จสมบูรณ์เท่านั้น")],
  ] as [C, C, C][],
};

const once = c("one-time", "ครั้งเดียว");
export const S_REPORTS = {
  eyebrow: c("Financials and valuation", "รายงานการเงินและการประเมินมูลค่า"),
  h2: c("Know your numbers without hiring an adviser on day one", "รู้มูลค่ากิจการ โดยไม่ต้องจ้างที่ปรึกษาตั้งแต่วันแรก"),
  intro: c("PitchSnack analysts build the reports from your DBD filings. Nothing to upload, one-time fees, no retainer.", "นักวิเคราะห์ของ PitchSnack จัดทำรายงานจากงบที่ยื่นกับ DBD ท่านไม่ต้องอัปโหลดอะไร ชำระครั้งเดียว ไม่มีค่ารายเดือน"),
  note: c("Both reports together ฿22,000 · listings with the “Verified financials” badge appear first when buyers filter", "ซื้อทั้งสองรายงาน ฿22,000 · ประกาศที่มีตรา “Verified financials” แสดงก่อนรายการอื่นเมื่อผู้ซื้อกรอง"),
  cards: [
    { kind: "report", tag: c("Recommended", "แนะนำ"), fig: "฿10,000", unit: once, h: c("Verified financial report", "รายงานการเงินที่ตรวจแล้ว"), line: c("Income statement and balance sheet FY2021–2025, with 15 financial ratios.", "งบกำไรขาดทุนและงบดุลปี 2021–2025 พร้อมอัตราส่วนทางการเงิน 15 ตัว"),
      points: [c("“Verified financials” badge on your listing", "ตรา “Verified financials” บนประกาศ"), c("Ready within 2 business days", "ได้รับภายใน 2 วันทำการ"), c("Refunded if your DBD filings cannot be read", "คืนเงินหากอ่านงบ DBD ไม่ได้")] },
    { kind: "val", tag: c("Optional", "ทางเลือก"), fig: "฿15,000", unit: once, h: c("Estimated valuation", "การประเมินมูลค่ากิจการ"), line: c("An independent value range from comparable deals and EV/EBITDA multiples.", "ช่วงมูลค่าอิสระจากดีลเทียบเคียง และตัวคูณ EV/EBITDA"),
      points: [c("“Independent valuation” badge on your listing", "ตรา “Independent valuation” บนประกาศ"), c("Set your asking price with confidence", "ช่วยตั้งราคาขายอย่างมั่นใจ"), c("Ordered after the financial report", "สั่งได้หลังได้รับรายงานการเงิน")] },
  ],
};

export const S_BUYERS = {
  h2: c("Many buyers, matched to your business", "ผู้ซื้อหลายราย ที่ตรงกับกิจการของท่าน"),
  intro: c("One listing reaches verified strategic buyers, private equity and family offices.", "ประกาศเดียว เข้าถึงผู้ซื้อเชิงกลยุทธ์ กองทุน และสำนักงานครอบครัวที่ผ่านการตรวจสอบ"),
  cards: [
    [c("Strategic corporates", "ผู้ซื้อเชิงกลยุทธ์"), c("Companies in your sector or next to it, looking for capacity or new markets.", "บริษัทในอุตสาหกรรมเดียวกันหรือใกล้เคียง ที่ต้องการขยายกำลังการผลิตหรือตลาด")],
    [c("Private equity", "กองทุนไพรเวทอิควิตี้"), c("Funds with a written mandate, ticket size and authority to act.", "กองทุนที่มีเกณฑ์ขนาดดีลและอำนาจตัดสินใจชัดเจน")],
    [c("Family offices and investors", "สำนักงานครอบครัวและนักลงทุน"), c("Long-term owners who often keep the founder on through a handover.", "ผู้ลงทุนระยะยาวที่มักให้เจ้าของเดิมอยู่ช่วยส่งต่อ")],
  ] as [C, C][],
  panel: c("How matching works", "การจับคู่ทำงานอย่างไร"),
  rows: [
    [c("Matched on written criteria", "จับคู่ตามเกณฑ์ที่เขียนไว้"), c("Sector must match, plus at least 4 of 5 criteria such as revenue size, region and deal type.", "อุตสาหกรรมต้องตรง และอีกอย่างน้อย 4 ใน 5 เกณฑ์ เช่น ขนาดรายได้ ภูมิภาค และรูปแบบดีล")],
    [c("Alerted when a buyer fits", "แจ้งเตือนเมื่อมีผู้ซื้อตรงเกณฑ์"), c("You get an email when a new buyer fits your business, using code names only.", "ท่านได้รับอีเมลเมื่อมีผู้ซื้อรายใหม่ตรงกับกิจการ โดยใช้ชื่อโครงการเท่านั้น")],
    [c("Compare several buyers at once", "เปรียบเทียบผู้ซื้อหลายรายพร้อมกัน"), c("Talk to several buyers in parallel, and choose the one that fits best.", "พูดคุยกับผู้ซื้อหลายรายคู่ขนาน และเลือกรายที่เหมาะที่สุด")],
  ] as [C, C][],
};

export const S_PLANS = { h: c("Business owner looking to sell", "เจ้าของกิจการที่ต้องการขาย (Seller)") };

export const S_FAQ = {
  h2: c("Questions Business owners ask", "คำถามจากเจ้าของกิจการ"),
  items: [
    [c("Will my staff or customers find out?", "พนักงานหรือลูกค้าของฉันจะรู้หรือไม่"), c("No. The listing carries no name, logo or photo of your premises, and a buyer must be verified and sign an NDA before your name is shared.", "ไม่ ประกาศไม่มีชื่อ โลโก้ หรือรูปสถานที่จริง และผู้ซื้อต้องผ่านการตรวจสอบและลงนาม NDA ก่อนได้เห็นชื่อกิจการ")],
    [c("What does NDA mean?", "NDA คืออะไร"), c("NDA stands for Non-Disclosure Agreement. It is a contract in which the buyer agrees to keep your business information confidential and to use it only to consider the purchase. On PitchSnack, every buyer signs an NDA before they see your business name, contacts or financial reports.", "NDA ย่อมาจาก Non-Disclosure Agreement หรือสัญญาไม่เปิดเผยข้อมูล เป็นสัญญาที่ผู้ซื้อตกลงว่าจะเก็บข้อมูลกิจการของท่านเป็นความลับ และใช้เพื่อพิจารณาการซื้อเท่านั้น บน PitchSnack ผู้ซื้อทุกรายต้องลงนาม NDA ก่อนได้เห็นชื่อกิจการ ข้อมูลติดต่อ และรายงานการเงินของท่าน")],
    [c("Can I withdraw if I change my mind?", "ถ้าเปลี่ยนใจ ฉันถอนตัวได้หรือไม่"), c("Yes, at any time. There is no exclusivity and no minimum term; hide or withdraw the listing whenever you like, with nothing owed if you do not sell.", "ได้ทุกเมื่อ ไม่มีสัญญาผูกขาดและไม่มีระยะผูกมัด ท่านซ่อนหรือถอนประกาศได้ตลอด และไม่มีค่าใช้จ่ายหากไม่ได้ขาย")],
    [c("Do I need the financial report before I list?", "ต้องสั่งรายงานการเงินก่อนลงประกาศหรือไม่"), c("No, it is optional. Listings with the Verified financials badge are shown first when buyers filter, and buyers decide faster.", "ไม่จำเป็น รายงานเป็นทางเลือก แต่ประกาศที่มีตรา Verified financials จะแสดงก่อนเมื่อผู้ซื้อกรอง และผู้ซื้อตัดสินใจได้เร็วขึ้น")],
    [c("How much is my business worth after building it for 50 years?", "กิจการที่ฉันสร้างมา 50 ปี มีมูลค่าเท่าไร"), c("Fifty years of history, loyal customers and a trusted name all add value, but buyers mainly pay for future profit and cash flow, and for how well the business runs without you. For a figure, order the Estimated valuation (฿15,000, one-time): an independent value range from comparable deals and EV/EBITDA multiples. It follows the Verified financial report (฿10,000), or get both for ฿22,000.", "ประวัติ 50 ปี ลูกค้าที่ภักดี และชื่อเสียงที่น่าเชื่อถือช่วยเพิ่มมูลค่า แต่ผู้ซื้อจ่ายเงินเพื่อกำไรและกระแสเงินสดในอนาคตเป็นหลัก และดูว่ากิจการดำเนินต่อได้ดีเพียงใดเมื่อไม่มีท่าน หากต้องการตัวเลข สั่งการประเมินมูลค่ากิจการ (฿15,000 ชำระครั้งเดียว) ซึ่งให้ช่วงมูลค่าอิสระจากดีลเทียบเคียง และตัวคูณ EV/EBITDA สั่งได้หลังได้รับรายงานการเงินที่ตรวจแล้ว (฿10,000) หรือซื้อทั้งสองรายงาน ฿22,000")],
    [c("How many buyers will I meet?", "ฉันจะได้พบผู้ซื้อกี่ราย"), c("It depends on your business and on buyers’ criteria. Every buyer who fits sees your anonymous profile, and you choose whom to talk to.", "ขึ้นอยู่กับกิจการและเกณฑ์ของผู้ซื้อ ทุกรายที่ตรงเกณฑ์จะเห็นโปรไฟล์ไม่ระบุชื่อของท่าน และท่านเลือกเองว่าจะคุยกับใคร")],
  ] as [C, C][],
};

export const S_CLOSE = {
  h2: c("Start quietly. List free, with nothing to sign away.", "เริ่มต้นอย่างเงียบๆ\nลงประกาศฟรี ไม่มีข้อผูกมัด"),
  x: c("Create an anonymous profile in minutes. You approve every buyer, and you can withdraw at any time.", "สร้างโปรไฟล์ไม่ระบุชื่อในไม่กี่นาที ท่านอนุมัติผู้ซื้อทุกราย และถอนตัวได้ทุกเมื่อ"),
  red: c("List your business free", "ลงประกาศฟรี"),
  outline: c("Talk to us first", "พูดคุยกับเราก่อน"),
};
