'use client'

import { AlertCircle, CheckCircle, Loader2, Phone, Search } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { rentPhoneNumber, searchAvailableNumbers } from '@/server/actions/twilio'

type TwilioNumber = {
  friendlyName: string
  phoneNumber: string
  locality: string
}

export function PhoneProvisioningClient() {
  const [areaCode, setAreaCode] = useState('')
  const [numbers, setNumbers] = useState<TwilioNumber[]>([])
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [isSearching, startSearching] = useTransition()
  const [isRenting, startRenting] = useTransition()
  const [rentingNumber, setRentingNumber] = useState<string | null>(null)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    startSearching(async () => {
      const res = await searchAvailableNumbers('US', areaCode)
      if (!res.ok) {
        setError(res.error || 'حدث خطأ أثناء البحث.')
        setNumbers([])
      } else {
        setNumbers(res.numbers || [])
        if (!res.numbers?.length) {
          setError('لم يتم العثور على أرقام متاحة، جرب كود منطقة آخر.')
        }
      }
    })
  }

  function handleRent(e164: string) {
    setError(null)
    setSuccessMsg(null)
    setRentingNumber(e164)
    startRenting(async () => {
      const res = await rentPhoneNumber(e164)
      if (!res.ok) {
        setError(res.error || 'حدث خطأ أثناء الاستئجار.')
      } else {
        setSuccessMsg(res.message || 'تم حجز الرقم بنجاح!')
        setNumbers([]) // clear list
      }
      setRentingNumber(null)
    })
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <input
          type="text"
          placeholder="كود المنطقة (مثال: 415)"
          className="input"
          value={areaCode}
          onChange={(e) => setAreaCode(e.target.value)}
          disabled={isSearching || isRenting}
        />
        <Button variant="primary" type="submit" disabled={isSearching || isRenting}>
          {isSearching ? <Loader2 className="spinner" size={16} /> : <Search size={16} />}
          <span>بحث</span>
        </Button>
      </form>

      {error && (
        <div
          style={{
            padding: '1rem',
            background: 'var(--red-tint)',
            color: 'var(--red)',
            borderRadius: '8px',
            marginBottom: '1rem',
            display: 'flex',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {successMsg && (
        <div
          style={{
            padding: '1rem',
            background: 'var(--green-tint)',
            color: 'var(--green)',
            borderRadius: '8px',
            marginBottom: '1rem',
            display: 'flex',
            gap: '0.5rem',
          }}
        >
          <CheckCircle size={18} />
          {successMsg}
        </div>
      )}

      {numbers.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {numbers.map((n) => (
            <li
              key={n.phoneNumber}
              style={{
                padding: '1rem',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong dir="ltr" style={{ fontSize: '1.2rem', fontFamily: 'monospace' }}>
                  {n.friendlyName}
                </strong>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-sub)' }}>
                  {n.locality || 'رقم محلي'}
                </span>
              </div>
              <Button
                variant="quiet"
                onClick={() => handleRent(n.phoneNumber)}
                disabled={isRenting || isSearching}
              >
                {isRenting && rentingNumber === n.phoneNumber ? (
                  <Loader2 className="spinner" size={16} />
                ) : (
                  <Phone size={16} />
                )}
                <span>استئجار</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
