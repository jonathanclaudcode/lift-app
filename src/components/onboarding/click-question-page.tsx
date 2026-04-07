'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { saveOnboardingProgress } from '@/actions/onboarding'
import { ProgressBar } from './progress-bar'
import { QuestionHeader } from './question-header'
import { OptionButton } from './option-button'
import { Loader2 } from 'lucide-react'
import type { ClickQuestion, ClickOption, FollowUp } from '@/lib/onboarding/questions'
import type {
  ClickQuestionAnswer,
  FollowUpAnswer,
  OnboardingData,
} from '@/lib/onboarding/types'

interface ClickQuestionPageProps {
  question: ClickQuestion
  aiName: string
  questionNumber: number
  totalQuestions: number
  initialAnswer?: ClickQuestionAnswer
  saveKey: keyof OnboardingData
  nextPath: string
}

interface ActiveFollowUp {
  followUp: FollowUp
  selected: string[] // Multi-select uses multiple, single-select uses length 1
  // Once true, multi-select follow-ups are "locked in" and we move to the next stage
  advanced: boolean
}

/**
 * Build the FULL chain of follow-ups that should be shown for a given option,
 * stopping at the first multi-select that hasn't been advanced.
 *
 * Order of follow-ups:
 *   1. dd1
 *   2. If dd1 is single-select AND dd1.dd2[selectedIndex] exists → that
 *      OR if dd1 is single-select AND dd1then exists → dd1then
 *      OR if dd1 is multi-select AND dd1then exists → dd1then
 *   3. always (always last, if present)
 *
 * Returns the chain. Caller decides which to render.
 */
function buildFollowUpChain(
  opt: ClickOption,
  existingFollowUps: ActiveFollowUp[]
): ActiveFollowUp[] {
  const chain: ActiveFollowUp[] = []

  // Stage 1: dd1
  if (!opt.dd1) return chain

  // Clone existing entry to avoid mutating state objects
  const stage1: ActiveFollowUp = existingFollowUps[0]
    ? { ...existingFollowUps[0], followUp: opt.dd1 }
    : { followUp: opt.dd1, selected: [], advanced: false }
  chain.push(stage1)

  // If user hasn't answered dd1 yet, stop here
  if (stage1.selected.length === 0) return chain
  // If dd1 is multi-select and not advanced yet, stop here (user must click "Fortsätt")
  if (stage1.followUp.multi && !stage1.advanced) return chain

  // Stage 2: dd1.dd2[index] (only for single-select dd1) OR dd1then
  let stage2FollowUp: FollowUp | undefined
  if (!stage1.followUp.multi && opt.dd1.dd2) {
    // Look up dd2 by the index of the SINGLE selected option in dd1
    const selectedText = stage1.selected[0]
    const selectedIndex = opt.dd1.opts.indexOf(selectedText)
    if (selectedIndex >= 0 && opt.dd1.dd2[selectedIndex]) {
      stage2FollowUp = opt.dd1.dd2[selectedIndex]
    }
  }
  if (!stage2FollowUp && opt.dd1then) {
    stage2FollowUp = opt.dd1then
  }

  if (stage2FollowUp) {
    // Clone existing entry, but update the followUp definition in case it changed
    // (e.g., user changed dd1 selection and dd2 is now a different sub-question).
    // If the followUp definition changed, reset the selection.
    const existing2 = existingFollowUps[1]
    const sameFollowUp = existing2 && existing2.followUp === stage2FollowUp
    const stage2: ActiveFollowUp = existing2 && sameFollowUp
      ? { ...existing2 }
      : { followUp: stage2FollowUp, selected: [], advanced: false }
    chain.push(stage2)

    if (stage2.selected.length === 0) return chain
    if (stage2.followUp.multi && !stage2.advanced) return chain
  }

  // Stage 3: always (final question, asked regardless)
  if (opt.always) {
    const alwaysIndex = chain.length
    const existingAlways = existingFollowUps[alwaysIndex]
    const sameAlways = existingAlways && existingAlways.followUp === opt.always
    const stageAlways: ActiveFollowUp = existingAlways && sameAlways
      ? { ...existingAlways }
      : { followUp: opt.always, selected: [], advanced: false }
    chain.push(stageAlways)
  }

  return chain
}

/**
 * Reconstruct the followUps state from a saved ClickQuestionAnswer.
 * Used on initial mount when the user is returning to a previously-answered question.
 */
function rehydrateFollowUps(
  question: ClickQuestion,
  initialAnswer: ClickQuestionAnswer | undefined
): ActiveFollowUp[] {
  if (!initialAnswer || initialAnswer.main_choice_index < 0) return []
  const opt = question.opts[initialAnswer.main_choice_index]
  if (!opt) return []

  // Build a synthetic chain by walking through the saved follow_ups
  // and matching them positionally to the chain stages
  const result: ActiveFollowUp[] = []
  for (const fu of initialAnswer.follow_ups) {
    // Find the matching FollowUp definition in the question structure
    // We need to look it up — start with dd1, then dd2/dd1then, then always
    let matchingDef: FollowUp | undefined

    if (result.length === 0) {
      matchingDef = opt.dd1
    } else if (result.length === 1) {
      // Could be dd2 or dd1then
      const stage1Selected = result[0].selected[0]
      if (opt.dd1 && !opt.dd1.multi && opt.dd1.dd2 && stage1Selected) {
        const idx = opt.dd1.opts.indexOf(stage1Selected)
        if (idx >= 0 && opt.dd1.dd2[idx]) {
          matchingDef = opt.dd1.dd2[idx]
        }
      }
      if (!matchingDef) matchingDef = opt.dd1then
      if (!matchingDef) matchingDef = opt.always
    } else {
      // Must be always
      matchingDef = opt.always
    }

    if (!matchingDef) break

    result.push({
      followUp: matchingDef,
      selected: fu.answers,
      advanced: true, // It's saved, so it's been advanced
    })
  }

  return result
}

export function ClickQuestionPage({
  question,
  aiName,
  questionNumber,
  totalQuestions,
  initialAnswer,
  saveKey,
  nextPath,
}: ClickQuestionPageProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [mainChoiceIndex, setMainChoiceIndex] = useState<number | null>(
    initialAnswer?.main_choice_index ?? null
  )

  const [followUps, setFollowUps] = useState<ActiveFollowUp[]>(() =>
    rehydrateFollowUps(question, initialAnswer)
  )

  function replaceName(text: string): string {
    return text.replace(/\{name\}/g, aiName)
  }

  function handleMainOptionClick(optionIndex: number) {
    setMainChoiceIndex(optionIndex)
    const opt = question.opts[optionIndex]
    // Reset all follow-ups when changing main option
    const newChain = buildFollowUpChain(opt, [])
    setFollowUps(newChain)
  }

  function handleFollowUpSelect(followUpIndex: number, optionText: string) {
    if (mainChoiceIndex === null) return
    const opt = question.opts[mainChoiceIndex]
    const fu = followUps[followUpIndex]
    if (!fu) return

    // Truncate any subsequent follow-ups (user is changing an earlier answer)
    const truncated = followUps.slice(0, followUpIndex + 1)

    let newSelected: string[]
    if (fu.followUp.multi) {
      // Toggle
      if (fu.selected.includes(optionText)) {
        newSelected = fu.selected.filter((s) => s !== optionText)
      } else {
        newSelected = [...fu.selected, optionText]
      }
    } else {
      newSelected = [optionText]
    }

    const updated: ActiveFollowUp = {
      ...fu,
      selected: newSelected,
      // Single-select auto-advances; multi-select needs the explicit "Fortsätt" click
      advanced: fu.followUp.multi ? false : newSelected.length > 0,
    }

    truncated[followUpIndex] = updated

    // Rebuild the chain forward from this point
    const newChain = buildFollowUpChain(opt, truncated)
    setFollowUps(newChain)
  }

  function handleAdvanceMultiSelect(followUpIndex: number) {
    if (mainChoiceIndex === null) return
    const opt = question.opts[mainChoiceIndex]
    const fu = followUps[followUpIndex]
    if (!fu || fu.selected.length === 0) return

    const updated: ActiveFollowUp = { ...fu, advanced: true }
    const truncated = followUps.slice(0, followUpIndex + 1)
    truncated[followUpIndex] = updated

    const newChain = buildFollowUpChain(opt, truncated)
    setFollowUps(newChain)
  }

  /**
   * Determine if the user has answered everything they need to answer.
   * The chain is complete when:
   *  - Main option is selected
   *  - The full chain (built from current state) has every entry with selections
   *  - Every multi-select in the chain has been "advanced"
   *  - The chain is at its terminal length (i.e., no more stages would be added)
   */
  function isComplete(): boolean {
    if (mainChoiceIndex === null) return false
    const opt = question.opts[mainChoiceIndex]

    // If the option has no follow-ups at all, complete on main click
    if (!opt.dd1 && !opt.always) return true

    // Build the chain from current state to see if more stages would appear
    const expectedChain = buildFollowUpChain(opt, followUps)

    // We're complete only if the rendered followUps match the expected terminal chain
    if (followUps.length !== expectedChain.length) return false

    // Every follow-up in the chain must have selections
    for (const fu of followUps) {
      if (fu.selected.length === 0) return false
      if (fu.followUp.multi && !fu.advanced) return false
    }

    // Final check: would the chain grow if we tried to extend it? If yes, not done.
    // We do this by simulating "what if every multi was advanced"
    const simulated = followUps.map((f) => ({ ...f, advanced: true }))
    const hypothetical = buildFollowUpChain(opt, simulated)
    if (hypothetical.length > followUps.length) return false

    return true
  }

  async function handleSubmit() {
    if (!isComplete() || mainChoiceIndex === null || loading) return
    setLoading(true)
    setError(null)

    const opt = question.opts[mainChoiceIndex]
    const answer: ClickQuestionAnswer = {
      main_choice: opt.t,
      main_choice_index: mainChoiceIndex,
      follow_ups: followUps.map<FollowUpAnswer>((f) => ({
        question: f.followUp.q,
        is_multi: f.followUp.multi,
        answers: f.selected,
      })),
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

  return (
    <div>
      <ProgressBar current={questionNumber} total={totalQuestions} />
      <QuestionHeader
        questionNumber={questionNumber}
        totalQuestions={totalQuestions}
        title={replaceName(question.title)}
        subtitle={question.sub}
      />

      <div className="flex flex-col gap-2">
        {question.opts.map((opt, i) => (
          <OptionButton
            key={i}
            label={replaceName(opt.t)}
            selected={mainChoiceIndex === i}
            onClick={() => handleMainOptionClick(i)}
          />
        ))}
      </div>

      {followUps.map((fu, followUpIndex) => (
        <div key={`${followUpIndex}-${fu.followUp.q}`} className="mt-4">
          <Separator className="mb-4" />
          <p className="text-sm font-medium mb-2.5">{replaceName(fu.followUp.q)}</p>
          {fu.followUp.multi && (
            <p className="text-xs text-muted-foreground mb-2.5">Du kan välja flera</p>
          )}
          <div className="flex flex-col gap-2">
            {fu.followUp.opts.map((optText, optIndex) => (
              <OptionButton
                key={optIndex}
                label={replaceName(optText)}
                selected={fu.selected.includes(optText)}
                onClick={() => handleFollowUpSelect(followUpIndex, optText)}
              />
            ))}
          </div>

          {fu.followUp.multi && fu.selected.length > 0 && !fu.advanced && (
            <Button
              onClick={() => handleAdvanceMultiSelect(followUpIndex)}
              variant="outline"
              size="sm"
              className="mt-3"
            >
              Fortsätt
            </Button>
          )}
        </div>
      ))}

      <Button
        onClick={handleSubmit}
        disabled={!isComplete() || loading}
        className="w-full mt-6"
        size="lg"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Nästa fråga'}
      </Button>

      {error && <p className="text-sm text-destructive mt-3 text-center">{error}</p>}
    </div>
  )
}
