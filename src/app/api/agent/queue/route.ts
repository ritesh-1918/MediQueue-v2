// GET /api/agent/queue
//
// Triggers the autonomous queue monitoring agent.
// Protected by a static shared secret sent in the X-Agent-Key header.
// Intended callers: admin dashboard, Supabase webhooks, external cron services.

import { NextRequest, NextResponse } from 'next/server'
import { runQueueAgent }             from '@/lib/agents/queue-agent'

export const runtime = 'nodejs'
// Allow up to 30 s for the agent to complete all Supabase mutations.
export const maxDuration = 30

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const agentSecret = process.env.AGENT_SECRET_KEY
  const provided    = request.headers.get('x-agent-key')

  if (!agentSecret) {
    console.error('[agent/queue] AGENT_SECRET_KEY env var is not set')
    return NextResponse.json({ error: 'Agent not configured' }, { status: 500 })
  }

  if (!provided || provided !== agentSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Run agent ───────────────────────────────────────────────────────────────
  const start = performance.now()

  try {
    const report = await runQueueAgent()
    const elapsed = Math.round(performance.now() - start)

    console.log(
      `[agent/queue] completed in ${elapsed}ms — ` +
      `reassignments=${report.reassignments} escalations=${report.escalations} ` +
      `depth=${report.queueDepth} active=${report.activeDoctors}`,
    )

    return NextResponse.json(
      { ...report, executionMs: elapsed },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'X-Agent-Execution-Ms': String(elapsed),
        },
      },
    )
  } catch (err) {
    const elapsed = Math.round(performance.now() - start)
    const message = err instanceof Error ? err.message : 'Unknown error'

    console.error(`[agent/queue] failed after ${elapsed}ms: ${message}`)

    return NextResponse.json(
      { error: 'Agent execution failed', detail: message, executionMs: elapsed },
      { status: 500 },
    )
  }
}
