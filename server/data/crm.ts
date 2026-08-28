import 'server-only'

import { and, desc, eq, gte, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import { db } from '@/server/db'
import { call, customer } from '@/server/db/schema'
import { protectedLookup } from '@/server/security/protected-data'

export type CrmDateRange = 'today' | 'week' | 'month' | 'year' | 'all'
export type CrmStatusFilter = 'lead' | 'active' | 'inactive' | 'all'

export type CrmFilters = {
  search?: string | undefined
  status?: CrmStatusFilter
  range?: CrmDateRange
}

/**
 * A cutoff Date for `createdAt >=`, or `null` for "all time" — the one place
 * that decides what "this week"/"this month" means. Both the table page and
 * the CSV export go through `getCrmCustomers` (which calls this via
 * `crmConditions`) rather than calling it directly, so a filtered export
 * always matches what was on screen without either caller duplicating the
 * date-window logic.
 */
function crmRangeCutoff(range: CrmDateRange | undefined): Date | null {
  if (!range || range === 'all') return null
  const now = new Date()
  if (range === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return start
  }
  if (range === 'week') {
    const start = new Date(now)
    start.setDate(start.getDate() - 7)
    return start
  }
  if (range === 'month') {
    const start = new Date(now)
    start.setMonth(start.getMonth() - 1)
    return start
  }
  const start = new Date(now)
  start.setFullYear(start.getFullYear() - 1)
  return start
}

export type CrmCustomerRow = {
  id: string
  name: string | null
  phone: string
  email: string | null
  status: 'lead' | 'active' | 'inactive'
  tags: string[]
  notes: string | null
  source: 'call' | 'manual'
  calls: number
  lastCallAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function crmConditions(workspaceId: string, filters: CrmFilters) {
  const conditions = [eq(customer.workspaceId, workspaceId)]

  if (filters.status && filters.status !== 'all') {
    conditions.push(eq(customer.status, filters.status))
  }

  const cutoff = crmRangeCutoff(filters.range)
  if (cutoff) conditions.push(gte(customer.createdAt, cutoff))

  const search = filters.search?.trim()
  if (search) {
    const pattern = `%${search.replace(/[%_]/g, (char) => `\\${char}`)}%`
    const searchClause = or(
      ilike(customer.name, pattern),
      ilike(customer.phone, pattern),
      ilike(customer.email, pattern),
    )
    if (searchClause) conditions.push(searchClause)
  }

  return and(...conditions)
}

/**
 * Live-call counts per customer phone, keyed by the exact phone strings
 * passed in.
 *
 * `call.callerNumber` is masked at write time (`+966****4567`) and the real
 * number only survives as `callerNumberHash`, a keyed HMAC — so it can never
 * be compared against `customer.phone` (kept in full, since it is the CRM's
 * own join key) with a plain equality. Calls recorded before that masking
 * shipped have no hash yet, so they are matched the old way instead. Every
 * live call falls into exactly one of the two groups, never both.
 */
export async function liveCallCountsByPhone(
  workspaceId: string,
  phones: string[],
): Promise<Map<string, number>> {
  if (phones.length === 0) return new Map()

  const hashByPhone = new Map(phones.map((phone) => [phone, protectedLookup(phone)] as const))

  const [byHash, byPlainNumber] = await Promise.all([
    db
      .select({ key: call.callerNumberHash, count: sql<number>`count(*)`.mapWith(Number) })
      .from(call)
      .where(
        and(
          eq(call.workspaceId, workspaceId),
          eq(call.origin, 'live'),
          inArray(call.callerNumberHash, [...hashByPhone.values()]),
        ),
      )
      .groupBy(call.callerNumberHash),
    db
      .select({ key: call.callerNumber, count: sql<number>`count(*)`.mapWith(Number) })
      .from(call)
      .where(
        and(
          eq(call.workspaceId, workspaceId),
          eq(call.origin, 'live'),
          isNull(call.callerNumberHash),
          inArray(call.callerNumber, phones),
        ),
      )
      .groupBy(call.callerNumber),
  ])

  const countByHash = new Map(byHash.map((r) => [r.key, r.count]))
  const countByPlainNumber = new Map(byPlainNumber.map((r) => [r.key, r.count]))

  const counts = new Map<string, number>()
  for (const phone of phones) {
    const hash = hashByPhone.get(phone) ?? ''
    counts.set(phone, (countByHash.get(hash) ?? 0) + (countByPlainNumber.get(phone) ?? 0))
  }
  return counts
}

/** The table's rows, newest first — used by both the page and the CSV export. */
export async function getCrmCustomers(
  workspaceId: string,
  filters: CrmFilters = {},
  limit = 500,
): Promise<CrmCustomerRow[]> {
  const rows = await db
    .select({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      status: customer.status,
      tags: customer.tags,
      notes: customer.notes,
      source: customer.source,
      lastCallAt: customer.lastCallAt,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    })
    .from(customer)
    .where(crmConditions(workspaceId, filters))
    .orderBy(desc(customer.createdAt))
    .limit(limit)

  const callCounts = await liveCallCountsByPhone(
    workspaceId,
    rows.map((row) => row.phone),
  )

  // `tags` is a nullable jsonb column at the schema level (no row has ever
  // been written with a null there, but the type has to admit it) — settled
  // once here so every caller gets a plain array, not `string[] | null`.
  return rows.map((row) => ({
    ...row,
    tags: row.tags ?? [],
    calls: callCounts.get(row.phone) ?? 0,
  }))
}

export async function getCrmSummary(workspaceId: string) {
  const [row] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      leads: sql<number>`count(*) filter (where ${customer.status} = 'lead')`.mapWith(Number),
      active: sql<number>`count(*) filter (where ${customer.status} = 'active')`.mapWith(Number),
      fromCalls: sql<number>`count(*) filter (where ${customer.source} = 'call')`.mapWith(Number),
    })
    .from(customer)
    .where(eq(customer.workspaceId, workspaceId))

  return row ?? { total: 0, leads: 0, active: 0, fromCalls: 0 }
}
