import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function POST() {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="ar-SA" voice="Polly.Zeina">عذراً، الموظف الصوتي مشغول حالياً بسبب كثافة الاتصالات. الرجاء ترك رسالة أو المحاولة لاحقاً.</Say>
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
