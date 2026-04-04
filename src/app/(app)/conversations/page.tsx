import { MessageSquare } from 'lucide-react'

export default function ConversationsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <MessageSquare className="h-12 w-12 opacity-30" />
      <p className="text-lg">Välj en konversation</p>
    </div>
  )
}
