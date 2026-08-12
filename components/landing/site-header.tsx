'use client'

import Link from 'next/link'
import { Button } from '@primer/react'
import { ArrowLeftIcon } from '@primer/octicons-react'
import { MujawibMark } from '@/components/mujawib-mark'

const NAV = [
  { label: 'المنتج', href: '#product' },
  { label: 'القطاعات', href: '#sectors' },
  { label: 'التكاملات', href: '#integrations' },
  { label: 'كيف نعمل', href: '#how' },
  { label: 'تواصل', href: '#contact' },
]

export function SiteHeader() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        backdropFilter: 'saturate(160%) blur(14px)',
        background: 'rgba(10, 10, 26, 0.72)',
        borderBottom: '1px solid rgba(150, 140, 255, 0.14)',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <Link href="/" aria-label="مُجاوِب — الصفحة الرئيسية" style={{ textDecoration: 'none' }}>
            <MujawibMark size={22} onEmphasis />
          </Link>

          <nav aria-label="التنقل الرئيسي" className="mjw-header-nav">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  style={{
                    color: 'rgba(233, 231, 255, 0.72)',
                    textDecoration: 'none',
                    fontSize: 14,
                    fontWeight: 500,
                    padding: '8px 12px',
                    borderRadius: 8,
                  }}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button
              as={Link}
              href="/console"
              variant="invisible"
              style={{ color: '#e9e7ff' }}
            >
              لوحة التشغيل
            </Button>
            <Button as={Link} href="/console" variant="primary" trailingVisual={ArrowLeftIcon}>
              احجز عرضًا
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
