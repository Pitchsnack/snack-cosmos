import * as React from 'react';
import { Body, Button, Container, Head, Heading, Html, Img, Link, Preview, Section, Text } from '@react-email/components';
import type { TemplateEntry } from './registry';

type Lang = 'en' | 'th';
type Row = { l: string; v: string };
export const BO_SHARE_COPY = {
  subject: ['{name} shared an acquisition opportunity with you', '{name} แชร์โอกาสซื้อกิจการให้ท่าน'],
  shared: ['shared', 'แชร์'],
  title: ['an acquisition opportunity with you', 'โอกาสซื้อกิจการให้ท่าน'],
  body: ['A verified buyer on PitchSnack is looking to acquire a business like the one below. If you’re interested, contact the PitchSnack team. The buyer’s identity will remain private.', 'ผู้ซื้อที่ผ่านการยืนยันบน PitchSnack กำลังมองหาธุรกิจแบบด้านล่างนี้ หากท่านสนใจ โปรดติดต่อทีมงาน PitchSnack ตัวตนของผู้ซื้อจะถูกเก็บเป็นความลับ'],
  buyer: ['Buyer', 'ผู้ซื้อ'], location: ['Location', 'สถานที่'], rev: ['Target revenue', 'รายได้เป้าหมาย'], price: ['Price range', 'ช่วงราคา'], deal: ['Deal type', 'รูปแบบดีล'], close: ['Applications close', 'ปิดรับสมัคร'],
  hidden: ['Name hidden', 'ไม่แสดงชื่อ'], sealed: ['Sealed · managed by PitchSnack', 'ปิดผนึก · ดูแลโดย PitchSnack'],
  view: ['View buyer request', 'ดูความต้องการของผู้ซื้อ'],
  hintNew: ['New to PitchSnack? You’ll create an account first, and the buy order opens straight after. No access code needed.', 'ยังไม่มีบัญชี PitchSnack? ท่านจะสร้างบัญชีก่อน แล้วประกาศซื้อจะเปิดขึ้นทันที ไม่ต้องใช้รหัสเข้าใช้งาน'],
  hintOld: ['Sign in to PitchSnack to see it.', 'เข้าสู่ระบบ PitchSnack เพื่อดูประกาศนี้'],
  because: ['You received this email because {name}', 'ท่านได้รับอีเมลนี้เพราะ {name}'],
  becauseTail: ['a buy order with', 'ประกาศซื้อไปยัง'],
  ignore: ['on PitchSnack. If you weren’t expecting it, you can ignore this email.', 'บน PitchSnack หากท่านไม่ได้คาดหวังอีเมลนี้ สามารถเพิกเฉยได้'],
} as const;

function BuyOrderShare({ name = 'PitchSnack member', email = '', url = 'https://pitchsnack.com', lang = 'en', existing = false, card = { title: '', ref: '', description: '', tile: '#475569', buyer: '', sealed: false, rows: [] as Row[] } }: any) {
  const c = (k: keyof typeof BO_SHARE_COPY) => BO_SHARE_COPY[k][lang === 'th' ? 1 : 0];
  const L = lang as Lang;
  return (
    <Html lang={L}><Head /><Preview>{c('subject').replace('{name}', name)}</Preview>
      <Body style={main}><Container style={box}>
        <Section style={bar}><Img src="https://pitchsnack.com/email/pitchsnack-logo-white.png" width="117" height="20" alt="PitchSnack" /></Section>
        <Section style={inner}>
          <Heading style={title}>{name} <em>{c('shared')}</em> {c('title')}</Heading>
          <Text style={body}>{c('body')}</Text>
          <Section style={orderBox}>
            <Section style={head}>
              <table role="presentation" cellPadding={0} cellSpacing={0}><tbody><tr>
                <td style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: card.tile, verticalAlign: 'top' }} />
                <td style={{ paddingLeft: '12px' }}>
                  <div style={{ fontSize: '15px', color: '#151A28' }}><b>{card.title}</b> · {card.ref}</div>
                  <div style={{ fontSize: '13px', color: '#4B5263', marginTop: '4px' }}>{card.description}</div>
                </td></tr></tbody></table>
            </Section>
            <Section style={{ padding: '12px 16px 14px' }}>
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}><tbody>
                <tr><td style={lab}>{c('buyer')}</td><td style={val}>{card.buyer} <span style={pill}>{c('hidden')}</span>{card.sealed && <> <span style={sealed}>🔒 {c('sealed')}</span></>}</td></tr>
                {(card.rows as Row[]).map((r) => <tr key={r.l}><td style={lab}>{r.l}</td><td style={val}>{r.v}</td></tr>)}
              </tbody></table>
            </Section>
          </Section>
          <Section style={{ marginTop: '20px' }}><Button href={url} style={button}>{c('view')}</Button></Section>
          <Text style={hint}>{existing ? c('hintOld') : c('hintNew')}</Text>
        </Section>
        <Section style={footer}>
          <Text style={footerText}>{c('because').replace('{name}', name)} <em>{c('shared')}</em> {c('becauseTail')} <Link href={`mailto:${email}`} style={link}>{email}</Link> {c('ignore')}</Text>
          <Link href="https://www.pitchsnack.com" style={{ ...link, fontWeight: 600, fontSize: '12.5px' }}>www.pitchsnack.com</Link>
        </Section>
      </Container></Body></Html>
  );
}
export const template = { component: BuyOrderShare, subject: (d: Record<string, any>) => BO_SHARE_COPY.subject[d.lang === 'th' ? 1 : 0].replace('{name}', d.name || 'PitchSnack member'), displayName: 'Buy order share' } satisfies TemplateEntry;
const main = { backgroundColor: '#EEF1F5', fontFamily: '"DM Sans", Arial, sans-serif', padding: '24px 12px' };
const box = { maxWidth: '580px', backgroundColor: '#ffffff', border: '1px solid #E9EBF0', borderRadius: '12px', overflow: 'hidden' as const };
const bar = { backgroundColor: '#1E3E56', padding: '16px 24px' };
const inner = { padding: '24px 18px' };
const title = { fontSize: '21px', fontWeight: 700, color: '#151A28', lineHeight: '1.3', margin: '0' };
const body = { fontSize: '14.5px', color: '#3A4152', lineHeight: '1.6', margin: '10px 0 18px' };
const orderBox = { border: '1px solid #E3E6EC', borderRadius: '12px', overflow: 'hidden' as const };
const head = { backgroundColor: '#F7F9FB', padding: '14px 16px' };
const lab = { fontSize: '13.5px', color: '#6A7181', padding: '4px 12px 4px 0', verticalAlign: 'top' as const, whiteSpace: 'nowrap' as const };
const val = { fontSize: '13.5px', color: '#151A28', fontWeight: 600, padding: '4px 0' };
const pill = { backgroundColor: '#EEF0F3', borderRadius: '999px', padding: '2px 8px', fontSize: '11.5px', fontWeight: 600 };
const sealed = { backgroundColor: '#151A28', color: '#ffffff', borderRadius: '999px', padding: '2px 8px', fontSize: '11.5px', fontWeight: 600 };
const button = { backgroundColor: '#1E2A4A', color: '#ffffff', fontSize: '15px', fontWeight: 600, borderRadius: '10px', padding: '13px 22px', textDecoration: 'none' };
const hint = { fontSize: '12.5px', color: '#6A7181', margin: '10px 0 0' };
const footer = { borderTop: '1px solid #E9EBF0', padding: '16px 24px' };
const footerText = { fontSize: '12px', color: '#8A90A0', lineHeight: '1.55', margin: '0 0 8px' };
const link = { color: '#2563EB', textDecoration: 'underline' };
