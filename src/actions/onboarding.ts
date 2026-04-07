'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  OnboardingData,
  ClickQuestionAnswer,
} from '@/lib/onboarding/types'

/**
 * Resolve the authenticated user's clinic ID server-side via JWT.
 * Throws if not authenticated. Never trust clinicId from the client.
 */
async function getAuthenticatedClinicId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const clinicId = user.app_metadata?.clinic_id as string | undefined
  if (!clinicId) throw new Error('No clinic ID in session')
  return clinicId
}

/**
 * Save partial onboarding data. Shallow-merges the partial into the existing JSONB.
 * Each call should pass the COMPLETE answer object for any field it touches —
 * partial nested updates will overwrite (this is shallow merge, not deep merge).
 */
export async function saveOnboardingProgress(
  partial: Partial<OnboardingData>
): Promise<{ success: boolean; error?: string }> {
  try {
    const clinicId = await getAuthenticatedClinicId()
    const supabase = await createClient()

    const { data: clinic, error: readError } = await supabase
      .from('clinics')
      .select('onboarding_data')
      .eq('id', clinicId)
      .single()

    if (readError) {
      return { success: false, error: readError.message }
    }

    const existing = (clinic?.onboarding_data ?? {}) as OnboardingData
    const merged: OnboardingData = { ...existing, ...partial }

    const { error: updateError } = await supabase
      .from('clinics')
      .update({ onboarding_data: merged })
      .eq('id', clinicId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * Set the AI name on the clinic. Called from the welcome screen.
 */
export async function setAiName(
  aiName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const trimmed = aiName.trim()
    if (!trimmed || trimmed.length === 0 || trimmed.length > 30) {
      return { success: false, error: 'Ogiltigt namn' }
    }

    const clinicId = await getAuthenticatedClinicId()
    const supabase = await createClient()

    const { error: updateError } = await supabase
      .from('clinics')
      .update({ ai_name: trimmed })
      .eq('id', clinicId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // Also save to onboarding_data for resume consistency
    const saveResult = await saveOnboardingProgress({ ai_name: trimmed })
    if (!saveResult.success) {
      return saveResult
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * Trigger background scraping for the clinic's website.
 *
 * IMPORTANT: This server action AWAITS the trigger fetch. Do not change to fire-and-forget —
 * Vercel will abort the outgoing connection when the server action returns if you don't await.
 * The /api/onboarding/scrape endpoint returns 200 IMMEDIATELY (within ~100ms) and processes
 * the actual scraping inside `after()`. So awaiting the trigger does NOT block the user.
 */
export async function startBackgroundScraping(
  domain: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const trimmedDomain = domain.trim().toLowerCase()
    if (!trimmedDomain || !trimmedDomain.includes('.')) {
      return { success: false, error: 'Ogiltig domän' }
    }

    const clinicId = await getAuthenticatedClinicId()
    const supabase = await createClient()

    // Save the domain to onboarding_data
    const saveResult = await saveOnboardingProgress({ website_domain: trimmedDomain })
    if (!saveResult.success) {
      return saveResult
    }

    // Mark scraping as pending and clear any old result
    const { error: updateError } = await supabase
      .from('clinics')
      .update({
        scraping_status: 'pending',
        scraping_started_at: new Date().toISOString(),
        scraping_completed_at: null,
        scraping_error: null,
        scraping_result: null,
      })
      .eq('id', clinicId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // Trigger the actual scraping endpoint with shared secret authentication.
    // We AWAIT this. The endpoint returns 200 immediately (work happens in after()),
    // so the await is fast (~100ms) and safe.
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    const secret = process.env.ONBOARDING_INTERNAL_SECRET
    if (!secret) {
      console.error('[Onboarding] ONBOARDING_INTERNAL_SECRET not set')
      return { success: false, error: 'Server configuration error' }
    }

    try {
      const triggerResponse = await fetch(`${baseUrl}/api/onboarding/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': secret,
        },
        body: JSON.stringify({ clinicId, domain: trimmedDomain }),
        signal: AbortSignal.timeout(10_000),
      })

      if (!triggerResponse.ok) {
        console.error('[Onboarding] Scrape trigger returned non-OK:', triggerResponse.status)
        // Don't fail the action — the user can still proceed; the review page will
        // show the scraping_status as pending and eventually time out gracefully.
      }
    } catch (triggerErr) {
      console.error('[Onboarding] Failed to trigger scraping:', triggerErr)
      // Same as above — let the user proceed.
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * Get current scraping status. Used by frontend polling on the review page.
 */
export async function getScrapingStatus(): Promise<{
  status: 'pending' | 'in_progress' | 'success' | 'failed' | null
  result?: unknown
  error?: string
}> {
  try {
    const clinicId = await getAuthenticatedClinicId()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('clinics')
      .select('scraping_status, scraping_result, scraping_error')
      .eq('id', clinicId)
      .single()

    if (error) {
      return { status: null, error: error.message }
    }

    return {
      status: data?.scraping_status as
        | 'pending'
        | 'in_progress'
        | 'success'
        | 'failed'
        | null,
      result: data?.scraping_result,
      error: data?.scraping_error || undefined,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { status: null, error: message }
  }
}

/**
 * Mark onboarding as complete. IDEMPOTENT: returns early if onboarded_at is already set.
 * Persists the answers to clinic_knowledge as a side effect (only on first call).
 */
export async function completeOnboarding(): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const clinicId = await getAuthenticatedClinicId()
    const supabase = await createClient()

    // Idempotency check: if already onboarded, return success without doing anything
    const { data: clinic, error: readError } = await supabase
      .from('clinics')
      .select('onboarded_at')
      .eq('id', clinicId)
      .single()

    if (readError) {
      return { success: false, error: readError.message }
    }

    if (clinic?.onboarded_at) {
      return { success: true }
    }

    // Persist answers to clinic_knowledge BEFORE marking onboarded_at
    // (so a partial failure doesn't leave us in an inconsistent state)
    await persistOnboardingAnswersToKnowledge(clinicId)

    // Set the AI personality character if Q7 was answered
    await persistAiPersonalityCharacter(clinicId)

    // Mark as onboarded
    const { error: updateError } = await supabase
      .from('clinics')
      .update({ onboarded_at: new Date().toISOString() })
      .eq('id', clinicId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}

/**
 * Persist the AI personality character (from Q7) to the clinic.
 */
async function persistAiPersonalityCharacter(clinicId: string): Promise<void> {
  const admin = createAdminClient()

  const { data: clinic } = await admin
    .from('clinics')
    .select('onboarding_data')
    .eq('id', clinicId)
    .single()

  if (!clinic) return

  const data = (clinic.onboarding_data ?? {}) as OnboardingData
  const character = data.q7_ai_character

  let value: string | null = null
  if (character?.selected_character) {
    value = `${character.selected_character.name}: ${character.selected_character.description}`
  } else if (character?.custom_character) {
    value = character.custom_character
  }

  if (value) {
    await admin
      .from('clinics')
      .update({ ai_personality_character: value })
      .eq('id', clinicId)
  }
}

/**
 * Convert onboarding_data JSONB into clinic_knowledge rows.
 * Categories used: 'personal' for vision/day/character, 'preference' for pain points.
 * Source = 'owner' (this is information the owner directly provided).
 */
async function persistOnboardingAnswersToKnowledge(clinicId: string): Promise<void> {
  const admin = createAdminClient()

  // Idempotency guard: if owner rows already exist for this clinic, skip.
  // This protects against the race window where persist succeeded but the
  // onboarded_at UPDATE failed, causing completeOnboarding to retry.
  const { data: existingOwnerRows } = await admin
    .from('clinic_knowledge')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('source', 'owner')
    .limit(1)

  if (existingOwnerRows && existingOwnerRows.length > 0) {
    console.log('[Onboarding] Owner rows already exist, skipping persist')
    return
  }

  const { data: clinic, error } = await admin
    .from('clinics')
    .select('onboarding_data, ai_name')
    .eq('id', clinicId)
    .single()

  if (error || !clinic) {
    console.error('[Onboarding] Failed to read onboarding_data:', error)
    return
  }

  const data = (clinic.onboarding_data ?? {}) as OnboardingData
  const aiName = clinic.ai_name || 'AI'

  const rows: Array<Record<string, unknown>> = []

  // Q3: Clinic vision (personal)
  if (data.q3_clinic_vision?.main_text) {
    rows.push({
      clinic_id: clinicId,
      category: 'personal',
      content: `Klinikens vision: ${data.q3_clinic_vision.main_text}`.slice(0, 500),
      source: 'owner',
      is_active: true,
      confidence: 'high',
    })
    if (data.q3_clinic_vision.follow_up_text) {
      rows.push({
        clinic_id: clinicId,
        category: 'personal',
        content: `Mest stolt över: ${data.q3_clinic_vision.follow_up_text}`.slice(0, 500),
        source: 'owner',
        is_active: true,
        confidence: 'high',
      })
    }
  }

  // Q6: Typical day (personal)
  if (data.q6_typical_day?.main_text) {
    rows.push({
      clinic_id: clinicId,
      category: 'personal',
      content: `En vanlig dag: ${data.q6_typical_day.main_text}`.slice(0, 500),
      source: 'owner',
      is_active: true,
      confidence: 'high',
    })
    if (data.q6_typical_day.follow_up_text) {
      rows.push({
        clinic_id: clinicId,
        category: 'personal',
        content: `Hoppas att ${aiName} kan hjälpa med: ${data.q6_typical_day.follow_up_text}`.slice(0, 500),
        source: 'owner',
        is_active: true,
        confidence: 'high',
      })
    }
  }

  // Q7: AI character (personal)
  if (data.q7_ai_character?.selected_character) {
    rows.push({
      clinic_id: clinicId,
      category: 'personal',
      content: `${aiName} ska ha en personlighet som ${data.q7_ai_character.selected_character.name}: ${data.q7_ai_character.selected_character.description}`.slice(0, 500),
      source: 'owner',
      is_active: true,
      confidence: 'high',
    })
  } else if (data.q7_ai_character?.custom_character) {
    rows.push({
      clinic_id: clinicId,
      category: 'personal',
      content: `${aiName} ska ha personligheten: ${data.q7_ai_character.custom_character}`.slice(0, 500),
      source: 'owner',
      is_active: true,
      confidence: 'high',
    })
  }

  // Q1, Q2, Q4, Q5: pain points and preferences
  const painPointQuestions: Array<{
    key: keyof OnboardingData
    label: string
  }> = [
    { key: 'q1_customer_communication', label: 'Kundkommunikation' },
    { key: 'q2_social_media', label: 'Sociala medier' },
    { key: 'q4_customer_situation', label: 'Kundsituation' },
    { key: 'q5_cancellations', label: 'Avbokningar' },
  ]

  for (const { key, label } of painPointQuestions) {
    const answer = data[key] as ClickQuestionAnswer | undefined
    if (!answer || !answer.main_choice) continue

    let content = `${label}: ${answer.main_choice}`
    for (const fu of answer.follow_ups || []) {
      content += `. ${fu.question} ${fu.answers.join(', ')}`
    }

    rows.push({
      clinic_id: clinicId,
      category: 'preference',
      content: content.slice(0, 500),
      source: 'owner',
      is_active: true,
      confidence: 'high',
    })
  }

  if (rows.length === 0) return

  const { error: insertError } = await admin.from('clinic_knowledge').insert(rows)
  if (insertError) {
    console.error('[Onboarding] Failed to insert knowledge rows:', insertError)
  }
}
