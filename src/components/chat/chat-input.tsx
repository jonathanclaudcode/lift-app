'use client'

import { useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [inputValue, setInputValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const target = e.currentTarget
    target.style.height = 'auto'
    target.style.height = Math.min(target.scrollHeight, 160) + 'px'
  }

  function handleSend() {
    const text = inputValue.trim()
    if (!text || disabled) return
    onSend(text)
    setInputValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (e.key === 'Enter' && !e.shiftKey && !isTouchDevice) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex gap-2 items-end">
      <textarea
        ref={textareaRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="Skriv till din assistent..."
        disabled={disabled}
        rows={1}
        className="flex-1 min-h-[40px] max-h-[160px] resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
      />
      <Button
        onClick={handleSend}
        disabled={!inputValue.trim() || disabled}
        size="icon"
        className="shrink-0"
        aria-label="Skicka meddelande"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  )
}
