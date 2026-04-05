'use client'

import { formatMessageTime } from '@/lib/format-time'

interface ChatMessageProps {
  role: 'owner' | 'assistant'
  content: string
  created_at: string
}

export function ChatMessage({ role, content, created_at }: ChatMessageProps) {
  const isOwner = role === 'owner'

  return (
    <div className={`flex mb-3 ${isOwner ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`px-4 py-2.5 max-w-[85%] md:max-w-[70%] shadow-sm ${
          isOwner
            ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm'
            : 'bg-muted rounded-2xl rounded-bl-sm'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        <span
          className={`block text-[10px] mt-1 text-right ${
            isOwner ? 'opacity-70' : 'text-muted-foreground'
          }`}
        >
          {formatMessageTime(created_at)}
        </span>
      </div>
    </div>
  )
}
