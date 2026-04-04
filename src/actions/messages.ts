'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/channels/sms'

export async function sendMessage(params: {
  conversationId: string
  clinicId: string
  content: string
  channel: string
}) {
  const supabase = await createClient()

  // Always persist the message first — it must exist in DB regardless of SMS outcome.
  // Start with status 'sending' for SMS, 'sent' for other channels.
  const initialStatus = params.channel === 'sms' ? 'sending' : 'sent'

  const { data, error } = await supabase
    .from('messages')
    .insert({
      clinic_id: params.clinicId,
      conversation_id: params.conversationId,
      direction: 'outbound',
      author: 'clinic_staff',
      content: params.content,
      status: initialStatus,
      channel: params.channel,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // For SMS channel: send via 46elks, then update status
  if (params.channel === 'sms') {
    const admin = createAdminClient()

    // Fetch customer phone via conversation → customer_id
    const { data: conversation } = await admin
      .from('conversations')
      .select('customer_id')
      .eq('id', params.conversationId)
      .single()

    if (!conversation) {
      await admin.from('messages').update({ status: 'failed' }).eq('id', data.id)
      return { ...data, status: 'failed' }
    }

    const { data: customer } = await admin
      .from('customers')
      .select('phone')
      .eq('id', conversation.customer_id)
      .single()

    if (!customer?.phone) {
      console.error(`[SMS] Customer ${conversation.customer_id} has no phone number`)
      await admin.from('messages').update({ status: 'failed' }).eq('id', data.id)
      return { ...data, status: 'failed' }
    }

    // Fetch clinic phone (46elks number)
    const { data: clinic } = await admin
      .from('clinics')
      .select('phone')
      .eq('id', params.clinicId)
      .single()

    if (!clinic?.phone) {
      console.error(`[SMS] Clinic ${params.clinicId} has no phone number configured`)
      await admin.from('messages').update({ status: 'failed' }).eq('id', data.id)
      return { ...data, status: 'failed' }
    }

    const result = await sendSms({
      to: customer.phone,
      message: params.content,
      from: clinic.phone,
    })

    if (result.success) {
      // 'sent' means 46elks API accepted the request — NOT that the SMS was delivered to the handset.
      // Delivery reports (DLR) are a separate future feature.
      const { error: updateError } = await admin
        .from('messages')
        .update({ status: 'sent', external_message_id: result.messageId })
        .eq('id', data.id)

      if (updateError) {
        console.error('[SMS] Status update failed after successful send:', updateError.message)
        // Message stays as 'sending' — known limitation, no retry mechanism yet.
      }

      return { ...data, status: 'sent', external_message_id: result.messageId }
    } else {
      await admin.from('messages').update({ status: 'failed' }).eq('id', data.id)
      return { ...data, status: 'failed' }
    }
  }

  return data
}

export async function markConversationRead(conversationId: string) {
  const supabase = await createClient()

  await supabase
    .from('conversations')
    .update({ unread_count: 0 })
    .eq('id', conversationId)
}
