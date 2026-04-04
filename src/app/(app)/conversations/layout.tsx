import { createClient } from '@/lib/supabase/server'
import ConversationList from '@/components/conversations/conversation-list'
import ConversationsLayoutWrapper from '@/components/conversations/conversations-layout-wrapper'
import type { ConversationListItem } from '@/types/conversations'

export default async function ConversationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const clinicId = (user?.app_metadata?.clinic_id as string) || ''

  const { data: conversations } = await supabase
    .from('conversations')
    .select(
      'id, channel, status, last_message_at, last_message_preview, last_message_direction, unread_count, customer_id, customers(id, name, phone, pipeline_stage)'
    )
    .eq('status', 'active')
    .order('last_message_at', { ascending: false, nullsFirst: false })

  return (
    <ConversationsLayoutWrapper
      list={
        <ConversationList
          initialConversations={(conversations || []) as unknown as ConversationListItem[]}
          clinicId={clinicId}
        />
      }
    >
      {children}
    </ConversationsLayoutWrapper>
  )
}
