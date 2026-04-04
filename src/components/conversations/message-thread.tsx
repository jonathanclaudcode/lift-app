'use client'

import { useRef, useState, useEffect, useTransition } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useMessages } from '@/hooks/use-messages'
import { sendMessage, markConversationRead } from '@/actions/messages'
import { Bot, Send, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMessageTime } from '@/lib/format-time'
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
  const [isPending, startTransition] = useTransition()
  const { data: messages = [] } = useMessages(conversationId, initialMessages)

  useEffect(() => {
    markConversationRead(conversationId)
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
  }, [conversationId, queryClient])

  // Scroll to bottom on mount and when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [messages.length])

  // Suggestion chips
  const lastMessage = messages[messages.length - 1]
  const showChips = lastMessage?.direction === 'inbound'

  let suggestions: string[] = []
  if (showChips) {
    const content = lastMessage.content.toLowerCase()
    if (content.includes('boka') || content.includes('tid') || content.includes('behandling')) {
      suggestions = [
        'Absolut! Vi har tider på torsdag och fredag 😊',
        'Självklart, vilken tid passar dig?',
        'Jag kollar schemat och återkommer!',
      ]
    } else if (content.includes('avbok') || content.includes('ändra') || content.includes('flytta')) {
      suggestions = [
        'Inga problem! Vill du boka om till en annan tid?',
        'Jag fixar det, vilken dag passar bättre?',
        'Okej! Jag avbokar och skickar förslag på nya tider',
      ]
    } else if (content.includes('tack')) {
      suggestions = [
        'Tack själv! Hör av dig om du undrar något 💕',
        'Alltid! Vi finns här om du behöver oss',
        'Så kul att höra! Ha en fin dag ✨',
      ]
    } else {
      suggestions = [
        'Tack för ditt meddelande! 😊',
        'Absolut, jag hjälper dig gärna!',
        'Jag kollar upp det och återkommer snart',
      ]
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
          {messages.map((msg) => {
            const isOutbound = msg.direction === 'outbound'
            return (
              <div
                key={msg.id}
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
                  {msg.author === 'ai_agent' && (
                    <div className="flex items-center gap-1 mt-1 justify-end">
                      <Bot className="h-3 w-3 opacity-60" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5 px-1">
                  <span className="text-xs text-muted-foreground">
                    {formatMessageTime(msg.created_at)}
                  </span>
                  {msg.status === 'sending' && <Clock className="h-3 w-3 text-muted-foreground" />}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Suggestion chips */}
      {showChips && suggestions.length > 0 && (
        <div className="px-4 py-2 flex gap-2 flex-wrap border-t bg-muted/30">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              variant="outline"
              size="sm"
              className="rounded-full text-xs h-auto py-1.5"
              onClick={() => {
                setInputValue(suggestion)
                textareaRef.current?.focus()
              }}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="shrink-0 border-t bg-background p-3">
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
