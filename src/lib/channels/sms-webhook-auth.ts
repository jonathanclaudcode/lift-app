// Webhook verification for incoming 46elks SMS.
// Supports Basic Auth header and ?token= query param fallback
// (Vercel can strip Basic Auth headers from URL credentials).

export function verifySmsWebhook(request: Request): boolean {
  const secret = process.env.ELKS_WEBHOOK_SECRET

  // In production, secret MUST be set. In dev, allow unauthenticated requests.
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SMS Webhook] ELKS_WEBHOOK_SECRET not set in production — rejecting request')
      return false
    }
    console.warn('[SMS Webhook] No ELKS_WEBHOOK_SECRET set — skipping verification (dev only)')
    return true
  }

  // Method 1: Basic Auth header
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Basic ')) {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString()
    // Split on FIRST colon — password may contain ':'
    const colonIndex = decoded.indexOf(':')
    if (colonIndex === -1) return false
    const user = decoded.slice(0, colonIndex)
    const pass = decoded.slice(colonIndex + 1)
    return user === process.env.ELKS_API_USERNAME && pass === secret
  }

  // Method 2: Query parameter fallback
  // Configure webhook URL as: https://domain.se/api/webhooks/sms?token=WEBHOOK_SECRET
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  if (token === secret) return true

  return false
}
