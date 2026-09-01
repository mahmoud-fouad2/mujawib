'use client'

import { CircleAlert, Loader2, Phone, Search } from 'lucide-react'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { requestPhoneNumberPurchase, searchAvailableNumbers } from '@/server/actions/twilio'

type TwilioNumber = {
  friendlyName: string
  phoneNumber: string
  locality: string
}

// A short, honest list — the countries this product actually serves plus one
// example market. Silently defaulting the search to a US area code (as the
// first version of this screen did) makes no sense for an Arabic Gulf B2B
// product; asking is one extra field, not a real cost.
const COUNTRIES = [
  { code: 'SA', label: 'السعودية' },
  { code: 'AE', label: 'الإمارات' },
  { code: 'EG', label: 'مصر' },
  { code: 'US', label: 'الولايات المتحدة (مثال)' },
]

export function PhoneProvisioningClient({ workspaceId }: { workspaceId: string }) {
  const [country, setCountry] = useState(COUNTRIES[0]?.code ?? 'SA')
  const [areaCode, setAreaCode] = useState('')
  const [numbers, setNumbers] = useState<TwilioNumber[]>([])
  const [error, setError] = useState<string | null>(null)
  const [requestedNumbers, setRequestedNumbers] = useState<Set<string>>(new Set())
  const [isSearching, startSearching] = useTransition()
  const [isRequesting, startRequesting] = useTransition()
  const [pendingNumber, setPendingNumber] = useState<string | null>(null)

  function handleSearch(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    startSearching(async () => {
      const res = await searchAvailableNumbers({
        workspaceId,
        countryCode: country,
        ...(areaCode.trim() ? { areaCode: areaCode.trim() } : {}),
      })
      if (!res.ok) {
        setError(res.error)
        setNumbers([])
        return
      }
      setNumbers(res.numbers)
      if (res.numbers.length === 0) setError('لم يُعثر على أرقام متاحة. جرّب كود منطقة آخر.')
    })
  }

  function handleRequest(n: TwilioNumber) {
    setError(null)
    setPendingNumber(n.phoneNumber)
    startRequesting(async () => {
      const res = await requestPhoneNumberPurchase({
        workspaceId,
        e164Number: n.phoneNumber,
        friendlyName: n.friendlyName,
        locality: n.locality,
        countryCode: country,
      })
      if (!res.ok) {
        setError(res.error)
      } else {
        setRequestedNumbers((prev) => new Set(prev).add(n.phoneNumber))
      }
      setPendingNumber(null)
    })
  }

  return (
    <div className="stack" style={{ gap: 'var(--s-4)', maxWidth: 640 }}>
      <form onSubmit={handleSearch} className="row" style={{ gap: 'var(--s-2)' }}>
        <select
          className="input"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          disabled={isSearching || isRequesting}
          aria-label="الدولة"
          style={{ maxWidth: 200 }}
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          className="input mono"
          dir="ltr"
          placeholder="كود المنطقة (اختياري)"
          value={areaCode}
          onChange={(e) => setAreaCode(e.target.value)}
          disabled={isSearching || isRequesting}
        />
        <Button variant="primary" type="submit" disabled={isSearching || isRequesting}>
          {isSearching ? <Loader2 className="spinner" size={16} /> : <Search size={16} />}
          <span>بحث</span>
        </Button>
      </form>

      {error ? (
        <div className="row" style={{ gap: 'var(--s-2)', color: 'var(--bad)' }}>
          <CircleAlert size={16} aria-hidden="true" />
          <span style={{ fontSize: 'var(--step--1)' }}>{error}</span>
        </div>
      ) : null}

      {numbers.length === 0 ? (
        <EmptyState
          title="ابحث عن رقم"
          body="اختر الدولة، وكود منطقة اختياريًا، ثم ابحث عن أرقام متاحة للاستئجار."
        />
      ) : (
        <ul
          className="stack"
          style={{ gap: 'var(--s-2)', listStyle: 'none', padding: 0, margin: 0 }}
        >
          {numbers.map((n) => {
            const requested = requestedNumbers.has(n.phoneNumber)
            return (
              <li
                key={n.phoneNumber}
                className="row"
                style={{
                  justifyContent: 'space-between',
                  padding: 'var(--s-3)',
                  border: '1px solid var(--signal-line)',
                  borderRadius: 'var(--r-panel)',
                }}
              >
                <div className="stack" style={{ gap: '2px' }}>
                  <strong className="mono" dir="ltr">
                    {n.friendlyName}
                  </strong>
                  <span className="muted" style={{ fontSize: 'var(--step--1)' }}>
                    {n.locality || 'رقم محلي'}
                  </span>
                </div>
                {requested ? (
                  <Pill tone="signal">قيد المراجعة</Pill>
                ) : (
                  <Button
                    variant="quiet"
                    size="sm"
                    disabled={isRequesting}
                    onClick={() => handleRequest(n)}
                  >
                    {isRequesting && pendingNumber === n.phoneNumber ? (
                      <Loader2 className="spinner" size={15} />
                    ) : (
                      <Phone size={15} />
                    )}
                    <span>اطلب هذا الرقم</span>
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <p className="muted" style={{ fontSize: 'var(--step--1)' }}>
        طلب رقم لا يعني شراءه فورًا. يراجع فريق التشغيل الطلب، وبعد الاعتماد يبقى ربط مسار الاتصال
        خطوة تشغيل أخيرة قبل استقبال المكالمات فعليًا.
      </p>
    </div>
  )
}
