'use server'

// TODO [GDPR]: Denna action skickar kunddata (allergier, hudtyp, behandlingshistorik)
// till Anthropic API. Kräver DPA, explicit samtycke, och DPIA innan produktionsrelease.

import { createClient } from '@/lib/supabase/server'
import { generateSuggestions, type AiSuggestion } from '@/lib/ai/generate-suggestions'
import { AI_MODEL } from '@/lib/ai/client'

export interface GenerateAiSuggestionsResult {
  suggestions: AiSuggestion[]
  triggeringMessageId: string | null
  error?: string
}

export async function generateAiSuggestions(
  conversationId: string,
  clinicId: string
): Promise<GenerateAiSuggestionsResult> {
  try {
    const supabase = await createClient()

    // Step 1: Get conversation → customer_id
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('customer_id')
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) {
      console.error('[AI Action] Conversation fetch failed:', convError)
      return { suggestions: [], triggeringMessageId: null, error: 'Kunde inte hämta konversation' }
    }

    const customerId = conversation.customer_id

    // Step 2: Parallel queries — customer, messages, bookings
    const [customerResult, messagesResult, bookingsResult] = await Promise.all([
      supabase
        .from('customers')
        .select(
          'name, phone, treatment_count, last_visit_at, pipeline_stage, notes, skin_type, allergies, preferences'
        )
        .eq('id', customerId)
        .single(),

      supabase
        .from('messages')
        .select('id, direction, author, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(20),

      supabase
        .from('bookings')
        .select('treatment, starts_at, status, provider_name')
        .eq('customer_id', customerId)
        .order('starts_at', { ascending: false })
        .limit(10),
    ])

    if (customerResult.error || !customerResult.data) {
      console.error('[AI Action] Customer fetch failed:', customerResult.error)
      return { suggestions: [], triggeringMessageId: null, error: 'Kunde inte hämta kunddata' }
    }

    if (messagesResult.error) {
      console.error('[AI Action] Messages fetch failed:', messagesResult.error)
      return { suggestions: [], triggeringMessageId: null, error: 'Kunde inte hämta meddelanden' }
    }

    const customer = customerResult.data
    const messages = messagesResult.data ?? []
    const bookings = bookingsResult.data ?? []

    // Find last inbound message (AI trigger)
    const lastInboundMessage = messages.filter((m) => m.direction === 'inbound').at(-1)
    const triggeringMessageId = lastInboundMessage?.id ?? null

    // Generate suggestions — measure response time
    const startTime = Date.now()

    const { suggestions, usage } = await generateSuggestions(
      messages as Parameters<typeof generateSuggestions>[0],
      customer as Parameters<typeof generateSuggestions>[1],
      bookings as Parameters<typeof generateSuggestions>[2]
    )

    const responseTimeMs = Date.now() - startTime

    // Log suggestion event
    const { error: insertError } = await supabase.from('suggestion_events').insert({
      clinic_id: clinicId,
      message_id: triggeringMessageId,
      conversation_id: conversationId,
      customer_id: customerId,
      suggestions: suggestions as unknown as Record<string, unknown>,
      model: AI_MODEL,
      prompt_tokens: usage?.inputTokens ?? null,
      completion_tokens: usage?.outputTokens ?? null,
      response_time_ms: responseTimeMs,
    })

    if (insertError) {
      console.error('[AI Action] Failed to log suggestion event:', insertError)
    }

    return { suggestions, triggeringMessageId }
  } catch (error) {
    console.error('[AI Action] Unexpected error:', error)
    return { suggestions: [], triggeringMessageId: null, error: 'AI-generering misslyckades' }
  }
}

export async function markSuggestionChosen(
  clinicId: string,
  messageId: string,
  chosenIndex: number,
  suggestedText: string
): Promise<void> {
  try {
    const supabase = await createClient()

    const { data: event, error: fetchError } = await supabase
      .from('suggestion_events')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('message_id', messageId)
      .is('chosen_index', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError || !event) {
      if (fetchError) console.error('[AI Action] Suggestion event lookup failed:', fetchError)
      return
    }

    const { error: updateError } = await supabase
      .from('suggestion_events')
      .update({
        chosen_index: chosenIndex,
        suggested_text: suggestedText,
      })
      .eq('id', event.id)

    if (updateError) {
      console.error('[AI Action] Failed to mark chosen suggestion:', updateError)
    }
  } catch (error) {
    console.error('[AI Action] markSuggestionChosen error:', error)
  }
}
