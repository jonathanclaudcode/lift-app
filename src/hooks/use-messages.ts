'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Message } from '@/types/conversations'

export function useMessages(conversationId: string, initialData?: Message[]) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('messages')
        .select('id, direction, author, content, status, channel, created_at, ai_suggestions, suggested_text, final_text')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as unknown as Message[]
    },
    initialData,
    staleTime: 10 * 1000,
  })
}
