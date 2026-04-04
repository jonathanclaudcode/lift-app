'use client'

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent } from '@/components/ui/card'
import { formatRelativeTime } from '@/lib/format-time'
import { STAGE_BORDER_COLOR, type PipelineCustomer } from '@/types/pipeline'

interface PipelineCardProps {
  customer: PipelineCustomer
  isDragOverlay?: boolean
}

export const PipelineCard = React.memo(function PipelineCard({ customer, isDragOverlay }: PipelineCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `card-${customer.id}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const borderClass = STAGE_BORDER_COLOR[customer.pipeline_stage]

  if (isDragOverlay) {
    return (
      <Card size="sm" className={`border-l-4 ${borderClass} rotate-2 shadow-xl opacity-90 cursor-grabbing`}>
        <CardContent className="space-y-0.5">
          <p className="font-medium truncate">{customer.display_name}</p>
          <p className="text-sm text-muted-foreground truncate">
            {customer.latest_treatment ?? '—'}
          </p>
          <p className="text-sm text-muted-foreground">
            {customer.last_contacted_at ? formatRelativeTime(customer.last_contacted_at) : '—'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        size="sm"
        className={`border-l-4 ${borderClass} cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-0' : ''}`}
      >
        <CardContent className="space-y-0.5">
          <p className="font-medium truncate">{customer.display_name}</p>
          <p className="text-sm text-muted-foreground truncate">
            {customer.latest_treatment ?? '—'}
          </p>
          <p className="text-sm text-muted-foreground">
            {customer.last_contacted_at ? formatRelativeTime(customer.last_contacted_at) : '—'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
})
