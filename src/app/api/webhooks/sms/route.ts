import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhoneNumber } from '@/lib/channels/sms'
import { verifySmsWebhook } from '@/lib/channels/sms-webhook-auth'

export async function POST(request: Request) {
  // ───── AUTH ─────
  if (!verifySmsWebhook(request)) {
    return new Response('Unauthorized', { status: 401 })
  }

  // ───── ALL LOGIC IN TRY/CATCH ─────
  // Always return 200 to prevent 46elks retries (except 401 above).
  try {
    const body = await request.text()
    const params = new URLSearchParams(body)

    const elksMsgId = params.get('id')
    const from = params.get('from')
    const to = params.get('to')
    const message = params.get('message')
    const created = params.get('created') // 46elks timestamp — logged for debugging delays

    // Validate required fields
    if (!elksMsgId || !from || !to || !message) {
      console.error('[SMS Webhook] Missing required fields', { id: elksMsgId, from, to, hasMessage: !!message })
      return new Response(null, { status: 200 })
    }

    const admin = createAdminClient()

    // Idempotency check (best-effort — race condition possible under high load).
    // TODO: Add UNIQUE constraint on messages.external_message_id for DB-level idempotency.
    const { data: existing } = await admin
      .from('messages')
      .select('id')
      .eq('external_message_id', elksMsgId)
      .limit(1)

    if (existing && existing.length > 0) {
      return new Response(null, { status: 200 })
    }

    // Find clinic by normalized 'to' number
    const normalizedTo = normalizePhoneNumber(to)
    const { data: clinics } = await admin
      .from('clinics')
      .select('*')
      .eq('phone', normalizedTo)
      .limit(2)

    if (!clinics || clinics.length === 0) {
      console.error('[SMS Webhook] No clinic found for number', normalizedTo)
      return new Response(null, { status: 200 })
    }

    if (clinics.length > 1) {
      console.warn('[SMS Webhook] Multiple clinics share number', normalizedTo)
    }

    const clinic = clinics[0]

    // Find or create customer
    const normalizedFrom = normalizePhoneNumber(from)

    const { data: upsertedCustomer } = await admin
      .from('customers')
      .upsert(
        { clinic_id: clinic.id, phone: normalizedFrom, name: normalizedFrom },
        { onConflict: 'clinic_id,phone', ignoreDuplicates: true }
      )
      .select()
      .single()

    let customer = upsertedCustomer
    if (!customer) {
      // upsert returned nothing on conflict — fetch existing
      const { data: existingCustomer } = await admin
        .from('customers')
        .select('*')
        .eq('clinic_id', clinic.id)
        .eq('phone', normalizedFrom)
        .single()

      customer = existingCustomer
    }

    if (!customer) {
      console.error('[SMS Webhook] Failed to find or create customer', { clinic_id: clinic.id, phone: normalizedFrom })
      return new Response(null, { status: 200 })
    }

    // Find or create conversation (BEFORE message — trigger needs existing conversation)
    // unread_count: 0 because trigger update_conversation_on_message increments it on message INSERT.
    const { data: upsertedConversation } = await admin
      .from('conversations')
      .upsert(
        {
          clinic_id: clinic.id,
          customer_id: customer.id,
          channel: 'sms' as const,
          status: 'active',
          last_message_at: new Date().toISOString(),
          unread_count: 0,
        },
        { onConflict: 'clinic_id,customer_id,channel', ignoreDuplicates: true }
      )
      .select()
      .single()

    let conversation = upsertedConversation
    if (!conversation) {
      const { data: existingConversation } = await admin
        .from('conversations')
        .select('*')
        .eq('clinic_id', clinic.id)
        .eq('customer_id', customer.id)
        .eq('channel', 'sms')
        .single()

      conversation = existingConversation
    }

    if (!conversation) {
      console.error('[SMS Webhook] Failed to find or create conversation', { clinic_id: clinic.id, customer_id: customer.id })
      return new Response(null, { status: 200 })
    }

    // Create the message
    // TODO: If UNIQUE constraint is added on external_message_id, switch to upsert with onConflict for DB-level idempotency.
    await admin.from('messages').insert({
      clinic_id: clinic.id,
      conversation_id: conversation.id,
      direction: 'inbound',
      author: 'customer',
      content: message,
      status: 'delivered',
      channel: 'sms',
      external_message_id: elksMsgId,
    })

    // DO NOT manually update conversations — trigger update_conversation_on_message
    // handles last_message_at, last_message_preview, and unread_count automatically.

    const maskedFrom = '***' + normalizedFrom.slice(-4)
    console.info(`[SMS Webhook] Received from ${maskedFrom} for clinic ${clinic.id}, msgId: ${elksMsgId}, 46elks created: ${created ?? 'unknown'}`)

    return new Response(null, { status: 200 })
  } catch (error) {
    // Catch ALL errors — normalization crashes, DB errors, everything.
    // Always return 200 to avoid 46elks retries.
    console.error('[SMS Webhook] Unhandled error:', error)
    return new Response(null, { status: 200 })
  }
}
