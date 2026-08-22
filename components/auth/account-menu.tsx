'use client'

import { LogOut, ShieldCheck, UserRound, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { authClient } from '@/lib/auth-client'

export function AccountMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const initial = (name.trim()[0] || email.trim()[0] || 'م').toUpperCase()

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => {
      document.removeEventListener('mousedown', closeOutside)
      document.removeEventListener('keydown', closeEscape)
    }
  }, [open])

  async function leave() {
    await authClient.signOut()
    window.location.assign('/sign-in')
  }

  return (
    <div className="account-menu" ref={root}>
      <button
        type="button"
        className="account-menu__trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="الحساب"
      >
        <span aria-hidden="true">{initial}</span>
      </button>
      {open ? (
        <div className="account-menu__panel" id={menuId}>
          <div className="account-menu__identity">
            <UserRound size={17} aria-hidden="true" />
            <span>
              <strong>{name}</strong>
              <small>{email}</small>
            </span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setOpen(false)}
              aria-label="إغلاق"
            >
              <X size={15} />
            </button>
          </div>
          <Link href="/account/security" onClick={() => setOpen(false)}>
            <ShieldCheck size={16} aria-hidden="true" />
            أمان الحساب
          </Link>
          <button type="button" onClick={leave}>
            <LogOut size={16} aria-hidden="true" />
            تسجيل الخروج
          </button>
        </div>
      ) : null}
    </div>
  )
}
