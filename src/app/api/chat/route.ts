import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AI_MODEL } from '@/lib/ai/client'
import { processAIMessage, runPostProcessing } from '@/lib/ai/process-message'

export const maxDuration = 60

// Simple in-memory rate limiter (per clinic)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 30
const RATE_LIMIT_WINDOW_MS = 60_000
let rateLimitCheckCount = 0

function checkRateLimit(clinicId: string): boolean {
  const now = Date.now()

  if (++rateLimitCheckCount % 100 === 0) {
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetAt) rateLimitMap.delete(key)
    }
  }

  const entry = rateLimitMap.get(clinicId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(clinicId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false
  }

  entry.count++
  return true
}

export async function POST(request: Request) {
  const startTime = Date.now()

  // Parse body safely
  let body: { message?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Ogiltigt meddelande' }, { status: 400 })
  }

  const message = body.message
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return Response.json({ error: 'Tomt meddelande' }, { status: 400 })
  }

  if (message.trim().length > 10000) {
    return Response.json(
      { error: 'Meddelandet är för långt (max 10 000 tecken)' },
      { status: 400 }
    )
  }

  // Auth — user-scoped client validates JWT and extracts clinicId via RLS
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Ej inloggad' }, { status: 401 })
  }

  const clinicId = user.app_metadata?.clinic_id as string | undefined
  if (!clinicId) {
    return Response.json({ error: 'Ingen klinik kopplad' }, { status: 400 })
  }

  if (!checkRateLimit(clinicId)) {
    return Response.json(
      { error: 'Du skickar meddelanden för snabbt. Vänta en stund.' },
      { status: 429 }
    )
  }

  try {
    const result = await processAIMessage({
      clinicId,
      ownerMessage: message.trim(),
      source: 'web',
    })

    const responsePayload = Response.json({
      id: result.assistantMessageId,
      role: 'assistant' as const,
      content: result.response,
      created_at: result.assistantMessageCreatedAt,
    })

    // Post-processing runs after response is sent to client
    after(async () => {
      try {
        await runPostProcessing({
          clinicId,
          ownerMessage: message.trim(),
        })
      } catch (err) {
        console.error('Post-processing error:', err)
      }
    })

    return responsePayload
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status
    const errMsg = error instanceof Error ? error.message : 'Unknown error'
    const errName = error instanceof Error ? error.name : undefined
    console.error('Chat API error:', { status, message: errMsg, name: errName })

    // Log error trace (non-critical)
    try {
      const admin = createAdminClient()
      await admin.from('ai_traces').insert({
        clinic_id: clinicId,
        model: AI_MODEL,
        latency_ms: Date.now() - startTime,
        error: errMsg,
        metadata: {
          error_type: error instanceof Error ? error.constructor.name : 'unknown',
        },
      })
    } catch {
      // Trace logging must never prevent error response
    }

    if (status === 429) {
      return Response.json(
        { error: 'AI-tjänsten är överbelastad just nu. Försök igen om en minut.' },
        { status: 429 }
      )
    }

    if (status !== undefined && status >= 500) {
      return Response.json(
        { error: 'AI-tjänsten är tillfälligt otillgänglig. Försök igen om en stund.' },
        { status: 503 }
      )
    }

    return Response.json({ error: 'Något gick fel. Försök igen.' }, { status: 500 })
  }
}
