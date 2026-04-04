'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateClinicSettings(
  prevState: { success: boolean; error?: string } | null,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Ej autentiserad' }
  }

  const clinicId = user.app_metadata?.clinic_id as string | undefined
  if (!clinicId) {
    return { success: false, error: 'Ej autentiserad' }
  }

  const name = (formData.get('name') as string) ?? ''
  const phone = (formData.get('phone') as string) ?? ''
  const address = (formData.get('address') as string) ?? ''
  const website = (formData.get('website') as string) ?? ''

  // Validation
  if (!name.trim()) {
    return { success: false, error: 'Kliniknamn är obligatoriskt' }
  }

  if (phone.trim() && !/^\+46\d{7,13}$/.test(phone.trim())) {
    return { success: false, error: 'Ogiltigt telefonnummer. Använd format +46XXXXXXXXX' }
  }

  if (website.trim() && !website.trim().startsWith('https://')) {
    return { success: false, error: 'Webbplatsadress måste börja med https://' }
  }

  // Empty optional fields → null (not empty strings)
  const updates = {
    name: name.trim(),
    phone: phone.trim() || null,
    address: address.trim() || null,
    website: website.trim() || null,
  }

  // updated_at is handled by the set_updated_at_clinics trigger
  const { error } = await supabase.from('clinics').update(updates).eq('id', clinicId)

  if (error) {
    console.error('[settings]', error)
    return { success: false, error: 'Kunde inte spara inställningar. Försök igen.' }
  }

  revalidatePath('/settings')
  return { success: true }
}
