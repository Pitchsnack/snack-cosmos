import * as React from 'react';
import { Body, Button, Container, Head, Heading, Html, Img, Link, Preview, Section, Text } from '@react-email/components';
import type { TemplateEntry } from './registry';

type Kind = 'startup' | 'investor' | 'firm';
type Lang = 'th' | 'en';

const DEF = 'PitchSnack team';
const COPY = {
  subject: {
    startup: ['PitchSnack has prepared your business profile', 'PitchSnack เตรียมโปรไฟล์ธุรกิจของท่านไว้แล้ว'],
    investor: ['PitchSnack has prepared your investor profile', 'PitchSnack เตรียมโปรไฟล์นักลงทุนของท่านไว้แล้ว'],
    firm: ['PitchSnack has prepared your firm profile', 'PitchSnack เตรียมโปรไฟล์บริษัทของท่านไว้แล้ว'],
  },
  title: {
    startup: ['Your business profile is ready for you to check', 'โปรไฟล์ธุรกิจของท่านพร้อมให้ตรวจสอบแล้ว'],
    investor: ['Your investor profile is ready for you to check', 'โปรไฟล์นักลงทุนของท่านพร้อมให้ตรวจสอบแล้ว'],
    firm: ['Your firm profile is ready for you to check', 'โปรไฟล์บริษัทของท่านพร้อมให้ตรวจสอบแล้ว'],
  },
  what: { startup: ['business', 'ธุรกิจ'], investor: ['investor', 'นักลงทุน'], firm: ['firm', 'บริษัท'] },
  last: {
    startup: ["Buyers won't see your business until you've checked it and sent it to our team for approval.", 'ผู้ซื้อจะยังไม่เห็นธุรกิจของท่าน จนกว่าท่านจะตรวจสอบและส่งให้ทีมงานอนุมัติ'],
    investor: ["Sellers won't see your profile until you've checked it and published it.", 'ผู้ขายจะยังไม่เห็นโปรไฟล์ของท่าน จนกว่าท่านจะตรวจสอบและเผยแพร่'],
    firm: ["Sellers and buyers won't see your firm until you've checked it and published it.", 'ผู้ขายและผู้ซื้อจะยังไม่เห็นบริษัทของท่าน จนกว่าท่านจะตรวจสอบและเผยแพร่'],
  },
  chip: { startup: ['SELLER', 'ผู้ขาย', '#FEF3DE', '#8A4B06'], investor: ['BUYER', 'ผู้ซื้อ', '#EEF2FF', '#4338CA'], firm: ['ADVISOR', 'ที่ปรึกษา', '#E6F4F1', '#0F766E'] },
} as const;

const ix = (l: Lang) => (l === 'th' ? 1 : 0);
const fmt = (d: string | undefined, l: Lang) => {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString(l === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' }); } catch { return d; }
};

function ProfileInvitation({ kind = 'startup', lang = 'en', email = '', sentBy = DEF, note, expires, url = 'https://pitchsnack.com' }: {
  kind?: Kind; lang?: Lang; email?: string; sentBy?: string; note?: string | null; expires?: string; url?: string;
}) {
  const i = ix(lang);
  const typed = sentBy && sentBy.trim() && sentBy.trim() !== DEF;
  const first = typed ? sentBy.trim().split(/\s+/)[0] : '';
  const what = COPY.what[kind][i];
  const open = lang === 'th'
    ? `${typed ? `คุณ${first} จาก PitchSnack` : 'ทีมงาน PitchSnack'} เตรียมโปรไฟล์${what}ไว้ให้ท่านแล้ว กดยอมรับคำเชิญเพื่อสร้างบัญชีและตรวจสอบข้อมูล ${COPY.last[kind][1]}`
    : `${typed ? `${first} from PitchSnack has` : 'The PitchSnack team has'} prepared a${kind === 'investor' ? 'n' : ''} ${what} profile for you. Accept the invitation to create your account and check it. ${COPY.last[kind][0]}`;
  const sign = typed ? `— ${sentBy.trim()}, PitchSnack` : lang === 'th' ? '— ทีมงาน PitchSnack' : '— PitchSnack team';
  const [ce, ct, cbg, cfg] = COPY.chip[kind];
  const groups = lang === 'th'
    ? ['หากท่านไม่ได้คาดว่าจะได้รับอีเมลนี้', 'ไม่ต้องทำอะไร', 'ระบบจะไม่สร้างบัญชีจนกว่าท่านจะกดยอมรับ']
    : ["If you didn't expect this email,", "you don't need to do anything:", 'no account is made', 'unless you accept.'];
  return (
    <Html lang={lang}>
      <Head />
      <Preview>{COPY.subject[kind][i]}</Preview>
      <Body style={main}>
        <Container style={card}>
          <Section style={top}><Img src="https://pitchsnack.com/email/pitchsnack-logo-white.png" width="117" height="20" alt="PitchSnack" /></Section>
          <Section style={inner}>
            <Text style={{ ...chip, backgroundColor: cbg, color: cfg }}>{lang === 'th' ? ct : ce}</Text>
            <Heading style={title}>{COPY.title[kind][i]}</Heading>
            <Text style={body}>{open}</Text>
            {note ? <Text style={quote}>“{note}”<br /><span style={{ color: '#6A7181' }}>{sign}</span></Text> : null}
            <Section style={box}>
              <Text style={row}><b>{lang === 'th' ? 'คำเชิญสำหรับ' : 'Invitation for'}:</b> {email}</Text>
              <Text style={row}><b>{lang === 'th' ? 'จาก' : 'From'}:</b> {typed ? sentBy.trim() : lang === 'th' ? 'ทีมงาน PitchSnack' : DEF}</Text>
              <Text style={row}><b>{lang === 'th' ? 'ใช้ได้ถึง' : 'Valid until'}:</b> {fmt(expires, lang)} ({lang === 'th' ? '7 วัน' : '7 days'})</Text>
            </Section>
            <Button href={url} style={button}>{lang === 'th' ? 'ยอมรับคำเชิญ' : 'Accept the invitation'}</Button>
            <Text style={hint}>{lang === 'th' ? 'เปิด PitchSnack ได้ทันที ไม่ต้องใช้รหัสเข้าใช้งาน' : 'Opens PitchSnack straight away, no access code needed'}</Text>
            <Text style={hint}>{groups.map((g, k) => <React.Fragment key={k}><span style={{ whiteSpace: 'nowrap' }}>{g}</span>{k < groups.length - 1 ? ' ' : ''}</React.Fragment>)}</Text>
          </Section>
          <Section style={footer}>
            <Text style={footerText}>
              {lang === 'th'
                ? <>ท่านได้รับอีเมลนี้เพราะทีมงาน PitchSnack เชิญให้ท่านดูแลโปรไฟล์{what} มีคำถาม? เขียนถึง <Link href="mailto:support@pitchsnack.com" style={link}>support@pitchsnack.com</Link></>
                : <>You get this email because PitchSnack invited you to take over a{kind === 'investor' ? 'n' : ''} {what} profile. Questions? Write to <Link href="mailto:support@pitchsnack.com" style={link}>support@pitchsnack.com</Link>.</>}
            </Text>
            <Text style={footerText}>PitchSnack · Bangkok, Thailand</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: ProfileInvitation,
  subject: (d: Record<string, any>) => COPY.subject[(d.kind as Kind) ?? 'startup'][ix(d.lang)],
  displayName: 'Profile invitation',
  previewData: { kind: 'startup', lang: 'en', email: 'owner@example.com', sentBy: DEF, note: 'We filled this in from our call.', expires: new Date(Date.now() + 7 * 86400000).toISOString(), url: 'https://pitchsnack.com/handover/x' },
} satisfies TemplateEntry;

const main = { backgroundColor: '#ffffff', fontFamily: '"DM Sans", Arial, sans-serif', padding: '24px 12px' };
const card = { maxWidth: '580px', backgroundColor: '#ffffff', border: '1px solid #E9EBF0', borderRadius: '12px', overflow: 'hidden' as const };
const top = { backgroundColor: '#1E3E56', padding: '16px 24px' };
const inner = { padding: '24px 22px' };
const chip = { display: 'inline-block', fontSize: '11px', fontWeight: 700, letterSpacing: '.06em', borderRadius: '999px', padding: '3px 10px', margin: '0 0 12px' };
const title = { fontSize: '21px', fontWeight: 700, color: '#151A28', lineHeight: '1.3', margin: '0' };
const body = { fontSize: '14.5px', color: '#3A4152', lineHeight: '1.6', margin: '10px 0 16px' };
const quote = { fontSize: '14px', color: '#151A28', fontStyle: 'italic' as const, borderLeft: '3px solid #BFDBFE', padding: '4px 0 4px 12px', margin: '0 0 16px', lineHeight: '1.55' };
const box = { backgroundColor: '#F4F9FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '10px 14px', margin: '0 0 18px' };
const row = { fontSize: '13px', color: '#3A4152', margin: '3px 0' };
const button = { backgroundColor: '#1E2A4A', color: '#ffffff', fontSize: '15px', fontWeight: 600, borderRadius: '10px', padding: '13px 22px', textDecoration: 'none' };
const hint = { fontSize: '12.5px', color: '#6A7181', margin: '10px 0 0', lineHeight: '1.55' };
const footer = { borderTop: '1px solid #E9EBF0', padding: '16px 24px' };
const footerText = { fontSize: '12px', color: '#8A90A0', lineHeight: '1.55', margin: '0 0 6px' };
const link = { color: '#2563EB', textDecoration: 'underline' };
