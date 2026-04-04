'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageSquare } from 'lucide-react'
import { useConversations } from '@/hooks/use-conversations'
import { formatRelativeTime } from '@/lib/format-time'
import type { ConversationListItem } from '@/types/conversations'

const avatarColors = [
  'hsl(210, 60%, 55%)',
  'hsl(150, 50%, 45%)',
  'hsl(270, 50%, 55%)',
  'hsl(30, 70%, 50%)',
  'hsl(330, 55%, 55%)',
  'hsl(180, 50%, 45%)',
]

function getAvatarColor(name: string) {
  return avatarColors[name.charCodeAt(0) % avatarColors.length]
}

export default function ConversationList({
  initialConversations,
  clinicId,
}: {
  initialConversations: ConversationListItem[]
  clinicId: string
}) {
  const { data: conversations } = useConversations(clinicId, initialConversations)
  const pathname = usePathname()

  if (!conversations || conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-4 text-muted-foreground">
        <MessageSquare className="h-10 w-10 opacity-30" />
        <p className="text-sm">Inga konversationer ännu</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      {conversations.map((conv) => {
        const customer = conv.customers
        const initial = customer.name.charAt(0).toUpperCase()
        const active = pathname.includes(conv.id)

        return (
          <Link
            key={conv.id}
            href={`/conversations/${conv.id}`}
            className={`flex items-center gap-3 p-3 border-b transition-colors hover:bg-accent${active ? ' bg-accent' : ''}`}
          >
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback
                style={{ backgroundColor: getAvatarColor(customer.name), color: 'white' }}
              >
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline gap-2">
                <span
                  className={`text-sm truncate ${conv.unread_count > 0 ? 'font-semibold' : 'font-medium'}`}
                >
                  {customer.name}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatRelativeTime(conv.last_message_at)}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground truncate">
                  {conv.last_message_preview || 'Inget meddelande'}
                </span>
                {conv.unread_count > 0 && (
                  <Badge className="h-5 w-5 flex items-center justify-center rounded-full text-xs p-0 shrink-0">
                    {conv.unread_count}
                  </Badge>
                )}
              </div>
            </div>
          </Link>
        )
      })}
    </ScrollArea>
  )
}
