export interface Signal {
  preference: string
  direction: 'positive' | 'negative'
  weight: number
  reason: string
}

export interface CalibratedPref {
  mean: number
  confidence: number
}

export interface CalibratedPreferences {
  formality: CalibratedPref
  emoji_frequency: CalibratedPref
  verbosity: CalibratedPref
  humor_tolerance: CalibratedPref
  proactivity_tolerance: CalibratedPref
}

// Unicode-aware word boundary helpers (Swedish å, ä, ö are \p{L} but not \w)
function wordBoundary(word: string): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'iu')
}

function anyWord(words: string[]): RegExp {
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  return new RegExp(`(?<!\\p{L})(?:${escaped})(?!\\p{L})`, 'iu')
}

function countEmojis(msg: string): number {
  return (msg.match(/\p{Extended_Pictographic}/gu) || []).length
}

function countWords(msg: string): number {
  return (msg.match(/\p{L}+/gu) || []).length
}

function hasSlang(msg: string): boolean {
  return anyWord(['asså', 'typ', 'ba', 'imo', 'tbh', 'haha', 'lol', 'omg']).test(msg)
}

function hasCompleteSentences(msg: string): boolean {
  return /[.!?]/.test(msg) && countWords(msg) >= 5
}

function isPositiveResponse(msg: string): boolean {
  const emojiPositive = /😂|😄|😊|👍|👏|❤️|🙏/.test(msg)
  const wordPositive = anyWord([
    'bra',
    'nice',
    'exakt',
    'precis',
    'toppen',
    'perfekt',
    'tack',
    'haha',
  ]).test(msg)
  return emojiPositive || wordPositive
}

function isNegativeTone(msg: string): boolean {
  const emojiNeg = /😤|😞|😡/.test(msg)
  // "arg" must NOT match "arganolja" — Unicode boundary handles this
  const wordNeg = anyWord([
    'arg',
    'irriterad',
    'frustrerad',
    'besviken',
    'trött',
    'orkar inte',
  ]).test(msg)
  return emojiNeg || wordNeg
}

function containsExplicitStyleWords(msg: string): boolean {
  return anyWord([
    'emoji',
    'kort',
    'kortare',
    'längre',
    'formell',
    'humor',
    'skämt',
    'saklig',
  ]).test(msg)
}

export function extractSignals(
  ownerMessage: string,
  previousAiMessage: string
): Signal[] {
  const signals: Signal[] = []
  const wc = countWords(ownerMessage)
  const tooShort = wc < 2

  // Context blindness protection: negative tone + no explicit style words → pause signals
  if (isNegativeTone(ownerMessage) && !containsExplicitStyleWords(ownerMessage)) {
    return signals
  }

  // Formality
  if (!tooShort) {
    if (hasCompleteSentences(ownerMessage) && !hasSlang(ownerMessage)) {
      signals.push({
        preference: 'formality',
        direction: 'positive',
        weight: 0.5,
        reason: 'complete_sentences',
      })
    }
    if (hasSlang(ownerMessage)) {
      signals.push({
        preference: 'formality',
        direction: 'negative',
        weight: 0.5,
        reason: 'slang',
      })
    }
  }

  // Emoji
  const ec = countEmojis(ownerMessage)
  if (ec > 0) {
    signals.push({
      preference: 'emoji_frequency',
      direction: 'positive',
      weight: Math.min(ec * 0.5, 1.5),
      reason: 'emojis_used',
    })
  } else if (wc > 15) {
    signals.push({
      preference: 'emoji_frequency',
      direction: 'negative',
      weight: 0.3,
      reason: 'no_emoji_long_msg',
    })
  }

  // Verbosity
  if (!tooShort) {
    if (wc > 30) {
      signals.push({
        preference: 'verbosity',
        direction: 'positive',
        weight: 0.5,
        reason: 'long_message',
      })
    } else if (wc < 8 && wc >= 2) {
      signals.push({
        preference: 'verbosity',
        direction: 'negative',
        weight: 0.5,
        reason: 'short_message',
      })
    }
  }

  // Humor + Proactivity — require previous AI message context
  if (previousAiMessage) {
    const aiUsedHumor =
      /😄|😂|🤣|😏/.test(previousAiMessage) ||
      anyWord(['haha', 'hehe', 'skämt']).test(previousAiMessage)
    if (aiUsedHumor && isPositiveResponse(ownerMessage)) {
      signals.push({
        preference: 'humor_tolerance',
        direction: 'positive',
        weight: 1.0,
        reason: 'humor_positive',
      })
    }

    const aiWasProactive = /vill du att jag|ska jag|förresten|tips:/iu.test(previousAiMessage)
    if (aiWasProactive && isPositiveResponse(ownerMessage)) {
      signals.push({
        preference: 'proactivity_tolerance',
        direction: 'positive',
        weight: 1.0,
        reason: 'proactive_engaged',
      })
    }
    if (aiWasProactive && anyWord(['nej tack', 'inte nu', 'skippa']).test(ownerMessage)) {
      signals.push({
        preference: 'proactivity_tolerance',
        direction: 'negative',
        weight: 1.5,
        reason: 'proactive_dismissed',
      })
    }
  }

  return signals
}

// Calibration

export const CONFIDENCE_THRESHOLD = 0.6

export const DEFAULT_PERSONALITY = 'Anpassa dig efter hur ägaren skriver. Var naturlig.'

export function calibrate(alpha: number, beta: number): CalibratedPref {
  const mean = alpha / (alpha + beta)
  const observations = Math.max(0, alpha + beta - 10)
  const confidence = 1 - 1 / (1 + observations / 15)
  return { mean, confidence }
}

export function buildPersonalityBlock(
  prefs: CalibratedPreferences,
  observedTraits: string[] = []
): string {
  const lines: string[] = []

  const maps: Record<string, Record<string, string>> = {
    formality: {
      low: 'Skriv avslappnat, som till en nära kollega.',
      mid: 'Professionellt men varmt.',
      high: 'Formellt och strukturerat.',
    },
    emoji_frequency: {
      low: 'Inga emojis.',
      mid: 'Emojis ibland, när det känns naturligt.',
      high: 'Gärna emojis för att förstärka ton.',
    },
    verbosity: {
      low: 'Korta svar — max 1-2 meningar.',
      mid: 'Lagom längd.',
      high: 'Utveckla gärna, ge kontext och resonemang.',
    },
    humor_tolerance: {
      low: 'Håll dig saklig.',
      mid: 'Humor okej när stämningen tillåter.',
      high: 'Gärna humor och lättsamhet.',
    },
    proactivity_tolerance: {
      low: 'Vänta på att bli tillfrågad.',
      mid: 'Föreslå saker ibland.',
      high: 'Var proaktiv — föreslå, påminn, lyft saker.',
    },
  }

  for (const [key, pref] of Object.entries(prefs)) {
    if (pref.confidence < CONFIDENCE_THRESHOLD) continue
    const bucket = pref.mean < 0.3 ? 'low' : pref.mean > 0.7 ? 'high' : 'mid'
    const text = maps[key]?.[bucket]
    if (text) lines.push(text)
  }

  if (observedTraits.length > 0) {
    lines.push('')
    lines.push('OBSERVERADE MÖNSTER:')
    for (const trait of observedTraits.slice(0, 5)) {
      lines.push(`- ${trait}`)
    }
  }

  return lines.length > 0 ? lines.join('\n') : DEFAULT_PERSONALITY
}

// Trait detectors

export const TRAIT_DETECTORS: Array<{
  pattern: (msg: string) => boolean
  traitKey: string
  traitText: string
  minOccurrences: number
}> = [
  {
    pattern: (m) =>
      anyWord(['statistik', 'siffror', 'antal', 'procent', 'data', 'resultat']).test(m) ||
      m.includes('%'),
    traitKey: 'likes_data',
    traitText: 'Gillar siffror och data',
    minOccurrences: 3,
  },
  {
    pattern: (m) =>
      anyWord(['stress', 'tidsbrist', 'kaos']).test(m) || /hinner inte|ont om tid/iu.test(m),
    traitKey: 'mentions_stress',
    traitText: 'Nämner tidsbrist ofta',
    minOccurrences: 3,
  },
  {
    pattern: (m) => anyWord(['personal', 'anställd', 'kollega', 'teamet']).test(m),
    traitKey: 'staff_focus',
    traitText: 'Engagerad i personalfrågor',
    minOccurrences: 3,
  },
  {
    pattern: (m) =>
      anyWord(['pris', 'rabatt', 'kampanj']).test(m) ||
      wordBoundary('höja').test(m) ||
      wordBoundary('sänka').test(m),
    traitKey: 'pricing_focus',
    traitText: 'Intresserad av prissättning',
    minOccurrences: 3,
  },
  {
    pattern: (m) => anyWord(['barn', 'familj', 'dagis', 'skola']).test(m),
    traitKey: 'shares_personal',
    traitText: 'Delar ibland personligt om familj',
    minOccurrences: 2,
  },
  {
    pattern: (m) =>
      anyWord(['bokning', 'bokningar', 'avbokning', 'schema']).test(m) ||
      /no.?show/iu.test(m),
    traitKey: 'booking_focus',
    traitText: 'Fokuserar mycket på bokningar',
    minOccurrences: 4,
  },
]
