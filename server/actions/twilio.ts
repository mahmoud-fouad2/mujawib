'use server'

import { revalidatePath } from 'next/cache'
import { getPortalAccess } from '@/server/auth/access'
import { db } from '@/server/db'
import { phoneNumber } from '@/server/db/schema'

/**
 * Searches Twilio for available phone numbers in a specific country.
 */
export async function searchAvailableNumbers(countryCode: string = 'US', areaCode?: string) {
  const access = await getPortalAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN

  if (!sid || !token) {
    return { ok: false, error: 'Twilio integration is not configured on this server.' }
  }

  const query = new URLSearchParams()
  query.append('VoiceEnabled', 'true')
  if (areaCode) query.append('AreaCode', areaCode)

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/AvailablePhoneNumbers/${countryCode}/Local.json?${query.toString()}`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      },
    },
  )

  if (!response.ok) {
    return { ok: false, error: 'Failed to fetch available numbers from Twilio.' }
  }

  const data = await response.json()
  return {
    ok: true,
    numbers: data.available_phone_numbers.map((n: Record<string, string>) => ({
      friendlyName: n.friendly_name,
      phoneNumber: n.phone_number,
      locality: n.locality,
    })),
  }
}

/**
 * Purchases a specific Twilio phone number and assigns it to the client's workspace.
 */
export async function rentPhoneNumber(e164Number: string) {
  const access = await getPortalAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN

  if (!sid || !token) {
    return { ok: false, error: 'Twilio integration is not configured on this server.' }
  }

  // 1. Purchase from Twilio
  const formData = new URLSearchParams()
  formData.append('PhoneNumber', e164Number)

  // Optionally, we could set the VoiceUrl to our SIP domain or webhook here if we had a Twilio App SID.
  // formData.append('VoiceUrl', 'https://mujawib.onrender.com/api/voice/fallback')

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    },
  )

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    return { ok: false, error: err.message || 'Failed to purchase number from Twilio.' }
  }

  // 2. Insert into database
  const id = `phone_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
  await db.insert(phoneNumber).values({
    id,
    workspaceId: access.workspace.id,
    e164: e164Number,
    label: 'رقم جديد',
    sipStatus: 'pending',
  })

  revalidatePath('/portal/phone')
  return { ok: true, message: 'تم شراء وإضافة الرقم بنجاح.' }
}
