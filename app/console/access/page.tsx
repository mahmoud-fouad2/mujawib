import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import {
  AccessRowActions,
  AddAccessButton,
  InvitationRowActions,
} from '@/components/console/access-actions'
import { PageHead, Section, SummaryBar } from '@/components/console/ui'
import { EmptyState, Pill } from '@/components/ui/primitives'
import { ACCESS_ROLE_LABEL, isClientRole, isOperatorRole } from '@/lib/access'
import { relative } from '@/lib/format'
import { authorizeOperator } from '@/server/auth/access'
import { getAccessDirectory } from '@/server/data/access'

export const metadata: Metadata = { title: 'الوصول والصلاحيات' }
export const dynamic = 'force-dynamic'

export default async function AccessPage() {
  const owner = await authorizeOperator('access.manage')
  if (!owner) redirect('/access-denied?area=console')
  const { workspaces, memberships, users, invitations } = await getAccessDirectory()
  const operatorAccess = memberships.filter((row) => isOperatorRole(row.role)).length
  const clientAccess = memberships.filter((row) => isClientRole(row.role)).length
  const assignedUsers = new Set(memberships.map((row) => row.userId)).size

  return (
    <>
      <PageHead
        title="الوصول والصلاحيات"
        sub="من يستطيع تشغيل المنصة، ومن يرى بيانات كل عميل"
        actions={<AddAccessButton workspaces={workspaces} />}
      />
      <SummaryBar
        items={[
          { label: 'وصول فريق التشغيل', value: String(operatorAccess) },
          { label: 'وصول العملاء', value: String(clientAccess) },
          { label: 'دعوات معلقة', value: String(invitations.length) },
          { label: 'حسابات بلا مساحة', value: String(Math.max(0, users.length - assignedUsers)) },
        ]}
      />
      <Section title="الدعوات المعلقة" flush>
        {invitations.length ? (
          <div className="table-scroll">
            <table className="table table--rows">
              <thead>
                <tr>
                  <th>البريد</th>
                  <th>مساحة العمل</th>
                  <th>الدور</th>
                  <th>تنتهي</th>
                  <th aria-label="إجراءات" />
                </tr>
              </thead>
              <tbody>
                {invitations.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="mono" dir="ltr">
                        {row.email}
                      </span>
                    </td>
                    <td>{row.workspaceName}</td>
                    <td>
                      <Pill tone={row.workspaceType === 'operator' ? 'signal' : 'neutral'}>
                        {isOperatorRole(row.role) || isClientRole(row.role)
                          ? ACCESS_ROLE_LABEL[row.role]
                          : 'دور غير معروف'}
                      </Pill>
                    </td>
                    <td className="muted">{relative(row.expiresAt)}</td>
                    <td>
                      <InvitationRowActions
                        id={row.id}
                        email={row.email}
                        workspaceName={row.workspaceName}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="لا توجد دعوات قيد الانتظار"
            body="عند دعوة مستخدم جديد ستظهر دعوته هنا حتى يقبلها أو تنتهي صلاحيتها."
          />
        )}
      </Section>
      <Section title="الوصول الحالي" flush>
        {memberships.length ? (
          <div className="table-scroll">
            <table className="table table--rows">
              <thead>
                <tr>
                  <th>المستخدم</th>
                  <th>مساحة العمل</th>
                  <th>الدور</th>
                  <th>آخر تعديل</th>
                  <th aria-label="إجراءات" />
                </tr>
              </thead>
              <tbody>
                {memberships.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.name}</strong>
                      <br />
                      <span className="muted mono" dir="ltr">
                        {row.email}
                      </span>
                    </td>
                    <td>{row.workspaceName}</td>
                    <td>
                      <Pill tone={row.workspaceType === 'operator' ? 'signal' : 'neutral'}>
                        {isOperatorRole(row.role) || isClientRole(row.role)
                          ? ACCESS_ROLE_LABEL[row.role]
                          : 'دور غير معروف'}
                      </Pill>
                    </td>
                    <td className="muted">{relative(row.updatedAt)}</td>
                    <td>
                      <AccessRowActions
                        id={row.id}
                        email={row.email}
                        workspaceName={row.workspaceName}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="لا توجد صلاحيات بعد"
            body="أضف مالكًا لمساحة التشغيل أولًا، ثم امنح كل عميل الوصول إلى مساحته فقط."
          />
        )}
      </Section>
    </>
  )
}
