/** Bilingual copy for the public For buyers page (/buyers). */
type C = { en: string; th: string };
const c = (en: string, th: string): C => ({ en, th });

export const B_HERO = {
  chip: c("For business buyers and investors · verified sellers · **names unlock after the NDA**", "สำหรับผู้ซื้อกิจการและนักลงทุน · ผู้ขายผ่านการตรวจสอบ · **เปิดชื่อหลังลงนาม NDA**"),
  h1: c("Find a business to buy. See the facts before the names.", "ค้นหากิจการที่จะซื้อ\nเห็นข้อเท็จจริง\nก่อนเห็นชื่อ"),
  intro: c("Browse anonymous teasers from verified sellers, with revenue and EBITDA ranges. Sign one standard NDA, and the full listing opens to you when the seller approves. Until then, sellers see your investor type, not your firm’s name.", "ดูประกาศไม่ระบุชื่อจากผู้ขายที่ผ่านการตรวจสอบ พร้อมช่วงรายได้และ EBITDA ลงนาม NDA มาตรฐานฉบับเดียว แล้วประกาศฉบับเต็มจะเปิดให้ท่านเมื่อผู้ขายอนุมัติ ระหว่างนั้นผู้ขายเห็นเพียงประเภทนักลงทุนของท่าน ไม่เห็นชื่อบริษัท"),
  red: c("Create your investor profile", "สร้างโปรไฟล์นักลงทุน"),
  outline: c("See how it works", "ดูขั้นตอนการทำงาน"),
};

export const B_CARD = {
  chip: c("Identity hidden", "ปิดชื่อกิจการ"),
  tag: c("NEW", "ใหม่"),
  title: c("Established Shrink Film Manufacturer Serving B2B Clients", "ผู้ผลิตฟิล์มหดรายเก่าแก่ ให้บริการลูกค้าธุรกิจ"),
  nda: c("Identity after NDA", "เปิดชื่อหลังลงนาม NDA"),
  rev: c("Revenue FY25", "รายได้ปี 2568"),
  range: c("Range", "ช่วง"),
  details: c("Packaging · operator · Bangkok · 51–200 employees", "บรรจุภัณฑ์ · ผู้ประกอบการ · กรุงเทพฯ · พนักงาน 51–200 คน"),
  desc: c("A shrink film manufacturer based in Central Thailand, operating since the 2010s. The business manufactures shrink film, label film, laminate film and pouch packaging.", "ผู้ผลิตฟิล์มหดในภาคกลางของไทย ดำเนินกิจการมาตั้งแต่ทศวรรษ 2010 ผลิตฟิล์มหด ฟิล์มฉลาก ฟิล์มลามิเนต และบรรจุภัณฑ์แบบถุง"),
  products: c("Products & services", "สินค้าและบริการ"),
  markets: c("Markets", "ตลาด"),
  productChips: ["Shrink Film", "Label Film", "Laminate Film", "Pouch Packaging", "Recycled Plastic"],
  marketChips: [c("B2B", "B2B"), c("Thailand", "ไทย"), c("Southeast Asia", "เอเชียตะวันออกเฉียงใต้")],
  deal: c("Full acquisition · 100% stake · price on request", "ขายกิจการทั้งหมด · หุ้น 100% · ราคาตามการสอบถาม"),
  footer: c("Project B2B Packaging", "โครงการ B2B Packaging"),
  less: c("Show less", "ย่อ"),
  more: c("Show more", "ดูเพิ่ม"),
};

export const B_PROMISES = {
  h2: c("Four ways PitchSnack helps buyers", "สี่วิธีที่ PitchSnack ช่วยผู้ซื้อ"),
  intro: c("On every listing and every NDA.", "ในทุกประกาศและทุก NDA"),
  cards: [
    { img: "/images/promises/promise-eye-padlock.webp", h: c("Your search stays private", "การค้นหาของท่านเป็นความลับ"), x: c("Sellers see your investor type, such as Private equity, not your firm’s name, until they approve your NDA.", "ผู้ขายเห็นเพียงประเภทนักลงทุนของท่าน เช่น Private equity ไม่เห็นชื่อบริษัท จนกว่าจะอนุมัติ NDA") },
    { img: "/images/promises/promise-nda-shield.webp", h: c("One standard NDA", "NDA มาตรฐานฉบับเดียว"), x: c("PitchSnack’s standard mutual NDA on every listing: 2 years, used only to evaluate that deal.", "NDA มาตรฐานแบบสองฝ่ายของ PitchSnack ใช้กับทุกประกาศ อายุ 2 ปี และใช้ข้อมูลเพื่อพิจารณาดีลนั้นเท่านั้น") },
    { img: "/images/promises/promise-road.webp", h: c("A clear path to the deal", "เส้นทางสู่ดีลที่ชัดเจน"), x: c("Track every deal in your Pipeline, from the NDA and letter of intent to legal, offer & SPA and payment.", "ติดตามทุกดีลใน Pipeline ตั้งแต่ NDA และหนังสือแสดงเจตจำนง ไปจนถึงกฎหมาย ข้อเสนอและสัญญาซื้อขาย และการชำระเงิน") },
    { img: "/images/promises/promise-charts.webp", h: c("Verified numbers", "ตัวเลขที่ตรวจสอบแล้ว"), x: c("Every listing is approved by PitchSnack before you see it, and its badges show what was checked, such as DBD financials FY21–25.", "ทุกประกาศผ่านการอนุมัติจาก PitchSnack ก่อนถึงมือท่าน และตราสัญลักษณ์บอกว่าตรวจอะไรแล้ว เช่น งบการเงิน DBD ปี 2021–2025") },
  ],
};

export const B_HOW = {
  eyebrow: c("How it works", "ขั้นตอนการทำงาน"),
  h2: c("From anonymous teaser to data room", "จากประกาศไม่ระบุชื่อ สู่ห้องข้อมูล"),
  intro: c("You see enough to judge whether a business fits before anyone shares a name. Each step opens more, and the seller approves it.", "ท่านเห็นข้อมูลมากพอที่จะตัดสินใจว่ากิจการเหมาะกับท่านหรือไม่ ก่อนที่ใครจะเปิดเผยชื่อ แต่ละขั้นเปิดข้อมูลมากขึ้น และผู้ขายเป็นผู้อนุมัติ"),
  ticks: [
    c("Every listing is approved by PitchSnack before buyers see it", "ทุกประกาศผ่านการอนุมัติจาก PitchSnack ก่อนผู้ซื้อจะเห็น"),
    c("Teaser text is checked for names and other giveaways", "ข้อความในประกาศผ่านการตรวจว่าไม่มีชื่อหรือข้อมูลที่ระบุตัวตน"),
    c("Revenue and EBITDA are shown as ranges before the NDA", "รายได้และ EBITDA แสดงเป็นช่วงก่อนลงนาม NDA"),
    c("Save listings to Favourites and compare them later", "บันทึกประกาศไว้ในรายการโปรด แล้วกลับมาเปรียบเทียบภายหลัง"),
  ],
  steps: [
    [c("Browse anonymous teasers", "ดูประกาศไม่ระบุชื่อ"), c("Code name, sector, region, revenue and EBITDA ranges, asking price and deal type", "ชื่อโครงการ อุตสาหกรรม ภูมิภาค ช่วงรายได้และ EBITDA ราคาขาย และรูปแบบดีล")],
    [c("Request an NDA", "ขอลงนาม NDA"), c("Sign the standard NDA; the seller reviews your profile, usually within 2–3 business days", "ลงนาม NDA มาตรฐาน แล้วผู้ขายพิจารณาโปรไฟล์ของท่าน โดยปกติภายใน 2–3 วันทำการ")],
    [c("The seller approves, the listing opens", "ผู้ขายอนุมัติ ประกาศเปิดเต็ม"), c("Company name, website, photos, people and exact figures", "ชื่อกิจการ เว็บไซต์ รูปภาพ ผู้บริหาร และตัวเลขจริง")],
    [c("Data room and reports", "ห้องข้อมูลและรายงาน"), c("Statements, the verified financial report and valuation, as the seller shares them", "งบการเงิน รายงานการเงินที่ตรวจแล้ว และการประเมินมูลค่า ตามที่ผู้ขายแชร์")],
  ] as [C, C][],
};

export const B_MANDATE = {
  h2: c("Matched to your mandate", "จับคู่ตามเกณฑ์การลงทุนของท่าน"),
  intro: c("Tell us once what you buy. PitchSnack checks every listing against it.", "บอกเราครั้งเดียวว่าท่านซื้อกิจการแบบใด PitchSnack จะเทียบทุกประกาศกับเกณฑ์นั้น"),
  cards: [
    [c("5", "5"), c("Mandate fit checks", "เกณฑ์ความเหมาะสม"), c("Sector, revenue range, control (51%+), ticket size and EBITDA margin, on every listing.", "อุตสาหกรรม ช่วงรายได้ การถือหุ้นควบคุม (51% ขึ้นไป) ขนาดเงินลงทุน และอัตรากำไร EBITDA ในทุกประกาศ")],
    [c("3 a week", "3 / สัปดาห์"), c("Match emails, at most", "อีเมลแจ้งเตือนสูงสุด"), c("An email when a listing fits your criteria; the rest arrive in a weekly summary.", "อีเมลเมื่อมีประกาศตรงเกณฑ์ ส่วนที่เหลือรวมไว้ในสรุปรายสัปดาห์")],
    [c("2 years", "2 ปี"), c("NDA term", "อายุ NDA"), c("One signature per listing, and no direct contact with the seller’s staff, customers or suppliers.", "ลงนามครั้งเดียวต่อประกาศ และไม่ติดต่อพนักงาน ลูกค้า หรือซัพพลายเออร์ของผู้ขายโดยตรง")],
  ] as [C, C, C][],
};

export const B_NUMBERS = {
  eyebrow: c("Before and after the NDA", "ก่อนและหลังลงนาม NDA"),
  h2: c("Judge the fit first. See the full picture once approved.", "ประเมินความเหมาะสมก่อน เห็นภาพเต็มเมื่อได้รับอนุมัติ"),
  intro: c("Teasers give you ranges, not guesses. Once a seller approves your NDA, the same listing shows exact figures and statements.", "ประกาศให้ตัวเลขเป็นช่วง ไม่ใช่การคาดเดา เมื่อผู้ขายอนุมัติ NDA ประกาศเดียวกันจะแสดงตัวเลขจริงและงบการเงิน"),
  note: c("Sellers can also share a verified financial report and an estimated valuation, one buyer at a time · figures in this example are illustrative", "ผู้ขายยังแชร์รายงานการเงินที่ตรวจแล้วและการประเมินมูลค่ากิจการให้ผู้ซื้อได้ทีละราย · ตัวเลขในตัวอย่างนี้เป็นตัวเลขสมมติ"),
  cards: [
    { kind: "before", tag: c("Before NDA", "ก่อน NDA"), fig: "฿400–450M", cap: c("Revenue FY25", "รายได้ปี 2568"), capTag: c("Range", "ช่วง"), h: c("Anonymous teaser", "ประกาศไม่ระบุชื่อ"), line: c("What every verified buyer sees.", "สิ่งที่ผู้ซื้อที่ผ่านการตรวจสอบทุกรายเห็น"),
      points: [c("Code name and ref no.", "ชื่อโครงการและเลขอ้างอิง"), c("EBITDA as a range, about 15% margin", "EBITDA เป็นช่วง เช่น อัตรากำไรประมาณ 15%"), c("Staff band and founding decade", "ช่วงจำนวนพนักงานและทศวรรษที่ก่อตั้ง"), c("Asking price, stake and deal type", "ราคาขาย สัดส่วนหุ้น และรูปแบบดีล")] },
    { kind: "after", tag: c("After NDA", "หลัง NDA"), fig: "฿427M", cap: c("Revenue FY25", "รายได้ปี 2568"), capTag: c("Exact", "ตัวเลขจริง"), h: c("Full listing", "ประกาศฉบับเต็ม"), line: c("Opened by the seller, for you only.", "ผู้ขายเปิดให้เฉพาะท่าน"),
      points: [c("Company name, logo and website", "ชื่อกิจการ โลโก้ และเว็บไซต์"), c("Exact figures and statements", "ตัวเลขจริงและงบการเงิน"), c("People, customers and suppliers named", "ระบุชื่อผู้บริหาร ลูกค้า และซัพพลายเออร์"), c("Data room, as the seller allows", "ห้องข้อมูล ตามที่ผู้ขายอนุญาต")] },
  ],
};

export const B_DEAL = {
  h2: c("Every deal, step by step", "ทุกดีล ทีละขั้นตอน"),
  intro: c("Your Pipeline tracks each business from the NDA to payment, with private notes only you can see.", "Pipeline ติดตามแต่ละกิจการตั้งแต่ NDA จนถึงการชำระเงิน พร้อมบันทึกส่วนตัวที่ท่านเห็นได้คนเดียว"),
  steps: [
    [c("NDA", "NDA"), c("Seller approves", "ผู้ขายอนุมัติ")],
    [c("Financials & valuation", "การเงินและมูลค่า"), c("Reports shared", "รายงานที่ผู้ขายแชร์")],
    [c("Letter of intent", "หนังสือแสดงเจตจำนง"), c("Non-binding", "ไม่มีผลผูกพัน")],
    [c("Contact M&A", "ติดต่อ M&A"), c("After acceptance", "หลังผู้ขายตอบรับ")],
    [c("Legal", "กฎหมาย"), c("Due diligence", "ตรวจสอบสถานะกิจการ")],
    [c("Offer & SPA", "ข้อเสนอและ SPA"), c("Sale agreement", "สัญญาซื้อขาย")],
    [c("Payment", "การชำระเงิน"), c("And completion", "และการโอนกิจการ")],
  ] as [C, C][],
  tools: [
    [c("Send a letter of intent in one form", "ส่งหนังสือแสดงเจตจำนงในฟอร์มเดียว"), c("Indicative price, exclusivity (60 days by default) and conditions. Non-binding, except exclusivity and confidentiality.", "ราคาเบื้องต้น ระยะเวลาเจรจาแต่เพียงผู้เดียว (ค่าเริ่มต้น 60 วัน) และเงื่อนไข ไม่มีผลผูกพัน ยกเว้นการเจรจาแต่เพียงผู้เดียวและการรักษาความลับ")],
    [c("Talk to the seller on PitchSnack", "คุยกับผู้ขายบน PitchSnack"), c("Message the seller once your NDA is approved, and get an email when they reply.", "ส่งข้อความถึงผู้ขายเมื่อ NDA ได้รับอนุมัติ และรับอีเมลเมื่อผู้ขายตอบกลับ")],
    [c("Compare several businesses", "เปรียบเทียบหลายกิจการ"), c("Run several deals at once in your Pipeline and compare the reports sellers share.", "ดูหลายดีลพร้อมกันใน Pipeline และเปรียบเทียบรายงานที่ผู้ขายแชร์")],
  ] as [C, C][],
};

export const B_PROFILE = {
  eyebrow: c("Your investor profile", "โปรไฟล์นักลงทุนของท่าน"),
  h2: c("Show sellers you are a genuine buyer", "แสดงให้ผู้ขายเห็นว่าท่านเป็นผู้ซื้อตัวจริง"),
  intro: c("Sellers want genuine buyers, not window shoppers. Set up your profile with the Investor Profile Setup Wizard, one question at a time; for firms in Thailand, we verify with the Company Registration Number.", "ผู้ขายต้องการผู้ซื้อตัวจริง ไม่ใช่แค่ผู้ที่เข้ามาดู ตั้งค่าโปรไฟล์ด้วย Investor Profile Setup Wizard ทีละคำถาม และสำหรับบริษัทในไทย เราตรวจสอบด้วยเลขทะเบียนนิติบุคคล"),
  ticks: [
    c("Sellers see your investor type, ref no. and country, not your name", "ผู้ขายเห็นประเภทนักลงทุน เลขอ้างอิง และประเทศ ไม่เห็นชื่อของท่าน"),
    c("Ticket size, AUM and target revenue minimum are shown as bands", "ขนาดเงินลงทุน AUM และรายได้ขั้นต่ำของกิจการเป้าหมาย แสดงเป็นช่วง"),
    c("A Verified investor badge on your card once your firm is checked", "ตรา Verified investor บนการ์ดของท่าน เมื่อตรวจสอบบริษัทแล้ว"),
  ],
  chipsLabel: c("Open to every kind of buyer", "เปิดรับผู้ซื้อทุกประเภท"),
  types: ["Family office", "Private equity", "Venture capital", "Corporate VC", "Corporate buyer", "Incubator / Accelerator", "Individual investor"],
  role: c("Buyer", "ผู้ซื้อ"),
  caption: c("Investor profile · live 3 Oct 2026", "โปรไฟล์นักลงทุน · เผยแพร่เมื่อ 3 ต.ค. 2569"),
  pill: c("Name hidden", "ซ่อนชื่อ"),
  name: c("Private Equity", "กองทุนไพรเวทอิควิตี้"),
  country: c("Thailand", "ประเทศไทย"),
  desc: c("Leading and influential private equity firm in Thailand and the Greater Mekong.", "กองทุนไพรเวทอิควิตี้ชั้นนำที่มีบทบาทสำคัญในประเทศไทยและภูมิภาคลุ่มแม่น้ำโขง"),
  ticket: c("Ticket size", "ขนาดเงินลงทุน"),
  aum: c("AUM", "สินทรัพย์ที่บริหาร (AUM)"),
  min: c("Min. target revenue", "รายได้ขั้นต่ำของกิจการเป้าหมาย"),
  geo: c("Geography", "ภูมิภาคที่ลงทุน"),
  geoV: c("Thailand · Greater Mekong · Southeast Asia", "ไทย · ลุ่มแม่น้ำโขง · เอเชียตะวันออกเฉียงใต้"),
  deals: c("Deal types", "รูปแบบดีล"),
  dealsV: c("Majority stake (above 51%)", "ถือหุ้นใหญ่ (มากกว่า 51%)"),
  stages: c("Preferred stages", "ระยะที่ลงทุน"),
  stagesV: c("Buyout", "ซื้อกิจการ (Buyout)"),
  verif: c("Verification", "การตรวจสอบ"),
  verifV: c("Verified investor", "นักลงทุนที่ผ่านการตรวจสอบ"),
  firm: c("Firm name and website", "ชื่อบริษัทและเว็บไซต์"),
  firmV: c("After the NDA", "หลังอนุมัติ NDA"),
  more: c("Show more", "ดูเพิ่ม"),
  less: c("Show less", "ย่อ"),
};

export const B_PLANS = {
  fine: c("Buyers pay no completion fee. Prices exclude VAT; all figures are proposals.", "ผู้ซื้อไม่มีค่าธรรมเนียมเมื่อปิดดีล ราคายังไม่รวมภาษีมูลค่าเพิ่ม ตัวเลขทั้งหมดเป็นข้อเสนอ"),
  link: c("All plans and the fee table →", "ดูแผนทั้งหมดและตารางค่าธรรมเนียม →"),
};

export const B_FAQ = {
  h2: c("Questions buyers ask", "คำถามจากผู้ซื้อ"),
  items: [
    [c("Why can’t I see the company’s name?", "ทำไมฉันจึงไม่เห็นชื่อกิจการ"), c("Sellers stay anonymous until they approve your NDA, so their staff, customers and competitors don’t find out. Before that, you see the code name, sector, region and figures as ranges.", "ผู้ขายไม่เปิดเผยชื่อจนกว่าจะอนุมัติ NDA ของท่าน เพื่อไม่ให้พนักงาน ลูกค้า และคู่แข่งรู้ ก่อนหน้านั้นท่านเห็นชื่อโครงการ อุตสาหกรรม ภูมิภาค และตัวเลขเป็นช่วง")],
    [c("What does NDA mean?", "NDA คืออะไร"), c("NDA stands for Non-Disclosure Agreement. It is a contract in which you agree to keep the seller’s information confidential and to use it only to consider the purchase. PitchSnack’s standard mutual NDA runs for 2 years.", "NDA ย่อมาจาก Non-Disclosure Agreement หรือสัญญาไม่เปิดเผยข้อมูล เป็นสัญญาที่ท่านตกลงว่าจะเก็บข้อมูลของผู้ขายเป็นความลับ และใช้เพื่อพิจารณาการซื้อเท่านั้น NDA มาตรฐานแบบสองฝ่ายของ PitchSnack มีอายุ 2 ปี")],
    [c("How long does a seller take to reply?", "ผู้ขายใช้เวลาตอบนานเท่าไร"), c("Usually 2–3 business days. You get an email when the seller approves or declines your NDA.", "โดยปกติ 2–3 วันทำการ ท่านจะได้รับอีเมลเมื่อผู้ขายอนุมัติหรือปฏิเสธ NDA")],
    [c("Will sellers see my firm’s name?", "ผู้ขายจะเห็นชื่อบริษัทของฉันหรือไม่"), c("Not until they approve your NDA. Before that, they see your investor type, ref no., country and figures as ranges, such as your ticket size.", "ไม่เห็นจนกว่าจะอนุมัติ NDA ก่อนหน้านั้นผู้ขายเห็นประเภทนักลงทุน เลขอ้างอิง ประเทศ และตัวเลขเป็นช่วง เช่น ขนาดเงินลงทุน")],
    [c("Is a letter of intent binding?", "หนังสือแสดงเจตจำนงมีผลผูกพันหรือไม่"), c("No. It is non-binding, except exclusivity and confidentiality. If the seller accepts, exclusivity runs for the number of days you set, 60 by default.", "ไม่มีผลผูกพัน ยกเว้นการเจรจาแต่เพียงผู้เดียวและการรักษาความลับ หากผู้ขายตอบรับ ระยะเวลาเจรจาแต่เพียงผู้เดียวจะนับตามจำนวนวันที่ท่านกำหนด ค่าเริ่มต้นคือ 60 วัน")],
    [c("How do I know a listing is genuine?", "จะรู้ได้อย่างไรว่าประกาศเป็นของจริง"), c("Every listing is approved by PitchSnack before buyers see it, and its badges show what was checked, such as Legally verified, DBD financials FY21–25 and Seller verified. Our information should complement, not replace, your own due diligence. Always conduct your own due diligence before proceeding.", "ทุกประกาศผ่านการอนุมัติจาก PitchSnack ก่อนผู้ซื้อจะเห็น และตราสัญลักษณ์บอกว่าตรวจอะไรแล้ว เช่น Legally verified, DBD financials FY21–25 และ Seller verified ข้อมูลของเราช่วยเสริม แต่ไม่ได้ทดแทนการตรวจสอบสถานะกิจการ (Due Diligence) ของท่านเอง โปรดตรวจสอบด้วยตนเองทุกครั้งก่อนดำเนินการต่อ")],
  ] as [C, C][],
};

export const B_CLOSE = {
  h2: c("Start your search quietly. Your name stays private until you choose.", "เริ่มค้นหาอย่างเงียบๆ\nชื่อของท่านเป็นความลับจนกว่าท่านจะเลือก"),
  x: c("Create your investor profile, browse anonymous teasers and request an NDA when a business fits.", "สร้างโปรไฟล์นักลงทุน ดูประกาศไม่ระบุชื่อ และขอลงนาม NDA เมื่อเจอกิจการที่ใช่"),
  red: c("Create your investor profile", "สร้างโปรไฟล์นักลงทุน"),
  outline: c("Talk to us first", "พูดคุยกับเราก่อน"),
};
