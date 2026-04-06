/**
 * Seed script for clinic knowledge.
 * Run with: npx tsx scripts/seed-clinic-knowledge.ts
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SEED_CLINIC_ID
 *
 * Tip: source .env.local before running, or prefix with env vars.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const clinicId = process.env.SEED_CLINIC_ID

if (!supabaseUrl || !supabaseKey || !clinicId) {
  console.error(
    'Missing env vars. Ensure NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, and SEED_CLINIC_ID are set.'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// REPLACE with actual clinic data before running
const SEED_DATA = [
  { category: 'treatment', content: 'Fillerbehandling: 2 800 kr. Läppar, kindben, käklinje.' },
  { category: 'treatment', content: 'Botox: 2 200 kr. Panna, kråksparkar, gummy smile.' },
  { category: 'treatment', content: 'Hudvård: 900 kr. Ansiktsbehandling med peeling.' },
  { category: 'treatment', content: 'Laser: 3 500 kr. Alexandrit-laser för hårborttagning.' },
  { category: 'team', content: 'Lisa (ägare, injektionssjuksköterska)' },
  { category: 'team', content: 'Anna (hudterapeut, specialist på ansiktsbehandlingar)' },
  {
    category: 'policy',
    content: '24 timmars avbokningspolicy. Avbokning senare än 24h = full avgift.',
  },
  { category: 'policy', content: '200 kr no-show-avgift vid uteblivet besök.' },
  { category: 'policy', content: 'Öppettider: Mån-Fre 09:00-18:00, Lör 10:00-15:00.' },
]

async function seed() {
  console.log(`Seeding clinic knowledge for clinic ${clinicId}...`)

  for (const entry of SEED_DATA) {
    const { error } = await supabase.from('clinic_knowledge').insert({
      clinic_id: clinicId,
      category: entry.category,
      content: entry.content,
      source: 'owner',
      is_active: true,
    })

    if (error) {
      if (error.code === '23505') {
        console.log(`  Skipped (duplicate): ${entry.content.slice(0, 50)}...`)
      } else {
        console.error(`  FAILED: ${entry.content.slice(0, 50)}... — ${error.message}`)
      }
    } else {
      console.log(`  Added: ${entry.content.slice(0, 50)}...`)
    }
  }

  console.log('Done.')
}

seed()
