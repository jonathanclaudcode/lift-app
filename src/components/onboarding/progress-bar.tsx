'use client'

interface ProgressBarProps {
  current: number  // 1-based
  total: number
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (current / total) * 100))
  return (
    <div className="h-1 rounded-full bg-muted mb-2 overflow-hidden">
      <div
        className="h-full bg-primary transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
