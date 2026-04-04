// 46elks SMS client — Sweden-focused phone normalization + SMS sending via REST API.

interface ElksSmsResponse {
  id: string
  status?: string
  cost?: number
  [key: string]: unknown
}

interface SendSmsParams {
  to: string // customer phone number
  message: string // message text
  from: string // clinic's 46elks number (from clinics.phone)
}

interface SendSmsResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Normalize a phone number to E.164 format.
 * Sweden-focused: handles 07x local numbers, 46x without +, and 00-prefixed international.
 * Numbers already in E.164 (+prefix) are accepted regardless of country.
 * Throws on invalid input.
 */
export function normalizePhoneNumber(phone: string): string {
  // Strip whitespace, dashes, parentheses
  let cleaned = phone.trim().replace(/[\s\-()]/g, '')

  if (cleaned.startsWith('+')) {
    // Already international format — keep as-is
  } else if (cleaned.startsWith('00')) {
    // International with 00 prefix → replace with +
    cleaned = '+' + cleaned.slice(2)
  } else if (cleaned.startsWith('07')) {
    // Swedish mobile number → prefix with +46, drop leading 0
    cleaned = '+46' + cleaned.slice(1)
  } else if (cleaned.startsWith('46')) {
    // Swedish number without + → add +
    cleaned = '+' + cleaned
  } else {
    throw new Error(`Cannot normalize phone number: ${phone}`)
  }

  // Validate E.164 length: + followed by 8-15 digits
  const digits = cleaned.slice(1)
  if (!/^\d{8,15}$/.test(digits)) {
    throw new Error(`Cannot normalize phone number: ${phone} (invalid length after normalization: ${cleaned})`)
  }

  return cleaned
}

function maskPhone(phone: string): string {
  return '***' + phone.slice(-4)
}

/**
 * Send an SMS via the 46elks API.
 * - Missing env vars → throws (programming error, should never happen in runtime).
 * - API/network/timeout errors → returns { success: false, error }.
 */
export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  const username = process.env.ELKS_API_USERNAME
  const password = process.env.ELKS_API_PASSWORD
  if (!username || !password) {
    throw new Error('Missing ELKS_API_USERNAME or ELKS_API_PASSWORD')
  }

  const to = normalizePhoneNumber(params.to)
  const from = normalizePhoneNumber(params.from)

  const body = new URLSearchParams({ from, to, message: params.message })

  if (process.env.ELKS_DRY_RUN === 'true') {
    body.append('dryrun', 'yes')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch('https://api.46elks.com/a1/sms', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(username + ':' + password).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => 'unknown')
      console.error(`[SMS] Send failed: HTTP ${response.status} — ${text}`)
      return { success: false, error: `HTTP ${response.status}: ${text}` }
    }

    const data: ElksSmsResponse = await response.json()
    console.info(`[SMS] Sent to ${maskPhone(to)}, messageId: ${data.id}, cost: ${data.cost ?? 'unknown'} SEK`)
    return { success: true, messageId: data.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    console.error(`[SMS] Send failed: ${isTimeout ? 'Timeout (10s)' : message}`)
    return { success: false, error: isTimeout ? 'Timeout (10s)' : message }
  } finally {
    clearTimeout(timeout)
  }
}
