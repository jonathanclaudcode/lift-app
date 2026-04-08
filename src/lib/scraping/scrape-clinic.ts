import * as cheerio from 'cheerio'
import { getAnthropicClient, AI_MODEL } from '@/lib/ai/client'

// ── Types ──

export interface ScrapedTreatment {
  name: string
  category: string | null
  price_sek: number | null
  price_type: 'fixed' | 'from' | 'consultation' | 'unknown'
  price_note: string | null
  description: string | null
  duration_minutes: number | null
  confidence: 'high' | 'medium' | 'low'
}

export interface ScrapedStaff {
  name: string
  role: string | null
  confidence: 'high' | 'medium' | 'low'
}

export interface ScrapedClinicData {
  clinic_name: string | null
  treatments: ScrapedTreatment[]
  staff: ScrapedStaff[]
  opening_hours: string | null
  policies: {
    cancellation: string | null
    consultation: string | null
    payment: string | null
  }
  booking_url: string | null
  extraction_notes: string
}

export interface ScrapeResult {
  success: boolean
  data: ScrapedClinicData | null
  pages_scraped: number
  urls_scraped: string[]
  raw_markdown: string | null
  error?: string
}

// ── URL Handling ──

export function normalizeClinicUrl(input: string): string {
  let url = input.trim()
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`
  }
  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed')
  }
  parsed.hash = ''
  let result = parsed.href
  if (result.endsWith('/') && parsed.pathname === '/') {
    result = result.slice(0, -1)
  }
  return result
}

function isPrivateUrl(urlString: string): boolean {
  const host = new URL(urlString).hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return true
  if (host.endsWith('.local') || host.endsWith('.internal')) return true
  if (host.startsWith('10.')) return true
  if (host.startsWith('192.168.')) return true
  if (host.startsWith('172.')) {
    const second = parseInt(host.split('.')[1], 10)
    if (second >= 16 && second <= 31) return true
  }
  if (host.startsWith('169.254.')) return true
  return false
}

// ── Page Fetching ──

const THIRD_PARTY_DOMAINS = ['bokadirekt.se', 'fresha.com', 'timma.se', 'mindbodyonline.com', 'treatwell.se']

async function fetchPageMarkdown(url: string): Promise<{ text: string; links: string[] } | null> {
  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: 'application/json',
        'X-Timeout': '15',
        ...(process.env.JINA_API_KEY ? { Authorization: `Bearer ${process.env.JINA_API_KEY}` } : {}),
      },
      signal: AbortSignal.timeout(20_000),
    })

    if (!response.ok) return await fetchWithCheerio(url)

    const contentType = response.headers.get('content-type') || ''
    let text = ''
    let links: string[] = []

    if (contentType.includes('application/json')) {
      const json = await response.json()
      text = json.data?.content || json.content || ''
      links = json.data?.links || json.links || []
    } else {
      text = await response.text()
    }

    // Also extract markdown links from text
    const mdLinks = [...text.matchAll(/\[(?:[^\]]*)\]\(([^)]+)\)/g)]
      .map((m) => m[1])
      .filter((href) => href.startsWith('http'))
    links = [...new Set([...links, ...mdLinks])]

    // Resolve relative URLs
    links = links
      .map((href) => {
        try {
          return new URL(href, url).href.split('#')[0]
        } catch {
          return null
        }
      })
      .filter((l): l is string => l !== null)

    if (!text.trim()) return await fetchWithCheerio(url)
    return { text, links }
  } catch {
    return await fetchWithCheerio(url)
  }
}

async function fetchWithCheerio(url: string): Promise<{ text: string; links: string[] } | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LIFTBot/1.0)' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) return null

    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/pdf')) return null

    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 5_000_000) return null

    const html = await response.text()
    const $ = cheerio.load(html)

    // Extract links BEFORE removing elements
    const baseHostname = new URL(url).hostname
    const links: string[] = []
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')
      if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        try {
          const resolved = new URL(href, url)
          if (resolved.hostname === baseHostname) {
            links.push(resolved.href.split('#')[0])
          }
        } catch {
          /* skip invalid */
        }
      }
    })

    // Remove noise
    $('script, style, nav, footer, header, iframe, noscript').remove()
    $('[class*="cookie"], [id*="cookie"], [class*="popup"], [id*="popup"], [class*="modal"], [id*="modal"], [class*="banner"], [id*="banner"]').remove()

    let text = $('body').text().replace(/\s+/g, ' ').trim()
    text = text.slice(0, 30_000)

    return { text, links: [...new Set(links)] }
  } catch {
    return null
  }
}

// ── Subpage Discovery ──

const TARGET_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\/(priser|prislista|vara-priser|prices)/i, label: 'prices' },
  { pattern: /\/(behandlingar|vara-behandlingar|treatments|vart-utbud)/i, label: 'treatments' },
  { pattern: /\/(om-oss|personal|om-kliniken|about|team|vara-behandlare)/i, label: 'about' },
  { pattern: /\/(kontakt|kontakta-oss|contact|hitta-oss)/i, label: 'contact' },
]

function discoverTargetPages(links: string[], baseUrl: string): string[] {
  const baseHostname = new URL(baseUrl).hostname
  const sameHostLinks = links.filter((l) => {
    try {
      return new URL(l).hostname === baseHostname
    } catch {
      return false
    }
  })

  const found = new Map<string, string>()
  const bookingUrls: string[] = []

  for (const link of sameHostLinks) {
    // Check for third-party booking domains
    try {
      const linkHost = new URL(link).hostname
      if (THIRD_PARTY_DOMAINS.some((d) => linkHost.includes(d))) {
        bookingUrls.push(link)
        continue
      }
    } catch {
      continue
    }

    for (const { pattern, label } of TARGET_PATTERNS) {
      if (!found.has(label) && pattern.test(new URL(link).pathname)) {
        found.set(label, link)
      }
    }
  }

  // Priority order: prices, treatments, about, contact
  const ordered: string[] = []
  for (const label of ['prices', 'treatments', 'about', 'contact']) {
    const url = found.get(label)
    if (url) ordered.push(url)
  }

  return ordered.slice(0, 5)
}

// ── Claude Extraction ──

const EXTRACTION_PROMPT = `Du är en dataextraktionsmotor för svenska skönhetskliniker.

Extrahera strukturerad information från webbplatstexten. Returnera ENDAST giltig JSON.
Börja direkt med { och avsluta med }. Ingen markdown, inga förklaringar, inga backticks.

REGLER:
- Extrahera ALLA behandlingar med priser du hittar
- Svenska prisformat: "1 500 kr", "2.900 kr", "3000 kr" → normalisera till heltal (2900)
- "från 2 500 kr" eller "2000 - 4000 kr" → price_type: "from", price_sek: lägsta priset
- Fast pris "2 500 kr" → price_type: "fixed"
- "Konsultation: 350 kr" → price_type: "consultation"
- Om pris per enhet ("per ml", "per zon") → lägg i price_note
- Kategorisera: "Injektioner", "Hudvård", "Laser", "Kropp", "Kirurgi", "Övrigt"
- Extrahera personal med titel ("Leg. Sjuksköterska", "Hudterapeut")
- Öppettider som en sträng ("Mån-Fre 09:00-18:00")
- Avbokningspolicy, konsultationskrav, betalmetoder — INTE generella cookie/GDPR-villkor
- Om du hittar boknings-URL (bokadirekt, fresha, timma) → booking_url
- Flagga osäkra extraktioner med confidence: "low"
- Behåll ALL text på svenska
- Hitta ALDRIG på priser eller personal — sätt null om info saknas
- Deduplicera: om samma behandling nämns på flera sidor, behåll den med mest info
- Max 150 behandlingar, max 30 personal

JSON-format:
{
  "clinic_name": "string|null",
  "treatments": [{ "name": "string", "category": "string|null", "price_sek": number|null, "price_type": "fixed|from|consultation|unknown", "price_note": "string|null", "description": "string|null", "duration_minutes": number|null, "confidence": "high|medium|low" }],
  "staff": [{ "name": "string", "role": "string|null", "confidence": "high|medium|low" }],
  "opening_hours": "string|null",
  "policies": { "cancellation": "string|null", "consultation": "string|null", "payment": "string|null" },
  "booking_url": "string|null",
  "extraction_notes": "string"
}`

async function extractWithClaude(combinedText: string): Promise<ScrapedClinicData> {
  const client = getAnthropicClient()

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 4096,
    temperature: 0,
    system: EXTRACTION_PROMPT,
    messages: [{ role: 'user', content: combinedText }],
  })

  if (!response.content?.length || response.content[0]?.type !== 'text') {
    throw new Error('Claude returned empty response')
  }

  let jsonText = response.content[0].text.trim()
  jsonText = jsonText.replace(/^```json?\s*\n?/, '').replace(/\n?\s*```$/, '')
  const firstBrace = jsonText.indexOf('{')
  if (firstBrace > 0) jsonText = jsonText.slice(firstBrace)
  const lastBrace = jsonText.lastIndexOf('}')
  if (lastBrace >= 0) jsonText = jsonText.slice(0, lastBrace + 1)

  const parsed = JSON.parse(jsonText)

  // Runtime validation
  if (!parsed || typeof parsed !== 'object') throw new Error('Claude response is not an object')
  if (!Array.isArray(parsed.treatments)) parsed.treatments = []
  if (!Array.isArray(parsed.staff)) parsed.staff = []

  parsed.treatments = parsed.treatments.slice(0, 150)
  parsed.staff = parsed.staff.slice(0, 30)

  parsed.treatments = parsed.treatments.filter(
    (t: Record<string, unknown>) => typeof t?.name === 'string' && (t.name as string).trim().length > 0
  )

  for (const t of parsed.treatments) {
    if (t.price_sek !== null && t.price_sek !== undefined) {
      t.price_sek = Math.round(Number(t.price_sek))
      if (isNaN(t.price_sek)) t.price_sek = null
    }
    if (t.duration_minutes !== null && t.duration_minutes !== undefined) {
      t.duration_minutes = Math.round(Number(t.duration_minutes))
      if (isNaN(t.duration_minutes)) t.duration_minutes = null
    }
  }

  parsed.staff = (parsed.staff || []).filter(
    (s: Record<string, unknown>) => typeof s?.name === 'string' && (s.name as string).trim().length > 0
  )

  return parsed as ScrapedClinicData
}

// ── Main Orchestrator ──

export async function scrapeClinic(inputUrl: string): Promise<ScrapeResult> {
  try {
    const url = normalizeClinicUrl(inputUrl)

    if (isPrivateUrl(url)) {
      return { success: false, data: null, pages_scraped: 0, urls_scraped: [], raw_markdown: null, error: 'URL:en pekar på en intern adress.' }
    }

    // Fetch homepage
    const homepage = await fetchPageMarkdown(url)
    if (!homepage) {
      return { success: false, data: null, pages_scraped: 0, urls_scraped: [], raw_markdown: null, error: 'Kunde inte nå hemsidan. Kontrollera URL:en.' }
    }

    const urlsScraped = [url]
    const pageTexts = new Map<string, { label: string; text: string }>()
    pageTexts.set(url, { label: 'STARTSIDA', text: homepage.text })

    // Discover subpages
    const targetPages = discoverTargetPages(homepage.links, url)
    const labelMap: Record<string, string> = {}
    for (const { pattern, label } of TARGET_PATTERNS) {
      for (const tp of targetPages) {
        if (pattern.test(new URL(tp).pathname)) labelMap[tp] = label.toUpperCase()
      }
    }

    // Fetch subpages in parallel
    const subResults = await Promise.allSettled(
      targetPages.map(async (subUrl) => {
        const result = await fetchPageMarkdown(subUrl)
        return { url: subUrl, result }
      })
    )

    for (const sr of subResults) {
      if (sr.status === 'fulfilled' && sr.value.result) {
        const label = labelMap[sr.value.url] || 'SIDA'
        pageTexts.set(sr.value.url, { label, text: sr.value.result.text })
        urlsScraped.push(sr.value.url)
      }
    }

    // Combine text: prices/treatments first, homepage last
    const priorityOrder = ['PRICES', 'TREATMENTS', 'ABOUT', 'CONTACT', 'STARTSIDA']
    const sortedEntries = [...pageTexts.entries()].sort((a, b) => {
      const aIdx = priorityOrder.indexOf(a[1].label)
      const bIdx = priorityOrder.indexOf(b[1].label)
      return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx)
    })

    let combined = ''
    for (const [pageUrl, { label, text }] of sortedEntries) {
      combined += `=== ${label}: ${pageUrl} ===\n${text}\n\n`
      if (combined.length > 80_000) break
    }
    combined = combined.slice(0, 80_000)

    const pagesScraped = urlsScraped.length
    const data = await extractWithClaude(combined)

    return {
      success: true,
      data,
      pages_scraped: pagesScraped,
      urls_scraped: urlsScraped,
      raw_markdown: combined,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown scraping error'
    console.error('scrapeClinic error:', message)
    return { success: false, data: null, pages_scraped: 0, urls_scraped: [], raw_markdown: null, error: message }
  }
}
