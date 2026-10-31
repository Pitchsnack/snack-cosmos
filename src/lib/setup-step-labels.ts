type Names = { short: [string, string]; full: [string, string] };
export const BUYER_STEP_NAMES: Record<string, Names> = {
  role: { short: ["Role", "บทบาท"], full: ["Your role", "บทบาทของท่าน"] },
  type: { short: ["Type", "ประเภท"], full: ["Investor type", "ประเภทนักลงทุน"] },
  name: { short: ["Firm", "บริษัท"], full: ["Firm name, registration number and address", "ชื่อบริษัท เลขทะเบียน และที่อยู่"] },
  web: { short: ["Website", "เว็บไซต์"], full: ["Firm website", "เว็บไซต์บริษัท"] },
  aum: { short: ["AUM", "AUM"], full: ["Assets under management (AUM)", "สินทรัพย์ภายใต้การบริหาร (AUM)"] },
  ticket: { short: ["Ticket", "เงิน\u200bลงทุน"], full: ["Average investment per deal", "เงินลงทุนเฉลี่ยต่อดีล"] },
  rev: { short: ["Min. revenue", "รายได้\u200bขั้นต่ำ"], full: ["Minimum target company revenue", "รายได้ขั้นต่ำของบริษัทเป้าหมาย"] },
  deals: { short: ["Deals", "ประเภท\u200bดีล"], full: ["Deal types", "ประเภทดีล"] },
  sectors: { short: ["Industries", "อุตสาห\u200bกรรม"], full: ["Industries", "อุตสาหกรรม"] },
  photos: { short: ["Photos", "รูปภาพ"], full: ["Logo and photos", "โลโก้และรูปภาพ"] },
  desc: { short: ["Description", "คำอธิบาย"], full: ["Description for sellers", "คำอธิบายสำหรับผู้ขาย"] },
  review: { short: ["Review", "ตรวจสอบ"], full: ["Review your answers", "ตรวจสอบข้อมูล"] },
};
export const ADVISOR_STEP_NAMES: Record<string, Names> = {
  type: { short: ["Type", "ประเภท"], full: ["Firm type", "ประเภทบริษัท"] },
  name: BUYER_STEP_NAMES.name,
  web: BUYER_STEP_NAMES.web,
  services: { short: ["Services", "บริการ"], full: ["Services and fees", "บริการและค่าธรรมเนียม"] },
  deal: { short: ["Deal size", "ขนาด\u200bดีล"], full: ["Typical deal size", "ขนาดดีลโดยทั่วไป"] },
  team: { short: ["Team", "ทีมงาน"], full: ["Team size and languages", "ขนาดทีมและภาษา"] },
  sectors: { short: ["Sectors", "กลุ่ม\u200bอุตสาหกรรม"], full: ["Sectors you know best", "กลุ่มอุตสาหกรรมที่เชี่ยวชาญ"] },
  contact: { short: ["Contact", "ติดต่อ"], full: ["Contact details", "ข้อมูลติดต่อ"] },
  logo: { short: ["Logo", "โลโก้"], full: ["Logo", "โลโก้"] },
  desc: { short: ["Description", "คำอธิบาย"], full: ["Description", "คำอธิบาย"] },
  review: BUYER_STEP_NAMES.review,
};