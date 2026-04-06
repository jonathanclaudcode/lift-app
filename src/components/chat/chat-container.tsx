'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatMessage } from './chat-message'
import { ChatInput } from './chat-input'

interface Message {
  id: string
  role: 'owner' | 'assistant'
  content: string
  created_at: string
}

interface ChatContainerProps {
  initialMessages: Message[]
}

const BURST_DEBOUNCE_MS = 3000
const BURST_DEBOUNCE_QUESTION_MS = 1500
const BURST_MAX_WAIT_MS = 10000
const PENDING_MSG_ID = 'pending-burst'

export function ChatContainer({ initialMessages }: ChatContainerProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isTyping, setIsTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isInitialRender = useRef(true)

  // Burst handling refs (mutable, no re-renders)
  const pendingTextsRef = useRef<string[]>([])
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const burstStartRef = useRef<number | null>(null)
  const isSendingRef = useRef(false)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-scroll: instant on first render, smooth on subsequent messages
  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: isInitialRender.current ? 'instant' : 'smooth',
    })
    isInitialRender.current = false
  }, [messages.length, isTyping])

  // Auto-clear error after 5 seconds
  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), 5000)
    return () => clearTimeout(timer)
  }, [error])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    }
  }, [])

  const sendToApi = useCallback(async (message: string) => {
    // Cosmetic typing delay — show indicator after 0.8-1.5s
    const typingDelay = 800 + Math.random() * 700
    typingTimerRef.current = setTimeout(() => {
      setIsTyping(true)
    }, typingDelay)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Nätverksfel' }))
        throw new Error(data.error || 'Något gick fel')
      }

      const assistantMsg: Message = await res.json()
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      // Remove the pending optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== PENDING_MSG_ID))
      setError(err instanceof Error ? err.message : 'Något gick fel. Försök igen.')
    } finally {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current)
        typingTimerRef.current = null
      }
      setIsTyping(false)
    }
  }, [])

  const flushPendingMessages = useCallback(async () => {
    if (isSendingRef.current) return
    if (pendingTextsRef.current.length === 0) return

    const combined = pendingTextsRef.current.join('\n\n')
    pendingTextsRef.current = []
    burstStartRef.current = null
    isSendingRef.current = true

    // Finalize the optimistic message content before sending
    setMessages((prev) =>
      prev.map((m) =>
        m.id === PENDING_MSG_ID ? { ...m, content: combined } : m
      )
    )

    try {
      await sendToApi(combined)
    } finally {
      isSendingRef.current = false

      // If new messages arrived while sending, schedule another flush
      if (pendingTextsRef.current.length > 0) {
        const lastText = pendingTextsRef.current[pendingTextsRef.current.length - 1]
        const debounceMs = lastText.endsWith('?')
          ? BURST_DEBOUNCE_QUESTION_MS
          : BURST_DEBOUNCE_MS
        burstStartRef.current = Date.now()
        debounceTimerRef.current = setTimeout(() => {
          void flushPendingMessages()
        }, debounceMs)
      }
    }
  }, [sendToApi])

  function handleSend(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return

    setError(null)
    pendingTextsRef.current.push(trimmed)

    // Track burst start time
    if (pendingTextsRef.current.length === 1) {
      burstStartRef.current = Date.now()
    }

    // Update optimistic message — ONE growing message during burst
    const pendingContent = pendingTextsRef.current.join('\n\n')
    setMessages((prev) => {
      const existing = prev.find((m) => m.id === PENDING_MSG_ID)
      if (existing) {
        return prev.map((m) =>
          m.id === PENDING_MSG_ID ? { ...m, content: pendingContent } : m
        )
      }
      return [
        ...prev,
        {
          id: PENDING_MSG_ID,
          role: 'owner' as const,
          content: pendingContent,
          created_at: new Date().toISOString(),
        },
      ]
    })

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Force flush if burst has exceeded max wait
    const timeSinceBurstStart = Date.now() - (burstStartRef.current ?? Date.now())
    if (timeSinceBurstStart >= BURST_MAX_WAIT_MS) {
      void flushPendingMessages()
      return
    }

    // Set debounce — shorter for questions
    const debounceMs = trimmed.endsWith('?')
      ? BURST_DEBOUNCE_QUESTION_MS
      : BURST_DEBOUNCE_MS

    debounceTimerRef.current = setTimeout(() => {
      void flushPendingMessages()
    }, debounceMs)
  }

  // Welcome state
  if (messages.length === 0 && !isTyping && pendingTextsRef.current.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <Bot className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-2xl font-semibold mt-4">Hej! 👋</p>
          <p className="text-muted-foreground text-center max-w-md mt-2">
            Jag är din personliga AI-assistent. Berätta lite om dig och din klinik — så lär jag mig
            hur jag bäst kan hjälpa dig.
          </p>
          <div className="flex gap-2 mt-6 flex-wrap justify-center">
            {[
              'Jag vill berätta om min klinik',
              'Jag behöver hjälp med något',
              'Vad kan du hjälpa mig med?',
            ].map((pill) => (
              <Button
                key={pill}
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => handleSend(pill)}
              >
                {pill}
              </Button>
            ))}
          </div>
        </div>
        <div className="shrink-0 border-t bg-background p-3">
          <ChatInput onSend={handleSend} disabled={false} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 overscroll-y-contain">
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
            created_at={msg.created_at}
          />
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start mb-3">
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce"
                style={{ animationDelay: '0ms' }}
              />
              <span
                className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce"
                style={{ animationDelay: '150ms' }}
              />
              <span
                className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce"
                style={{ animationDelay: '300ms' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 text-sm text-destructive text-center">{error}</div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t bg-background p-3">
        <ChatInput onSend={handleSend} disabled={false} />
      </div>
    </div>
  )
}
