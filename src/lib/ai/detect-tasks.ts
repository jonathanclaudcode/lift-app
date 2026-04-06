export interface DetectedTask {
  description: string
  dueDate: string | null
  sourceMessage: string
}

function getStockholmToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })
}

function getStockholmDatePlusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })
}

const SWEDISH_DAYS: Record<string, number> = {
  måndag: 1,
  tisdag: 2,
  onsdag: 3,
  torsdag: 4,
  fredag: 5,
  lördag: 6,
  söndag: 0,
}

const TASK_PATTERNS: Array<{ regex: RegExp; group: number }> = [
  {
    regex:
      /(?<!\p{L})(?:påminn\s+mig|kan\s+du\s+påminna\s+mig)\s+(?:att\s+|om\s+(?:att\s+)?)?(.+?)(?:[.!?]|$)/iu,
    group: 1,
  },
  {
    regex: /(?<!\p{L})kom\s+ihåg\s+(?:att\s+)?(.+?)(?:[.!?]|$)/iu,
    group: 1,
  },
  {
    regex: /(?<!\p{L})glöm\s+inte\s+(?:att\s+)?(.+?)(?:[.!?]|$)/iu,
    group: 1,
  },
]

function parseRelativeDate(text: string): string | null {
  const lower = text.toLowerCase()

  if (/(?<!\p{L})idag(?!\p{L})/iu.test(lower)) {
    return getStockholmToday()
  }

  if (/(?<!\p{L})imorgon(?!\p{L})/iu.test(lower)) {
    return getStockholmDatePlusDays(1)
  }

  if (/(?<!\p{L})(?:i\s+)?övermorgon(?!\p{L})/iu.test(lower)) {
    return getStockholmDatePlusDays(2)
  }

  if (/(?<!\p{L})nästa\s+vecka(?!\p{L})/iu.test(lower)) {
    const today = new Date()
    const todayDay = today.getDay()
    const daysUntilMonday = todayDay === 0 ? 1 : 8 - todayDay
    return getStockholmDatePlusDays(daysUntilMonday)
  }

  for (const [dayName, dayNum] of Object.entries(SWEDISH_DAYS)) {
    const pattern = new RegExp(
      `(?<!\\p{L})(?:på\\s+|nästa\\s+)?${dayName}(?!\\p{L})`,
      'iu'
    )
    if (pattern.test(lower)) {
      const today = new Date()
      const todayDay = today.getDay()
      let daysUntil = dayNum - todayDay
      if (daysUntil <= 0) daysUntil += 7
      return getStockholmDatePlusDays(daysUntil)
    }
  }

  const daysMatch = lower.match(/(?<!\p{L})om\s+(\d+)\s+dagar?(?!\p{L})/iu)
  if (daysMatch) {
    return getStockholmDatePlusDays(parseInt(daysMatch[1]))
  }

  return null
}

export function detectTask(message: string): DetectedTask | null {
  for (const { regex, group } of TASK_PATTERNS) {
    const match = message.match(regex)
    if (match && match[group]) {
      const rawDescription = match[group].trim().replace(/[.!?]+$/, '')
      if (rawDescription.length < 3) continue

      const dueDate = parseRelativeDate(rawDescription) || parseRelativeDate(message)

      // Clean date references from description
      let description = rawDescription
      for (const dayName of Object.keys(SWEDISH_DAYS)) {
        const cleanPattern = new RegExp(
          `(?<!\\p{L})(?:på\\s+|i\\s+|nästa\\s+)?${dayName}(?!\\p{L})`,
          'giu'
        )
        description = description.replace(cleanPattern, '')
      }
      description = description
        .replace(/(?<!\p{L})(?:i\s+)?övermorgon(?!\p{L})/giu, '')
        .replace(/(?<!\p{L})(?:idag|imorgon|nästa\s+vecka)(?!\p{L})/giu, '')
        .replace(/(?<!\p{L})om\s+\d+\s+dagar?(?!\p{L})/giu, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/^[\s,]+|[\s,]+$/g, '')

      if (description.length < 3) description = rawDescription

      return {
        description,
        dueDate,
        sourceMessage: message.slice(0, 500),
      }
    }
  }

  return null
}
