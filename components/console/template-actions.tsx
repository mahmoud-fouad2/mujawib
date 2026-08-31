'use client'

import { Pencil, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/overlays'
import { RowAction, RowActions, useAction } from '@/components/ui/row-actions'
import { createIndustryTemplate, updateIndustryTemplate } from '@/server/actions/console'
import type { getTemplates } from '@/server/data/console'

type TemplateRow = Awaited<ReturnType<typeof getTemplates>>[number]

type Draft = {
  packKey: string
  name: string
  version: string
  serviceFields: string
  staffFields: string
  branchFields: string
  policyFields: string
  faqFields: string
  defaultFlows: string
  defaultIntegrations: string
  qaSuite: string
}

const DEFAULT_DRAFT: Draft = {
  packKey: '',
  name: '',
  version: '1.0',
  serviceFields: [
    'body',
    'price',
    'duration',
    'suitableFor',
    'requirements',
    'preparation',
    'aftercare',
    'outcome',
    'availability',
    'owner',
    'branch',
  ].join('\n'),
  staffFields: ['body', 'specialty', 'role', 'qualifications', 'experience', 'services'].join('\n'),
  branchFields: ['address', 'phone', 'hours', 'body'].join('\n'),
  policyFields: ['body', 'scope', 'exceptions'].join('\n'),
  faqFields: ['answer', 'relatedService'].join('\n'),
  defaultFlows: ['booking', 'callback', 'handoff', 'faq'].join('\n'),
  defaultIntegrations: ['google_calendar', 'whatsapp', 'rest_api'].join('\n'),
  qaSuite: [
    'حجز موعد كامل مع تأكيد الرقم المعروف',
    'شرح خدمة بتفاصيلها وحدودها',
    'سؤال عن فريق العمل أو الفرع',
    'تصعيد آمن عند طلب موظف بشري',
    'إنهاء المكالمة بأدب عند الوداع',
  ].join('\n'),
}

function listText(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .join('\n')
    : ''
}

function fieldsText(template: TemplateRow, key: string, fallback: string) {
  const schema = (template.knowledgeSchema ?? {}) as {
    fields?: Record<string, unknown>
  }
  return listText(schema.fields?.[key]) || fallback
}

function draftFromTemplate(template?: TemplateRow): Draft {
  if (!template) return DEFAULT_DRAFT
  return {
    packKey: template.packKey,
    name: template.name,
    version: template.version,
    serviceFields: fieldsText(template, 'service', DEFAULT_DRAFT.serviceFields),
    staffFields: fieldsText(template, 'staff', DEFAULT_DRAFT.staffFields),
    branchFields: fieldsText(template, 'branch', DEFAULT_DRAFT.branchFields),
    policyFields: fieldsText(template, 'policy', DEFAULT_DRAFT.policyFields),
    faqFields: fieldsText(template, 'faq', DEFAULT_DRAFT.faqFields),
    defaultFlows: listText(template.defaultFlows),
    defaultIntegrations: listText(template.defaultIntegrations),
    qaSuite: listText(template.qaSuite),
  }
}

function lines(text: string) {
  return text
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function Field({
  id,
  label,
  value,
  onChange,
  hint,
  mono,
  rows,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  mono?: boolean
  rows?: number
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {rows ? (
        <textarea
          id={id}
          className={mono ? 'input mono' : 'input'}
          value={value}
          rows={rows}
          dir={mono ? 'ltr' : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          className={mono ? 'input mono' : 'input'}
          value={value}
          dir={mono ? 'ltr' : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  )
}

function TemplateSheet({
  template,
  open,
  onClose,
}: {
  template?: TemplateRow
  open: boolean
  onClose: () => void
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFromTemplate(template))
  const { run, pending } = useAction()
  const set = (key: keyof Draft) => (value: string) =>
    setDraft((previous) => ({ ...previous, [key]: value }))
  const isEdit = Boolean(template)

  useEffect(() => {
    if (open) setDraft(draftFromTemplate(template))
  }, [open, template])

  const payload = {
    templateId: template?.id,
    packKey: draft.packKey,
    name: draft.name,
    version: draft.version,
    serviceFields: lines(draft.serviceFields),
    staffFields: lines(draft.staffFields),
    branchFields: lines(draft.branchFields),
    policyFields: lines(draft.policyFields),
    faqFields: lines(draft.faqFields),
    defaultFlows: lines(draft.defaultFlows),
    defaultIntegrations: lines(draft.defaultIntegrations),
    qaSuite: lines(draft.qaSuite),
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? `تعديل ${template?.name}` : 'إضافة قالب قطاع'}
      description="القالب يحدد شكل المعرفة، المسارات، والتكاملات التي يبدأ بها أي عميل جديد."
      footer={
        <>
          <Button onClick={onClose} disabled={pending}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            disabled={pending || draft.name.trim().length < 2 || draft.packKey.trim().length < 2}
            onClick={() =>
              run(
                () => (isEdit ? updateIndustryTemplate(payload) : createIndustryTemplate(payload)),
                onClose,
              )
            }
          >
            {pending ? 'جارٍ الحفظ…' : isEdit ? 'احفظ القالب' : 'أضف القالب'}
          </Button>
        </>
      }
    >
      <div className="sheet__group">
        <h3>هوية القالب</h3>
        <Field id="template-name" label="اسم القالب" value={draft.name} onChange={set('name')} />
        <Field
          id="template-key"
          label="مفتاح القالب"
          value={draft.packKey}
          onChange={set('packKey')}
          mono
          hint="مثال: medical, realestate, hospitality, automotive, education. يستخدم في تهيئة العميل."
        />
        <Field
          id="template-version"
          label="نسخة القالب"
          value={draft.version}
          onChange={set('version')}
          mono
        />
      </div>

      <div className="sheet__group">
        <h3>سكيما المعرفة</h3>
        <Field
          id="template-service-fields"
          label="حقول الخدمة"
          value={draft.serviceFields}
          onChange={set('serviceFields')}
          rows={5}
          mono
        />
        <Field
          id="template-staff-fields"
          label="حقول الفريق / الخبراء"
          value={draft.staffFields}
          onChange={set('staffFields')}
          rows={5}
          mono
        />
        <Field
          id="template-branch-fields"
          label="حقول الفروع"
          value={draft.branchFields}
          onChange={set('branchFields')}
          rows={4}
          mono
        />
        <Field
          id="template-policy-fields"
          label="حقول السياسات"
          value={draft.policyFields}
          onChange={set('policyFields')}
          rows={4}
          mono
        />
        <Field
          id="template-faq-fields"
          label="حقول الأسئلة الشائعة"
          value={draft.faqFields}
          onChange={set('faqFields')}
          rows={3}
          mono
        />
      </div>

      <div className="sheet__group">
        <h3>التشغيل والاختبار</h3>
        <Field
          id="template-flows"
          label="المسارات الافتراضية"
          value={draft.defaultFlows}
          onChange={set('defaultFlows')}
          rows={5}
          mono
        />
        <Field
          id="template-integrations"
          label="التكاملات الافتراضية"
          value={draft.defaultIntegrations}
          onChange={set('defaultIntegrations')}
          rows={4}
          mono
        />
        <Field
          id="template-qa"
          label="سيناريوهات الاختبار الافتراضية"
          value={draft.qaSuite}
          onChange={set('qaSuite')}
          rows={6}
        />
      </div>
    </Sheet>
  )
}

export function AddTemplateButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="primary"
        size="sm"
        leading={<Plus size={15} />}
        onClick={() => setOpen(true)}
      >
        أضف قالبًا
      </Button>
      <TemplateSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export function TemplateRowActions({ template }: { template: TemplateRow }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <RowActions>
        <RowAction icon={<Pencil size={15} />} onClick={() => setOpen(true)}>
          عدّل القالب
        </RowAction>
      </RowActions>
      <TemplateSheet template={template} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
