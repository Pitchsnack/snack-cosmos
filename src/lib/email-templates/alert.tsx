import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface AlertEmailProps {
  role?: 'seller' | 'buyer' | 'advisor'
  lang?: 'en' | 'th'
  subject?: string
  title?: string
  body?: string
  quote?: string
  details?: [string, string][]
  button?: string
  url?: string
  place?: string
  color?: string
}

const SITE = 'https://pitchsnack.com'

const AlertEmail = ({ role = 'seller', lang = 'en', title = 'PitchSnack update', body = '', quote, details, button = 'Open PitchSnack', url = SITE, place = 'PitchSnack', color = '#1E2A4A' }: AlertEmailProps) => {
  const seller = role === 'seller'
  const advisor = role === 'advisor'
  return (
    <Html lang={lang} dir="ltr">
      <Head />
      <Preview>{title}</Preview>
      <Body style={main}>
        <Container style={card}>
          <Section style={top}>
            <table width="100%" cellPadding={0} cellSpacing={0} role="presentation"><tbody><tr>
              <td><Img src={`${SITE}/email/pitchsnack-logo.png`} width="117" height="20" alt="PitchSnack" /></td>
              <td align="right">
                <span style={{ ...chip, backgroundColor: advisor ? '#E0F5F2' : seller ? '#F6A823' : '#4338CA', color: advisor ? '#0F766E' : seller ? '#0E162F' : '#FFFFFF' }}>
                  {advisor ? (lang === 'th' ? 'ที่ปรึกษา' : 'ADVISOR') : lang === 'th' ? (seller ? 'ผู้ขาย' : 'ผู้ซื้อ') : seller ? 'SELLER' : 'BUYER'}
                </span>
              </td>
            </tr></tbody></table>
          </Section>
          <Section style={inner}>
            <div style={{ ...tile, backgroundColor: color }} />
            <Heading style={h1}>{title}</Heading>
            {body && <Text style={p}>{body}</Text>}
            {quote && <Text style={q}>“{quote}”</Text>}
            {details && details.length > 0 && (
              <table width="100%" cellPadding={0} cellSpacing={0} role="presentation" style={box}><tbody>
                {details.map(([l, v], i) => (
                  <tr key={i}>
                    <td style={{ ...cellL, borderTop: i ? '1px solid #E5E7EB' : 'none' }}>{l}</td>
                    <td style={{ ...cellV, borderTop: i ? '1px solid #E5E7EB' : 'none' }}>{v}</td>
                  </tr>
                ))}
              </tbody></table>
            )}
            <Button href={url} style={btn}>{button}</Button>
            <Text style={small}>{lang === 'th' ? `เปิด ${place} ใน PitchSnack` : `Opens ${place} in PitchSnack.`}</Text>
            {advisor && <Text style={small}>You get this email because you use PitchSnack as an advisor. Turn email alerts off in Account &amp; activity › Notifications, in the Seller or Buyer view. Questions? Write to support@pitchsnack.com.</Text>}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AlertEmail,
  subject: (d: Record<string, any>) => d.subject || 'PitchSnack update',
  displayName: 'Email alert',
  previewData: {
    role: 'seller', subject: 'Project Nimbus is live on PitchSnack', title: 'Your listing is approved and live',
    body: 'Admin approved Project Nimbus. Buyers can now find it in Browse listings.',
    details: [['Listing', 'Project Nimbus'], ['Approved', '3 Oct 2026']], button: 'View my listing', place: 'My Company › Public view', color: '#16A34A',
  },
} satisfies TemplateEntry

const font = '"DM Sans", Arial, sans-serif'
const main = { backgroundColor: '#ffffff', fontFamily: font, padding: '24px 0' }
const card = { maxWidth: '560px', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden' as const }
const top = { padding: '16px 24px', borderBottom: '1px solid #E5E7EB' }
const chip = { fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', padding: '4px 10px', borderRadius: '999px' }
const inner = { padding: '24px' }
const tile = { width: '44px', height: '44px', borderRadius: '12px', marginBottom: '16px' }
const h1 = { fontSize: '20px', fontWeight: 600, color: '#111827', margin: '0 0 10px' }
const p = { fontSize: '14px', lineHeight: '1.6', color: '#374151', margin: '0 0 14px' }
const q = { fontSize: '14px', lineHeight: '1.6', color: '#374151', backgroundColor: '#FAFBFC', borderLeft: '3px solid #E5E7EB', padding: '10px 14px', margin: '0 0 14px' }
const box = { border: '1px solid #E5E7EB', borderRadius: '10px', margin: '0 0 18px', borderCollapse: 'separate' as const }
const cellL = { fontSize: '13px', color: '#6B7280', padding: '9px 12px', width: '38%' }
const cellV = { fontSize: '13px', color: '#111827', padding: '9px 12px' }
const btn = { backgroundColor: '#1E2A4A', color: '#ffffff', fontSize: '14px', fontWeight: 600, borderRadius: '9px', padding: '13px 20px', textDecoration: 'none' }
const small = { fontSize: '12.5px', color: '#6B7280', margin: '10px 0 0' }
