// Default wording for the 10 email alerts. Admin overrides live in the database
// (email_alert_settings.overrides) and are merged over these defaults.
export type AlertRole = "seller" | "buyer" | "advisor";
export type AlertLang = "en" | "th";
export type AlertText = { subject: string; title: string; body: string; button: string };
export type AlertVersion = {
  sentWhen: string;
  sentTo: string;
  place: string; // "Opens {place} in PitchSnack."
  path: string;
  text: Record<AlertLang, AlertText>;
};
export type AlertDef = {
  key: string;
  n: number;
  group: "Approvals" | "NDA" | "Pipeline" | "Matches" | "Messages" | "Advisors";
  name: string;
  icon: "log-out" | "check" | "edit" | "x" | "lock" | "unlock" | "ban" | "file" | "pen" | "spark" | "mail" | "handshake" | "user-check" | "user-x" | "inbox";
  color: string;
  instant?: boolean; // ignores quiet hours
  wired: boolean; // sent automatically today
  placeholders: string[];
  seller?: AlertVersion;
  buyer?: AlertVersion;
  advisor?: AlertVersion;
};

/** The versions an alert has, in display order. */
export const rolesOf = (def: AlertDef): AlertRole[] => (["seller", "buyer", "advisor"] as const).filter((r) => !!def[r]);

const v = (sentWhen: string, sentTo: string, place: string, path: string, en: AlertText, th: AlertText): AlertVersion => ({
  sentWhen, sentTo, place, path, text: { en, th },
});
const SELLER_TO = "Listing owner and team";
const BUYER_TO = "The buyer";

export const EMAIL_ALERTS: AlertDef[] = [
  {
    key:'report_ready',n:12,group:'Pipeline',name:'Report authorised',icon:'file',color:'#0E7490',wired:true,
    placeholders:['{company}','{report}','{companyId}','{key}'],
    seller:v('Admin authorises a report',SELLER_TO,'Tools › My reports','/my-reports?company={companyId}&report={key}',
      {subject:'Your {report} for {company} is ready',title:'Your report is ready',body:'Your {report} for {company} is ready. You can share it with buyers whose NDA you approved.',button:'Open My reports'},
      {subject:'{report} ของ {company} พร้อมแล้ว',title:'รายงานของท่านพร้อมแล้ว',body:'{report} ของ {company} พร้อมแล้ว ท่านแชร์ให้ผู้ซื้อที่ท่านอนุมัติ NDA ได้',button:'เปิดรายงานของฉัน'}),
  },
  {
    key: 'report_share_request', n: 11, group: 'Pipeline', name: 'Report share request', icon: 'file', color: '#0E7490', wired: true,
    placeholders: ['{buyer}', '{report}', '{pipeline}', '{key}'],
    seller: v('A buyer with an approved NDA asks for a report', SELLER_TO, 'My Pipeline › Buyer reports', '/my-reports/buyer/{pipeline}?report={key}',
      {subject:'{buyer} asked you to share {report}.',title:'A buyer asked for a report',body:'{buyer} asked you to share {report}. Sharing is free for the buyer and does not use their plan.',button:'Open buyer reports'},
      {subject:'{buyer} ขอให้ท่านแชร์{report}',title:'ผู้ซื้อขอรายงาน',body:'{buyer} ขอให้ท่านแชร์{report} การแชร์ไม่มีค่าใช้จ่ายสำหรับผู้ซื้อ และไม่ใช้สิทธิ์ในแพ็กเกจ',button:'เปิดรายงานของผู้ซื้อ'}),
  },
  {
    key: "approved", n: 1, group: "Approvals", name: "Approved", icon: "check", color: "#16A34A", instant: true, wired: true,
    placeholders: ["{listing name}", "{ref}", "{rewrote}", "{firm}", "{date}"],
    seller: v("Admin verifies and publishes the listing", SELLER_TO, "My Company", "/my-startups",
      { subject: "Your listing is approved", title: "Your listing is approved", body: "Admin verified your company and published your listing. Buyers can now find it as {listing name} ({ref}) in Browse listings, and you can connect with buyers.{rewrote}", button: "View my listing" },
      { subject: "ประกาศของท่านได้รับอนุมัติแล้ว", title: "ประกาศของท่านได้รับอนุมัติแล้ว", body: "ผู้ดูแลระบบยืนยันบริษัทของท่านและเผยแพร่ประกาศแล้ว ผู้ซื้อจะพบประกาศในชื่อ {listing name} ({ref}) ใน ดูธุรกิจที่เปิดขาย และท่านติดต่อผู้ซื้อได้แล้ว{rewrote}", button: "ดูประกาศของฉัน" }),
    buyer: v("Admin verifies the buyer and publishes the investor profile", BUYER_TO, "My Company", "/marketplace/my-company",
      { subject: "Your profile is approved", title: "Your profile is approved", body: "Admin verified your account and published your investor profile. Sellers can now find your firm as {listing name} ({ref}) in Browse investors, and you can request NDAs.{rewrote}", button: "View my profile" },
      { subject: "โปรไฟล์ของท่านได้รับอนุมัติแล้ว", title: "โปรไฟล์ของท่านได้รับอนุมัติแล้ว", body: "ผู้ดูแลระบบยืนยันบัญชีของท่านและเผยแพร่โปรไฟล์นักลงทุนแล้ว ผู้ขายจะพบบริษัทของท่านในชื่อ {listing name} ({ref}) ใน ดูรายชื่อนักลงทุน และท่านขอ NDA ได้แล้ว{rewrote}", button: "ดูโปรไฟล์ของฉัน" }),
    advisor: v("Admin verifies the advisor firm", "The firm profile's owner", "My Company", "/marketplace/my-company",
      { subject: "Your profile is approved", title: "Your profile is approved", body: "Admin verified your firm and published your profile. Sellers and buyers can now find {listing name} in Browse advisors.{rewrote}", button: "Open My Company" },
      { subject: "โปรไฟล์ของท่านได้รับอนุมัติแล้ว", title: "โปรไฟล์ของท่านได้รับอนุมัติแล้ว", body: "ผู้ดูแลระบบยืนยันบริษัทของท่านและเผยแพร่โปรไฟล์แล้ว ผู้ขายและผู้ซื้อจะพบ {listing name} ใน ดูรายชื่อที่ปรึกษา{rewrote}", button: "เปิดบริษัทของฉัน" }),
  },
  {
    key: "changes_requested", n: 2, group: "Approvals", name: "Changes requested", icon: "edit", color: "#D97706", instant: true, wired: true,
    placeholders: ["{listing code name}", "{firm}", "{fields}", "{note}"],
    seller: v("Admin requests changes to the listing", SELLER_TO, "My Company › Edit public view", "/marketplace/my-company",
      { subject: "Changes requested for {listing code name}", title: "Admin asked for changes before publishing", body: "Your listing is not live yet. Fix the fields below, then resubmit both views.", button: "Edit and resubmit" },
      { subject: "มีคำขอแก้ไขสำหรับ {listing code name}", title: "ผู้ดูแลขอให้แก้ไขก่อนเผยแพร่", body: "รายการของคุณยังไม่เผยแพร่ โปรดแก้ไขข้อมูลด้านล่าง แล้วส่งทั้งสองมุมมองอีกครั้ง", button: "แก้ไขและส่งอีกครั้ง" }),
    buyer: v("Admin asks the buyer for more information", BUYER_TO, "My Company › Verification", "/marketplace/my-company",
      { subject: "PitchSnack needs a little more information", title: "We need a little more to verify you", body: "Your verification is on hold until you add the details below.", button: "Add the details" },
      { subject: "PitchSnack ต้องการข้อมูลเพิ่มเติม", title: "เราต้องการข้อมูลเพิ่มเติมเพื่อยืนยันตัวคุณ", body: "การยืนยันของคุณถูกพักไว้จนกว่าคุณจะเพิ่มข้อมูลด้านล่าง", button: "เพิ่มข้อมูล" }),
    advisor: v("Admin asks the advisor firm for more information", "The firm profile's owner", "My Company", "/marketplace/my-company",
      { subject: "We need more information to verify {firm}", title: "We need more information to verify {firm}", body: "Please fix these on My Company: {fields}. When you save them, your firm goes back to PitchSnack for a check.", button: "Open My Company" },
      { subject: "เราต้องการข้อมูลเพิ่มเติมเพื่อยืนยัน {firm}", title: "เราต้องการข้อมูลเพิ่มเติมเพื่อยืนยัน {firm}", body: "กรุณาแก้ไขข้อมูลต่อไปนี้ในหน้าบริษัทของฉัน: {fields} เมื่อท่านบันทึกแล้ว บริษัทของท่านจะถูกส่งกลับมาให้ PitchSnack ตรวจสอบอีกครั้ง", button: "เปิดบริษัทของฉัน" }),
  },
  {
    key: "declined", n: 3, group: "Approvals", name: "Declined", icon: "x", color: "#B91C1C", instant: true, wired: true,
    placeholders: ["{listing code name}", "{firm}", "{reason}", "{note}"],
    seller: v("Admin declines the listing", SELLER_TO, "My Company", "/marketplace/my-company",
      { subject: "{listing code name} was not approved", title: "Your listing was not approved", body: "The listing stays a draft and buyers can't see it. You can edit it and submit again.", button: "Open My Company" },
      { subject: "{listing code name} ไม่ได้รับอนุมัติ", title: "รายการของคุณไม่ได้รับอนุมัติ", body: "รายการยังเป็นฉบับร่างและผู้ซื้อมองไม่เห็น คุณสามารถแก้ไขและส่งใหม่ได้", button: "เปิด My Company" }),
    buyer: v("Admin declines the buyer's profile", BUYER_TO, "My Company", "/marketplace/my-company",
      { subject: "Your PitchSnack profile was not approved", title: "Your profile was not approved", body: "Your investor profile stays hidden and you can't request NDAs yet. You can update it and submit again.", button: "Open My Company" },
      { subject: "โปรไฟล์ PitchSnack ของคุณไม่ได้รับอนุมัติ", title: "โปรไฟล์ของคุณไม่ได้รับอนุมัติ", body: "โปรไฟล์นักลงทุนของคุณยังซ่อนอยู่และยังขอ NDA ไม่ได้ คุณสามารถแก้ไขและส่งใหม่ได้", button: "เปิด My Company" }),
    advisor: v("Admin declines the advisor firm", "The firm profile's owner", "My Company", "/marketplace/my-company",
      { subject: "We couldn't verify {firm}", title: "We couldn't verify {firm}", body: "{reason}. {firm} is unpublished, so sellers and buyers can't find it. If you think this is a mistake, write to support@pitchsnack.com.", button: "Open My Company" },
      { subject: "เราไม่สามารถยืนยัน {firm} ได้", title: "เราไม่สามารถยืนยัน {firm} ได้", body: "{reason} {firm} ถูกนำออกจากการแสดงผล ผู้ขายและผู้ซื้อจะไม่พบบริษัทของท่าน หากท่านคิดว่าเป็นความผิดพลาด กรุณาติดต่อ support@pitchsnack.com", button: "เปิดบริษัทของฉัน" }),
  },
  {
    key: "nda_request", n: 4, group: "NDA", name: "NDA request", icon: "lock", color: "#4338CA", wired: true,
    placeholders: ["{buyer code name}", "{listing code name}"],
    seller: v("A buyer requests an NDA on the listing", SELLER_TO, "Pipeline › All deals", "/marketplace/pipeline",
      { subject: "{buyer code name} asked for an NDA on {listing code name}", title: "A buyer asked for your NDA", body: "{buyer code name} wants to see the private view of {listing code name}. Their name stays hidden until you approve, but you can see their public profile now.", button: "Review the request" },
      { subject: "{buyer code name} ขอ NDA สำหรับ {listing code name}", title: "มีผู้ซื้อขอ NDA กับคุณ", body: "{buyer code name} ต้องการดูมุมมองพิเศษของ {listing code name} ชื่อของผู้ซื้อจะถูกซ่อนจนกว่าคุณจะอนุมัติ แต่คุณดูโปรไฟล์สาธารณะได้แล้ว", button: "ตรวจสอบคำขอ" }),
    buyer: v("A seller requests an NDA with the buyer", BUYER_TO, "Pipeline › All deals", "/marketplace/pipeline",
      { subject: "{listing code name} asked you for an NDA", title: "A seller asked you for an NDA", body: "The seller of {listing code name} would like to share its private view with your firm. If you approve, you see the company's name and exact figures, and the seller sees your private profile.", button: "Review the request" },
      { subject: "{listing code name} ขอ NDA กับคุณ", title: "ผู้ขายขอ NDA กับคุณ", body: "ผู้ขาย {listing code name} ต้องการแบ่งปันมุมมองพิเศษกับบริษัทของคุณ หากคุณอนุมัติ คุณจะเห็นชื่อบริษัทและตัวเลขจริง และผู้ขายจะเห็นโปรไฟล์ส่วนตัวของคุณ", button: "ตรวจสอบคำขอ" }),
  },
  {
    key: "nda_approved", n: 5, group: "NDA", name: "NDA approved", icon: "unlock", color: "#16A34A", wired: true,
    placeholders: ["{buyer code name}", "{buyer company}", "{listing code name}", "{date}"],
    seller: v("The buyer approves the seller's NDA request", SELLER_TO, "Pipeline › All deals", "/marketplace/pipeline",
      { subject: "{buyer code name} approved your NDA request", title: "The buyer approved your NDA", body: "{buyer code name} approved the NDA for {listing code name}. You can now see their private profile, and they can see your private view.", button: "Open investor profile" },
      { subject: "{buyer code name} อนุมัติคำขอ NDA ของคุณ", title: "ผู้ซื้ออนุมัติ NDA ของคุณ", body: "{buyer code name} อนุมัติ NDA สำหรับ {listing code name} แล้ว คุณดูโปรไฟล์ส่วนตัวของผู้ซื้อได้ และผู้ซื้อดูมุมมองพิเศษของคุณได้", button: "เปิดโปรไฟล์นักลงทุน" }),
    buyer: v("The seller approves the buyer's NDA request", BUYER_TO, "Favourites › Exclusive view", "/marketplace/favourites",
      { subject: "Your NDA for {listing code name} is approved", title: "The seller approved your NDA", body: "You can now see the private view of {listing code name}, including the company name and exact figures, in Favourites.", button: "Open private view" },
      { subject: "NDA ของคุณสำหรับ {listing code name} ได้รับอนุมัติ", title: "ผู้ขายอนุมัติ NDA ของคุณ", body: "คุณสามารถดูมุมมองพิเศษของ {listing code name} รวมถึงชื่อบริษัทและตัวเลขจริงได้ใน Favourites", button: "เปิดมุมมองพิเศษ" }),
  },
  {
    key: "nda_declined", n: 6, group: "NDA", name: "NDA declined", icon: "ban", color: "#B91C1C", wired: true,
    placeholders: ["{buyer code name}", "{listing code name}"],
    seller: v("The buyer declines the seller's NDA request", SELLER_TO, "Browse investors", "/marketplace/browse",
      { subject: "{buyer code name} declined your NDA request", title: "The buyer declined your NDA", body: "{buyer code name} declined your request for {listing code name}. Their profile stays in Browse investors, anonymous.", button: "Browse other investors" },
      { subject: "{buyer code name} ปฏิเสธคำขอ NDA ของคุณ", title: "ผู้ซื้อปฏิเสธ NDA ของคุณ", body: "{buyer code name} ปฏิเสธคำขอสำหรับ {listing code name} โปรไฟล์ยังอยู่ใน Browse investors แบบไม่ระบุตัวตน", button: "ดูนักลงทุนอื่น" }),
    buyer: v("The seller declines the buyer's NDA request", BUYER_TO, "Browse listings", "/marketplace/browse",
      { subject: "Your NDA for {listing code name} was declined", title: "The seller declined your NDA", body: "The seller of {listing code name} declined your request. The listing stays in Browse listings, anonymous.", button: "Browse other listings" },
      { subject: "NDA ของคุณสำหรับ {listing code name} ถูกปฏิเสธ", title: "ผู้ขายปฏิเสธ NDA ของคุณ", body: "ผู้ขาย {listing code name} ปฏิเสธคำขอของคุณ รายการยังอยู่ใน Browse listings แบบไม่ระบุตัวตน", button: "ดูรายการอื่น" }),
  },
  {
    key: "financial_report", n: 7, group: "Pipeline", name: "Financial report", icon: "file", color: "#0E7490", wired: true,
    placeholders: ["{buyer company}", "{seller company}", "{report name}"],
    seller: v("A buyer with an approved NDA asks for the report", SELLER_TO, "Pipeline › All deals › Financial & Valuation", "/marketplace/pipeline",
      { subject: "{buyer company} asked for your financial report", title: "A buyer asked for your report", body: "{buyer company}, whose NDA you approved, asked to see your verified financial report. They see only the ranges on your listing until you share it.", button: "Share report" },
      { subject: "{buyer company} ขอรายงานการเงินของคุณ", title: "ผู้ซื้อขอรายงานของคุณ", body: "{buyer company} ซึ่งคุณอนุมัติ NDA แล้ว ขอดูรายงานการเงินที่ยืนยันแล้ว ผู้ซื้อจะเห็นเพียงช่วงตัวเลขในรายการจนกว่าคุณจะแชร์", button: "แชร์รายงาน" }),
    buyer: v("The seller shares a report", BUYER_TO, "Pipeline › All deals", "/marketplace/pipeline",
      { subject: "{seller company} shared its financial report with you", title: "A seller shared a report with you", body: "{seller company} shared its {report name}. It opens in the app only, with your name as a watermark.", button: "View report" },
      { subject: "{seller company} แชร์รายงานการเงินกับคุณ", title: "ผู้ขายแชร์รายงานกับคุณ", body: "{seller company} แชร์ {report name} แล้ว เปิดดูได้ในแอปเท่านั้น โดยมีชื่อของคุณเป็นลายน้ำ", button: "ดูรายงาน" }),
  },
  {
    key: "loi", n: 8, group: "Pipeline", name: "Letter of intent", icon: "pen", color: "#7C3AED", wired: true,
    placeholders: ["{buyer company}", "{seller company}"],
    seller: v("A buyer sends a letter of intent", SELLER_TO, "Pipeline › All deals › LOI", "/marketplace/pipeline",
      { subject: "{buyer company} sent a letter of intent", title: "You received a letter of intent", body: "{buyer company} sent a letter of intent for {seller company}. Read the terms and reply in the app.", button: "Read the letter" },
      { subject: "{buyer company} ส่งหนังสือแสดงเจตจำนง", title: "คุณได้รับหนังสือแสดงเจตจำนง", body: "{buyer company} ส่งหนังสือแสดงเจตจำนงสำหรับ {seller company} อ่านเงื่อนไขและตอบกลับในแอป", button: "อ่านหนังสือ" }),
    buyer: v("The seller replies to the letter of intent", BUYER_TO, "Pipeline › All deals › LOI", "/marketplace/pipeline",
      { subject: "{seller company} replied to your letter of intent", title: "The seller replied to your letter of intent", body: "{seller company} replied to your letter of intent. Read their answer in the app.", button: "Read the reply" },
      { subject: "{seller company} ตอบกลับหนังสือแสดงเจตจำนงของคุณ", title: "ผู้ขายตอบกลับหนังสือแสดงเจตจำนงของคุณ", body: "{seller company} ตอบกลับหนังสือแสดงเจตจำนงของคุณแล้ว อ่านคำตอบในแอป", button: "อ่านคำตอบ" }),
  },
  {
    key: "deal_withdrawn", n: 15, group: "Pipeline", name: "Deal withdrawn", icon: "log-out", color: "#B91C1C", wired: true,
    placeholders: ["{buyer company}", "{seller company}", "{listing code name}", "{organisation}", "{date}", "{NDA expiry}"],
    seller: v("A seller or buyer withdraws from a deal", SELLER_TO, "Pipeline › History", "/marketplace/pipeline/history",
      { subject: "{buyer company} withdrew from the deal for {listing code name}", title: "The buyer withdrew from the deal", body: "{organisation} withdrew from the deal on {date}. The NDA stays in force until {NDA expiry}.", button: "See the deal" },
      { subject: "{buyer company} ถอนตัวจากดีล {listing code name}", title: "ผู้ซื้อถอนตัวจากดีล", body: "{organisation} ถอนตัวจากดีลเมื่อ {date} NDA ยังมีผลจนถึง {NDA expiry}", button: "ดูดีล" }),
    buyer: v("A seller or buyer withdraws from a deal", BUYER_TO, "Pipeline › History", "/marketplace/pipeline/history",
      { subject: "{seller company} withdrew from the deal for {listing code name}", title: "The seller withdrew from the deal", body: "{organisation} withdrew from the deal on {date}. The NDA stays in force until {NDA expiry}.", button: "See the deal" },
      { subject: "{seller company} ถอนตัวจากดีล {listing code name}", title: "ผู้ขายถอนตัวจากดีล", body: "{organisation} ถอนตัวจากดีลเมื่อ {date} NDA ยังมีผลจนถึง {NDA expiry}", button: "ดูดีล" }),
  },
  {
    key: "criteria_match", n: 9, group: "Matches", name: "Criteria match", icon: "spark", color: "#F6A823", wired: false,
    placeholders: ["{buyer code name}", "{listing code name}", "{n}"],
    seller: v("A new investor profile is published that matches the listing", SELLER_TO, "Browse investors", "/marketplace/browse",
      { subject: "A new investor matches {listing code name}", title: "A new investor matches your business", body: "{buyer code name} was just published on PitchSnack and fits {n} of 5 of your listing's criteria. Their name stays hidden until they request an NDA and you approve.", button: "View investor profile" },
      { subject: "มีนักลงทุนใหม่ที่ตรงกับ {listing code name}", title: "มีนักลงทุนใหม่ที่ตรงกับธุรกิจของคุณ", body: "{buyer code name} เพิ่งเผยแพร่บน PitchSnack และตรงกับเกณฑ์ {n} จาก 5 ข้อของรายการคุณ ชื่อจะถูกซ่อนจนกว่าจะขอ NDA และคุณอนุมัติ", button: "ดูโปรไฟล์นักลงทุน" }),
    buyer: v("A new listing goes live that matches the buyer's mandate", BUYER_TO, "Browse listings", "/marketplace/browse",
      { subject: "New listing matches your mandate: {listing code name}", title: "A new listing matches your mandate", body: "{listing code name} went live today and fits {n} of 5 of your mandate criteria. The company stays anonymous until you request an NDA and the seller approves.", button: "View listing" },
      { subject: "รายการใหม่ตรงกับเกณฑ์ของคุณ: {listing code name}", title: "มีรายการใหม่ที่ตรงกับเกณฑ์ของคุณ", body: "{listing code name} เผยแพร่วันนี้และตรงกับเกณฑ์ {n} จาก 5 ข้อของคุณ บริษัทจะไม่ระบุตัวตนจนกว่าคุณจะขอ NDA และผู้ขายอนุมัติ", button: "ดูรายการ" }),
  },
  {
    key: "new_message", n: 10, group: "Messages", name: "New message", icon: "mail", color: "#1E2A4A", wired: false,
    placeholders: ["{sender}", "{listing code name}"],
    seller: v("A message to the seller is still unread 10 minutes after it was sent", SELLER_TO, "Messages", "/marketplace/messages",
      { subject: "New message from {sender}", title: "You have a new message", body: "{sender} wrote about {listing code name}:", button: "Reply" },
      { subject: "ข้อความใหม่จาก {sender}", title: "คุณมีข้อความใหม่", body: "{sender} เขียนถึงเรื่อง {listing code name}:", button: "ตอบกลับ" }),
    buyer: v("A message to the buyer is still unread 10 minutes after it was sent", BUYER_TO, "Messages", "/marketplace/messages",
      { subject: "New message from {sender}", title: "You have a new message", body: "{sender} wrote about {listing code name}:", button: "Reply" },
      { subject: "ข้อความใหม่จาก {sender}", title: "คุณมีข้อความใหม่", body: "{sender} เขียนถึงเรื่อง {listing code name}:", button: "ตอบกลับ" }),
  },
  {
    key: "advisor_invitation", n: 11, group: "Advisors", name: "Advisor invitation", icon: "handshake", color: "#0F766E", wired: true,
    placeholders: ["{person}", "{client}", "{firm}", "{client side}", "{date}"],
    advisor: v("A seller or buyer invites the firm to a deal", "The firm profile's owner", "Advisor › Pipeline › Invitations", "/advisor/pipeline",
      { subject: "{client} invited you to a deal", title: "A client invited you to a deal", body: "{person} at {client} invited {firm} to work on one of its deals. Open the invitation to see the deal, then join or decline.", button: "Open the invitation" },
      { subject: "{client} invited you to a deal", title: "A client invited you to a deal", body: "{person} at {client} invited {firm} to work on one of its deals. Open the invitation to see the deal, then join or decline.", button: "Open the invitation" }),
  },
  {
    key: "advisor_joined", n: 12, group: "Advisors", name: "Your advisor joined", icon: "user-check", color: "#16A34A", wired: true,
    placeholders: ["{firm}", "{other side}", "{date}"],
    seller: v("The advisor signs the NDA", "The client", "Pipeline › All deals", "/marketplace/pipeline",
      { subject: "{firm} joined your deal with {other side}", title: "Your advisor joined the deal", body: "{firm} joined your deal with {other side}. They signed an NDA with you and {other side}.", button: "View the advisor NDA" },
      { subject: "{firm} joined your deal with {other side}", title: "Your advisor joined the deal", body: "{firm} joined your deal with {other side}. They signed an NDA with you and {other side}.", button: "View the advisor NDA" }),
    buyer: v("The advisor signs the NDA", "The client", "Pipeline › All deals", "/marketplace/pipeline",
      { subject: "{firm} joined your deal with {other side}", title: "Your advisor joined the deal", body: "{firm} joined your deal with {other side}. They signed an NDA with you and {other side}.", button: "View the advisor NDA" },
      { subject: "{firm} joined your deal with {other side}", title: "Your advisor joined the deal", body: "{firm} joined your deal with {other side}. They signed an NDA with you and {other side}.", button: "View the advisor NDA" }),
  },
  {
    key: "advisor_joined_other", n: 13, group: "Advisors", name: "An advisor joined your deal", icon: "user-check", color: "#16A34A", wired: true,
    placeholders: ["{client}", "{firm}", "{date}"],
    seller: v("The other side's advisor signs the NDA", "The other side", "Pipeline › All deals", "/marketplace/pipeline",
      { subject: "{client} brought in {firm} as its advisor", title: "An advisor joined your deal", body: "{client} brought in {firm} as its advisor on your deal. They signed an NDA with you and {client}.", button: "View the advisor NDA" },
      { subject: "{client} brought in {firm} as its advisor", title: "An advisor joined your deal", body: "{client} brought in {firm} as its advisor on your deal. They signed an NDA with you and {client}.", button: "View the advisor NDA" }),
    buyer: v("The other side's advisor signs the NDA", "The other side", "Pipeline › All deals", "/marketplace/pipeline",
      { subject: "{client} brought in {firm} as its advisor", title: "An advisor joined your deal", body: "{client} brought in {firm} as its advisor on your deal. They signed an NDA with you and {client}.", button: "View the advisor NDA" },
      { subject: "{client} brought in {firm} as its advisor", title: "An advisor joined your deal", body: "{client} brought in {firm} as its advisor on your deal. They signed an NDA with you and {client}.", button: "View the advisor NDA" }),
  },
  {
    key: "advisor_declined", n: 14, group: "Advisors", name: "Advisor declined", icon: "user-x", color: "#B91C1C", wired: true,
    placeholders: ["{firm}", "{other side}"],
    seller: v("The advisor declines, or joins the deal for the other side", "The client", "Pipeline › All deals", "/marketplace/pipeline",
      { subject: "{firm} declined your invitation", title: "Your advisor declined", body: "{firm} declined your invitation to the deal with {other side}. You can invite another advisor from Pipeline.", button: "Invite another advisor" },
      { subject: "{firm} declined your invitation", title: "Your advisor declined", body: "{firm} declined your invitation to the deal with {other side}. You can invite another advisor from Pipeline.", button: "Invite another advisor" }),
    buyer: v("The advisor declines, or joins the deal for the other side", "The client", "Pipeline › All deals", "/marketplace/pipeline",
      { subject: "{firm} declined your invitation", title: "Your advisor declined", body: "{firm} declined your invitation to the deal with {other side}. You can invite another advisor from Pipeline.", button: "Invite another advisor" },
      { subject: "{firm} declined your invitation", title: "Your advisor declined", body: "{firm} declined your invitation to the deal with {other side}. You can invite another advisor from Pipeline.", button: "Invite another advisor" }),
  },
  {
    key: "advisor_new_enquiry", n: 16, group: "Advisors", name: "New enquiry", icon: "inbox", color: "#0F766E", wired: true,
    placeholders: ["{client company}", "{client name}", "{firm}", "{service}", "{seller | buyer}"],
    advisor: v("A seller or buyer sends an enquiry", "The users of the advisor account that owns the firm profile", "Advisor › Messages", "/advisor/messages?thread={thread}",
      { subject: "{client company} sent you an enquiry", title: "New enquiry from a {seller | buyer}", body: "{client name} at {client company} asked {firm} about {service}. Reply in Messages, or send a proposal.", button: "Open the enquiry" },
      { subject: "{client company} sent you an enquiry", title: "New enquiry from a {seller | buyer}", body: "{client name} at {client company} asked {firm} about {service}. Reply in Messages, or send a proposal.", button: "Open the enquiry" }),
  },
  {
    key: "advisor_proposal", n: 17, group: "Advisors", name: "Proposal from a firm", icon: "file", color: "#1D4ED8", wired: true,
    placeholders: ["{firm}", "{service}", "{fee}", "{date}"],
    seller: v("The firm sends a proposal", "The client's users", "Browse advisors", "/marketplace/advisors?firm={firmId}",
      { subject: "Proposal from {firm}", title: "You have a proposal from {firm}", body: "{firm} sent you a proposal for {service}. Review it and accept it, or reply in Messages.", button: "Review the proposal" },
      { subject: "Proposal from {firm}", title: "You have a proposal from {firm}", body: "{firm} sent you a proposal for {service}. Review it and accept it, or reply in Messages.", button: "Review the proposal" }),
    buyer: v("The firm sends a proposal", "The client's users", "Browse advisors", "/marketplace/advisors?firm={firmId}",
      { subject: "Proposal from {firm}", title: "You have a proposal from {firm}", body: "{firm} sent you a proposal for {service}. Review it and accept it, or reply in Messages.", button: "Review the proposal" },
      { subject: "Proposal from {firm}", title: "You have a proposal from {firm}", body: "{firm} sent you a proposal for {service}. Review it and accept it, or reply in Messages.", button: "Review the proposal" }),
  },
  {
    key: "advisor_proposal_accepted", n: 18, group: "Advisors", name: "Proposal accepted", icon: "user-check", color: "#16A34A", wired: true,
    placeholders: ["{client company}", "{service}", "{fee}"],
    advisor: v("The client accepts the proposal", "The firm's users", "Advisor › Messages", "/advisor/messages?thread={thread}",
      { subject: "{client company} engaged you", title: "Your proposal was accepted", body: "{client company} accepted your proposal for {service}. You're now their advisor.", button: "Open the conversation" },
      { subject: "{client company} engaged you", title: "Your proposal was accepted", body: "{client company} accepted your proposal for {service}. You're now their advisor.", button: "Open the conversation" }),
  },
  {
    key: "advisor_enquiry_declined", n: 19, group: "Advisors", name: "Enquiry declined", icon: "user-x", color: "#B91C1C", wired: true,
    placeholders: ["{firm}", "{service}", "{reason}"],
    seller: v("The firm declines the enquiry", "The client's users", "Browse advisors", "/marketplace/advisors",
      { subject: "{firm} declined your enquiry", title: "{firm} declined your enquiry", body: "{firm} declined your enquiry about {service}: {reason}. Other firms on PitchSnack can help.", button: "Find another firm" },
      { subject: "{firm} declined your enquiry", title: "{firm} declined your enquiry", body: "{firm} declined your enquiry about {service}: {reason}. Other firms on PitchSnack can help.", button: "Find another firm" }),
    buyer: v("The firm declines the enquiry", "The client's users", "Browse advisors", "/marketplace/advisors",
      { subject: "{firm} declined your enquiry", title: "{firm} declined your enquiry", body: "{firm} declined your enquiry about {service}: {reason}. Other firms on PitchSnack can help.", button: "Find another firm" },
      { subject: "{firm} declined your enquiry", title: "{firm} declined your enquiry", body: "{firm} declined your enquiry about {service}: {reason}. Other firms on PitchSnack can help.", button: "Find another firm" }),
  },
];
export const ALERT_BY_KEY = Object.fromEntries(EMAIL_ALERTS.map((a) => [a.key, a])) as Record<string, AlertDef>;

export type AlertOverrides = Partial<Record<AlertRole, Partial<Record<AlertLang, Partial<AlertText>>>>>;

export function alertText(def: AlertDef, role: AlertRole, lang: AlertLang, ov?: AlertOverrides): AlertText {
  const ver = def[role] ?? def[rolesOf(def)[0]!]!;
  return { ...ver.text[lang], ...(ov?.[role]?.[lang] ?? {}) } as AlertText;
}

export function fill(s: string, vars: Record<string, string | number | undefined>) {
  return s.replace(/\{([^}]+)\}/g, (m, k) => (vars[k] != null && vars[k] !== "" ? String(vars[k]) : m));
}
