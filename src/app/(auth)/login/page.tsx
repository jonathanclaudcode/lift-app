'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Mail, Loader2 } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam === 'setup_failed') {
      setError('Något gick fel vid kontoskapandet. Försök igen.')
    } else if (errorParam === 'auth_failed') {
      setError('Inloggningslänken har gått ut. Försök igen.')
    }

    async function checkUser() {
      const { data } = await supabase.auth.getUser()
      if (data.user?.app_metadata?.clinic_id) {
        router.push('/dashboard')
      } else {
        setChecking(false)
      }
    }
    checkUser()
  }, [searchParams, router, supabase.auth])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + '/auth/callback',
      },
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (checking) {
    return (
      <div className="w-full max-w-md p-4">
        <Card>
          <CardHeader className="text-center">
            <Skeleton className="h-9 w-24 mx-auto" />
            <Skeleton className="h-5 w-48 mx-auto mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full mt-4" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md p-4">
      <Card>
        <CardHeader className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">LIFT</h1>
          <p className="text-muted-foreground">AI-assistent för skönhetskliniker</p>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <Mail className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm">
                Kolla din inbox! Vi har skickat en inloggningslänk till{' '}
                <span className="font-medium">{email}</span>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                placeholder="din@email.se"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Skicka magisk länk'
                )}
              </Button>
            </form>
          )}
          {error && <p className="text-sm text-destructive mt-4 text-center">{error}</p>}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground text-center mt-4">
        Genom att logga in godkänner du våra villkor
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div />}>
      <LoginForm />
    </Suspense>
  )
}
