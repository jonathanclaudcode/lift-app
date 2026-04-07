'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { setAiName } from '@/actions/onboarding'
import { SUGGESTED_AI_NAMES } from '@/lib/onboarding/types'
import { Loader2 } from 'lucide-react'

interface WelcomeFormProps {
  initialName: string
}

export function WelcomeForm({ initialName }: WelcomeFormProps) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!name.trim() || loading) return
    setLoading(true)
    setError(null)
    const result = await setAiName(name.trim())
    if (!result.success) {
      setError(result.error || 'Något gick fel')
      setLoading(false)
      return
    }
    router.push('/onboarding/domain')
  }

  return (
    <div className="text-center py-8">
      <svg
        viewBox="0 0 200 100"
        width="150"
        height="75"
        className="mx-auto mb-6 text-foreground"
      >
        <path
          d="M86 20 C92 14, 96 12, 100 18 C104 12, 108 14, 114 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text
          x="100"
          y="62"
          textAnchor="middle"
          fontSize="36"
          letterSpacing="14"
          fill="currentColor"
          style={{ fontFamily: 'Georgia, serif', fontWeight: 400 }}
        >
          LIFT
        </text>
      </svg>

      <h2 className="text-xl font-medium mb-2">Välkommen till LIFT</h2>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        Vi ska sätta upp din personliga AI-assistent. Men först — vad vill du att hon eller han ska heta?
      </p>

      <div className="flex flex-wrap gap-2 justify-center mb-5">
        {SUGGESTED_AI_NAMES.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => setName(suggestion)}
            className="px-3.5 py-1.5 rounded-full border border-border text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <Input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Eller skriv ett eget namn"
        maxLength={30}
        className="text-center text-base mb-4"
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit()
        }}
      />

      <Button
        onClick={handleSubmit}
        disabled={loading || !name.trim()}
        className="w-full"
        size="lg"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sätt igång'}
      </Button>

      {error && <p className="text-sm text-destructive mt-3">{error}</p>}

      <div className="mt-6 p-3.5 rounded-xl bg-muted text-left">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Du kommer att svara på några korta frågor så att vi kan anpassa din assistent efter just dig och din klinik. Svara på alla frågor — om inget alternativ stämmer exakt, välj det som är mest likt.
        </p>
      </div>
    </div>
  )
}
