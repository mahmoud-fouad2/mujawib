import Link from 'next/link'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

type Variant = 'default' | 'primary' | 'quiet' | 'danger'
type Size = 'sm' | 'md' | 'lg'

type StyleProps = {
  variant?: Variant | undefined
  size?: Size | undefined
  block?: boolean | undefined
  className?: string | undefined
}

type SlotProps = {
  leading?: ReactNode
  trailing?: ReactNode
  children?: ReactNode
}

function classes({ variant = 'default', size = 'md', block, className }: StyleProps) {
  return [
    'btn',
    variant !== 'default' && `btn--${variant}`,
    size !== 'md' && `btn--${size}`,
    block && 'btn--block',
    className,
  ]
    .filter(Boolean)
    .join(' ')
}

type ButtonProps = StyleProps &
  SlotProps &
  Omit<ComponentPropsWithoutRef<'button'>, 'className' | 'children'>

export function Button({
  variant,
  size,
  block,
  leading,
  trailing,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={classes({ variant, size, block, className })} {...rest}>
      {leading}
      {children}
      {trailing}
    </button>
  )
}

/**
 * Only the anchor props a button actually needs. Spreading the full anchor
 * prop set into next/link trips `exactOptionalPropertyTypes`, and a narrow
 * surface is the better API anyway.
 */
type AnchorExtras = Pick<
  ComponentPropsWithoutRef<'a'>,
  'target' | 'rel' | 'title' | 'id' | 'onClick' | 'hrefLang' | 'download'
> & {
  'aria-label'?: string
  'aria-current'?: ComponentPropsWithoutRef<'a'>['aria-current']
  'data-cta'?: string
  'data-testid'?: string
}

type LinkButtonProps = StyleProps & SlotProps & { href: string } & AnchorExtras

export function LinkButton({
  variant,
  size,
  block,
  leading,
  trailing,
  className,
  children,
  href,
  ...rest
}: LinkButtonProps) {
  const external = /^(https?:|mailto:|tel:|#)/.test(href)
  const cls = classes({ variant, size, block, className })
  const content = (
    <>
      {leading}
      {children}
      {trailing}
    </>
  )

  if (external) {
    return (
      <a href={href} className={cls} {...rest}>
        {content}
      </a>
    )
  }

  /**
   * next/link declares its optional props without `| undefined`, so spreading
   * a partially-filled prop bag trips `exactOptionalPropertyTypes`. Dropping
   * the undefined entries makes the spread accurate at runtime and at the type
   * level.
   */
  const linkProps = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined),
  ) as Partial<{ [K in keyof AnchorExtras]-?: Exclude<AnchorExtras[K], undefined> }>

  return (
    <Link href={href} className={cls} {...linkProps}>
      {content}
    </Link>
  )
}
