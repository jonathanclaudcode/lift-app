import Anthropic from '@anthropic-ai/sdk'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'
import { AI_MODEL } from '@/lib/ai/client'
import { detectExplicitCorrection, detectNoGoZone } from '@/lib/ai/detect-corrections'
import { detectKnowledgeUpdate, type DetectedKnowledge } from '@/lib/ai/detect-knowledge'

export const maxDuration = 30

const CONVERSATION_GAP_MS = 60 * 60 * 1000 // 60 minutes

const anthropic = new Anthropic()

export async function POST(request: Request) {
  const startTime = Date.now()
  const admin = createAdminClient()

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

  // Auth
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

  try {
    const { data: clinic } = await supabase
      .from('clinics')
      .select('name')
      .eq('id', clinicId)
      .single()

    const clinicName = clinic?.name || 'din klinik'
    const ownerName = user.email?.split('@')[0] || null

    // Determine conversation_id
    const { data: lastMsg } = await supabase
      .from('ai_chat_messages')
      .select('conversation_id, created_at')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let conversationId: string
    if (
      !lastMsg ||
      !lastMsg.conversation_id ||
      Date.now() - new Date(lastMsg.created_at).getTime() > CONVERSATION_GAP_MS
    ) {
      conversationId = crypto.randomUUID()
    } else {
      conversationId = lastMsg.conversation_id
    }

    // Fetch recent history (newest 50 DESC, then reverse to chronological)
    const { data: historyDesc } = await supabase
      .from('ai_chat_messages')
      .select('role, content')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(50)

    const history = (historyDesc || []).reverse()

    const messages: Anthropic.MessageParam[] = history.map((m) => ({
      role: m.role === 'owner' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    }))
    messages.push({ role: 'user' as const, content: message.trim() })

    // Save owner message
    const { data: savedOwnerMsg, error: ownerInsertError } = await supabase
      .from('ai_chat_messages')
      .insert({
        clinic_id: clinicId,
        role: 'owner',
        content: message.trim(),
        conversation_id: conversationId,
      })
      .select('id')
      .single()

    if (ownerInsertError) {
      throw new Error(`Failed to save message: ${ownerInsertError.message}`)
    }

    // Fetch corrections and no-go zones
    const { data: corrections } = await supabase
      .from('ai_corrections')
      .select('interpreted_rule, forbidden_phrase')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10)

    const { data: noGoZones } = await supabase
      .from('ai_no_go_zones')
      .select('topic, topic_keywords')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .gte('confidence', 0.4)
      .order('created_at', { ascending: false })
      .limit(10)

    // Fetch memories (non-private daily summaries only)
    const { data: memories } = await supabase
      .from('ai_memories')
      .select('content')
      .eq('clinic_id', clinicId)
      .eq('is_private', false)
      .eq('memory_type', 'daily_summary')
      .order('source_date', { ascending: false })
      .limit(5)

    // Fetch clinic knowledge
    const { data: clinicKnowledge, error: knowledgeError } = await supabase
      .from('clinic_knowledge')
      .select('category, content')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (knowledgeError) {
      console.error('Failed to fetch clinic knowledge:', knowledgeError)
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt({
      clinicName,
      ownerName,
      corrections: (corrections || []) as Array<{ interpreted_rule: string }>,
      noGoZones: (noGoZones || []) as Array<{ topic: string; topic_keywords: string[] }>,
      memories: (memories || []) as Array<{ content: string }>,
      clinicKnowledge: (clinicKnowledge || []) as Array<{ category: string; content: string }>,
    })

    // Call Anthropic with retry logic
    let response: Anthropic.Message
    let retryCount = 0
    const MAX_RETRIES = 1

    while (true) {
      try {
        response = await anthropic.messages.create({
          model: AI_MODEL,
          max_tokens: 1024,
          temperature: 0.7,
          system: systemPrompt,
          messages,
        })
        break
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status
        const isRetryable = status !== undefined && (status >= 500 || status === 429)
        if (retryCount < MAX_RETRIES && isRetryable) {
          retryCount++
          const delay = status === 429 ? 2000 : 1000
          console.warn(`Anthropic ${status}, retry ${retryCount}/${MAX_RETRIES} after ${delay}ms`)
          await new Promise((r) => setTimeout(r, delay))
          continue
        }
        throw err
      }
    }

    const latencyMs = Date.now() - startTime

    // Safe response extraction
    const assistantText =
      response.content?.length > 0 && response.content[0]?.type === 'text'
        ? response.content[0].text
        : ''

    if (!assistantText) {
      return Response.json(
        { error: 'AI-tjänsten returnerade ett tomt svar. Försök igen.' },
        { status: 502 }
      )
    }

    // Save assistant message
    const { data: savedAssistantMsg, error: assistantInsertError } = await supabase
      .from('ai_chat_messages')
      .insert({
        clinic_id: clinicId,
        role: 'assistant',
        content: assistantText,
        model: response.model,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        latency_ms: latencyMs,
        conversation_id: conversationId,
      })
      .select('id, created_at')
      .single()

    if (assistantInsertError) {
      throw new Error(`Failed to save response: ${assistantInsertError.message}`)
    }

    // Log trace (non-critical)
    await admin.from('ai_traces').insert({
      clinic_id: clinicId,
      message_id: savedAssistantMsg.id,
      model: response.model,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      latency_ms: latencyMs,
      finish_reason: response.stop_reason,
      metadata: {
        history_length: messages.length,
        owner_message_id: savedOwnerMsg.id,
        temperature: 0.7,
      },
    })

    // Increment interaction count (non-critical)
    await admin.rpc('increment_interaction_count', { p_clinic_id: clinicId })

    const responsePayload = Response.json({
      id: savedAssistantMsg.id,
      role: 'assistant' as const,
      content: assistantText,
      created_at: savedAssistantMsg.created_at,
    })

    // Post-processing runs after response is sent to client
    after(async () => {
      try {
        await processPostMessage(admin, clinicId, message.trim())
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

async function processPostMessage(
  admin: ReturnType<typeof createAdminClient>,
  clinicId: string,
  ownerMessage: string
): Promise<void> {
  // 1. Detect no-go zone FIRST (takes priority over corrections)
  const noGo = detectNoGoZone(ownerMessage)
  if (noGo) {
    try {
      await admin.from('ai_no_go_zones').insert({
        clinic_id: clinicId,
        topic: noGo.topic.toLowerCase().trim(),
        topic_keywords: noGo.keywords,
        reason: noGo.reason,
        detected_via: noGo.explicit ? 'explicit' : 'inferred',
        confidence: noGo.explicit ? 1.0 : 0.7,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (!msg.includes('unique') && !msg.includes('duplicate')) {
        console.error('Failed to insert no-go zone:', err)
      }
    }
    // NOTE: No early return — confidence decay and knowledge detection still run below
  }

  // 2. Detect explicit correction (only if no no-go zone found)
  if (!noGo) {
    const correction = detectExplicitCorrection(ownerMessage)
    if (correction) {
      try {
        await admin.from('ai_corrections').insert({
          clinic_id: clinicId,
          correction_text: correction.text,
          interpreted_rule: correction.rule,
          forbidden_phrase: correction.forbiddenPhrase
            ? correction.forbiddenPhrase.toLowerCase().trim()
            : null,
          preference_key: correction.mappedPreference,
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : ''
        if (!msg.includes('unique') && !msg.includes('duplicate')) {
          console.error('Failed to insert correction:', err)
        }
      }
    }
  }

  // 3. No-go zone confidence decay
  // NOTE: This now runs even when a no-go was detected in step 1 (intentional behavior
  // change from Prompt 1 where the early return blocked it).
  const { data: activeZones } = await admin
    .from('ai_no_go_zones')
    .select('id, topic_keywords, confidence')
    .eq('clinic_id', clinicId)
    .eq('is_active', true)

  if (activeZones) {
    const lowerMsg = ownerMessage.toLowerCase()
    for (const zone of activeZones) {
      const keywords = (zone.topic_keywords as string[]).filter((kw) => kw.length >= 3)
      if (keywords.length === 0) continue

      const mentionsNoGoTopic = keywords.some((kw) => {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(`\\b${escaped}\\b`, 'i')
        return regex.test(lowerMsg)
      })

      if (mentionsNoGoTopic) {
        const newConfidence = Math.max(0.1, (zone.confidence as number) - 0.15)

        if (newConfidence <= 0.3) {
          await admin
            .from('ai_no_go_zones')
            .update({
              confidence: newConfidence,
              is_active: false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', zone.id)
        } else {
          await admin
            .from('ai_no_go_zones')
            .update({ confidence: newConfidence, updated_at: new Date().toISOString() })
            .eq('id', zone.id)
        }
      }
    }
  }

  // 4. Auto-learn clinic knowledge
  const knowledge = detectKnowledgeUpdate(ownerMessage)
  if (knowledge) {
    await saveDetectedKnowledge(admin, clinicId, knowledge)
  }
}

async function saveDetectedKnowledge(
  admin: ReturnType<typeof createAdminClient>,
  clinicId: string,
  knowledge: DetectedKnowledge
): Promise<void> {
  if (knowledge.isReplaceable) {
    // REPLACEABLE facts (policies, hours): find existing and UPDATE
    const { data: existing } = await admin
      .from('clinic_knowledge')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('category', knowledge.category)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (existing) {
      const { error: updateError } = await admin
        .from('clinic_knowledge')
        .update({
          content: knowledge.content,
          source: knowledge.source,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) console.error('Failed to update clinic knowledge:', updateError)
      return
    }
  }

  // ADDITIVE facts (team, treatments) or no existing replaceable: INSERT new row
  const { error: insertError } = await admin.from('clinic_knowledge').insert({
    clinic_id: clinicId,
    category: knowledge.category,
    content: knowledge.content,
    source: knowledge.source,
    is_active: true,
  })

  if (insertError) {
    console.error('Failed to insert clinic knowledge:', insertError)
  }
}
