'use server'

import { createClient } from '@/lib/supabase/server'

export async function sendMessage(params: {
  conversationId: string
  clinicId: string
  content: string
  channel: string
}) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('messages')
    .insert({
      clinic_id: params.clinicId,
      conversation_id: params.conversationId,
      direction: 'outbound',
      author: 'clinic_staff',
      content: params.content,
      status: 'sent',
      channel: params.channel,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function markConversationRead(conversationId: string) {
  const supabase = await createClient()

  await supabase
    .from('conversations')
    .update({ unread_count: 0 })
    .eq('id', conversationId)
}
