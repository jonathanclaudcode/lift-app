import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'
import { AI_MODEL } from '@/lib/ai/client'
import { detectExplicitCorrection, detectNoGoZone } from '@/lib/ai/detect-corrections'
import { detectKnowledgeUpdate, type DetectedKnowledge } from '@/lib/ai/detect-knowledge'
import {
  extractSignals,
  calibrate,
  buildPersonalityBlock,
  TRAIT_DETECTORS,
  type CalibratedPreferences,
} from '@/lib/ai/extract-signals'
import { detectTask } from '@/lib/ai/detect-tasks'

const anthropic = new Anthropic()

const CONVERSATION_GAP_WEB_MS = 60 * 60 * 1000 // 60 minutes
const CONVERSATION_GAP_WHATSAPP_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * SECURITY: This function uses admin client (bypasses RLS). Callers MUST validate
 * clinicId before calling. In route.ts: clinicId comes from authenticated JWT app_metadata.
 * In WhatsApp webhook: clinicId comes from phone number lookup via admin client.
 */
export async function processAIMessage(options: {
  clinicId: string
  ownerMessage: string
  source: 'web' | 'whatsapp' | 'sms'
}): Promise<{
  response: string
  assistantMessageId: string
  assistantMessageCreatedAt: string
  ownerMessageId: string
  conversationId: string
}> {
  const { clinicId, ownerMessage, source } = options
  const startTime = Date.now()
  const admin = createAdminClient()

  // Fetch clinic name
  const { data: clinic } = await admin
    .from('clinics')
    .select('name')
    .eq('id', clinicId)
    .single()

  const clinicName = clinic?.name || 'din klinik'

  // Resolve conversation_id based on source channel
  const gapMs = source === 'web' ? CONVERSATION_GAP_WEB_MS : CONVERSATION_GAP_WHATSAPP_MS
  const { data: lastMsg } = await admin
    .from('ai_chat_messages')
    .select('conversation_id, created_at')
    .eq('clinic_id', clinicId)
    .eq('source', source)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let conversationId: string
  if (
    !lastMsg ||
    !lastMsg.conversation_id ||
    Date.now() - new Date(lastMsg.created_at).getTime() > gapMs
  ) {
    conversationId = crypto.randomUUID()
  } else {
    conversationId = lastMsg.conversation_id
  }

  // Fetch recent history (newest 50 DESC, then reverse)
  const { data: historyDesc } = await admin
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
  messages.push({ role: 'user' as const, content: ownerMessage })

  // Save owner message
  const { data: savedOwnerMsg, error: ownerInsertError } = await admin
    .from('ai_chat_messages')
    .insert({
      clinic_id: clinicId,
      role: 'owner',
      content: ownerMessage,
      conversation_id: conversationId,
      source,
    })
    .select('id')
    .single()

  if (ownerInsertError) {
    throw new Error(`Failed to save message: ${ownerInsertError.message}`)
  }

  // Fetch corrections, no-go zones, memories, preferences, knowledge, tasks in parallel
  const [
    correctionsResult,
    noGoResult,
    memoriesResult,
    prefResult,
    knowledgeResult,
    tasksResult,
  ] = await Promise.all([
    admin
      .from('ai_corrections')
      .select('interpreted_rule, forbidden_phrase')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('ai_no_go_zones')
      .select('topic, topic_keywords')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .gte('confidence', 0.4)
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('ai_memories')
      .select('content')
      .eq('clinic_id', clinicId)
      .eq('is_private', false)
      .eq('memory_type', 'daily_summary')
      .order('source_date', { ascending: false })
      .limit(5),
    admin
      .from('preference_engine')
      .select('*')
      .eq('clinic_id', clinicId)
      .maybeSingle(),
    admin
      .from('clinic_knowledge')
      .select('category, content')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    (() => {
      const stockholmToday = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })
      return admin
        .from('ai_tasks')
        .select('description, due_date')
        .eq('clinic_id', clinicId)
        .eq('status', 'pending')
        .or(`due_date.is.null,due_date.lte.${stockholmToday}`)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(5)
    })(),
  ])

  if (prefResult.error) console.error('Failed to fetch preferences:', prefResult.error)
  if (knowledgeResult.error) console.error('Failed to fetch clinic knowledge:', knowledgeResult.error)
  if (tasksResult.error) console.error('Failed to fetch tasks:', tasksResult.error)

  // Build personality block
  let personalityBlock: string | undefined
  if (prefResult.data) {
    const pd = prefResult.data
    const calibrated: CalibratedPreferences = {
      formality: calibrate(pd.formality_alpha as number, pd.formality_beta as number),
      emoji_frequency: calibrate(pd.emoji_frequency_alpha as number, pd.emoji_frequency_beta as number),
      verbosity: calibrate(pd.verbosity_alpha as number, pd.verbosity_beta as number),
      humor_tolerance: calibrate(pd.humor_tolerance_alpha as number, pd.humor_tolerance_beta as number),
      proactivity_tolerance: calibrate(pd.proactivity_tolerance_alpha as number, pd.proactivity_tolerance_beta as number),
    }
    const observedTraits = (pd.observed_traits as string[]) ?? []
    personalityBlock = buildPersonalityBlock(calibrated, observedTraits)
  }

  // Build system prompt
  const systemPrompt = buildSystemPrompt({
    clinicName,
    ownerName: null, // owner name not available in shared context — prompt handles null gracefully
    corrections: (correctionsResult.data || []) as Array<{ interpreted_rule: string }>,
    noGoZones: (noGoResult.data || []) as Array<{ topic: string; topic_keywords: string[] }>,
    memories: (memoriesResult.data || []) as Array<{ content: string }>,
    clinicKnowledge: (knowledgeResult.data || []) as Array<{ category: string; content: string }>,
    personalityBlock,
    pendingTasks: (tasksResult.data || []) as Array<{ description: string; due_date: string | null }>,
    source,
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

  // Safe response extraction — handle multi-block responses
  const assistantText = response.content
    ?.filter((b) => b.type === 'text')
    .map((b) => (b as Anthropic.TextBlock).text)
    .join('\n') || ''

  const responseText = assistantText || 'Ursäkta, jag kunde inte generera ett svar just nu. Försök igen!'

  // Save assistant message
  const { data: savedAssistantMsg, error: assistantInsertError } = await admin
    .from('ai_chat_messages')
    .insert({
      clinic_id: clinicId,
      role: 'assistant',
      content: responseText,
      model: response.model,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      latency_ms: latencyMs,
      conversation_id: conversationId,
      source,
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
      source,
    },
  })

  // Increment interaction count (non-critical)
  await admin.rpc('increment_interaction_count', { p_clinic_id: clinicId })

  return {
    response: responseText,
    assistantMessageId: savedAssistantMsg.id,
    assistantMessageCreatedAt: savedAssistantMsg.created_at,
    ownerMessageId: savedOwnerMsg.id,
    conversationId,
  }
}

/**
 * Post-processing: corrections, no-go zones, knowledge detection,
 * preference signals, trait observations, task detection, phase progression.
 * Runs after response is returned to user.
 */
export async function runPostProcessing(options: {
  clinicId: string
  ownerMessage: string
}): Promise<void> {
  const { clinicId, ownerMessage } = options
  const admin = createAdminClient()

  // 1. Detect no-go zone FIRST (takes priority over corrections)
  const noGo = detectNoGoZone(ownerMessage)
  if (noGo) {
    const { error: noGoInsertError } = await admin.from('ai_no_go_zones').insert({
      clinic_id: clinicId,
      topic: noGo.topic.toLowerCase().trim(),
      topic_keywords: noGo.keywords,
      reason: noGo.reason,
      detected_via: noGo.explicit ? 'explicit' : 'inferred',
      confidence: noGo.explicit ? 1.0 : 0.7,
    })

    if (noGoInsertError && noGoInsertError?.code !== '23505') {
      console.error('Failed to insert no-go zone:', noGoInsertError)
    }
  }

  // 2. Detect explicit correction (only if no no-go zone found)
  if (!noGo) {
    const correction = detectExplicitCorrection(ownerMessage)
    if (correction) {
      const { error: corrInsertError } = await admin.from('ai_corrections').insert({
        clinic_id: clinicId,
        correction_text: correction.text,
        interpreted_rule: correction.rule,
        forbidden_phrase: correction.forbiddenPhrase
          ? correction.forbiddenPhrase.toLowerCase().trim()
          : null,
        preference_key: correction.mappedPreference,
      })

      if (corrInsertError && corrInsertError?.code !== '23505') {
        console.error('Failed to insert correction:', corrInsertError)
      }
    }
  }

  // 3. No-go zone confidence decay
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

  // 5. Extract preference signals and apply Bayesian updates
  const { data: prevAiMsgs, error: prevAiError } = await admin
    .from('ai_chat_messages')
    .select('content')
    .eq('clinic_id', clinicId)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(2)

  if (prevAiError) console.error('Failed to fetch previous AI message:', prevAiError)

  const previousAiMessage = prevAiMsgs && prevAiMsgs.length >= 2 ? prevAiMsgs[1].content : ''

  const signals = extractSignals(ownerMessage, previousAiMessage)

  for (const signal of signals) {
    const { data: result, error: rpcError } = await admin.rpc('update_preference_atomic', {
      p_clinic_id: clinicId,
      p_preference_key: signal.preference,
      p_direction: signal.direction,
      p_weight: signal.weight,
    })

    if (rpcError) {
      console.error('Preference update failed:', rpcError)
      continue
    }

    if (result) {
      const rpcResult = result as {
        old_alpha: number
        old_beta: number
        new_alpha: number
        new_beta: number
      }
      const { error: signalError } = await admin.from('preference_signals').insert({
        clinic_id: clinicId,
        preference_key: signal.preference,
        signal_type: signal.reason,
        signal_direction: signal.direction,
        signal_weight: signal.weight,
        alpha_before: rpcResult.old_alpha,
        beta_before: rpcResult.old_beta,
        alpha_after: rpcResult.new_alpha,
        beta_after: rpcResult.new_beta,
      })
      if (signalError) console.error('Signal log failed:', signalError)
    }
  }

  // 6. Update trait observations
  for (const detector of TRAIT_DETECTORS) {
    if (!detector.pattern(ownerMessage)) continue

    const { data: newCount, error: traitError } = await admin.rpc('upsert_trait_observation', {
      p_clinic_id: clinicId,
      p_trait_key: detector.traitKey,
    })

    if (traitError) {
      console.error('Trait observation failed:', traitError)
      continue
    }

    if (typeof newCount === 'number' && newCount >= detector.minOccurrences) {
      const { data: traitRow } = await admin
        .from('trait_observations')
        .select('promoted')
        .eq('clinic_id', clinicId)
        .eq('trait_key', detector.traitKey)
        .maybeSingle()

      if (traitRow && !traitRow.promoted) {
        const { error: promoteError } = await admin.rpc('promote_trait', {
          p_clinic_id: clinicId,
          p_trait_text: detector.traitText,
        })
        if (promoteError) console.error('Trait promotion failed:', promoteError)

        const { error: markError } = await admin
          .from('trait_observations')
          .update({ promoted: true })
          .eq('clinic_id', clinicId)
          .eq('trait_key', detector.traitKey)
        if (markError) console.error('Trait mark promoted failed:', markError)
      }
    }
  }

  // 7. Increment total messages (atomic RPC)
  const { error: incError } = await admin.rpc('increment_preference_messages', {
    p_clinic_id: clinicId,
  })
  if (incError) console.error('Message count increment failed:', incError)

  // 8. Detect task/reminder requests
  const task = detectTask(ownerMessage)
  if (task) {
    const descPrefix = task.description.slice(0, 40).toLowerCase()
    const { data: existingTask, error: existingError } = await admin
      .from('ai_tasks')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('status', 'pending')
      .ilike('description', `${descPrefix.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`)
      .maybeSingle()

    if (existingError) console.error('Task dedup check failed:', existingError)

    if (!existingTask) {
      const { error: taskError } = await admin.from('ai_tasks').insert({
        clinic_id: clinicId,
        description: task.description,
        due_date: task.dueDate,
        source_message: task.sourceMessage,
        status: 'pending',
      })

      if (taskError) console.error('Failed to insert task:', taskError)
    }
  }

  // 9. Phase progression
  const { data: prefs, error: prefsError } = await admin
    .from('clinic_preferences')
    .select('interaction_count, relationship_phase')
    .eq('clinic_id', clinicId)
    .maybeSingle()

  if (prefsError) {
    console.error('Failed to read clinic_preferences for phase update:', prefsError)
  } else if (prefs) {
    const count = prefs.interaction_count ?? 0
    const currentPhase = prefs.relationship_phase ?? 'dating'

    let targetPhase: 'dating' | 'building' | 'secure'
    if (count >= 50) {
      targetPhase = 'secure'
    } else if (count >= 15) {
      targetPhase = 'building'
    } else {
      targetPhase = 'dating'
    }

    if (targetPhase !== currentPhase) {
      const { error: phaseUpdateError } = await admin
        .from('clinic_preferences')
        .update({ relationship_phase: targetPhase })
        .eq('clinic_id', clinicId)

      if (phaseUpdateError) {
        console.error('Failed to update relationship_phase:', phaseUpdateError)
      }
    }
  }
}

async function saveDetectedKnowledge(
  admin: ReturnType<typeof createAdminClient>,
  clinicId: string,
  knowledge: DetectedKnowledge
): Promise<void> {
  if (knowledge.isReplaceable) {
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
