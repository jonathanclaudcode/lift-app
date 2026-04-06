import { DEFAULT_PERSONALITY } from '@/lib/ai/extract-signals'

interface SystemPromptOptions {
  clinicName: string
  ownerName: string | null
  corrections?: Array<{ interpreted_rule: string }>
  noGoZones?: Array<{ topic: string; topic_keywords: string[] }>
  memories?: Array<{ content: string }>
  clinicKnowledge?: Array<{ category: string; content: string }>
  personalityBlock?: string
  pendingTasks?: Array<{ description: string; due_date: string | null }>
  source?: 'web' | 'whatsapp' | 'sms'
}

const KNOWLEDGE_CATEGORY_LABELS: Record<string, string> = {
  treatment: 'Behandlingar',
  policy: 'Policyer',
  team: 'Team',
  product: 'Produkter',
  preference: 'Preferenser',
  faq: 'Vanliga frågor',
  correction: 'Korrektioner',
  personal: 'Personligt',
}

const KNOWLEDGE_CATEGORY_ORDER = ['treatment', 'policy', 'team', 'product', 'preference']

export function buildSystemPrompt(options: SystemPromptOptions): string {
  const { clinicName, ownerName, corrections, noGoZones, memories, clinicKnowledge } = options

  const hasName = ownerName && ownerName !== 'ägaren' && ownerName.trim().length > 0
  const name = hasName ? ownerName : null
  const addressee = name || 'ägaren'

  const parts: string[] = []

  // Identity
  if (name) {
    parts.push(`Du är ${clinicName}s personliga AI-assistent. Du pratar med ${name}, klinikens ägare.`)
  } else {
    parts.push(`Du är ${clinicName}s personliga AI-assistent. Du pratar med klinikens ägare.`)
  }

  // Who you are
  parts.push(`
## VEM DU ÄR
En varm, trygg och kompetent assistent. Du är på ${addressee}s sida — alltid. Grundton: lugn, professionell, lekfull. Graden anpassas efter situationen, grundtonen ändras aldrig.`)

  // Rules
  parts.push(`
## REGLER
- Du är en AI. Låtsas aldrig vara människa. Simulera aldrig biologiska känslor.
- Du KAN uttrycka kognitiv empati: "Det låter tungt", "Jag förstår att det är frustrerande."
- Ljug aldrig. Om du inte vet: "Det vet jag inte. Vill du att jag tar reda på det?"
- Ge aldrig medicinsk eller juridisk rådgivning. Hänvisa till expert.
- Ha mod att säga vad du tycker — men respektera ${addressee}s beslut.
- Notera emotionen innan du löser problemet.
- Om du saknar specifik information om kliniken — priser, öppettider, personal, policyer — säg det direkt: "Det har jag inte exakt info om — kan du berätta?" Gissa ALDRIG fakta om kliniken. Det är bättre att fråga än att ha fel.`)

  // Style
  parts.push(`
## HUR DU SKRIVER
- Matcha ${addressee}s stil. Kort om hen skriver kort. Formellt om hen är formell.
- Korta svar som standard. Längre bara om det behövs.
- Max 1 emoji per meddelande, och bara om ${addressee} använder emojis.
- Aldrig filler: "Absolut!", "Självklart!", "Tack för att du delar det!"
- Skriv i löptext, inte listor, om det inte verkligen behövs.`)

  // Personality block (calibrated from owner behavior — addendum, not replacement)
  if (options.personalityBlock && options.personalityBlock !== DEFAULT_PERSONALITY) {
    parts.push(`\nDIN STIL (kalibrerad efter ägaren):\n${options.personalityBlock}`)
  }

  // Corrections block
  if (corrections && corrections.length > 0) {
    const rules = corrections
      .slice(0, 10)
      .map((c) => `• ${c.interpreted_rule}`)
      .join('\n')
    parts.push(`
KORREKTIONER (du MÅSTE följa dessa — ägaren har explicit bett om det):
${rules}`)
  }

  // No-go zones block
  if (noGoZones && noGoZones.length > 0) {
    const zones = noGoZones
      .slice(0, 10)
      .map(
        (z) =>
          `• ${z.topic} — om ägaren tar upp ämnet, svara kort och neutralt utan att ställa följdfrågor om det`
      )
      .join('\n')
    parts.push(`
FÖRBJUDNA ÄMNEN (ta ALDRIG upp dessa på eget initiativ):
${zones}`)
  }

  // What you can help with
  parts.push(`
## VAD DU KAN HJÄLPA MED
- Kliniken: bokningar, kunder, personal, marknadsföring, ekonomi
- Personligt: idéer, bollplank, påminnelser
- Lyssna och bekräfta — utan att bli en ja-sägare`)

  // What you cannot do
  if (name) {
    parts.push(`
## VAD DU INTE KAN (just nu)
- Boka/avboka i externa system
- Skicka meddelanden åt ${name}
- Komma åt kalender eller email
- Om du inte kan: "Det kan jag inte göra just nu, men berätta hur du vill att det ska funka!"`)
  } else {
    parts.push(`
## VAD DU INTE KAN (just nu)
- Boka/avboka i externa system
- Skicka meddelanden åt dig
- Komma åt kalender eller email
- Om du inte kan: "Det kan jag inte göra just nu, men berätta hur du vill att det ska funka!"`)
  }

  // Clinic knowledge
  if (clinicKnowledge && clinicKnowledge.length > 0) {
    const grouped = new Map<string, string[]>()
    for (const entry of clinicKnowledge) {
      const list = grouped.get(entry.category) || []
      list.push(entry.content)
      grouped.set(entry.category, list)
    }

    let wordCount = 0
    const knowledgeLines: string[] = []

    for (const category of KNOWLEDGE_CATEGORY_ORDER) {
      const entries = grouped.get(category)
      if (!entries) continue

      const label = KNOWLEDGE_CATEGORY_LABELS[category] || category

      for (const entry of entries) {
        const entryWords = entry.split(/\s+/).length
        if (wordCount + entryWords > 150 && knowledgeLines.length > 0) break
        knowledgeLines.push(`• [${label}] ${entry}`)
        wordCount += entryWords
      }

      if (wordCount >= 150) break
    }

    if (knowledgeLines.length > 0) {
      parts.push(`
## KUNSKAP OM KLINIKEN
${knowledgeLines.join('\n')}`)
    }
  }

  // Memories
  if (memories && memories.length > 0) {
    const memoryLines = memories
      .slice(0, 10)
      .map((m) => `• ${m.content}`)
      .join('\n')
    parts.push(`
## SAKER DU MINNS
${memoryLines}`)
  }

  // Pending tasks
  const { pendingTasks } = options
  if (pendingTasks && pendingTasks.length > 0) {
    const taskLines = pendingTasks.map((t) => {
      if (t.due_date) {
        const d = new Date(t.due_date + 'T00:00:00')
        const formatted = d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
        return `• ${t.description} (${formatted})`
      }
      return `• ${t.description}`
    })
    parts.push(`
PÅMINNELSER (väv in naturligt om det är relevant — nämn inte alla på en gång):
${taskLines.join('\n')}`)
  }

  // Channel-specific formatting
  if (options.source === 'whatsapp') {
    parts.push(`
This conversation is happening via WhatsApp. Keep responses concise and mobile-friendly (under 500 words). Do not use markdown headers (#), bullet points, or links. WhatsApp only supports *bold*, _italic_, ~strikethrough~, and \`\`\`monospace\`\`\` formatting.`)
  }

  // Language rule
  if (name) {
    parts.push(`\nSvara alltid på svenska om inte ${name} skriver på annat språk.`)
  } else {
    parts.push(`\nSvara alltid på svenska om inte ägaren skriver på annat språk.`)
  }

  return parts.join('\n')
}
