import { MessageSquare } from 'lucide-react'

export default function ConversationsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[50vh] gap-3">
      <MessageSquare className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-xl font-semibold">Konversationer</h2>
      <p className="text-muted-foreground">Konversationer — kommer snart</p>
    </div>
  )
}
