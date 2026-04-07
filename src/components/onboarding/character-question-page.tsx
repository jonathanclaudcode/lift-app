'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { saveOnboardingProgress } from '@/actions/onboarding'
import { ProgressBar } from './progress-bar'
import { QuestionHeader } from './question-header'
import { AI_CHARACTERS } from '@/lib/onboarding/types'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CharacterQuestionAnswer } from '@/lib/onboarding/types'

interface CharacterQuestionPageProps {
  aiName: string
  questionNumber: number
  totalQuestions: number
  initialAnswer?: CharacterQuestionAnswer
  nextPath: string
}

export function CharacterQuestionPage({
  aiName,
  questionNumber,
  totalQuestions,
  initialAnswer,
  nextPath,
}: CharacterQuestionPageProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initialIndex = initialAnswer?.selected_character
    ? AI_CHARACTERS.findIndex((c) => c.name === initialAnswer.selected_character?.name)
    : -1

  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    initialIndex >= 0 ? initialIndex : null
  )
  const [customText, setCustomText] = useState(initialAnswer?.custom_character || '')

  function handleCharacterSelect(index: number) {
    setSelectedIndex(index)
    setCustomText('')
  }

  function handleCustomChange(value: string) {
    setCustomText(value)
    if (value.trim()) {
      setSelectedIndex(null)
    }
  }

  const canSubmit = selectedIndex !== null || customText.trim().length > 0

  async function handleSubmit() {
    if (!canSubmit || loading) return
    setLoading(true)
    setError(null)

    const answer: CharacterQuestionAnswer = {}
    if (selectedIndex !== null) {
      answer.selected_character = AI_CHARACTERS[selectedIndex]
    } else if (customText.trim()) {
      answer.custom_character = customText.trim()
    }

    const result = await saveOnboardingProgress({ q7_ai_character: answer })
    if (!result.success) {
      setError(result.error || 'Kunde inte spara svar')
      setLoading(false)
      return
    }
    router.push(nextPath)
  }

  return (
    <div>
      <ProgressBar current={questionNumber} total={totalQuestions} />
      <QuestionHeader
        questionNumber={questionNumber}
        totalQuestions={totalQuestions}
        title={`Om ${aiName} var en karaktär i en film eller serie, vilken skulle du välja?`}
      />

      <div className="flex flex-col gap-2">
        {AI_CHARACTERS.map((char, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleCharacterSelect(i)}
            className={cn(
              'w-full text-left px-3.5 py-3 rounded-xl border text-sm transition-colors',
              'bg-card text-card-foreground border-border',
              'hover:bg-accent',
              selectedIndex === i && 'border-primary bg-primary/10'
            )}
          >
            <div className="font-medium mb-0.5">{char.name}</div>
            <div className="text-xs text-muted-foreground">{char.description}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          Eller skriv din egen
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <Textarea
        value={customText}
        onChange={(e) => handleCustomChange(e.target.value)}
        placeholder="Skriv en karaktär och varför här..."
        className="min-h-[60px]"
      />

      <Button
        onClick={handleSubmit}
        disabled={!canSubmit || loading}
        className="w-full mt-6"
        size="lg"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Slutför'}
      </Button>

      {error && <p className="text-sm text-destructive mt-3 text-center">{error}</p>}
    </div>
  )
}
