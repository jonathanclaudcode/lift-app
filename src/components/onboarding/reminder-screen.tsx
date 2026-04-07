'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface ReminderScreenProps {
  aiName: string
}

export function ReminderScreen({ aiName }: ReminderScreenProps) {
  const router = useRouter()

  return (
    <div className="py-8">
      <h2 className="text-xl font-medium mb-5">
        Innan vi börjar — en viktig sak om {aiName}
      </h2>

      <p className="text-sm leading-relaxed mb-4">
        {aiName} är inte ett AI-verktyg eller en chatbot som ChatGPT. Det är en riktig anställd. En AI-agent som jobbar för din klinik varje dag. Du chattar med {aiName} på WhatsApp precis som du chattar med en vanlig person. Skickar textmeddelanden, röstnotiser, bilder — precis som du gör med alla andra.
      </p>

      <p className="text-sm leading-relaxed mb-4">
        Skillnaden mot en vanlig anställd? {aiName} sover aldrig. {aiName} är aldrig sjuk. {aiName} är tillgänglig precis när du behöver, oavsett om det är klockan 7 på morgonen eller 11 på kvällen. Och det bästa — {aiName} är personlig för just din verksamhet. Desto mer du kommunicerar med {aiName}, desto mer lär {aiName} sig själv. {aiName} kan till och med ta egna initiativ baserat på just din specifika verksamhet.
      </p>

      <Separator className="my-4" />

      <p className="text-sm leading-relaxed font-medium mb-6">
        Glöm inte det här när du svarar på frågorna. Ge allt i det här formuläret för att ge {aiName} en riktig chans. Det här är framtiden och kan verkligen förändra så otroligt mycket för dig och din klinik. Så ge det en ärlig chans — för det är så värt det.
      </p>

      <Button onClick={() => router.push('/onboarding/q1')} className="w-full" size="lg">
        Jag är redo — låt oss köra
      </Button>
    </div>
  )
}
