/** Public site copy, English and Thai. "\n" = line break in that language, **x** = bold, ==x== = highlighted word. */
export type Lang = "th" | "en";
type C = { en: string; th: string };
const c = (en: string, th: string): C => ({ en, th });

export const NAV = {
  home: c("Home", "หน้าแรก"), sellers: c("For sellers", "ผู้ขาย"), buyers: c("For buyers", "ผู้ซื้อ"), partners: c("For partners", "พาร์ทเนอร์"),
  plans: c("Plans", "ค่าบริการ"), discovery: c("Discovery", "ตัวอย่างหน้าจอ"),
  talk: c("Start a conversation", "เริ่มพูดคุยกับเรา"), langShort: c("EN", "ไทย"), login: c("Log in", "เข้าสู่ระบบ"),
};

export const HERO = {
  chip: c("Thailand’s SME ownership marketplace · for businesses from **THB 250m** in annual revenue", "ตลาดกลางซื้อขายกิจการ SME ไทย · สำหรับกิจการที่มียอดขายตั้งแต่ **250 ล้านบาท**ต่อปี"),
  h1: c("The confidential marketplace for Thai businesses changing hands.", "ตลาดกลางที่เป็นความลับ\nสำหรับกิจการไทย\nที่กำลังจะเปลี่ยนมือ"),
  intro: c("PitchSnack is a neutral Thai marketplace where verified SME owners meet corporate and investor buyers. We make the introduction and score every target against the documented failure predictors before an offer; licensed advisers run the deal, and PitchSnack never holds funds or takes a side.",
    "PitchSnack คือตลาดกลางที่เป็นกลาง ซึ่งเจ้าของกิจการ SME ไทยที่ผ่านการตรวจสอบ ได้พบกับผู้ซื้อระดับองค์กรและนักลงทุน เราทำหน้าที่ชี้ช่องแนะนำ และประเมินกิจการเป้าหมายทุกรายตามปัจจัยที่งานวิจัยระบุว่าทำให้ดีลล้มเหลว ก่อนมีการยื่นข้อเสนอ ธุรกรรมดำเนินการโดยที่ปรึกษาที่มีใบอนุญาต และ PitchSnack ไม่ถือเงินและไม่เข้าข้างฝ่ายใด"),
  own: c("I own a business", "ฉันเป็นเจ้าของกิจการ"), acquire: c("I am looking to acquire", "ฉันต้องการซื้อกิจการ"),
  fine: c("Introducer under sections 845–849 of the Civil and Commercial Code · no custody of funds · no side taken · a 1.25–3.0% completion fee on the seller side, published in advance",
    " ไม่ถือเงิน · ไม่เข้าข้างฝ่ายใด · ค่าธรรมเนียมเมื่อปิดดีล 1.25–3.0% เรียกเก็บจากผู้ขาย และเปิดเผยล่วงหน้า"),
};

export const CONNECT = {
  h2: c("Connecting Sellers and Buyers in One M&A Marketplace", "เชื่อมผู้ขายและผู้ซื้อ ในตลาด M&A แห่งเดียว"),
  intro: c("PitchSnack is a neutral M&A marketplace where verified sellers meet qualified buyers, with privacy, controlled disclosure, and no pressure to transact until both sides are ready.",
    "PitchSnack คือตลาด M&A ที่เป็นกลาง ซึ่งผู้ขายที่ผ่านการตรวจสอบได้พบกับผู้ซื้อที่มีคุณสมบัติ โดยรักษาความเป็นส่วนตัว ควบคุมการเปิดเผยข้อมูลทีละขั้น และไม่มีแรงกดดันให้ต้องทำธุรกรรม จนกว่าทั้งสองฝ่ายจะพร้อม"),
  cards: [
    { kind: "seller", label: c("For Business Owners Looking to Sell", "สำหรับเจ้าของกิจการที่ต้องการขาย"),
      h: c("Find the right buyer or successor without advertising your business.", "หาผู้ซื้อหรือผู้สืบทอดที่ใช่ โดยไม่ต้องประกาศขายกิจการต่อสาธารณะ"),
      ticks: [c("Your identity stays private until you choose to disclose it", "ตัวตนของท่านไม่ถูกเปิดเผย จนกว่าท่านจะเลือกเปิดเอง"),
        c("Sell all, part, or none of the business. You decide", "ขายทั้งหมด ขายบางส่วน หรือไม่ขายเลย ท่านเป็นผู้ตัดสินใจ"),
        c("Start free; the completion fee falls from 3.0% to 1.25% on a paid plan", "เริ่มได้ฟรี ค่าธรรมเนียมเมื่อปิดดีลลดจาก 3.0% เหลือ 1.25% เมื่อเลือกแผนแบบเสียค่าบริการ")], to: "/sellers" },
    { kind: "buyer", label: c("For buyers and investors", "สำหรับผู้ซื้อและนักลงทุน"),
      h: c("Meet the owners who would never list their business publicly.", "พบเจ้าของกิจการที่ไม่มีวันประกาศขายต่อสาธารณะ"),
      ticks: [c("Filed accounts before an introduction, not an owner’s teaser", "เห็นงบการเงินที่ยื่นจริงก่อนการแนะนำ ไม่ใช่เอกสารนำเสนอของเจ้าของ"),
        c("Owners open up because you have been verified too", "เจ้าของกิจการพร้อมเปิดข้อมูล เพราะท่านเองก็ผ่านการตรวจสอบแล้ว"),
        c("Buyers pay a subscription only, never a completion fee", "ฝั่งผู้ซื้อจ่ายเพียงค่าสมาชิก ไม่มีค่าธรรมเนียมเมื่อปิดดีล")], to: "/buyers" },
  ] as const,
  more: c("Find out more", "ดูรายละเอียดเพิ่มเติม"),
};

export const HOW = {
  h2: c("How it works", "ขั้นตอนการทำงาน"),
  intro: c("A clear, step-by-step M&A journey that guides buyers and sellers from first conversation to transaction, with ==privacy== protected at every stage.",
    "เส้นทาง M&A ที่ชัดเจนทีละขั้น นำทางทั้งผู้ซื้อและผู้ขาย ตั้งแต่การพูดคุยครั้งแรกจนถึงการทำธุรกรรม โดยปกป้อง==ความเป็นส่วนตัว==ในทุกขั้นตอน"),
  owner: c("Owner", "เจ้าของกิจการ"), buyers: c("Buyers", "ผู้ซื้อหลายราย"),
  steps: [
    { tip: c("Badges earned: Registry Verified · Identity Verified", "ตราที่ได้รับ: ยืนยันทะเบียนนิติบุคคลแล้ว · ยืนยันตัวตนแล้ว"), t: c("Verify", "ตรวจสอบ"), x: c("We check both seller and buyer against the registry before anyone sees anyone.", "เราตรวจสอบทั้งผู้ขายและผู้ซื้อกับข้อมูลทะเบียน ก่อนที่ทั้งสองฝ่ายจะได้เห็นกัน") },
    { tip: c("Sector must match, plus at least 4 of 5 criteria", "อุตสาหกรรมต้องตรง และอีกอย่างน้อย 4 ใน 5 เกณฑ์"), t: c("Match", "จับคู่"), x: c("Anonymous profiles, matched against written criteria.", "จับคู่โปรไฟล์ที่ไม่ระบุชื่อ ตามเกณฑ์การซื้อที่เป็นลายลักษณ์อักษร") },
    { tip: c("6 checks, for example 5 clear · 1 to review", "ตรวจ 6 ข้อ เช่น ผ่าน 5 ข้อ · ตรวจเพิ่ม 1 ข้อ"), t: c("Screen", "คัดกรอง"), x: c("A six-check screening report from the registry record, before the first meeting.", "รายงานคัดกรอง 6 ข้อจากข้อมูลทะเบียน ก่อนการพบกันครั้งแรก") },
    { tip: c("NDA signed first, then the name is shared, one buyer at a time", "ลงนาม NDA แล้วจึงเปิดชื่อ ทีละผู้ซื้อ"), t: c("Introduce", "แนะนำให้รู้จัก"), x: c("Identity exchanged after an NDA. The data room opens when the owner is ready.", "เปิดเผยตัวตนหลังลงนามสัญญารักษาความลับ (NDA) ห้องข้อมูลเปิดเมื่อเจ้าของพร้อม") },
    { tip: c("Licensed advisers run the deal; PitchSnack holds no funds", "ที่ปรึกษาที่มีใบอนุญาตดูแลดีล PitchSnack ไม่ถือเงิน"), t: c("Transact", "ปิดดีล"), x: c("Licensed advisers negotiate, document and close. We hold no funds.", "ที่ปรึกษาที่มีใบอนุญาตเป็นผู้เจรจา จัดทำเอกสาร และปิดดีล เราไม่ถือเงิน") },
  ],
};

export const BADGES = {
  h2: c("Every badge means one specific check, on a recorded date", "ตราสัญลักษณ์แต่ละตรา หมายถึงการตรวจสอบหนึ่งรายการ ณ วันที่บันทึกไว้"),
  intro: c("None of them is an opinion on whether a business is a good buy or a buyer worth meeting, and none can be bought with a dearer plan.", "ไม่มีตราใดเป็นความเห็นว่ากิจการน่าซื้อหรือผู้ซื้อน่าพบ และไม่มีตราใดได้มาเพียงเพราะเลือกแผนที่แพงกว่า"),
  tiles: [
    { name: "Registry Verified", x: c("Company details match\nthe DBD register", "ข้อมูลบริษัทตรงกับ\nทะเบียน DBD") },
    { name: "Accounts Filed", x: c("Filed accounts\nread by us", "เราอ่านงบการเงิน\nที่ยื่นไว้แล้ว") },
    { name: "Site Visited", x: c("We visited the premises,\non a recorded date", "เราเยี่ยมชมสถานที่จริง\nในวันที่บันทึกไว้") },
    { name: "Licences Current", x: c("Licences sighted\nand in date", "ใบอนุญาตตรวจแล้ว\nและยังไม่หมดอายุ") },
    { name: "Featured", x: c("Paid placement,\nnot a check", "บริการแบบเสียเงิน\nไม่ใช่การตรวจสอบ") },
  ],
  seller: { label: c("Due diligence", "การตรวจสอบสถานะกิจการ"), h: c("What we check on a seller", "สิ่งที่เราตรวจฝั่งผู้ขาย"), rows: [
    [c("Registry Verified", "ยืนยันทะเบียนนิติบุคคลแล้ว"), c("Name, number, directors and capital match the DBD filing", "ชื่อ เลขทะเบียน กรรมการ และทุนจดทะเบียน ตรงกับข้อมูลที่ยื่นต่อกรมพัฒนาธุรกิจการค้า (DBD)")],
    [c("Accounts Filed", "งบการเงินที่ยื่นแล้ว"), c("Three or five years as lodged, read by us", "งบย้อนหลัง 3 หรือ 5 ปีตามที่ยื่นไว้ โดยเราอ่านด้วยตนเอง")],
    [c("Ownership Confirmed", "ยืนยันผู้ถือหุ้นแล้ว"), c("The shareholder list and the authority to sell", "บัญชีรายชื่อผู้ถือหุ้น และอำนาจในการขายกิจการ")],
    [c("Licences Current", "ใบอนุญาตยังไม่หมดอายุ"), c("Factory licence, GMP, HACCP, ISO, sighted and in date", "ใบอนุญาตประกอบกิจการโรงงาน GMP HACCP ISO เราเห็นเอกสารจริงและยังไม่หมดอายุ")],
    [c("Site Visited", "เข้าเยี่ยมชมสถานที่แล้ว"), c("A named person stood in the place, on a recorded date", "เจ้าหน้าที่ที่ระบุชื่อได้ไปตรวจสถานที่จริง และบันทึกวันที่ไว้")],
  ] },
  buyer: { label: c("Buyer verification", "การยืนยันผู้ซื้อ"), h: c("What we check on a buyer", "สิ่งที่เราตรวจฝั่งผู้ซื้อ"), rows: [
    [c("Identity Verified", "ยืนยันตัวตนแล้ว"), c("The entity and the person signing for it, checked against the register", "นิติบุคคลและผู้มีอำนาจลงนาม ตรวจสอบกับทะเบียนแล้ว")],
    [c("Mandate Confirmed", "ยืนยันอำนาจตัดสินใจแล้ว"), c("A named sponsor with authority to transact, and written criteria on file", "มีผู้รับผิดชอบที่ระบุชื่อและมีอำนาจทำธุรกรรม พร้อมเกณฑ์การซื้อเป็นลายลักษณ์อักษร")],
    [c("Funding Evidenced", "ยืนยันแหล่งเงินทุนแล้ว"), c("Evidence of capital sighted. Sellers see a band, never an amount", "เราเห็นหลักฐานเงินทุนแล้ว ผู้ขายเห็นเพียงช่วงวงเงิน ไม่เห็นจำนวนจริง")],
    [c("Historical Investment", "ประวัติการลงทุน"), c("We review the buyer’s historical investments and track record", "เราตรวจสอบประวัติการลงทุนและผลงานที่ผ่านมาของผู้ซื้อ")],
  ] },
};

export const WHY = {
  h2: c("Why now", "ทำไมต้องเป็นตอนนี้"),
  intro: c("Ownership change in Thailand is structural, not one owner’s private problem.", "การเปลี่ยนมือของกิจการไทยเป็นเรื่องเชิงโครงสร้าง ไม่ใช่เรื่องส่วนตัวของเจ้าของคนใดคนหนึ่ง"),
  cards: [
    ["20%", c("of Thais were aged 60 or over in 2024, about 14 million people, up from 6.8% in 1994", "ของคนไทยมีอายุ 60 ปีขึ้นไปในปี 2567 หรือราว 14 ล้านคน เพิ่มขึ้นจาก 6.8% ในปี 2537")],
    ["80%", c("of those still working past 60 run their own business or work in the family’s. Only 16% are employees", "ของผู้สูงอายุที่ยังทำงาน เป็นเจ้าของกิจการหรือทำงานในกิจการครอบครัว มีเพียง 16% ที่เป็นลูกจ้าง")],
    ["50%", c("of Thai deals are sourced through personal networks and relationships. The good businesses are rarely advertised", "ของดีลในไทยมาจากเครือข่ายและความสัมพันธ์ส่วนตัว กิจการที่ดีจึงแทบไม่เคยถูกประกาศขาย")],
    ["237", c("Thai M&A deals announced in 2025, averaging US$24.4m in the final quarter. A mid-market, not a mega-cap one", "ดีล M&A ในไทยที่ประกาศในปี 2568 ขนาดเฉลี่ยของดีลที่เปิดเผยมูลค่าในไตรมาสสุดท้ายอยู่ที่ 24.4 ล้านดอลลาร์สหรัฐ นี่คือตลาดระดับกลาง ไม่ใช่ตลาดดีลขนาดใหญ่")],
  ] as [string, C][],
  sources: c("Sources: JILPT, Aging Population and Employment in Thailand (2025) · KPMG, Doing Deals in Thailand 2025 · KPMG, M&A Trends in Thailand Q4 2025", "แหล่งข้อมูล: JILPT, Aging Population and Employment in Thailand (2025) · KPMG, Doing Deals in Thailand 2025 · KPMG, M&A Trends in Thailand ไตรมาส 4/2025"),
};

export const FIT = {
  h2: c("Who this is built for", "เหมาะกับกิจการแบบไหน"),
  intro: c("Owners of established Thai businesses who want to hand control to someone who will take the business further.", "เจ้าของกิจการไทยที่มั่นคงแล้ว และต้องการส่งต่ออำนาจควบคุมให้ผู้ที่จะพากิจการเติบโตต่อไป"),
  cards: [
    [c("THB 250m+", "250 ล้านบาท+"), c("Annual revenue, as filed", "รายได้ต่อปี ตามงบที่ยื่น"), c("From THB 250m a year: a business with filed accounts, a management layer and customers who do not depend on the owner alone. It is the size at which strategic buyers, private equity and family offices start to look.", "ตั้งแต่ 250 ล้านบาทต่อปีขึ้นไป กิจการที่มีงบการเงินยื่นจริง มีทีมบริหาร และมีลูกค้าที่ไม่ได้พึ่งเจ้าของเพียงคนเดียว ซึ่งเป็นขนาดที่ผู้ซื้อเชิงกลยุทธ์ กองทุน และสำนักงานครอบครัวเริ่มให้ความสนใจ")],
    [c("Majority", "หุ้นข้างมาก"), c("Control changes hands", "ขายหุ้นข้างมาก อำนาจควบคุมเปลี่ยนมือ"), c("You sell 51% to 100%. Many owners keep a minority stake and stay through a handover of one to three years, so the buyer gets continuity and you keep a share of what comes next.", "ท่านขายหุ้น 51% ถึง 100% เจ้าของหลายรายเก็บหุ้นส่วนน้อยไว้และอยู่ช่วยส่งมอบงาน 1–3 ปี ผู้ซื้อได้ความต่อเนื่อง ส่วนท่านยังได้ส่วนแบ่งจากการเติบโตในอนาคต")],
    [c("Growth", "เติบโตต่อ"), c("A buyer who will grow it", "ผู้ซื้อที่จะพากิจการไปต่อ"), c("The business keeps its name, its people and its customers, and gets what the next stage needs: capital, new markets, professional management or a successor. A sale here is a next chapter, not a closing.", "กิจการยังใช้ชื่อเดิม ทีมเดิม ลูกค้าเดิม และได้สิ่งที่ขั้นต่อไปต้องการ ไม่ว่าจะเป็นเงินทุน ตลาดใหม่ ผู้บริหารมืออาชีพ หรือผู้สืบทอด การขายที่นี่คือการเริ่มบทใหม่ ไม่ใช่การปิดกิจการ")],
  ] as [C, C, C][],
  sectorsLabel: c("Typical sectors", "อุตสาหกรรมที่พบบ่อย"),
  sectors: [c("Agricultural processing", "แปรรูปเกษตร"), c("Food and beverage", "อาหารและเครื่องดื่ม"), c("Hotels", "โรงแรมและที่พัก"), c("Restaurant chains and clinics", "เชนร้านอาหารและคลินิก"), c("Medical devices", "เครื่องมือแพทย์"), c("Rubber", "ยางพารา"), c("Automotive parts", "ชิ้นส่วนยานยนต์")],
};

const fee = c("completion fee", "ค่าธรรมเนียมเมื่อปิดดีล");
const below50 = c("Business selling price below THB 50m", "ราคาขายกิจการต่ำกว่า 50 ล้านบาท");
const below200 = c("Business selling price below THB 200m", "ราคาขายกิจการต่ำกว่า 200 ล้านบาท");
const anyValue = c("Business selling price: any value", "ราคาขายกิจการ: ทุกมูลค่า");
const onReq = c("On request", "ตามข้อเสนอ");
export type Plan = { id: string; name: string; badge: C; price: C | string; unit?: C; fee?: string; intent: C; points: C[]; limit: C };
export const PLANS = {
  eyebrow: c("PitchSnack plans", "แผนของ PitchSnack"), h2: c("Price / Plan", "Price / Plan"),
  intro: c("Subscribe for a defined period, then pay a seller-side completion fee only when a transaction completes. Registry verification and anonymity are included in every plan, including the free plan.", "สมัครสมาชิกตามรอบที่กำหนด และผู้ขายจ่ายค่าธรรมเนียมเมื่อปิดดีล เฉพาะเมื่อธุรกรรมเสร็จสมบูรณ์เท่านั้น การตรวจทะเบียนและการไม่เปิดเผยตัวตนมีในทุกแผน รวมถึงแผนฟรี"),
  noteT: c("Simple commercial model", "โครงสร้างค่าบริการที่เรียบง่าย"),
  noteX: c("Subscription gives access and tools. Completion fees apply only on the seller side, and only when a deal closes.", "ค่าสมาชิกให้สิทธิ์เข้าใช้และเครื่องมือ ค่าธรรมเนียมเมื่อปิดดีลเรียกเก็บจากผู้ขายเท่านั้น และเฉพาะเมื่อปิดดีลได้"),
  principles: [
    [c("Registry check included", "มีการตรวจทะเบียนทุกแผน"), c("Every plan includes a basic registry check.", "ทุกแผนมีการตรวจทะเบียนนิติบุคคลขั้นพื้นฐาน")],
    [c("Anonymous by default", "ไม่เปิดเผยตัวตนเป็นค่าเริ่มต้น"), c("Owners remain anonymous until disclosure is approved.", "เจ้าของกิจการไม่เปิดเผยตัวตน จนกว่าจะอนุมัติให้เปิดเผย")],
    [c("No completion fee for buyers", "ผู้ซื้อไม่มีค่าธรรมเนียมเมื่อปิดดีล"), c("The completion fee sits on the seller side.", "ค่าธรรมเนียมเมื่อปิดดีลอยู่ฝั่งผู้ขายเท่านั้น")],
  ] as [C, C][],
  ownersH: c("Owners", "เจ้าของกิจการที่ต้องการขาย (Seller)"),
  ownersLine: c("For business owners exploring, preparing, or actively running a sale process.", "สำหรับเจ้าของกิจการที่กำลังสำรวจ เตรียมตัว หรือดำเนินกระบวนการขายอยู่"),
  fee,
  owners: [
    { id: "entry", name: "Entry", badge: c("Start quietly", "เริ่มอย่างเงียบ ๆ"), price: c("Free", "ฟรี"), fee: "3.0%", intent: c("You are exploring, quietly.", "ท่านกำลังสำรวจตลาดอย่างเงียบ ๆ"),
      points: [c("List a business selling for under THB 50m", "ประกาศขายกิจการมูลค่าต่ำกว่า 50 ล้านบาท"), c("Renews every 6 months", "ต่ออายุทุก 6 เดือน"), c("Receive contact requests", "รับคำขอติดต่อได้"), c("Send no outbound requests", "ส่งคำขอติดต่อเองไม่ได้")], limit: below50 },
    { id: "promo", name: "Promo Professional", badge: c("Promo", "โปรโมชัน"), price: "9,900", unit: c("THB / 3 mo", "บาท / 3 เดือน"), fee: "1.25%", intent: c("A three-month trial of everything in Professional.", "ทดลองใช้ทุกอย่างในแผน Professional นาน 3 เดือน"),
      points: [c("List a business under THB 200m", "ประกาศขายกิจการมูลค่าต่ำกว่า 200 ล้านบาท"), c("Full Professional feature set", "ได้ทุกฟีเจอร์ของแผน Professional"), c("Short fixed trial period", "ระยะทดลองสั้นและมีกำหนดเวลา")], limit: below200 },
    { id: "pro", name: "Professional", badge: c("Most practical", "เหมาะกับคนส่วนใหญ่"), price: "39,000", unit: c("THB / yr", "บาท / ปี"), fee: "1.25%", intent: c("You intend to transact this year.", "ท่านตั้งใจขายกิจการภายในปีนี้"),
      points: [c("List a business under THB 200m", "ประกาศขายกิจการมูลค่าต่ำกว่า 200 ล้านบาท"), c("Teaser and data room", "ทีเซอร์และห้องข้อมูล"), c("20 contact requests a year", "ส่งคำขอติดต่อได้ 20 ครั้งต่อปี")], limit: below200 },
    { id: "exec", name: "Executive", badge: c("Premium Visibility", "การมองเห็นระดับพรีเมียม"), price: onReq, fee: "1.25%", intent: c("You want the process run for you.", "ท่านต้องการให้เราดูแลกระบวนการทั้งหมดให้"),
      points: [c("List a business of any value", "ประกาศขายกิจการได้ทุกมูลค่า"), c("Dedicated manager", "ผู้จัดการดูแลเฉพาะ"), c("Valuation and pitch video", "ประเมินมูลค่าและวิดีโอนำเสนอ"), c("Site visit included", "รวมการเยี่ยมชมสถานที่")], limit: anyValue },
  ] as Plan[],
  buyersH: c("Buyers and investors", "ผู้ซื้อและนักลงทุน (Investor)"),
  buyersLine: c("For strategic buyers, investors, and institutions searching for verified opportunities.", "สำหรับผู้ซื้อเชิงกลยุทธ์ นักลงทุน และสถาบัน ที่มองหาโอกาสที่ผ่านการตรวจสอบแล้ว"),
  buyers: [
    { id: "basic", name: "Basic", badge: c("Explore", "สำรวจตลาด"), price: "19,000", unit: c("THB / 6 mo", "บาท / 6 เดือน"), intent: c("You want to see the market.", "ท่านอยากเห็นภาพรวมตลาดก่อน"),
      points: [c("View businesses selling for under THB 50m", "ดูกิจการที่ราคาขายต่ำกว่า 50 ล้านบาท"), c("Verified search and receive", "ค้นหาและรับคำขอ หลังยืนยันตัวตน"), c("Contact requests bought in bundles", "ซื้อสิทธิ์ส่งคำขอติดต่อเป็นแพ็กเกจ")], limit: below50 },
    { id: "investor", name: "Investor", badge: c("Active buyer", "ผู้ซื้อที่พร้อมลงมือ"), price: "45,000", unit: c("THB / yr", "บาท / ปี"), intent: c("You have criteria and authority to act.", "ท่านมีเกณฑ์การซื้อและอำนาจตัดสินใจ"),
      points: [c("View businesses under THB 200m", "ดูกิจการมูลค่าต่ำกว่า 200 ล้านบาท"), c("Matched shortlists", "รายชื่อกิจการที่จับคู่ให้"), c("Screening reports", "รายงานคัดกรอง"), c("30 requests a year", "คำขอติดต่อ 30 ครั้งต่อปี")], limit: below200 },
    { id: "inst", name: "Institutional", badge: c("Multi-mandate", "หลายเกณฑ์การซื้อ"), price: onReq, intent: c("You buy more than once a year.", "ท่านซื้อกิจการมากกว่าปีละครั้ง"),
      points: [c("View every business, at any value", "ดูกิจการได้ทุกมูลค่า"), c("Several mandates on one account", "หลายเกณฑ์การซื้อในบัญชีเดียว"), c("Multiple users", "ผู้ใช้หลายคน")], limit: anyValue },
  ] as Plan[],
  boxH: c("What stays the same across every plan", "สิ่งที่เหมือนกันในทุกแผน"),
  boxX: c("Registry verification, anonymity, and a clear separation between subscription access and seller-side completion fees.", "การตรวจทะเบียน การไม่เปิดเผยตัวตน และการแยกค่าสมาชิกออกจากค่าธรรมเนียมเมื่อปิดดีลฝั่งผู้ขายอย่างชัดเจน"),
  chipT: c("Transparent by design", "โปร่งใสโดยหลักการ"),
  chipX: c("No buyer completion fee. No hidden success fee in the subscription.", "ผู้ซื้อไม่มีค่าธรรมเนียมเมื่อปิดดีล และไม่มีค่าธรรมเนียมความสำเร็จแฝงในค่าสมาชิก"),
  fine: c("Every completion fee has a THB 350,000 minimum. Prices exclude VAT; all figures are proposals.", "ค่าธรรมเนียมเมื่อปิดดีลมีขั้นต่ำ 350,000 บาททุกแผน ราคายังไม่รวมภาษีมูลค่าเพิ่ม ตัวเลขทั้งหมดเป็นข้อเสนอ"),
  link: c("All plans and the fee table →", "ดูแผนทั้งหมดและตารางค่าธรรมเนียม →"),
};

export const ROLE = {
  h2: c("Independent, Transparent, and Non-Advisory", "บทบาทของเรา"),
  intro: c("PitchSnack is a marketplace that stays neutral by negotiating for neither side, holding nobody’s money, and stating its own fee in advance.", "PitchSnack เป็นตลาดกลางที่วางตัวเป็นกลาง โดยไม่เจรจาแทนฝ่ายใด ไม่ถือเงินของฝ่ายใด และเปิดเผยค่าธรรมเนียมของตนไว้ล่วงหน้า"),
  cards: [
    [c("An introducer, not a broker or adviser", "ชี้ช่อง ไม่ใช่นายหน้าหรือที่ปรึกษา"), c("We verify, match and introduce. Negotiation, valuation and documents are the work of licensed advisers, engaged by you directly.", "เราตรวจสอบ จับคู่ และแนะนำ ส่วนการเจรจา การประเมินมูลค่า และเอกสาร เป็นงานของที่ปรึกษาที่มีใบอนุญาต ซึ่งท่านว่าจ้างโดยตรง")],
    [c("No custody of funds", "ไม่ถือเงินของฝ่ายใด"), c("Deposits and consideration never pass through us. We are not a party to any transaction, and there is no exclusivity; you can withdraw at any time.", "เงินมัดจำและค่าซื้อขายไม่ผ่านเรา เราไม่ใช่คู่สัญญาในธุรกรรมใด และไม่มีสัญญาผูกขาด ท่านถอนตัวได้ทุกเมื่อ")],
    [c("No side taken", "ไม่เข้าข้างฝ่ายใด"), c("We negotiate for neither side, publish no rating of any seller, and take no share of an adviser’s fee. Our own fee is published in advance on the Plans page.", "เราไม่เจรจาแทนฝ่ายใด ไม่เผยแพร่คะแนนหรือการจัดอันดับผู้ขายรายใด และไม่รับส่วนแบ่งจากค่าบริการของที่ปรึกษา ค่าธรรมเนียมของเราเปิดเผยไว้ล่วงหน้าบนหน้าค่าบริการ")],
  ] as [C, C][],
};

export const FAQ = {
  h2: c("Questions we are asked", "คำถามที่ถามบ่อย"),
  items: [
    [c("Is PitchSnack a broker or an adviser?", "PitchSnack เป็นนายหน้าหรือที่ปรึกษาหรือไม่"), c("Neither. We act as an introducer: we verify, match and introduce. Negotiation, valuation and the contract are the work of licensed advisers, whom you choose and engage yourself.", "ไม่ใช่ทั้งสองอย่าง เราทำหน้าที่ชี้ช่อง คือตรวจสอบ จับคู่ และแนะนำ ส่วนการเจรจา การประเมินมูลค่า และการจัดทำสัญญา เป็นงานของที่ปรึกษาที่มีใบอนุญาต ซึ่งท่านเลือกและว่าจ้างเอง")],
    [c("Who sees my company’s name?", "ใครจะเห็นชื่อกิจการของฉัน"), c("Nobody, until you approve that buyer and both sides have signed an NDA. Before that a buyer sees only an anonymous profile, with the badges that say what we have already checked.", "ไม่มีใคร จนกว่าท่านจะอนุมัติผู้ซื้อรายนั้นและทั้งสองฝ่ายลงนามสัญญารักษาความลับ (NDA) แล้ว ก่อนหน้านั้นผู้ซื้อเห็นเพียงโปรไฟล์ไม่ระบุชื่อ พร้อมตราสัญลักษณ์ที่บอกว่าเราตรวจอะไรไปแล้วบ้าง")],
    [c("How do you charge?", "คิดค่าบริการอย่างไร"), c("A subscription for the plan you choose, free, three-monthly or annual, plus a completion fee from the seller as a percentage of the transaction value: 3.0% on the free plan and 1.25% on a paid plan, minimum THB 350,000. The plan also sets the size of business: an Entry seller lists a business selling for under THB 50m, Professional under THB 200m, Executive any value; a Basic buyer views only businesses under THB 50m, Investor under THB 200m, Institutional everything. Buyers pay a subscription only. All figures are proposals until the pilot ends.", "ค่าสมาชิกตามแผนที่เลือก ฟรี ราย 3 เดือน หรือรายปี และผู้ขายจ่ายค่าธรรมเนียมเมื่อปิดดีลเป็นเปอร์เซ็นต์ของมูลค่าธุรกรรม 3.0% ในแผนฟรี และ 1.25% ในแผนแบบชำระเงิน ขั้นต่ำ 350,000 บาท แผนยังกำหนดขนาดกิจการ ผู้ขาย Entry ประกาศขายกิจการมูลค่าต่ำกว่า 50 ล้านบาท Professional ต่ำกว่า 200 ล้านบาท Executive ทุกมูลค่า ส่วนผู้ซื้อ Basic ดูได้เฉพาะกิจการต่ำกว่า 50 ล้านบาท Investor ต่ำกว่า 200 ล้านบาท Institutional ทุกขนาด ฝั่งผู้ซื้อจ่ายเพียงค่าสมาชิก ตัวเลขทั้งหมดเป็นข้อเสนอจนกว่าโครงการนำร่องจะสิ้นสุด")],
    [c("Do I have to sell everything?", "ฉันต้องขายทั้งหมดหรือไม่"), c("No. Partial sales and staged handovers are common in Thai processing industries; many owners keep a stake and stay on. You say from the start which structures you would consider, and you can change your mind at any time.", "ไม่ การขายบางส่วนและการส่งต่อแบบเป็นขั้นตอนเป็นเรื่องปกติในอุตสาหกรรมแปรรูปของไทย เจ้าของจำนวนมากเก็บหุ้นส่วนหนึ่งไว้และยังบริหารต่อ ท่านระบุได้ตั้งแต่ต้นว่าเปิดรับโครงสร้างแบบใด และเปลี่ยนใจได้ตลอด")],
  ] as [C, C][],
};

export const CLOSE = {
  h2: c("Book a free 30-minute consultation. No commitment required.", "นัดปรึกษาฟรี 30 นาที\nไม่มีข้อผูกมัด"),
  x: c("Tell us what you are looking to buy or sell, and our experienced team will help you clarify your target, assess your options, and define the next practical step.", "บอกเราว่าท่านกำลังมองหากิจการเพื่อซื้อหรือขาย แล้วทีมงานที่มีประสบการณ์ของเราจะช่วยท่านกำหนดเป้าหมายให้ชัดเจน ประเมินทางเลือก และวางขั้นตอนถัดไปที่ทำได้จริง"),
};

export const FOOTER = {
  legal: c("PitchSnack acts as an introducer under sections 845–849 of the Civil and Commercial Code. We are not a party to any transaction, hold no funds and take no side. Where we describe something as verified, we mean only the check described for that badge, on the date shown. It is not an endorsement, not a solvency assessment, and not a substitute for your own due diligence. Screening reports are decision support, not legal, financial or investment advice.",
    "PitchSnack ทำหน้าที่ชี้ช่องตามประมวลกฎหมายแพ่งและพาณิชย์ มาตรา 845–849 ไม่ใช่คู่สัญญาในธุรกรรมใด ไม่ถือเงินของฝ่ายใด และไม่เข้าข้างฝ่ายใด การที่เราระบุว่าข้อมูลใด “ผ่านการตรวจสอบ” หมายถึงการตรวจตามที่อธิบายไว้สำหรับตราสัญลักษณ์นั้นในวันที่ระบุเท่านั้น ไม่ใช่การรับรอง ไม่ใช่การประเมินฐานะทางการเงิน และไม่ใช่สิ่งทดแทนการตรวจสอบสถานะกิจการของท่านเอง รายงานคัดกรองเป็นข้อมูลสนับสนุนการตัดสินใจ ไม่ใช่คำแนะนำทางกฎหมาย การเงิน หรือการลงทุน"),
  links: [
    ["/sellers", c("For sellers", "สำหรับผู้ขาย")], ["/buyers", c("For buyers", "สำหรับผู้ซื้อ")], ["/partners", c("For partners", "สำหรับพาร์ทเนอร์")],
    ["/plans", c("Plans", "ค่าบริการ")], ["/badges", c("Badge library", "คลังตราสัญลักษณ์")], ["/directory", c("Directory", "ทำเนียบธุรกิจ")],
  ] as [string, C][],
};

export const SOON: Record<string, { title: C; nav: keyof typeof NAV | null }> = {
  "/sellers": { title: c("For sellers", "สำหรับผู้ขาย"), nav: "sellers" },
  "/buyers": { title: c("For buyers", "สำหรับผู้ซื้อ"), nav: "buyers" },
  "/partners": { title: c("For partners", "สำหรับพาร์ทเนอร์"), nav: "partners" },
  "/plans": { title: c("Plans", "ค่าบริการ"), nav: "plans" },
  "/discovery": { title: c("Discovery", "ตัวอย่างหน้าจอ"), nav: "discovery" },
  "/badges": { title: c("Badge library", "คลังตราสัญลักษณ์"), nav: null },
  "/directory": { title: c("Directory", "ทำเนียบธุรกิจ"), nav: null },
};
export const SOON_TEXT = { x: c("This page is coming soon.", "หน้านี้กำลังจะเปิดให้บริการเร็ว ๆ นี้"), back: c("← Back to the homepage", "← กลับไปหน้าแรก") };
