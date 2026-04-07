'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { startBackgroundScraping } from '@/actions/onboarding'
import { Loader2, Globe } from 'lucide-react'

interface DomainFormProps {
  aiName: string
  initialDomain: string
}

function cleanDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
}

export function DomainForm({ aiName, initialDomain }: DomainFormProps) {
  const router = useRouter()
  const [domain, setDomain] = useState(initialDomain)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    const cleaned = cleanDomain(domain)
    if (!cleaned || !cleaned.includes('.')) {
      setError('Ange en giltig domän, t.ex. minklinik.se')
      return
    }
    setLoading(true)
    setError(null)
    const result = await startBackgroundScraping(cleaned)
    if (!result.success) {
      setError(result.error || 'Något gick fel')
      setLoading(false)
      return
    }
    router.push('/onboarding/reminder')
  }

  return (
    <div className="py-8">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
        <Globe className="h-7 w-7 text-primary" />
      </div>

      <h2 className="text-xl font-medium text-center mb-2">
        Vad är klinikens hemsida?
      </h2>
      <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
        {aiName} kommer att läsa din hemsida i bakgrunden medan du svarar på frågorna. På så sätt får {aiName} direkt en bra bild av din verksamhet.
      </p>

      <Input
        type="text"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        placeholder="minklinik.se"
        className="text-center text-base mb-1"
        autoComplete="off"
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit()
        }}
      />
      <p className="text-xs text-muted-foreground text-center mb-6">
        Du behöver inte skriva https:// eller www
      </p>

      <Button
        onClick={handleSubmit}
        disabled={loading || !domain.trim()}
        className="w-full"
        size="lg"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fortsätt'}
      </Button>

      {error && <p className="text-sm text-destructive mt-3 text-center">{error}</p>}
    </div>
  )
}
