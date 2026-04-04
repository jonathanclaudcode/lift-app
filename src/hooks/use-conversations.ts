'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ConversationListItem } from '@/types/conversations'

export function useConversations(clinicId: string, initialData?: ConversationListItem[]) {
  return useQuery({
    queryKey: ['conversations', clinicId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('conversations')
        .select('id, channel, status, last_message_at, last_message_preview, unread_count, customer_id, customers(id, name, phone, pipeline_stage)')
        .eq('status', 'active')
        .order('last_message_at', { ascending: false, nullsFirst: false })

      if (error) throw error
      return data as unknown as ConversationListItem[]
    },
    initialData,
    staleTime: 30 * 1000,
  })
}
