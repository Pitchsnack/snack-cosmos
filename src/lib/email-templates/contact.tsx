import * as React from 'react'
import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE = 'https://pitchsnack.com'

export interface ContactConfirmProps { lang?: 'en' | 'th'; name?: string; reference?: string; topic?: string; message?: string }
export interface ContactTeamProps { reference?: string; role?: string; topic?: string; rows?: [string, string][]; message?: string }

const Frame = ({ lang, preview, children }: { lang: string; preview: string; children: React.ReactNode }) => (
  <Html lang={lang} dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={card}>
        <Section style={top}><Img src={`${SITE}/email/pitchsnack-logo.png`} width="117" height="20" alt="PitchSnack" /></Section>
        <Section style={inner}>{children}</Section>
      </Container>
    </Body>
  </Html>
)

const ContactConfirm = ({ lang = 'en', name = '', reference = '', topic = '', message = '' }: ContactConfirmProps) => {
  const th = lang === 'th'
  return (
    <Frame lang={lang} preview={th ? `เราได้รับคำถามของท่านแล้ว · ${reference}` : `We have your enquiry · ${reference}`}>
      <Heading style={h1}>{th ? `ขอบคุณ ${name} เราได้รับคำถามของท่านแล้ว` : `Thank you, ${name}. We have your enquiry.`}</Heading>
      <Text style={p}>{th ? 'ทีมงานจะตอบกลับภายใน 48 ชั่วโมง ทางอีเมลนี้' : 'The team replies within 48 hours, to this email address.'}</Text>
      <table width="100%" cellPadding={0} cellSpacing={0} role="presentation" style={box}><tbody>
        <tr><td style={cellL}>{th ? 'เลขที่อ้างอิง' : 'Reference'}</td><td style={cellV}>{reference}</td></tr>
        <tr><td style={{ ...cellL, borderTop: '1px solid #E5E7EB' }}>{th ? 'หัวข้อ' : 'Topic'}</td><td style={{ ...cellV, borderTop: '1px solid #E5E7EB' }}>{topic}</td></tr>
      </tbody></table>
      <Text style={q}>{message}</Text>
      <Text style={small}>{th ? 'มีคำถาม? เขียนถึง support@pitchsnack.com' : 'Questions? Write to support@pitchsnack.com.'}</Text>
    </Frame>
  )
}

const ContactTeam = ({ reference = '', rows = [], message = '' }: ContactTeamProps) => (
  <Frame lang="en" preview={`New enquiry · ${reference}`}>
    <Heading style={h1}>New enquiry · {reference}</Heading>
    <table width="100%" cellPadding={0} cellSpacing={0} role="presentation" style={box}><tbody>
      {rows.map(([l, v], i) => (
        <tr key={i}><td style={{ ...cellL, borderTop: i ? '1px solid #E5E7EB' : 'none' }}>{l}</td><td style={{ ...cellV, borderTop: i ? '1px solid #E5E7EB' : 'none' }}>{v}</td></tr>
      ))}
    </tbody></table>
    <Text style={q}>{message}</Text>
    <Text style={small}>Reply to this email to answer the sender directly.</Text>
  </Frame>
)

export const confirmTemplate = {
  component: ContactConfirm,
  subject: (d: Record<string, any>) => d.lang === 'th' ? `เราได้รับคำถามของท่านแล้ว · ${d.reference}` : `We have your enquiry · ${d.reference}`,
  displayName: 'Contact enquiry · confirmation',
  previewData: { lang: 'en', name: 'Somchai', reference: 'ENQ-2610-0421', topic: 'Selling my business', message: 'I would like to know how listing works for a packaging business.' },
} satisfies TemplateEntry

export const teamTemplate = {
  component: ContactTeam,
  subject: (d: Record<string, any>) => `New enquiry · ${d.role} · ${d.topic} · ${d.reference}`,
  displayName: 'Contact enquiry · team',
  to: 'support@pitchsnack.com',
  previewData: { reference: 'ENQ-2610-0421', role: 'seller', topic: 'Selling my business', rows: [['Name', 'Somchai Jaidee'], ['Email', 'somchai@example.com']], message: 'Hello' },
} satisfies TemplateEntry

const font = '"DM Sans", "IBM Plex Sans Thai Looped", Arial, sans-serif'
const main = { backgroundColor: '#F4F5F7', fontFamily: font, padding: '24px 0' }
const card = { maxWidth: '560px', backgroundColor: '#ffffff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden' as const }
const top = { padding: '16px 24px', borderBottom: '1px solid #E5E7EB' }
const inner = { padding: '24px' }
const h1 = { fontSize: '20px', fontWeight: 600, color: '#111827', margin: '0 0 10px' }
const p = { fontSize: '14px', lineHeight: '1.6', color: '#374151', margin: '0 0 14px' }
const q = { fontSize: '14px', lineHeight: '1.6', color: '#374151', backgroundColor: '#FAFBFC', borderLeft: '3px solid #E5E7EB', padding: '10px 14px', margin: '0 0 14px', whiteSpace: 'pre-wrap' as const }
const box = { border: '1px solid #E5E7EB', borderRadius: '10px', margin: '0 0 18px', borderCollapse: 'separate' as const }
const cellL = { fontSize: '13px', color: '#6B7280', padding: '9px 12px', width: '38%' }
const cellV = { fontSize: '13px', color: '#111827', padding: '9px 12px' }
const small = { fontSize: '12.5px', color: '#6B7280', margin: '10px 0 0' }
