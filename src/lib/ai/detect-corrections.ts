const SWEDISH_STOPWORDS = new Set([
  'jag', 'du', 'han', 'hon', 'den', 'det', 'vi', 'de', 'dem',
  'min', 'din', 'sin', 'hans', 'hennes', 'vår', 'deras',
  'mitt', 'ditt', 'sitt', 'vårt',
  'mig', 'dig', 'sig', 'oss',
  'en', 'ett',
  'och', 'eller', 'men', 'för', 'att', 'som', 'med', 'av', 'på',
  'till', 'från', 'om', 'i', 'är', 'var', 'har', 'hade',
  'inte', 'kan', 'ska', 'vill', 'får', 'måste', 'blir',
  'alla', 'allt', 'andra', 'efter', 'bara', 'denna', 'dessa',
  'där', 'här', 'hur', 'när', 'vad', 'varför', 'vilket',
  'igen', 'aldrig', 'alltid', 'mycket', 'lite', 'mer', 'mest',
  'så', 'nog', 'ju', 'väl', 'ändå', 'också',
])

const OPERATIONAL_KEYWORDS = /\b(kund|klient|patient|bokning|schema|behandling|faktura|brev|mail|sms|besökare|konsultation|återbud|journal|reception|avbokning)\b/i

export interface DetectedCorrection {
  text: string
  rule: string
  forbiddenPhrase: string | null
  mappedPreference: string | null
}

export interface DetectedNoGo {
  topic: string
  reason: string
  explicit: boolean
  keywords: string[]
}

export function cleanForbiddenPhrase(phrase: string): string {
  return phrase.trim().replace(/[!?.,:;]+$/, '')
}

export function detectExplicitCorrection(message: string): DetectedCorrection | null {
  const patterns: Array<{ regex: RegExp; quoted: boolean }> = [
    { regex: /säg (?:aldrig|inte)\s+["'](.+?)["']/i, quoted: true },
    { regex: /säg (?:aldrig|inte)\s+(.+?)(?:\.|!|\?|$)/i, quoted: false },
    { regex: /sluta (?:med att |att )?(?:säga |skriva )["']?(.+?)["']?(?:\.|!|\?|$)/i, quoted: false },
  ]

  for (const { regex, quoted } of patterns) {
    const match = message.match(regex)
    if (!match || !match[1]) continue

    const cleaned = cleanForbiddenPhrase(match[1])
    if (cleaned.length < 2) continue

    // Check operational keywords against extracted phrase only
    if (OPERATIONAL_KEYWORDS.test(cleaned)) return null

    const forbiddenPhrase = quoted ? cleaned : (cleaned.length <= 40 ? cleaned : null)

    const mappedPreference = mapToPreference(cleaned)

    return {
      text: message,
      rule: forbiddenPhrase
        ? `Använd aldrig frasen "${forbiddenPhrase}"`
        : `Undvik: ${cleaned.slice(0, 100)}`,
      forbiddenPhrase,
      mappedPreference,
    }
  }

  return null
}

function mapToPreference(phrase: string): string | null {
  const lower = phrase.toLowerCase()
  if (/emoji|smiley|😊|🙂|😀/.test(lower)) return 'emoji_frequency'
  if (/\b(kort|lång|utveckla|detalj|kortare|längre)\b/.test(lower)) return 'verbosity'
  if (/\b(humor|skämt|rolig|allvar|skämta)\b/.test(lower)) return 'humor_tolerance'
  return null
}

export function detectNoGoZone(message: string): DetectedNoGo | null {
  const patterns = [
    /prata (?:aldrig|inte) om\s+(.+?)(?:\.|!|\?|$)/i,
    /nämn (?:aldrig|inte)\s+(.+?)(?:\.|!|\?|$)/i,
    /undvik (?:att prata om\s+)?(.+?)(?:\.|!|\?|$)/i,
    /jag vill inte att du tar upp\s+(.+?)(?:\.|!|\?|$)/i,
  ]

  for (const regex of patterns) {
    const match = message.match(regex)
    if (!match || !match[1]) continue

    let topic = match[1].trim().replace(/[!?.,:;]+$/, '')

    // Remove trailing filler words
    topic = topic.replace(/\s+(tack|snälla|igen)$/i, '')

    if (topic.length < 2) continue

    // Generate keywords
    let keywords = topic
      .split(/\s+/)
      .map((w) => w.toLowerCase())
      .filter((w) => w.length >= 3 && !SWEDISH_STOPWORDS.has(w))

    // Deduplicate
    keywords = [...new Set(keywords)]

    // Fallback if no keywords remain
    if (keywords.length === 0) {
      keywords = [topic.toLowerCase()]
    }

    return {
      topic,
      reason: message,
      explicit: true,
      keywords,
    }
  }

  return null
}
