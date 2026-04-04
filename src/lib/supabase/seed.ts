import { createAdminClient } from './admin'

export async function seedDatabase(clinicId: string) {
  const supabase = createAdminClient()

  // Clean existing seed data (respect FK order)
  await supabase.from('suggestion_events').delete().eq('clinic_id', clinicId)
  await supabase.from('messages').delete().eq('clinic_id', clinicId)
  await supabase.from('conversations').delete().eq('clinic_id', clinicId)
  await supabase.from('bookings').delete().eq('clinic_id', clinicId)
  await supabase.from('customers').delete().eq('clinic_id', clinicId)

  // Insert customers
  const { data: customers, error: custErr } = await supabase
    .from('customers')
    .insert([
      {
        clinic_id: clinicId,
        name: 'Lisa Andersson',
        phone: '0731234567',
        email: 'lisa.andersson@gmail.com',
        pipeline_stage: 'loyal',
        treatment_count: 8,
        last_visit_at: '2026-03-28T10:00:00+02:00',
        skin_type: 'Normal/Torr',
        allergies: ['retinol'],
        notes: 'Stamkund sedan 2024, föredrar kvällstider',
        response_rate: 0.85,
      },
      {
        clinic_id: clinicId,
        name: 'Emma Lindström',
        phone: '0739876543',
        email: 'emma.lindstrom@hotmail.com',
        pipeline_stage: 'consultation_booked',
        treatment_count: 0,
        notes: 'Ny kund, intresserad av fillers, hittade oss via Instagram',
      },
      {
        clinic_id: clinicId,
        name: 'Sara Johansson',
        phone: '0735551234',
        email: 'sara.j@gmail.com',
        pipeline_stage: 'follow_up_due',
        treatment_count: 3,
        last_visit_at: '2026-03-15T14:00:00+02:00',
        skin_type: 'Känslig',
        notes: 'Avbokade senaste tiden, hör av oss för ombokning',
        response_rate: 0.6,
      },
      {
        clinic_id: clinicId,
        name: 'Maria Eriksson',
        phone: '0732223344',
        pipeline_stage: 'treated',
        treatment_count: 5,
        last_visit_at: '2026-04-01T11:00:00+02:00',
        notes: 'Mycket nöjd med senaste hudvårdsbehandlingen',
        response_rate: 0.9,
      },
      {
        clinic_id: clinicId,
        name: 'Anna Nilsson',
        phone: '0736667788',
        email: 'anna.n@outlook.com',
        pipeline_stage: 'consultation_booked',
        treatment_count: 1,
        notes: 'Intresserad av Botox, hade konsultation i mars',
      },
    ])
    .select('id, name')

  if (custErr || !customers) throw new Error(`Failed to insert customers: ${custErr?.message}`)

  const lisa = customers.find((c) => c.name === 'Lisa Andersson')!
  const emma = customers.find((c) => c.name === 'Emma Lindström')!
  const sara = customers.find((c) => c.name === 'Sara Johansson')!

  // Insert conversations
  const { data: convos, error: convErr } = await supabase
    .from('conversations')
    .insert([
      {
        clinic_id: clinicId,
        customer_id: lisa.id,
        channel: 'sms',
        status: 'active',
        last_message_at: '2026-04-02T10:15:00+02:00',
        last_message_preview: 'Tack så mycket! 🙏',
      },
      {
        clinic_id: clinicId,
        customer_id: emma.id,
        channel: 'sms',
        status: 'active',
        last_message_at: '2026-04-02T11:20:00+02:00',
        last_message_preview: 'Perfekt, jag tar den!',
      },
      {
        clinic_id: clinicId,
        customer_id: sara.id,
        channel: 'sms',
        status: 'active',
        last_message_at: '2026-03-30T14:12:00+02:00',
        last_message_preview: 'Ja tack, gärna på en tisdag eller onsdag',
      },
    ])
    .select('id, customer_id')

  if (convErr || !convos) throw new Error(`Failed to insert conversations: ${convErr?.message}`)

  const lisaConvo = convos.find((c) => c.customer_id === lisa.id)!
  const emmaConvo = convos.find((c) => c.customer_id === emma.id)!
  const saraConvo = convos.find((c) => c.customer_id === sara.id)!

  // Insert messages with explicit timestamps
  const { error: msgErr } = await supabase.from('messages').insert([
    // Lisa's conversation
    {
      clinic_id: clinicId,
      conversation_id: lisaConvo.id,
      direction: 'inbound',
      author: 'customer',
      content: 'Hej! Jag skulle vilja boka en ny tid för Botox. Har ni nåt nästa vecka?',
      status: 'read',
      channel: 'sms',
      created_at: '2026-04-02T10:00:00+02:00',
    },
    {
      clinic_id: clinicId,
      conversation_id: lisaConvo.id,
      direction: 'outbound',
      author: 'ai_agent',
      content:
        'Hej Lisa! Vad kul att du vill komma tillbaka! 💕 Vi har lediga tider på torsdag kl 14 och fredag kl 10. Vilken passar dig bäst?',
      status: 'delivered',
      channel: 'sms',
      created_at: '2026-04-02T10:03:00+02:00',
    },
    {
      clinic_id: clinicId,
      conversation_id: lisaConvo.id,
      direction: 'inbound',
      author: 'customer',
      content: 'Torsdag kl 14 låter perfekt!',
      status: 'read',
      channel: 'sms',
      created_at: '2026-04-02T10:07:00+02:00',
    },
    {
      clinic_id: clinicId,
      conversation_id: lisaConvo.id,
      direction: 'outbound',
      author: 'ai_agent',
      content:
        'Toppen! Jag har bokat in dig på torsdag 17 april kl 14:00 för Botox. Kom ihåg att undvika blodförtunnande en vecka innan. Ses då! ✨',
      status: 'delivered',
      channel: 'sms',
      created_at: '2026-04-02T10:10:00+02:00',
    },
    {
      clinic_id: clinicId,
      conversation_id: lisaConvo.id,
      direction: 'inbound',
      author: 'customer',
      content: 'Tack så mycket! 🙏',
      status: 'read',
      channel: 'sms',
      created_at: '2026-04-02T10:15:00+02:00',
    },

    // Emma's conversation
    {
      clinic_id: clinicId,
      conversation_id: emmaConvo.id,
      direction: 'inbound',
      author: 'customer',
      content: 'Hej, jag har funderat på att testa fillers i läpparna. Hur funkar det hos er?',
      status: 'read',
      channel: 'sms',
      created_at: '2026-04-02T11:00:00+02:00',
    },
    {
      clinic_id: clinicId,
      conversation_id: emmaConvo.id,
      direction: 'outbound',
      author: 'clinic_staff',
      content:
        'Hej Emma! Vad roligt att du är intresserad! Vi börjar alltid med en kostnadsfri konsultation där vi går igenom dina önskemål och förväntningar. Vill du boka in en tid?',
      status: 'delivered',
      channel: 'sms',
      created_at: '2026-04-02T11:05:00+02:00',
    },
    {
      clinic_id: clinicId,
      conversation_id: emmaConvo.id,
      direction: 'inbound',
      author: 'customer',
      content: 'Ja gärna! Har ni nåt denna vecka?',
      status: 'read',
      channel: 'sms',
      created_at: '2026-04-02T11:10:00+02:00',
    },
    {
      clinic_id: clinicId,
      conversation_id: emmaConvo.id,
      direction: 'outbound',
      author: 'clinic_staff',
      content:
        'Vi har en tid på onsdag kl 11:00. Konsultationen tar ca 30 minuter. Passar det?',
      status: 'delivered',
      channel: 'sms',
      created_at: '2026-04-02T11:14:00+02:00',
    },
    {
      clinic_id: clinicId,
      conversation_id: emmaConvo.id,
      direction: 'inbound',
      author: 'customer',
      content: 'Perfekt, jag tar den!',
      status: 'delivered',
      channel: 'sms',
      created_at: '2026-04-02T11:20:00+02:00',
    },

    // Sara's conversation
    {
      clinic_id: clinicId,
      conversation_id: saraConvo.id,
      direction: 'outbound',
      author: 'ai_agent',
      content:
        'Hej Sara! Vi saknar dig hos oss 💆‍♀️ Hur mår din hud efter senaste laserbehandlingen? Vill du boka in en uppföljning?',
      status: 'delivered',
      channel: 'sms',
      created_at: '2026-03-30T14:00:00+02:00',
    },
    {
      clinic_id: clinicId,
      conversation_id: saraConvo.id,
      direction: 'inbound',
      author: 'customer',
      content:
        'Hej! Tack för att ni hör av er. Huden känns bra men jag hade inte tid senast. Kan vi boka nåt i slutet av april?',
      status: 'read',
      channel: 'sms',
      created_at: '2026-03-30T14:05:00+02:00',
    },
    {
      clinic_id: clinicId,
      conversation_id: saraConvo.id,
      direction: 'outbound',
      author: 'ai_agent',
      content: 'Absolut! Vi har bra tider vecka 17. Ska jag föreslå några alternativ? 😊',
      status: 'delivered',
      channel: 'sms',
      created_at: '2026-03-30T14:08:00+02:00',
    },
    {
      clinic_id: clinicId,
      conversation_id: saraConvo.id,
      direction: 'inbound',
      author: 'customer',
      content: 'Ja tack, gärna på en tisdag eller onsdag',
      status: 'delivered',
      channel: 'sms',
      created_at: '2026-03-30T14:12:00+02:00',
    },
  ])

  if (msgErr) throw new Error(`Failed to insert messages: ${msgErr.message}`)

  // Reset unread counts (trigger inflated them with historical data)
  await supabase
    .from('conversations')
    .update({ unread_count: 0 })
    .eq('clinic_id', clinicId)

  // Insert bookings
  const { error: bookErr } = await supabase.from('bookings').insert([
    {
      clinic_id: clinicId,
      customer_id: lisa.id,
      treatment: 'Botox',
      starts_at: '2026-04-17T14:00:00+02:00',
      ends_at: '2026-04-17T15:00:00+02:00',
      status: 'confirmed',
      provider_name: 'Dr. Sofia',
      source: 'manual',
      price: 3500,
    },
    {
      clinic_id: clinicId,
      customer_id: sara.id,
      treatment: 'Helkropp laser',
      starts_at: '2026-04-10T10:00:00+02:00',
      ends_at: '2026-04-10T11:30:00+02:00',
      status: 'cancelled',
      provider_name: 'Anna',
      source: 'email',
      price: 4500,
    },
  ])

  if (bookErr) throw new Error(`Failed to insert bookings: ${bookErr.message}`)
}
