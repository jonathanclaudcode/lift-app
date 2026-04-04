'use client'

import { useRef, useState, useEffect, useTransition } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useMessages } from '@/hooks/use-messages'
import { sendMessage, markConversationRead } from '@/actions/messages'
import { markSuggestionChosen } from '@/actions/ai'
import { useAiSuggestions } from '@/hooks/use-ai-suggestions'
import { Bot, Send, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMessageTime, formatDateLabel, getDateKey } from '@/lib/format-time'
import type { Message } from '@/types/conversations'

export default function MessageThread({
  conversationId,
  clinicId,
  channel,
  initialMessages,
}: {
  conversationId: string
  clinicId: string
  channel: string
  initialMessages: Message[]
}) {
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const queryClient = useQueryClient()
  const [, startTransition] = useTransition()
  const { data: messages = [] } = useMessages(conversationId, initialMessages)

  useEffect(() => {
    markConversationRead(conversationId)
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
  }, [conversationId, queryClient])

  // Scroll to bottom on mount and when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [messages.length])

  // AI suggestion logic
  const lastMessage = messages.at(-1)
  const lastInboundMessage = messages.filter((m) => m.direction === 'inbound').at(-1)
  const lastInboundMessageId = lastInboundMessage?.id
  const shouldFetchSuggestions = lastMessage?.direction === 'inbound'

  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false)

  // Reset dismissed state when a new inbound message triggers suggestions
  const prevTriggerIdRef = useRef(lastInboundMessageId)
  useEffect(() => {
    if (lastInboundMessageId && lastInboundMessageId !== prevTriggerIdRef.current) {
      prevTriggerIdRef.current = lastInboundMessageId
      setSuggestionsDismissed(false)
    }
  }, [lastInboundMessageId])

  const {
    data: aiData,
    isLoading: aiLoading,
    isError: aiError,
  } = useAiSuggestions(conversationId, clinicId, lastInboundMessageId, shouldFetchSuggestions)

  const showSuggestions = shouldFetchSuggestions && !suggestionsDismissed && !inputValue.trim()

  function handleSelectSuggestion(text: string, index: number) {
    setSuggestionsDismissed(true)
    setInputValue(text)
    textareaRef.current?.focus()

    if (aiData?.triggeringMessageId) {
      void markSuggestionChosen(clinicId, aiData.triggeringMessageId, index, text)
    }
  }

  function handleTextareaInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const target = e.currentTarget
    target.style.height = 'auto'
    target.style.height = Math.min(target.scrollHeight, 120) + 'px'
  }

  async function handleSend() {
    const content = inputValue.trim()
    if (!content || isSending) return

    setInputValue('')
    setIsSending(true)
    setSuggestionsDismissed(true)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const optimisticMessage: Message = {
      id: 'optimistic-' + Date.now(),
      direction: 'outbound',
      author: 'clinic_staff',
      content,
      status: 'sending',
      channel,
      created_at: new Date().toISOString(),
      ai_suggestions: null,
      suggested_text: null,
      final_text: null,
    }

    queryClient.setQueryData(
      ['messages', conversationId],
      (old: Message[] | undefined) => [...(old || []), optimisticMessage]
    )

    startTransition(async () => {
      try {
        const sent = await sendMessage({ conversationId, clinicId, content, channel })
        queryClient.setQueryData(
          ['messages', conversationId],
          (old: Message[] | undefined) =>
            (old || []).map((m) =>
              m.id === optimisticMessage.id
                ? {
                    ...sent,
                    direction: sent.direction as Message['direction'],
                    author: sent.author as Message['author'],
                  }
                : m
            )
        )
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
      } catch {
        queryClient.setQueryData(
          ['messages', conversationId],
          (old: Message[] | undefined) =>
            (old || []).filter((m) => m.id !== optimisticMessage.id)
        )
        setInputValue(content)
      } finally {
        setIsSending(false)
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto flex flex-col justify-end min-h-0"
      >
        <div className="mt-auto px-4 pt-2">
          {messages.map((msg, index) => {
            const isOutbound = msg.direction === 'outbound'
            const prevMsg = messages[index - 1]
            const showDateSeparator =
              index === 0 ||
              (prevMsg && getDateKey(msg.created_at) !== getDateKey(prevMsg.created_at))
            return (
              <div key={msg.id}>
                {showDateSeparator && (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    {formatDateLabel(msg.created_at)}
                  </div>
                )}
                <div
                  className={`flex flex-col mb-3 ${isOutbound ? 'items-end' : 'items-start'}`}
                >
                <div
                  className={
                    isOutbound
                      ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2 max-w-[85%] shadow-sm'
                      : 'bg-muted text-foreground rounded-2xl rounded-bl-sm px-4 py-2 max-w-[85%] shadow-sm'
                  }
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
                <div className="flex items-center gap-1 mt-0.5 px-1">
                  <span className="text-xs text-muted-foreground">
                    {formatMessageTime(msg.created_at)}
                  </span>
                  {msg.author === 'ai_agent' && <Bot className="h-3 w-3 text-muted-foreground" />}
                  {isOutbound && msg.status === 'sending' && <Clock className="h-3 w-3 text-muted-foreground" />}
                </div>
              </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* AI suggestion chips */}
      {showSuggestions && aiLoading && (
        <div className="flex flex-col gap-2 px-4 py-2 border-t bg-muted/30">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 rounded-2xl bg-muted animate-pulse"
              style={{ width: `${60 + i * 10}%` }}
            />
          ))}
        </div>
      )}

      {showSuggestions && aiData?.suggestions && aiData.suggestions.length > 0 && (
        <div className="flex flex-col gap-2 px-4 py-2 border-t bg-muted/30">
          {aiData.suggestions.map((suggestion, index) => (
            <button
              key={`${lastInboundMessageId}-${index}`}
              onClick={() => handleSelectSuggestion(suggestion.text, index)}
              className="rounded-2xl border px-4 py-3 text-sm hover:bg-accent transition-colors text-left"
            >
              {suggestion.text}
            </button>
          ))}
        </div>
      )}

      {showSuggestions && aiError && (
        <p className="px-4 py-2 text-xs text-muted-foreground">
          Kunde inte generera förslag
        </p>
      )}

      {/* Input area */}
      <div className="shrink-0 border-t bg-background px-3 py-1.5">
        <div className="flex items-end gap-2 rounded-2xl border bg-background shadow-sm px-3 py-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onInput={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Skriv ett meddelande..."
            className="flex-1 min-h-[36px] max-h-[120px] resize-none border-0 bg-transparent py-1 text-sm focus:outline-none focus:ring-0"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending}
            size="icon"
            className="shrink-0 rounded-full h-8 w-8 transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
