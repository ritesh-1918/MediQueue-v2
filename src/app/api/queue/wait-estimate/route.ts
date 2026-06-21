// GET /api/queue/wait-estimate?doctor_id=<uuid>&position=<n>
//
// Returns an AI-powered wait-time prediction for a given doctor and queue
// position. Used by the LiveQueue component to show dynamic estimates.

import { NextRequest, NextResponse } from 'next/server'
import { predictWaitTime }           from '@/lib/ai/predict-wait'
import { createServiceClient }       from '@/lib/supabase/service'

export const runtime = 'nodejs'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl
  const doctorId  = searchParams.get('doctor_id')
  const positionS = searchParams.get('position')

  if (!doctorId) {
    return NextResponse.json({ error: 'doctor_id is required' }, { status: 400 })
  }

  const position = parseInt(positionS ?? '1', 10)
  if (isNaN(position) || position < 1) {
    return NextResponse.json({ error: 'position must be a positive integer' }, { status: 400 })
  }

  // Check if anyone is currently being served for this doctor
  const supabase = createServiceClient()
  const { count: servingCount } = await supabase
    .from('queue_entries')
    .select('id', { count: 'exact', head: true })
    .eq('doctor_id', doctorId)
    .eq('status', 'serving')

  const { data: doctor } = await supabase
    .from('doctors')
    .select('specialty')
    .eq('id', doctorId)
    .single()

  const now = new Date()

  try {
    const prediction = await predictWaitTime({
      doctorId,
      queuePosition:    position,
      timeOfDay:        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      dayOfWeek:        now.getDay(),
      currentlyServing: (servingCount ?? 0) > 0,
      doctorSpecialty:  doctor?.specialty,
    })

    return NextResponse.json(prediction, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Prediction failed'
    console.error('[wait-estimate]', message)
    return NextResponse.json(
      { error: message },
      { status: 500 },
    )
  }
}
