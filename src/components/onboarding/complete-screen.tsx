'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircle, Loader2 } from 'lucide-react'
import { completeOnboarding } from '@/actions/onboarding'

interface CompleteScreenProps {
  aiName: string
}

export function CompleteScreen({ aiName }: CompleteScreenProps) {
  const router = useRouter()
  const [finalizing, setFinalizing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasFinalizedRef = useRef(false)

  useEffect(() => {
    // Guard against double-call from React Strict Mode or remounts
    if (hasFinalizedRef.current) return
    hasFinalizedRef.current = true

    let cancelled = false
    async function finalize() {
      const result = await completeOnboarding()
      if (cancelled) return
      if (!result.success) {
        setError(result.error || 'Något gick fel')
      }
      setFinalizing(false)
    }
    finalize()
    return () => {
      cancelled = true
    }
  }, [])

  if (finalizing) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Förbereder allt...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-destructive mb-4">{error}</p>
        <Button onClick={() => router.refresh()}>Försök igen</Button>
      </div>
    )
  }

  return (
    <div className="py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
        <CheckCircle className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-2xl font-medium mb-3">Perfekt!</h2>
      <p className="text-base text-muted-foreground mb-1">
        {aiName} förbereder sig just nu.
      </p>
      <p className="text-base text-muted-foreground mb-8">
        {aiName} kollar in din klinik och hör av sig på WhatsApp inom kort.
      </p>
      <Button onClick={() => router.push('/dashboard')} className="w-full" size="lg">
        Gå till dashboard
      </Button>
    </div>
  )
}
