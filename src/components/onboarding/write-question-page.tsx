'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { saveOnboardingProgress } from '@/actions/onboarding'
import { ProgressBar } from './progress-bar'
import { QuestionHeader } from './question-header'
import { Loader2 } from 'lucide-react'
import type { WriteQuestion } from '@/lib/onboarding/questions'
import type { TextQuestionAnswer, OnboardingData } from '@/lib/onboarding/types'

interface WriteQuestionPageProps {
  question: WriteQuestion
  aiName: string
  questionNumber: number
  totalQuestions: number
  initialAnswer?: TextQuestionAnswer
  saveKey: keyof OnboardingData
  nextPath: string
}

export function WriteQuestionPage({
  question,
  aiName,
  questionNumber,
  totalQuestions,
  initialAnswer,
  saveKey,
  nextPath,
}: WriteQuestionPageProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mainText, setMainText] = useState(initialAnswer?.main_text || '')
  const [followUpText, setFollowUpText] = useState(initialAnswer?.follow_up_text || '')
  const [showFollowUp, setShowFollowUp] = useState(!!initialAnswer?.main_text)

  function replaceName(text: string): string {
    return text.replace(/\{name\}/g, aiName)
  }

  async function handleSubmit() {
    if (!mainText.trim() || loading) return

    // First click on a write question with a follow-up: reveal the follow-up
    if (question.followUp && !showFollowUp) {
      setShowFollowUp(true)
      return
    }

    setLoading(true)
    setError(null)
    const answer: TextQuestionAnswer = {
      main_text: mainText.trim(),
      follow_up_text: question.followUp ? followUpText.trim() : undefined,
    }
    const payload = { [saveKey]: answer } as Partial<OnboardingData>
    const result = await saveOnboardingProgress(payload)
    if (!result.success) {
      setError(result.error || 'Kunde inte spara svar')
      setLoading(false)
      return
    }
    router.push(nextPath)
  }

  // Follow-up text is OPTIONAL — the user can submit even if it's empty
  const canSubmit = mainText.trim().length > 0

  return (
    <div>
      <ProgressBar current={questionNumber} total={totalQuestions} />
      <QuestionHeader
        questionNumber={questionNumber}
        totalQuestions={totalQuestions}
        title={replaceName(question.title)}
        subtitle={question.sub}
      />

      {question.aiExamples && (
        <div className="rounded-xl bg-muted p-3.5 mb-3">
          <p className="text-xs text-muted-foreground mb-2">Inspiration</p>
          {question.aiExamples.map((ex, i) => (
            <p
              key={i}
              className="text-xs text-muted-foreground italic leading-relaxed mb-1"
            >
              &ldquo;{replaceName(ex)}&rdquo;
            </p>
          ))}
        </div>
      )}

      <Textarea
        value={mainText}
        onChange={(e) => setMainText(e.target.value)}
        placeholder="Skriv här..."
        className="min-h-[100px] mb-4"
      />

      {showFollowUp && question.followUp && (
        <>
          <Separator className="my-4" />
          <p className="text-sm font-medium mb-2.5">{replaceName(question.followUp.q)}</p>

          {question.followUp.aiExamples && (
            <div className="rounded-xl bg-muted p-3.5 mb-3">
              <p className="text-xs text-muted-foreground mb-2">Inspiration</p>
              {question.followUp.aiExamples.map((ex, i) => (
                <p
                  key={i}
                  className="text-xs text-muted-foreground italic leading-relaxed mb-1"
                >
                  &ldquo;{replaceName(ex)}&rdquo;
                </p>
              ))}
            </div>
          )}

          <Textarea
            value={followUpText}
            onChange={(e) => setFollowUpText(e.target.value)}
            placeholder="Skriv här... (valfritt)"
            className="min-h-[100px]"
          />
        </>
      )}

      <Button
        onClick={handleSubmit}
        disabled={!canSubmit || loading}
        className="w-full mt-6"
        size="lg"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : question.followUp && !showFollowUp ? (
          'Fortsätt'
        ) : (
          'Nästa fråga'
        )}
      </Button>

      {error && <p className="text-sm text-destructive mt-3 text-center">{error}</p>}
    </div>
  )
}
