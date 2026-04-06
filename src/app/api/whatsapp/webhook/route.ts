import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processAIMessage, runPostProcessing } from '@/lib/ai/process-message'
import { sendWhatsAppMessage, markMessageAsRead } from '@/lib/whatsapp/send-message'

export const maxDuration = 60

const KNOWN_MEDIA_TYPES = ['image', 'audio', 'video', 'document', 'sticker', 'location', 'contacts']

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    if (!challenge) {
      return new Response('Missing challenge', { status: 400 })
    }
    return new Response(challenge, { status: 200 })
  }

  return new Response('Forbidden', { status: 403 })
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    console.error('[WhatsApp Webhook] Failed to parse request body')
    return NextResponse.json({ status: 'ok' }, { status: 200 })
  }

  after(async () => {
    try {
      await processWebhookPayload(body)
    } catch (error) {
      console.error('[WhatsApp Webhook] Processing error:', error)
    }
  })

  return NextResponse.json({ status: 'ok' }, { status: 200 })
}

async function processWebhookPayload(body: Record<string, unknown>): Promise<void> {
  const entry = body?.entry as Array<Record<string, unknown>> | undefined
  const changes = entry?.[0]?.changes as Array<Record<string, unknown>> | undefined
  const value = changes?.[0]?.value as Record<string, unknown> | undefined

  if (!value) {
    console.warn('[WhatsApp Webhook] Malformed payload — no value')
    return
  }

  const messages = value.messages as Array<Record<string, unknown>> | undefined
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    // Status update (delivered/read) — silently ignore
    return
  }

  const admin = createAdminClient()

  for (const message of messages) {
    try {
      await processInboundMessage(admin, message)
    } catch (err) {
      console.error('[WhatsApp Webhook] Error processing message:', err)
    }
  }
}

async function processInboundMessage(
  admin: ReturnType<typeof createAdminClient>,
  message: Record<string, unknown>
): Promise<void> {
  const from = message.from as string | undefined
  const msgId = message.id as string | undefined
  const msgType = message.type as string | undefined

  if (!from || !msgId) return

  // Self-message guard
  if (from === process.env.WHATSAPP_PHONE_NUMBER) return

  // Reaction — silently skip
  if (msgType === 'reaction') return

  // Non-text media types — polite reply
  if (msgType && msgType !== 'text') {
    if (KNOWN_MEDIA_TYPES.includes(msgType)) {
      await sendWhatsAppMessage(
        from,
        'Hej! Jag kan bara läsa textmeddelanden just nu. Skriv gärna ditt meddelande som text så hjälper jag dig!'
      )
    }
    return
  }

  // Check for text content
  const textBody = (message.text as Record<string, unknown>)?.body as string | undefined
  if (!textBody || textBody.trim().length === 0) return

  // Dedup — insert into log
  const { error: dedupError } = await admin.from('whatsapp_message_log').insert({
    whatsapp_message_id: msgId,
    clinic_id: null, // Updated after clinic lookup
  })

  if (dedupError) {
    if (dedupError.code === '23505') return // Duplicate — skip silently
    console.error('[WhatsApp Webhook] Dedup insert error:', dedupError)
    return
  }

  // Normalize phone number
  const normalizedPhone = from.replace(/\D/g, '')

  // Look up clinic by whatsapp_phone
  const { data: clinic, error: clinicError } = await admin
    .from('clinics')
    .select('id')
    .eq('whatsapp_phone', normalizedPhone)
    .maybeSingle()

  if (clinicError) {
    console.error('[WhatsApp Webhook] Clinic lookup error:', clinicError)
    return
  }

  if (!clinic) {
    console.warn(`[WhatsApp] Unknown number: ${normalizedPhone}`)
    return
  }

  // Update dedup log with clinic_id (non-critical)
  await admin
    .from('whatsapp_message_log')
    .update({ clinic_id: clinic.id })
    .eq('whatsapp_message_id', msgId)

  // Simple rate limiting — count messages from this clinic in last 5 minutes
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { count, error: countError } = await admin
    .from('whatsapp_message_log')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinic.id)
    .gte('processed_at', fiveMinAgo)

  if (!countError && count !== null && count > 20) {
    await sendWhatsAppMessage(
      normalizedPhone,
      'Du skickar meddelanden för snabbt. Vänta en stund och försök igen.'
    )
    return
  }

  // Mark as read immediately (fire-and-forget)
  markMessageAsRead(msgId)

  // Process with AI
  const result = await processAIMessage({
    clinicId: clinic.id,
    ownerMessage: textBody.trim(),
    source: 'whatsapp',
  })

  // Send AI response back via WhatsApp
  const sent = await sendWhatsAppMessage(normalizedPhone, result.response)
  if (!sent) {
    console.error(
      `[WhatsApp] Failed to send reply to ${normalizedPhone} for message ${msgId}`
    )
  }

  // Run post-processing
  await runPostProcessing({
    clinicId: clinic.id,
    ownerMessage: textBody.trim(),
  })

  console.log(`[WhatsApp] Processed message from ${normalizedPhone} (clinic: ${clinic.id})`)
}
