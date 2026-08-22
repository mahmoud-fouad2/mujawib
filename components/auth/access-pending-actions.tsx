'use client'

import { LogOut, Mail } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'

export function AccessPendingActions() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <div className="row access-pending__actions">
      <Link href="/contact" className="btn btn--primary">
        <Mail size={16} aria-hidden="true" />
        تواصل مع فريق التشغيل
      </Link>
      <Button
        leading={<LogOut size={16} />}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await authClient.signOut()
            router.replace('/sign-in')
            router.refresh()
          })
        }
      >
        {pending ? 'جارٍ الخروج…' : 'الدخول بحساب آخر'}
      </Button>
    </div>
  )
}
