import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ConversationPageClient from '@/components/conversations/conversation-page-client'
import type { Message, ConversationCustomer } from '@/types/conversations'

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const { conversationId } = await params
  const supabase = await createClient()

  const { data: conversation } = await supabase
    .from('conversations')
    .select(
      'id, channel, clinic_id, customer_id, customers(id, name, phone, pipeline_stage)'
    )
    .eq('id', conversationId)
    .single()

  if (!conversation) notFound()

  const { data: messages } = await supabase
    .from('messages')
    .select(
      'id, direction, author, content, status, channel, created_at, ai_suggestions, suggested_text, final_text'
    )
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  return (
    <ConversationPageClient
      conversationId={conversationId}
      clinicId={conversation.clinic_id}
      channel={conversation.channel}
      customer={conversation.customers as unknown as ConversationCustomer}
      initialMessages={(messages || []) as unknown as Message[]}
    />
  )
}
