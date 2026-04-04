'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  useSensors,
  useSensor,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type DragCancelEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { PipelineColumn } from './pipeline-column'
import { PipelineCard } from './pipeline-card'
import { usePipelineCustomers, useUpdatePipelineStage } from '@/hooks/use-pipeline-data'
import { PIPELINE_STAGES, type PipelineCustomer, type PipelineStage } from '@/types/pipeline'

interface PipelineBoardProps {
  clinicId: string
  initialCustomers: PipelineCustomer[]
}

function resolveColumnFromCardId(
  cardId: string,
  customersByStage: Map<PipelineStage, PipelineCustomer[]>
): PipelineStage | null {
  const customerId = cardId.replace('card-', '')
  for (const [stage, customers] of customersByStage) {
    if (customers.some((c) => c.id === customerId)) return stage
  }
  return null
}

function groupAndSort(customers: PipelineCustomer[]): Map<PipelineStage, PipelineCustomer[]> {
  const map = new Map<PipelineStage, PipelineCustomer[]>()
  for (const stage of PIPELINE_STAGES) {
    map.set(stage.key, [])
  }
  for (const c of customers) {
    const stage = map.has(c.pipeline_stage) ? c.pipeline_stage : 'new'
    map.get(stage)!.push(c)
  }
  // Sort each column: last_contacted_at descending, nulls at bottom
  for (const list of map.values()) {
    list.sort((a, b) => {
      if (!a.last_contacted_at && !b.last_contacted_at) return 0
      if (!a.last_contacted_at) return 1
      if (!b.last_contacted_at) return -1
      return new Date(b.last_contacted_at).getTime() - new Date(a.last_contacted_at).getTime()
    })
  }
  return map
}

export function PipelineBoard({ clinicId, initialCustomers }: PipelineBoardProps) {
  const { data: customers } = usePipelineCustomers(clinicId, initialCustomers)
  const mutation = useUpdatePipelineStage(clinicId)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [overColumnId, setOverColumnId] = useState<PipelineStage | null>(null)
  const [localMoves, setLocalMoves] = useState<Map<string, PipelineStage>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Apply local moves on top of query data for immediate visual feedback during drag
  const effectiveCustomers = useMemo(() => {
    if (localMoves.size === 0) return customers
    return customers.map((c) => {
      const override = localMoves.get(c.id)
      return override ? { ...c, pipeline_stage: override } : c
    })
  }, [customers, localMoves])

  const customersByStage = useMemo(() => groupAndSort(effectiveCustomers), [effectiveCustomers])

  const activeCustomer = useMemo(() => {
    if (!activeId) return null
    const customerId = activeId.replace('card-', '')
    return effectiveCustomers.find((c) => c.id === customerId) ?? null
  }, [activeId, effectiveCustomers])

  const showError = useCallback((msg: string) => {
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current)
    setError(msg)
    errorTimeoutRef.current = setTimeout(() => setError(null), 5000)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const getCustomerName = useCallback(
    (id: string | number) => {
      const customerId = String(id).replace('card-', '')
      return effectiveCustomers.find((c) => c.id === customerId)?.display_name ?? 'Okänd'
    },
    [effectiveCustomers]
  )

  const getColumnLabel = useCallback((id: string | number) => {
    const stage = PIPELINE_STAGES.find((s) => s.key === String(id))
    return stage?.label ?? String(id)
  }, [])

  const announcements = useMemo(
    () => ({
      onDragStart({ active }: DragStartEvent) {
        return `Plockat upp ${getCustomerName(active.id)}`
      },
      onDragOver({ active, over }: DragOverEvent) {
        return over ? `Flyttar till ${getColumnLabel(over.id)}` : ''
      },
      onDragEnd({ active, over }: DragEndEvent) {
        return over ? `Släppte i ${getColumnLabel(over.id)}` : 'Flytt avbruten'
      },
      onDragCancel() {
        return 'Flytt avbruten'
      },
    }),
    [getCustomerName, getColumnLabel]
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
    setIsDragging(true)
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) {
      setOverColumnId(null)
      return
    }

    const overId = String(over.id)

    // Resolve target column: could be a column ID or a card ID
    let targetColumn: PipelineStage | null = null
    if (PIPELINE_STAGES.some((s) => s.key === overId)) {
      targetColumn = overId as PipelineStage
    } else {
      targetColumn = resolveColumnFromCardId(overId, customersByStage)
    }

    setOverColumnId(targetColumn)

    // Move card visually to target column during drag
    if (targetColumn) {
      const customerId = String(active.id).replace('card-', '')
      const currentStage = resolveColumnFromCardId(String(active.id), customersByStage)
      if (currentStage !== targetColumn) {
        setLocalMoves((prev) => new Map(prev).set(customerId, targetColumn))
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    setOverColumnId(null)
    setIsDragging(false)
    setLocalMoves(new Map())

    if (!over) return // Dropped outside — cancel

    const overId = String(over.id)
    let targetColumn: PipelineStage | null = null
    if (PIPELINE_STAGES.some((s) => s.key === overId)) {
      targetColumn = overId as PipelineStage
    } else {
      targetColumn = resolveColumnFromCardId(overId, customersByStage)
    }

    if (!targetColumn) return

    const customerId = String(active.id).replace('card-', '')
    const sourceColumn = customers.find((c) => c.id === customerId)?.pipeline_stage
    if (sourceColumn === targetColumn) return // Same column — no-op

    mutation.mutate(
      { customerId, newStage: targetColumn },
      {
        onError: () => {
          showError('Kunde inte flytta kunden. Försök igen.')
        },
      }
    )
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setActiveId(null)
    setOverColumnId(null)
    setIsDragging(false)
    setLocalMoves(new Map())
  }

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-muted-foreground">
        <p className="text-lg">Inga kunder att visa. Lägg till din första kund för att komma igång.</p>
      </div>
    )
  }

  return (
    <div>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        accessibility={{ announcements }}
      >
        <div
          className={`flex overflow-x-auto gap-4 pb-4 -mx-4 px-4 md:mx-0 md:px-0 ${
            isDragging ? '' : 'snap-x snap-mandatory md:snap-none'
          }`}
        >
          {PIPELINE_STAGES.map((stage) => (
            <div key={stage.key} className="snap-center min-w-[85vw] md:min-w-[240px] md:flex-1 flex-shrink-0">
              <PipelineColumn
                stageKey={stage.key}
                label={stage.label}
                customers={customersByStage.get(stage.key) ?? []}
                isOver={overColumnId === stage.key}
              />
            </div>
          ))}
        </div>

        <DragOverlay>
          {activeCustomer ? <PipelineCard customer={activeCustomer} isDragOverlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
