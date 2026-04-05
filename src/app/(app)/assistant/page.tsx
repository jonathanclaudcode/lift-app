import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ChatContainer } from '@/components/chat/chat-container'

export const metadata = { title: 'AI Assistent — LIFT' }

export default async function AssistantPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const clinicId = user.app_metadata?.clinic_id as string | undefined
  if (!clinicId) redirect('/login')

  // Ensure clinic_preferences row exists (admin — bypasses RLS for upsert)
  const admin = createAdminClient()
  await admin
    .from('clinic_preferences')
    .upsert({ clinic_id: clinicId }, { onConflict: 'clinic_id', ignoreDuplicates: true })
    .catch(() => {})

  // Fetch newest 100 messages, then reverse to chronological order
  const { data: messagesDesc } = await supabase
    .from('ai_chat_messages')
    .select('id, role, content, created_at')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
    .limit(100)

  const messages = (messagesDesc || []).reverse() as Array<{
    id: string
    role: 'owner' | 'assistant'
    content: string
    created_at: string
  }>

  // Negate parent layout padding (p-4 md:p-6) so chat fills edge-to-edge
  return (
    <div className="h-full -m-4 md:-m-6">
      <ChatContainer initialMessages={messages} />
    </div>
  )
}
