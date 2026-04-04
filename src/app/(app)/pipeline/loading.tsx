export default function PipelineLoading() {
  return (
    <div>
      <div className="h-8 w-32 bg-muted animate-pulse rounded mb-6" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, colIdx) => (
          <div key={colIdx} className="min-w-[240px] flex-1 rounded-lg bg-muted/40 p-3 space-y-3">
            <div className="h-5 w-28 bg-muted animate-pulse rounded" />
            {Array.from({ length: 3 }).map((_, cardIdx) => (
              <div key={cardIdx} className="rounded-lg bg-card p-3 space-y-2 ring-1 ring-foreground/5">
                <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
                <div className="h-3 w-1/3 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
