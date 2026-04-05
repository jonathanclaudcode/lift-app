import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'
import { AI_MODEL } from '@/lib/ai/client'

export const maxDuration = 30

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
      .insert({ clinic_id: clinicId, role: 'owner', content: message.trim() })
      .select('id')
      .single()

    if (ownerInsertError) {
      throw new Error(`Failed to save message: ${ownerInsertError.message}`)
    }

    // Build system prompt
    const ownerName = user.email?.split('@')[0] || 'ägaren'
    const systemPrompt = buildSystemPrompt(clinic?.name || 'din klinik', ownerName)

    // Call Anthropic
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

    const latencyMs = Date.now() - startTime

    const textBlock = response.content.find((block) => block.type === 'text')
    const assistantContent = textBlock && textBlock.type === 'text' ? textBlock.text : ''

    if (!assistantContent) {
      throw new Error('AI returned empty response')
    }

    // Save assistant message
    const { data: savedAssistantMsg, error: assistantInsertError } = await supabase
      .from('ai_chat_messages')
      .insert({
        clinic_id: clinicId,
        role: 'assistant',
        content: assistantContent,
        model: response.model,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        latency_ms: latencyMs,
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
      },
    })

    // Increment interaction count (non-critical)
    await admin.rpc('increment_interaction_count', { p_clinic_id: clinicId })

    return Response.json({
      id: savedAssistantMsg.id,
      role: 'assistant' as const,
      content: assistantContent,
      created_at: savedAssistantMsg.created_at,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Chat API error:', errorMessage)

    // Log error trace (non-critical)
    await admin.from('ai_traces').insert({
      clinic_id: clinicId,
      model: AI_MODEL,
      latency_ms: Date.now() - startTime,
      error: errorMessage,
      metadata: {
        error_type: error instanceof Error ? error.constructor.name : 'unknown',
      },
    })

    return Response.json({ error: 'Något gick fel. Försök igen.' }, { status: 500 })
  }
}
