import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'لوحة التشغيل — مُجاوِب',
  description:
    'لوحة تشغيل مُجاوِب: متابعة المكالمات المباشرة، الحجوزات، الجودة والتحليلات لحظيًا.',
}

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return children
}
