export interface DetectedKnowledge {
  category: string
  content: string
  source: 'ai_learned'
  confidence: number
  isReplaceable: boolean
}

function splitSentences(msg: string): string[] {
  return msg
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2)
}

function isQuestionOrHypothetical(sentence: string): boolean {
  if (sentence.endsWith('?')) return true
  if (
    /^(vad|hur|var|varför|när|vem|vilken|vilka|vilket|kan|ska|borde|finns|har|om)\s/iu.test(
      sentence
    )
  )
    return true
  if (
    /\b(funderar|kanske|eventuellt|tänker på att|överväger|planerar att|skulle kunna|om vi)\b/iu.test(
      sentence
    )
  )
    return true
  return false
}

interface PatternEntry {
  regex: RegExp
  category: string
  replaceable: boolean
}

const STAFF_PATTERNS: PatternEntry[] = [
  {
    regex:
      /(?:anställ(?:t|er)|rekryter(?:at|ar)|(?:ny(?:tt)?|nya)\s+(?:personal|medarbetare|kollega|hudterapeut|sjuksköterska|receptionist))\s+(?:som\s+heter\s+)?([\p{L}\-]+)/iu,
    category: 'team',
    replaceable: false,
  },
  {
    regex: /([\p{L}\-]+)\s+(?:börjar|slutar|har\s+slutat)\s+(?:hos\s+oss|på\s+kliniken|här)/iu,
    category: 'team',
    replaceable: false,
  },
]

const TREATMENT_PATTERNS: PatternEntry[] = [
  {
    regex:
      /(?:börjar\s+med|lanserar|erbjuder\s+nu|lägger\s+till|ny\s+behandling)\s+(.{3,60}?)(?:\.|!|,|\?|$)/iu,
    category: 'treatment',
    replaceable: false,
  },
]

const POLICY_PATTERNS: PatternEntry[] = [
  {
    regex: /(?:avbokning(?:spolic\p{L}*)?|no[- ]?show)\s+(.{3,80}?)(?:\.|!|\?|$)/iu,
    category: 'policy',
    replaceable: true,
  },
  {
    regex: /(?:öppettid\p{L}*|öppnar|stänger)\s+(.{3,80}?)(?:\.|!|\?|$)/iu,
    category: 'policy',
    replaceable: true,
  },
]

const PRICE_PATTERNS: PatternEntry[] = [
  {
    regex: /([\p{L}\s]{3,40})\s+kostar\s+(\d[\d\s]*\s*kr)/iu,
    category: 'treatment',
    replaceable: false,
  },
]

const ALL_PATTERNS: PatternEntry[] = [
  ...PRICE_PATTERNS,
  ...STAFF_PATTERNS,
  ...TREATMENT_PATTERNS,
  ...POLICY_PATTERNS,
]

export function detectKnowledgeUpdate(message: string): DetectedKnowledge | null {
  const sentences = splitSentences(message)

  for (const sentence of sentences) {
    if (isQuestionOrHypothetical(sentence)) continue

    for (const pattern of ALL_PATTERNS) {
      const match = sentence.match(pattern.regex)
      if (match && match[1]) {
        const extracted = match[1].trim().replace(/[.!,;:]+$/, '')
        if (extracted.length < 3) continue

        // Build clean content — use sentence context if short, otherwise extracted phrase
        const content =
          sentence.length <= 100
            ? sentence.replace(/[.!]+$/, '').trim()
            : extracted.length <= 80
              ? extracted
              : extracted.slice(0, 80).trim()

        return {
          category: pattern.category,
          content,
          source: 'ai_learned',
          confidence: pattern.category === 'team' ? 0.7 : 0.8,
          isReplaceable: pattern.replaceable,
        }
      }
    }
  }

  return null
}
