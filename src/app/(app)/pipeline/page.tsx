import { Kanban } from 'lucide-react'

export default function PipelinePage() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[50vh] gap-3">
      <Kanban className="h-12 w-12 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Pipeline</h1>
      <p className="text-muted-foreground">Kommer snart</p>
    </div>
  )
}
