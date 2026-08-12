'use client'

import Button from '@mui/material/Button'
import type { ButtonProps } from '@mui/material/Button'
import Link from 'next/link'

type MarketingButtonProps = ButtonProps & {
  href?: string
}

/**
 * Material 3 CTA — marketing / client portal surfaces.
 * Operator console stays on Primer (@primer/react).
 */
export function MarketingButton({ href, children, ...props }: MarketingButtonProps) {
  if (href) {
    return (
      <Button component={Link} href={href} variant="contained" size="large" {...props}>
        {children}
      </Button>
    )
  }

  return (
    <Button variant="contained" size="large" {...props}>
      {children}
    </Button>
  )
}
