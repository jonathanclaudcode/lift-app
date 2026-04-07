'use client'

import { cn } from '@/lib/utils'

interface OptionButtonProps {
  label: string
  selected: boolean
  onClick: () => void
}

export function OptionButton({ label, selected, onClick }: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left px-3.5 py-3 rounded-xl border text-sm leading-relaxed transition-colors',
        'bg-card text-card-foreground border-border',
        'hover:bg-accent',
        selected && 'border-primary bg-primary/10'
      )}
    >
      {label}
    </button>
  )
}
