'use client'

import Link from 'next/link'
import { Button, Heading, Label, Stack, Text } from '@primer/react'
import { ArrowLeftIcon, DownloadIcon, PlusIcon } from '@primer/octicons-react'
import { ConsoleSidebar } from '@/components/console/sidebar'
import { ConsoleTopbar } from '@/components/console/topbar'
import { KpiRow } from '@/components/console/kpi-row'
import { LiveStrip } from '@/components/console/live-strip'
import { QaPanel } from '@/components/console/qa-panel'
import { RecentCalls } from '@/components/console/recent-calls'

export default function ConsolePage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bgColor-inset)' }}>
      <ConsoleSidebar />

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <ConsoleTopbar />

        <div style={{ padding: '28px 24px 48px', maxWidth: 1240, width: '100%', margin: '0 auto' }}>
          <Stack direction="vertical" gap="spacious">
            {/* Page header */}
            <Stack
              direction={{ narrow: 'vertical', wide: 'horizontal' }}
              align="start"
              justify="space-between"
              gap="normal"
            >
              <Stack direction="vertical" gap="condensed">
                <Stack direction="horizontal" align="center" gap="condensed">
                  <Heading as="h1" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>
                    نظرة عامة على التشغيل
                  </Heading>
                  <Label variant="success">مباشر</Label>
                </Stack>
                <Text style={{ color: 'var(--fgColor-muted)', lineHeight: 1.6 }}>
                  ملخّص لحظي لأداء موظفي مُجاوِب الصوتيين عبر جميع القنوات.
                </Text>
              </Stack>

              <Stack direction="horizontal" gap="condensed" wrap="wrap">
                <Button leadingVisual={DownloadIcon} variant="default">
                  تصدير التقرير
                </Button>
                <Button
                  as={Link}
                  href="/"
                  variant="primary"
                  leadingVisual={PlusIcon}
                  trailingVisual={ArrowLeftIcon}
                >
                  Agent جديد
                </Button>
              </Stack>
            </Stack>

            {/* KPI cards */}
            <KpiRow />

            {/* Live calls strip */}
            <LiveStrip />

            {/* Recent calls + QA */}
            <div className="mjw-console-grid">
              <RecentCalls />
              <QaPanel />
            </div>
          </Stack>
        </div>
      </main>
    </div>
  )
}
