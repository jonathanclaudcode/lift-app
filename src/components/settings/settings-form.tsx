'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { updateClinicSettings } from '@/actions/clinic-settings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, AlertCircle, ImageIcon } from 'lucide-react'

interface ClinicData {
  id: string
  name: string
  phone: string | null
  address: string | null
  website: string | null
  logo_url: string | null
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Sparar...' : 'Spara inställningar'}
    </Button>
  )
}

export function SettingsForm({ clinic }: { clinic: ClinicData }) {
  const [state, formAction] = useActionState(updateClinicSettings, null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!state) return

    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    if (state.success) {
      setFeedback({ type: 'success', message: 'Inställningar sparade' })
    } else if (state.error) {
      setFeedback({ type: 'error', message: state.error })
    }

    timeoutRef.current = setTimeout(() => setFeedback(null), 5000)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [state])

  return (
    <div className="max-w-2xl">
      {feedback && (
        <Alert variant={feedback.type === 'error' ? 'destructive' : 'default'} className="mb-4">
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Klinikinformation</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Kliniknamn *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={clinic.name}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefonnummer</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={clinic.phone ?? ''}
                placeholder="+46XXXXXXXXX"
              />
              <p className="text-xs text-muted-foreground">46elks virtuellt nummer för SMS</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Adress</Label>
              <Textarea
                id="address"
                name="address"
                defaultValue={clinic.address ?? ''}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Webbplats</Label>
              <Input
                id="website"
                name="website"
                type="url"
                defaultValue={clinic.website ?? ''}
                placeholder="https://www.dinklinik.se"
              />
            </div>

            <div className="space-y-2">
              <Label>Logotyp</Label>
              {clinic.logo_url ? (
                <img
                  src={clinic.logo_url}
                  alt="Klinikens logotyp"
                  className="h-16 w-16 rounded-lg object-cover border"
                />
              ) : (
                <div className="flex items-center justify-center h-16 w-16 rounded-lg border bg-muted">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <Input type="file" accept="image/*" disabled className="max-w-xs" />
              <p className="text-xs text-muted-foreground">Logotyp-uppladdning kommer snart</p>
            </div>

            <SubmitButton />
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
