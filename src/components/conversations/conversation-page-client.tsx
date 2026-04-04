'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import MessageThread from './message-thread'
import CustomerProfile from './customer-profile'
import type { Message, ConversationCustomer } from '@/types/conversations'

export default function ConversationPageClient({
  conversationId,
  clinicId,
  channel,
  customer,
  initialMessages,
}: {
  conversationId: string
  clinicId: string
  channel: string
  customer: ConversationCustomer
  initialMessages: Message[]
}) {
  const [profileOpen, setProfileOpen] = useState(false)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 border-b px-3 py-2 flex items-center gap-2 bg-background">
        <div className="md:hidden">
          <Link href="/conversations">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="font-semibold text-sm hover:underline cursor-pointer truncate"
        >
          {customer.name}
        </button>
        <Badge variant="outline" className="text-xs shrink-0">
          {channel.toUpperCase()}
        </Badge>
        {customer.phone && (
          <span className="text-xs text-muted-foreground hidden sm:block shrink-0">
            {customer.phone}
          </span>
        )}
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-hidden min-h-0">
        <MessageThread
          conversationId={conversationId}
          clinicId={clinicId}
          channel={channel}
          initialMessages={initialMessages}
        />
      </div>

      {/* Profile sheet */}
      <CustomerProfile
        customerId={customer.id}
        open={profileOpen}
        onOpenChange={setProfileOpen}
      />
    </div>
  )
}
