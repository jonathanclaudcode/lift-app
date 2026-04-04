'use client'

import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[50vh] gap-4">
      <h2 className="text-xl font-semibold">Något gick fel</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Button onClick={reset}>Försök igen</Button>
    </div>
  )
}
