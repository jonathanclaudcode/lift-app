'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { PipelineCard } from './pipeline-card'
import type { PipelineCustomer, PipelineStage } from '@/types/pipeline'

interface PipelineColumnProps {
  stageKey: PipelineStage
  label: string
  customers: PipelineCustomer[]
  isOver: boolean
}

export function PipelineColumn({ stageKey, label, customers, isOver }: PipelineColumnProps) {
  const { setNodeRef } = useDroppable({ id: stageKey })
  const cardIds = customers.map((c) => `card-${c.id}`)

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-lg bg-muted/40 p-3 min-h-[200px] max-h-[calc(100vh-12rem)] transition-colors ${
        isOver ? 'ring-2 ring-primary/20' : ''
      }`}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <h2 className="text-sm font-semibold">{label}</h2>
        <span className="text-xs text-muted-foreground">({customers.length})</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {customers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Inga kunder i detta steg
            </p>
          ) : (
            customers.map((customer) => (
              <PipelineCard key={customer.id} customer={customer} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  )
}
