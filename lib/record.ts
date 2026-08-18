import type { RecordItem } from '@/components/site/call-record'

type Turn = { role: 'agent' | 'caller'; text: string; at: number }
type Tool = { name: string; success: boolean; latencyMs: number | null }

/**
 * Merges the transcript and the tool executions into one time-ordered record.
 *
 * Tool executions carry an absolute timestamp while transcript turns carry a
 * second offset from the start of the call, so the tools are placed just before
 * the closing turns — where they actually ran — rather than appended at the end.
 */
export function buildRecordItems(
  turns: Turn[],
  tools: Tool[],
  totalSeconds: number | null,
): RecordItem[] {
  const items: RecordItem[] = turns.map((t) => ({
    kind: 'turn',
    at: t.at,
    role: t.role,
    text: t.text,
  }))

  if (tools.length > 0) {
    const end = totalSeconds ?? (turns.at(-1)?.at ?? 0) + 6
    // Space the tools evenly across the final stretch of the call.
    const span = Math.min(14, Math.max(6, end * 0.25))
    tools.forEach((tool, i) => {
      const at = Math.max(1, Math.round(end - span + (span / (tools.length + 1)) * (i + 1)))
      items.push({
        kind: 'tool',
        at,
        name: tool.name,
        success: tool.success,
        latencyMs: tool.latencyMs,
      })
    })
  }

  return items.sort((a, b) => a.at - b.at)
}
