if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
  console.warn('[WhatsApp] Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID env vars')
}
if (!process.env.WHATSAPP_PHONE_NUMBER) {
  console.warn('[WhatsApp] Missing WHATSAPP_PHONE_NUMBER env var — self-message loop guard will not work')
}

const WHATSAPP_API_BASE = `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`
const MAX_CHUNK = 4096

export async function sendWhatsAppMessage(to: string, body: string): Promise<boolean> {
  try {
    const chunks: string[] = []
    let remaining = body

    while (remaining.length > 0) {
      if (remaining.length <= MAX_CHUNK) {
        chunks.push(remaining)
        break
      }

      // Find natural break point before limit
      let breakAt = remaining.lastIndexOf('\n\n', MAX_CHUNK)
      if (breakAt < 200) breakAt = remaining.lastIndexOf('\n', MAX_CHUNK)
      if (breakAt < 200) {
        // Hard truncate
        chunks.push(remaining.slice(0, 4093) + '...')
        remaining = remaining.slice(4093)
        continue
      }

      chunks.push(remaining.slice(0, breakAt).trim())
      remaining = remaining.slice(breakAt).trim()
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i].trim()
      if (!chunk) continue

      const res = await fetch(WHATSAPP_API_BASE, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: chunk },
        }),
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) {
        const errBody = await res.text().catch(() => 'unknown')
        console.error(`[WhatsApp] Send failed (${res.status}):`, errBody)
        return false
      }

      // Small delay between chunks to help maintain order
      if (i < chunks.length - 1) {
        await new Promise((r) => setTimeout(r, 500))
      }
    }

    return true
  } catch (err) {
    console.error('[WhatsApp] Send error:', err)
    return false
  }
}

export function markMessageAsRead(messageId: string): void {
  // True fire-and-forget — no await from caller
  fetch(WHATSAPP_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
    signal: AbortSignal.timeout(10000),
  }).catch((err) => {
    console.error('[WhatsApp] markAsRead error:', err)
  })
}
