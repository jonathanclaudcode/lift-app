'use client'

import { useQuery } from '@tanstack/react-query'
import { generateAiSuggestions } from '@/actions/ai'

export function useAiSuggestions(
  conversationId: string,
  clinicId: string,
  lastInboundMessageId: string | undefined,
  shouldShow: boolean
) {
  return useQuery({
    queryKey: ['ai-suggestions', conversationId, lastInboundMessageId],
    queryFn: () => generateAiSuggestions(conversationId, clinicId),
    enabled: !!conversationId && !!clinicId && !!lastInboundMessageId && shouldShow,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (prev) => prev,
  })
}
