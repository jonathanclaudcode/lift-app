'use client'

import { useState, useRef, useEffect } from 'react'
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

export function ChatContainer({ initialMessages }: ChatContainerProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isInitialRender = useRef(true)

  // Auto-scroll: instant on first render, smooth on subsequent messages
  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: isInitialRender.current ? 'instant' : 'smooth',
    })
    isInitialRender.current = false
  }, [messages.length, isLoading])

  // Auto-clear error after 5 seconds
  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), 5000)
    return () => clearTimeout(timer)
  }, [error])

  async function handleSend(text: string) {
    if (isLoading) return

    setError(null)

    const optimisticMsg: Message = {
      id: 'temp-' + Date.now(),
      role: 'owner',
      content: text,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, optimisticMsg])
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Nätverksfel' }))
        throw new Error(data.error || 'Något gick fel')
      }

      const assistantMsg: Message = await res.json()
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
      setError(err instanceof Error ? err.message : 'Något gick fel. Försök igen.')
    } finally {
      setIsLoading(false)
    }
  }

  // Welcome state
  if (messages.length === 0 && !isLoading) {
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
          <ChatInput onSend={handleSend} disabled={isLoading} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 overscroll-y-contain">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} role={msg.role} content={msg.content} created_at={msg.created_at} />
        ))}

        {/* Typing indicator */}
        {isLoading && (
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
        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>
    </div>
  )
}
