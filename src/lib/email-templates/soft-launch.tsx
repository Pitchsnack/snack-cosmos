import * as React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE = 'https://pitchsnack.com'

/** One language part: title, lines (numbered steps start with "1. "), an optional code box and a button. */
export type MailPart = { title: string; lines: string[]; code?: string; button?: { label: string; url: string } }
export interface SoftLaunchMailProps { subject?: string; th?: MailPart; en?: MailPart }

const Part = ({ p }: { p: MailPart }) => (
  <>
    <Heading style={h1}>{p.title}</Heading>
    {p.lines.map((l, i) => <Text key={i} style={/^\d\. /.test(l) ? step : para}>{l}</Text>)}
    {p.code && <Text style={codeBox}>{p.code}</Text>}
    {p.button && <Button href={p.button.url} style={btn}>{p.button.label}</Button>}
  </>
)

const SoftLaunchMail = ({ subject = '', th, en }: SoftLaunchMailProps) => (
  <Html lang="th" dir="ltr">
    <Head />
    <Preview>{subject}</Preview>
    <Body style={main}>
      <Container style={card}>
        <Section style={top}><Img src={`${SITE}/email/pitchsnack-logo.png`} width="117" height="20" alt="PitchSnack" /></Section>
        <Section style={inner}>
          {th && <Part p={th} />}
          {th && en && <Hr style={hr} />}
          {en && <Part p={en} />}
          <Text style={small}>Questions? Write to support@pitchsnack.com.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const softLaunchTemplate = {
  component: SoftLaunchMail,
  subject: (d: Record<string, any>) => d.subject ?? 'PitchSnack',
  displayName: 'Soft launch · invitation and free plan',
  previewData: { subject: 'Your invitation to try PitchSnack', en: { title: 'Your invitation to try PitchSnack', lines: ['Dear Acme team,', '1. Go to pitchsnack.com'], code: 'PS-ABCD-2345', button: { label: 'Open PitchSnack', url: SITE } } },
} satisfies TemplateEntry

const font = '"DM Sans", "IBM Plex Sans Thai Looped", Arial, sans-serif'
const main = { backgroundColor: '#F4F5F7', fontFamily: font, padding: '24px 0' }
const card = { maxWidth: '560px', backgroundColor: '#ffffff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden' as const }
const top = { padding: '16px 24px', borderBottom: '1px solid #E5E7EB' }
const inner = { padding: '24px' }
const h1 = { fontSize: '20px', fontWeight: 600, color: '#111827', margin: '0 0 12px' }
const para = { fontSize: '14px', lineHeight: '1.6', color: '#374151', margin: '0 0 12px' }
const step = { ...para, margin: '0 0 4px' }
const codeBox = { fontFamily: '"IBM Plex Mono", Menlo, Consolas, monospace', fontSize: '22px', fontWeight: 600, letterSpacing: '.08em', backgroundColor: '#F2F5F8', borderRadius: '10px', padding: '12px 16px', margin: '12px 0', color: '#111827', textAlign: 'center' as const }
const btn = { backgroundColor: '#1E3E56', color: '#ffffff', borderRadius: '10px', padding: '12px 20px', fontSize: '14px', fontWeight: 600, textDecoration: 'none', display: 'inline-block', margin: '4px 0 14px' }
const hr = { borderColor: '#E5E7EB', margin: '22px 0' }
const small = { fontSize: '12.5px', color: '#6B7280', margin: '14px 0 0' }
