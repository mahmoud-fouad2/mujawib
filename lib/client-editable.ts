/**
 * Business information and editable client model.
 *
 * Placed in lib/ rather than inside a 'use client' component so both
 * React Server Components (app/console/clients/page.tsx) and Client Components
 * (components/console/client-actions.tsx) can import and call it safely.
 */

export type ClientBusinessInfo = {
  legalName?: string
  industry?: string
  city?: string
  country?: string
  website?: string
  supportEmail?: string
  publicPhone?: string
  transferTo?: string
  notes?: string
  hours?: { sun_thu?: string }
}

export type ClientEditable = {
  workspaceId: string
  slug: string
  name: string
  status: string
  legalName: string
  industry: string
  city: string
  country: string
  website: string
  supportEmail: string
  publicPhone: string
  hoursWeekday: string
  transferTo: string
  notes: string
  /** null = unlimited. */
  monthlyCallLimit: number | null
  concurrentCallLimit: number
}

export function clientEditable(
  workspace: {
    id: string
    slug: string
    name: string
    status: string
    monthlyCallLimit: number | null
    concurrentCallLimit: number
  },
  info: ClientBusinessInfo,
): ClientEditable {
  return {
    workspaceId: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    status: workspace.status,
    legalName: info.legalName ?? '',
    industry: info.industry ?? '',
    city: info.city ?? '',
    country: info.country ?? '',
    website: info.website ?? '',
    supportEmail: info.supportEmail ?? '',
    publicPhone: info.publicPhone ?? '',
    hoursWeekday: info.hours?.sun_thu ?? '',
    transferTo: info.transferTo ?? '',
    notes: info.notes ?? '',
    monthlyCallLimit: workspace.monthlyCallLimit,
    concurrentCallLimit: workspace.concurrentCallLimit,
  }
}
