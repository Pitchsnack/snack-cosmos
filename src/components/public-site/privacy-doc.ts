/** Privacy notice text (EN/TH), shared by the pop-up and /privacy. **x** = bold, [key] = value from privacyConfig. */
export type Two = { en: string; th: string };
export type DocBlock = { k: "title" | "h" | "p"; en: string; th: string } | { k: "ul"; items: Two[] };
export const PRIVACY_DOC: DocBlock[] = [
{
"k": "title",
"en": "Privacy notice",
"th": "ประกาศความเป็นส่วนตัว"
},
{
"k": "p",
"en": "Last updated 8 October 2026 · In effect from {effective}",
"th": "ปรับปรุงล่าสุด 8 ตุลาคม 2569 · มีผลใช้ {effective}"
},
{
"k": "p",
"en": "This notice explains what personal data PitchSnack collects, why, who can see it, how long we keep it, and your rights, under Thailand’s Personal Data Protection Act B.E. 2562 (2019).",
"th": "ประกาศนี้อธิบายว่า PitchSnack เก็บข้อมูลส่วนบุคคลใด ใช้เพื่ออะไร ใครเห็นได้ เก็บไว้นานเท่าใด และท่านมีสิทธิอะไรบ้าง ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562"
},
{
"k": "h",
"en": "1. Who we are",
"th": "1. เราคือใคร"
},
{
"k": "p",
"en": "PitchSnack is the data controller under Thailand’s Personal Data Protection Act B.E. 2562 (2019) (PDPA) for the personal data you give us on the PitchSnack website and app.",
"th": "PitchSnack เป็นผู้ควบคุมข้อมูลส่วนบุคคลตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) สำหรับข้อมูลที่ท่านให้ไว้บนเว็บไซต์และแอป PitchSnack"
},
{
"k": "p",
"en": "This notice applies to everyone who uses PitchSnack: sellers, buyers and investors, advisers and partners, and anyone who contacts us through the Contact page.",
"th": "ประกาศนี้ใช้กับทุกคนที่ใช้ PitchSnack ได้แก่ ผู้ขาย ผู้ซื้อและนักลงทุน ที่ปรึกษาและพาร์ทเนอร์ และผู้ที่ติดต่อเราผ่านหน้าติดต่อเรา"
},
{
"k": "h",
"en": "2. What we collect",
"th": "2. ข้อมูลที่เราเก็บ"
},
{
"k": "p",
"en": "We collect only what we need to run the service. Most of it you give us yourself. Some comes from the Department of Business Development’s company registry or your company website, to fill in details for you.",
"th": "เราเก็บเฉพาะข้อมูลที่จำเป็นต่อการให้บริการ ส่วนใหญ่ท่านเป็นผู้ให้ไว้เอง บางส่วนเราได้จากทะเบียนบริษัทของกรมพัฒนาธุรกิจการค้า หรือจากเว็บไซต์บริษัทของท่าน เพื่อเติมข้อมูลให้ท่าน"
},
{
"k": "ul",
"items": [
{
"en": "Your account: Name, email, phone, password (stored encrypted), your role (seller, buyer or adviser), your language, and your Google or Microsoft account if you sign up with one",
"th": "บัญชีผู้ใช้: ชื่อ อีเมล เบอร์โทรศัพท์ รหัสผ่าน (เก็บแบบเข้ารหัส) บทบาท (ผู้ขาย ผู้ซื้อ หรือที่ปรึกษา) ภาษาที่เลือก และบัญชี Google หรือ Microsoft หากท่านใช้สมัคร"
},
{
"en": "Your company and verification: Company name, registration number, licences, company documents, your job title, and the names of directors or team members you add",
"th": "บริษัทและการตรวจสอบ: ชื่อบริษัท เลขทะเบียนนิติบุคคล ใบอนุญาต เอกสารบริษัท ตำแหน่งของท่าน และชื่อผู้บริหารหรือทีมงานที่ท่านใส่ไว้"
},
{
"en": "Listings and mandates: Details of a business you list for sale, its figures, and a buyer’s investment mandate. Mostly company data, but it can include people’s names",
"th": "ประกาศขายและความต้องการลงทุน: ข้อมูลกิจการที่ท่านประกาศขาย ตัวเลขทางการเงิน และความต้องการลงทุนของผู้ซื้อ ส่วนใหญ่เป็นข้อมูลบริษัท แต่อาจมีชื่อบุคคลรวมอยู่ด้วย"
},
{
"en": "Deal activity: NDAs you sign (name, email and time of signing), messages, private notes, favourites and your Pipeline steps",
"th": "กิจกรรมในดีล: NDA ที่ท่านลงนาม (ชื่อ อีเมล และเวลาที่ลงนาม) ข้อความ บันทึกส่วนตัว รายการโปรด และขั้นตอนใน Pipeline"
},
{
"en": "Enquiries: What you fill in on the Contact form, and emails you send us",
"th": "คำถามที่ส่งถึงเรา: สิ่งที่ท่านกรอกในแบบฟอร์มติดต่อเรา และอีเมลที่ท่านส่งถึงเรา"
},
{
"en": "Billing: Your plan, invoices, and the name and address for tax invoices. We don’t keep your card number; our payment provider does",
"th": "การชำระเงิน: แผนที่ท่านเลือก ใบแจ้งหนี้ และชื่อและที่อยู่สำหรับออกใบกำกับภาษี เราไม่เก็บเลขบัตรของท่าน ผู้ให้บริการชำระเงินเป็นผู้เก็บ"
},
{
"en": "Technical data: IP address, browser and device type, sign-in times, and whether you open our alert emails",
"th": "ข้อมูลทางเทคนิค: ที่อยู่ IP ประเภทเบราว์เซอร์และอุปกรณ์ เวลาเข้าสู่ระบบ และการเปิดอีเมลแจ้งเตือน"
}
]
},
{
"k": "p",
"en": "We don’t ask for sensitive data such as religion, health or biometrics. Please don’t include it in messages or documents.",
"th": "เราไม่ขอข้อมูลส่วนบุคคลที่มีความอ่อนไหว เช่น ศาสนา สุขภาพ หรือข้อมูลชีวภาพ กรุณาอย่าใส่ข้อมูลเหล่านี้ในข้อความหรือเอกสาร"
},
{
"k": "h",
"en": "3. Why we use it",
"th": "3. เราใช้ข้อมูลเพื่ออะไร"
},
{
"k": "p",
"en": "The PDPA requires a legal basis for every use of your data.",
"th": "PDPA กำหนดให้เราต้องมีฐานทางกฎหมายสำหรับการใช้ข้อมูลทุกครั้ง"
},
{
"k": "ul",
"items": [
{
"en": "Create and run your account, and let you use Browse, NDAs, Messages and the Pipeline (legal basis: Contract)",
"th": "สร้างและดูแลบัญชีของท่าน ให้ท่านใช้ Browse, NDA, ข้อความ และ Pipeline (ฐานทางกฎหมาย: สัญญา)"
},
{
"en": "Verify companies and show badges (legal basis: Contract, and legitimate interests (a trustworthy market))",
"th": "ตรวจสอบบริษัทและแสดงตราสัญลักษณ์ (ฐานทางกฎหมาย: สัญญา และประโยชน์โดยชอบด้วยกฎหมาย (ให้ตลาดน่าเชื่อถือ))"
},
{
"en": "Send deal and match alerts (legal basis: Contract; turn them off in Notifications)",
"th": "ส่งอีเมลแจ้งเตือนเรื่องดีลและการจับคู่ (ฐานทางกฎหมาย: สัญญา ท่านปิดได้ที่ การแจ้งเตือน)"
},
{
"en": "Reply to your Contact enquiry (legal basis: Consent (the box you tick))",
"th": "ตอบคำถามที่ท่านส่งผ่านหน้าติดต่อเรา (ฐานทางกฎหมาย: ความยินยอม (ช่องที่ท่านทำเครื่องหมาย))"
},
{
"en": "Invoices, tax invoices and accounting records (legal basis: Legal obligation)",
"th": "ออกใบแจ้งหนี้และใบกำกับภาษี และเก็บบัญชี (ฐานทางกฎหมาย: หน้าที่ตามกฎหมาย)"
},
{
"en": "Prevent fraud, keep the service secure and improve it (legal basis: Legitimate interests)",
"th": "ป้องกันการฉ้อโกง ดูแลความปลอดภัย และปรับปรุงบริการ (ฐานทางกฎหมาย: ประโยชน์โดยชอบด้วยกฎหมาย)"
},
{
"en": "Send news and marketing (legal basis: Consent, only if you opt in)",
"th": "ส่งข่าวสารและข้อเสนอทางการตลาด (ฐานทางกฎหมาย: ความยินยอม เฉพาะเมื่อท่านเลือกรับ)"
}
]
},
{
"k": "p",
"en": "If you don’t give data the contract needs, such as your email, we can’t open an account or provide the service.",
"th": "หากท่านไม่ให้ข้อมูลที่จำเป็นต่อสัญญา เช่น อีเมล เราจะสร้างบัญชีหรือให้บริการแก่ท่านไม่ได้"
},
{
"k": "h",
"en": "4. Who sees your data",
"th": "4. ใครเห็นข้อมูลของท่าน"
},
{
"k": "ul",
"items": [
{
"en": "Other PitchSnack users. Before an NDA is approved, others see only a code name, the sector and figures as ranges, never a business name, people’s names or contacts. When the seller approves an NDA, both sides see each other’s names and contacts.",
"th": "ผู้ใช้อื่นบน PitchSnack ก่อนอนุมัติ NDA ผู้อื่นเห็นเพียงชื่อโครงการ อุตสาหกรรม และตัวเลขเป็นช่วง ไม่เห็นชื่อกิจการ ชื่อบุคคล หรือช่องทางติดต่อ เมื่อผู้ขายอนุมัติ NDA ทั้งสองฝ่ายจึงเห็นชื่อและช่องทางติดต่อของกันและกัน"
},
{
"en": "Advisers your client invites see a deal’s details only once they are invited into it. Adviser reviews never show the client’s name.",
"th": "ที่ปรึกษาที่ลูกค้าเชิญ เห็นข้อมูลของดีลนั้นเมื่อลูกค้าเชิญเข้าร่วมเท่านั้น รีวิวที่ปรึกษาไม่แสดงชื่อลูกค้า"
},
{
"en": "Our service providers, such as cloud hosting and database, email and payments. They use the data only on our instructions, under a data processing agreement.",
"th": "ผู้ให้บริการของเรา เช่น ผู้ให้บริการระบบคลาวด์และฐานข้อมูล อีเมล และการชำระเงิน ซึ่งใช้ข้อมูลตามคำสั่งของเราเท่านั้นภายใต้สัญญาประมวลผลข้อมูล"
},
{
"en": "Authorities, when the law requires it, such as the Revenue Department or a court order.",
"th": "หน่วยงานรัฐ เมื่อกฎหมายกำหนด เช่น กรมสรรพากร หรือตามคำสั่งศาล"
}
]
},
{
"k": "p",
"en": "We never sell your personal data, and we don’t share it with advertisers.",
"th": "เราไม่ขายข้อมูลส่วนบุคคลของท่าน และไม่ให้ผู้ลงโฆษณานำไปใช้"
},
{
"k": "h",
"en": "5. Transfers outside Thailand",
"th": "5. การส่งข้อมูลไปต่างประเทศ"
},
{
"k": "p",
"en": "Some of our service providers store data outside Thailand {transfer}. We send data only to countries with adequate protection, or under contracts with the safeguards the PDPA requires.",
"th": "ผู้ให้บริการบางรายของเราเก็บข้อมูลไว้นอกประเทศไทย {transfer} เราส่งข้อมูลไปเฉพาะประเทศที่มีมาตรฐานคุ้มครองข้อมูลเพียงพอ หรือภายใต้สัญญาที่มีมาตรการคุ้มครองตามที่ PDPA กำหนด"
},
{
"k": "h",
"en": "6. How long we keep it",
"th": "6. เราเก็บข้อมูลนานเท่าใด"
},
{
"k": "ul",
"items": [
{
"en": "Account and profile: While the account is open, and 2 years after it closes",
"th": "บัญชีและโปรไฟล์: ตลอดที่บัญชียังใช้งาน และ 2 ปีหลังปิดบัญชี"
},
{
"en": "Signed NDAs: The NDA’s term, plus 10 years",
"th": "NDA ที่ลงนาม: ตลอดอายุ NDA และอีก 10 ปี"
},
{
"en": "Deal messages and notes: 2 years after the deal closes",
"th": "ข้อความและบันทึกในดีล: 2 ปีหลังดีลปิด"
},
{
"en": "Contact enquiries: 2 years after our reply",
"th": "คำถามจากหน้าติดต่อเรา: 2 ปีหลังเราตอบกลับ"
},
{
"en": "Invoices and accounts: At least 5 years, as accounting and tax law requires",
"th": "ใบแจ้งหนี้และบัญชี: อย่างน้อย 5 ปี ตามกฎหมายบัญชีและภาษี"
},
{
"en": "Email log: 12 months",
"th": "บันทึกการส่งอีเมล: 12 เดือน"
}
]
},
{
"k": "p",
"en": "After that, we delete the data or make it anonymous.",
"th": "เมื่อครบกำหนด เราลบข้อมูลหรือทำให้ไม่สามารถระบุตัวบุคคลได้"
},
{
"k": "h",
"en": "7. Your rights",
"th": "7. สิทธิของท่าน"
},
{
"k": "p",
"en": "Under the PDPA you can:",
"th": "ภายใต้ PDPA ท่านมีสิทธิ"
},
{
"k": "ul",
"items": [
{
"en": "Access your data and get a copy",
"th": "ขอเข้าถึงและขอรับสำเนาข้อมูล"
},
{
"en": "Have your data sent to another provider",
"th": "ขอให้ส่งข้อมูลไปยังผู้ให้บริการรายอื่น"
},
{
"en": "Object to how we use it",
"th": "คัดค้านการใช้ข้อมูล"
},
{
"en": "Have it deleted",
"th": "ขอให้ลบหรือทำลายข้อมูล"
},
{
"en": "Have its use paused",
"th": "ขอให้ระงับการใช้ข้อมูล"
},
{
"en": "Have it corrected",
"th": "ขอให้แก้ไขข้อมูลให้ถูกต้อง"
},
{
"en": "Withdraw your consent at any time",
"th": "ถอนความยินยอมได้ทุกเมื่อ"
},
{
"en": "Complain to the Office of the Personal Data Protection Committee (PDPC)",
"th": "ร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส.)"
}
]
},
{
"k": "p",
"en": "Write to privacy@pitchsnack.com. We may ask you to confirm who you are first, and we reply within 30 days, free of charge. You can edit most of your data yourself in My Company, and turn alert emails off in Notifications.",
"th": "ส่งคำขอถึง privacy@pitchsnack.com เราอาจขอยืนยันตัวตนของท่านก่อน และจะตอบภายใน 30 วัน ไม่มีค่าใช้จ่าย ข้อมูลส่วนใหญ่ท่านแก้ไขเองได้ที่ My Company และปิดอีเมลแจ้งเตือนได้ที่ การแจ้งเตือน"
},
{
"k": "p",
"en": "In some cases the law lets us refuse, for example when tax law requires us to keep an invoice. We will tell you why.",
"th": "บางกรณีเราอาจปฏิเสธคำขอได้ตามที่กฎหมายอนุญาต เช่น เมื่อต้องเก็บใบแจ้งหนี้ไว้ตามกฎหมายภาษี เราจะแจ้งเหตุผลให้ท่านทราบ"
},
{
"k": "h",
"en": "8. Cookies and browser storage",
"th": "8. คุกกี้และการจัดเก็บในเบราว์เซอร์"
},
{
"k": "p",
"en": "We use essential cookies to keep you signed in and secure, and browser storage to remember your language. We don’t use advertising cookies.",
"th": "เราใช้คุกกี้ที่จำเป็นเพื่อให้ท่านเข้าสู่ระบบได้และปลอดภัย และใช้พื้นที่จัดเก็บในเบราว์เซอร์เพื่อจำภาษาที่ท่านเลือก เราไม่ใช้คุกกี้โฆษณา"
},
{
"k": "p",
"en": "If we use analytics cookies, we will ask for your consent first.",
"th": "หากเราจะใช้คุกกี้เพื่อวิเคราะห์การใช้งาน เราจะขอความยินยอมจากท่านก่อน"
},
{
"k": "h",
"en": "9. Keeping it safe",
"th": "9. การรักษาความปลอดภัย"
},
{
"k": "p",
"en": "We encrypt data in transit and at rest, give staff only the access they need, and log who opens data-room files. If a breach puts your data at risk, we tell the PDPC within 72 hours, and tell you without delay if the risk is high.",
"th": "เราเข้ารหัสข้อมูลระหว่างส่งและขณะจัดเก็บ จำกัดสิทธิ์พนักงานให้เข้าถึงเท่าที่จำเป็น และบันทึกการเข้าถึงเอกสารในห้องข้อมูล หากเกิดเหตุละเมิดข้อมูลที่มีความเสี่ยง เราจะแจ้ง สคส. ภายใน 72 ชั่วโมง และแจ้งท่านโดยไม่ชักช้าหากมีความเสี่ยงสูง"
},
{
"k": "h",
"en": "10. Minors",
"th": "10. ผู้เยาว์"
},
{
"k": "p",
"en": "PitchSnack is a service for businesses and is not meant for anyone under 20. We don’t knowingly collect minors’ data.",
"th": "PitchSnack เป็นบริการสำหรับธุรกิจ ไม่ได้มีไว้สำหรับผู้ที่อายุต่ำกว่า 20 ปี เราไม่เก็บข้อมูลของผู้เยาว์โดยเจตนา"
},
{
"k": "h",
"en": "11. Changes to this notice",
"th": "11. การเปลี่ยนแปลงประกาศนี้"
},
{
"k": "p",
"en": "If we change this notice in a way that matters, we tell you by email or in the app before it takes effect, and update the \"Last updated\" date at the top.",
"th": "หากเราเปลี่ยนแปลงประกาศนี้ในสาระสำคัญ เราจะแจ้งทางอีเมลหรือในแอปก่อนมีผลใช้ และปรับวันที่ \"ปรับปรุงล่าสุด\" ด้านบน"
},
{
"k": "h",
"en": "12. Contact us about your data",
"th": "12. ติดต่อเรื่องข้อมูลส่วนบุคคล"
},
{
"k": "p",
"en": "Data protection officer (DPO): privacy@pitchsnack.com",
"th": "เจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคล (DPO): privacy@pitchsnack.com"
},
{
"k": "p",
"en": "The Thai and English versions say the same thing. If they differ, the Thai version applies.",
"th": "ฉบับภาษาไทยและภาษาอังกฤษมีเนื้อหาเดียวกัน หากมีข้อขัดแย้ง ให้ใช้ฉบับภาษาไทย"
}
];
