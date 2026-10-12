const c = (en: string, th: string) => ({ en, th });

/** Soft-launch access page, ribbon and sign-up invitation wording (EN/TH). */
export const G = {
  title: c("PitchSnack · Soft launch", "PitchSnack · ทดลองใช้งาน"),
  chipA: c("Soft launch · ", "ทดลองใช้งาน · "), chipB: c("by invitation", "เฉพาะผู้ได้รับเชิญ"),
  intro: c("PitchSnack is open to a small group of invited clients before it opens to everyone. Your access code is in your invitation.",
    "PitchSnack เปิดให้ลูกค้าที่ได้รับเชิญกลุ่มเล็ก ๆ ทดลองใช้งาน ก่อนเปิดให้บริการทั่วไป รหัสเข้าใช้งานอยู่ในคำเชิญของท่าน"),
  p1: c("A code for your company, from the PitchSnack team", "รหัสเฉพาะสำหรับบริษัทของท่าน จากทีมงาน PitchSnack"),
  p2: c("The same checks and privacy as the full launch", "การตรวจสอบและความเป็นส่วนตัวเหมือนตอนเปิดให้บริการจริง"),
  p3: c("Tell us what works and what doesn’t", "บอกเราได้ว่าส่วนไหนใช้ดี ส่วนไหนควรปรับ"),
  card: c("Enter your access code", "กรอกรหัสเข้าใช้งาน"),
  cline: c("PitchSnack is in soft launch with invited clients. Enter the code from your invitation to open the website.",
    "PitchSnack อยู่ระหว่างทดลองใช้งานกับลูกค้าที่ได้รับเชิญ กรอกรหัสจากคำเชิญเพื่อเข้าสู่เว็บไซต์"),
  label: c("Access code", "รหัสเข้าใช้งาน"),
  remember: c("Remember this device for 30\u00a0days", "จดจำอุปกรณ์นี้ไว้ 30\u00a0วัน"),
  btn: c("Open the website", "เข้าสู่เว็บไซต์"), busy: c("Checking…", "กำลังตรวจสอบ…"),
  eEmpty: c("Enter the access code from your invitation.", "กรุณากรอกรหัสเข้าใช้งานจากคำเชิญ"),
  eShort: c("That code is too short. Codes look like PS-XXXX-XXXX.", "รหัสยังไม่ครบ รหัสมีรูปแบบ PS-XXXX-XXXX"),
  eUnknown: c("We don’t recognise that code. Check it against your invitation.", "ไม่พบรหัสนี้ กรุณาตรวจสอบกับคำเชิญของท่าน"),
  eInactive: c("This code is no longer active. Ask the PitchSnack team for a new one.", "รหัสนี้ใช้งานไม่ได้แล้ว กรุณาขอรหัสใหม่จากทีมงาน PitchSnack"),
  ePaused: c("Too many wrong tries. Please wait 15\u00a0minutes and try again.", "ลองผิดหลายครั้งเกินไป กรุณารอ 15\u00a0นาทีแล้วลองใหม่"),
  eFail: c("We couldn’t check the code. Please try again.", "ตรวจสอบรหัสไม่สำเร็จ กรุณาลองอีกครั้ง"),
  eNewAcct: c("New accounts need the code from your invitation.", "การสร้างบัญชีใหม่ต้องใช้รหัสจากคำเชิญ"),
  helpA: c("No code yet? Ask for an invitation at ", "ยังไม่มีรหัส? ขอคำเชิญได้ที่ "),
  have: c("Already have an account? ", "มีบัญชีอยู่แล้ว? "), signIn: c("Sign in", "เข้าสู่ระบบ"),
  fine: c("This website is open to invited clients during the soft launch. Please keep your code within your company. · ",
    "เว็บไซต์นี้เปิดให้ลูกค้าที่ได้รับเชิญทดลองใช้งาน กรุณาใช้รหัสภายในบริษัทของท่านเท่านั้น · "),
  privacy: c("Privacy notice", "ประกาศความเป็นส่วนตัว"),
  ribbonA: c("Soft launch", "ทดลองใช้งาน"), ribbonFor: c("invitation for ", "คำเชิญของ "),
  feedback: c("Send feedback", "ส่งความเห็น"),
  welcome: c("Code accepted · Welcome, ", "รหัสถูกต้อง · ยินดีต้อนรับ "),
  // Sign-up
  invFor: c("Invitation for {client}", "คำเชิญของ {client}"),
  invLeft: c("Code {code} · {n} of {max} accounts left", "รหัส {code} · สมัครได้อีก {n} จาก {max} บัญชี"),
  invNone: c("Code {code} · all {max} accounts used", "รหัส {code} · สร้างบัญชีครบ {max} บัญชีแล้ว"),
  invNone1: c("Code {code} · its 1 account is used", "รหัส {code} · สร้างบัญชีครบ 1 บัญชีแล้ว"),
  free: c("{plan} free for {n} from the day you sign up · no card needed", "ใช้แผน {plan} ฟรี {n} นับจากวันที่สมัคร · ไม่ต้องผูกบัตร"),
  freeAny: c("Your role’s plan free for {n} · no card needed", "ใช้แผนของบทบาทที่ท่านเลือกได้ฟรี {n} · ไม่ต้องผูกบัตร"),
  sellerPt: c("{plan} free for {n} with your invitation", "ใช้แผน {plan} ฟรี {n} ตามคำเชิญ"),
  roleNote: c("Picked from your invitation. You can change it.", "เลือกไว้ให้ตามคำเชิญ ท่านเปลี่ยนได้"),
  fullT: c("This code has no accounts left", "รหัสนี้สร้างบัญชีครบแล้ว"),
  fullP: c("{client} has used all {max} accounts on this code. To add more people, contact the PitchSnack team at support@pitchsnack.com.",
    "{client} สร้างบัญชีด้วยรหัสนี้ครบ {max} บัญชีแล้ว หากต้องการเพิ่มผู้ใช้ กรุณาติดต่อทีมงาน PitchSnack ที่ support@pitchsnack.com"),
};

export const months = (n: number, lang: "th" | "en") =>
  lang === "th" ? `${n}\u00a0เดือน` : n === 1 ? "1\u00a0month" : `${n}\u00a0months`;
