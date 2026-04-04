'use client'

import { usePathname } from 'next/navigation'

export default function ConversationsLayoutWrapper({
  list,
  children,
}: {
  list: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isConversationOpen = pathname !== '/conversations' && pathname.startsWith('/conversations/')

  return (
    <div className="flex h-full">
      <div
        className={`h-full overflow-hidden border-r bg-background ${isConversationOpen ? 'hidden md:block' : 'block'} w-full md:w-80 shrink-0`}
      >
        {list}
      </div>
      <div
        className={`h-full overflow-hidden flex-1 ${isConversationOpen ? 'block' : 'hidden md:block'}`}
      >
        {children}
      </div>
    </div>
  )
}
