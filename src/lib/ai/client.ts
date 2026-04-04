import Anthropic from '@anthropic-ai/sdk'

export const AI_MODEL = 'claude-haiku-4-5-20251001' as const

let client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is not set. Add it to .env.local and Vercel Environment Variables.'
      )
    }
    client = new Anthropic({ apiKey, timeout: 10_000 })
  }
  return client
}
