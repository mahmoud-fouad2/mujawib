import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Manual-config-only. MUJAWIB's call path is OpenAI's own SIP acceptance of
 * a number already pointed at it (server/voice/session.ts) — nothing in this
 * codebase wires a Twilio-purchased number to that path automatically. If an
 * operator manually points a Twilio number's Voice webhook at this route
 * (Twilio Console → Phone Numbers → Voice Configuration) as a stopgap before
 * the real SIP trunk connection is done, this returns TwiML that answers
 * politely instead of ringing into nothing.
 */
export function POST() {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="ar-SA">عذرًا، هذا الرقم قيد الإعداد ولم يُربط بعد بخدمة الرد الصوتي. سنتواصل معك قريبًا.</Say>
  <Hangup/>
</Response>`

  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' },
  })
}

export function GET() {
  return POST()
}
