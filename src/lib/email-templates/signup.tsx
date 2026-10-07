import * as React from 'react'
import { Body, Container, Head, Heading, Html, Img, Link, Preview, Text } from '@react-email/components'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
  token?: string
}

/** Sign-up confirmation: the 6-digit code (step 4 of sign-up), with the link as a fallback. */
export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl, token }: SignupEmailProps) => (
  <Html lang="th" dir="ltr">
    <Head />
    <Preview>{token ? `รหัสยืนยัน ${token} · Your code is ${token}` : `Confirm your email for ${siteName}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={`${siteUrl}/email/pitchsnack-logo.png`} alt="PitchSnack" width="150" style={{ margin: '0 0 24px' }} />
        <Heading style={h1}>ยืนยันอีเมลของท่าน · Confirm your email</Heading>
        <Text style={text}>
          กรอกรหัส 6 หลักนี้ในหน้าสมัครใช้งาน เพื่อยืนยัน {recipient}
          <br />Enter this 6-digit code on the sign-up page to confirm {recipient}.
        </Text>
        {token && <Text style={code}>{token}</Text>}
        <Text style={small}>
          หรือ <Link href={confirmationUrl} style={link}>ยืนยันด้วยลิงก์นี้</Link> · or <Link href={confirmationUrl} style={link}>confirm with this link</Link>
        </Text>
        <Text style={footer}>หากท่านไม่ได้สมัครใช้งาน {siteName} ไม่ต้องดำเนินการใด ๆ · If you didn't sign up, you can ignore this email.</Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '520px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1e3e56', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#414c5d', lineHeight: '1.6', margin: '0 0 20px' }
const code = { fontSize: '34px', fontWeight: 'bold' as const, letterSpacing: '10px', color: '#1e3e56', backgroundColor: '#f2f5f8', borderRadius: '10px', padding: '14px 0', textAlign: 'center' as const, margin: '0 0 20px' }
const small = { fontSize: '13px', color: '#69738a', margin: '0 0 20px' }
const link = { color: '#25638d', textDecoration: 'underline' }
const footer = { fontSize: '12px', color: '#999999', margin: '28px 0 0' }
