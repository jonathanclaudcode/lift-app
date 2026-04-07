'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { getScrapingStatus } from '@/actions/onboarding'
import type { ScrapedTreatment, ScrapedStaff } from '@/lib/scraping/scrape-clinic'

interface ScrapingResultData {
  data: {
    clinic_name: string | null
    treatments: ScrapedTreatment[]
    staff: ScrapedStaff[]
    opening_hours: string | null
    policies: {
      cancellation: string | null
      consultation: string | null
      payment: string | null
    }
    booking_url: string | null
  }
  url: string
  pages_scraped: number
  urls_scraped: string[]
}

interface ReviewPageProps {
  clinicId: string
  aiName: string
  initialStatus: 'pending' | 'in_progress' | 'success' | 'failed' | null
  initialResult: unknown
  initialError: string | null
}

const LOADING_MESSAGES = [
  'Letar efter dina behandlingar...',
  'Hittar din personal...',
  'Läser dina priser...',
  'Kollar öppettider...',
  'Sammanställer all info...',
]

const MAX_POLL_ATTEMPTS = 40 // 40 × 3s = 120s total
const POLL_INTERVAL_MS = 3000

export function ReviewPage({
  clinicId,
  aiName,
  initialStatus,
  initialResult,
  initialError,
}: ReviewPageProps) {
  const router = useRouter()
  const [status, setStatus] = useState<
    'pending' | 'in_progress' | 'success' | 'failed' | 'timed_out' | null
  >(initialStatus)
  const [scrapeData, setScrapeData] = useState<ScrapingResultData | null>(
    initialResult as ScrapingResultData | null
  )
  const [error, setError] = useState(initialError)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const pollCountRef = useRef(0)

  const [selectedTreatments, setSelectedTreatments] = useState<Set<number>>(new Set())
  const [selectedStaff, setSelectedStaff] = useState<Set<number>>(new Set())
  const [includeHours, setIncludeHours] = useState(true)
  const [includeCancellation, setIncludeCancellation] = useState(true)
  const [includeConsultation, setIncludeConsultation] = useState(true)
  const [includePayment, setIncludePayment] = useState(true)
  const [includeBooking, setIncludeBooking] = useState(true)

  // Initialize selections when result loads
  useEffect(() => {
    if (scrapeData?.data) {
      setSelectedTreatments(new Set(scrapeData.data.treatments.map((_, i) => i)))
      setSelectedStaff(new Set(scrapeData.data.staff.map((_, i) => i)))
    }
  }, [scrapeData])

  // Cycle loading messages
  useEffect(() => {
    if (status !== 'pending' && status !== 'in_progress') return
    const interval = setInterval(() => {
      setLoadingMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [status])

  // Poll for status changes
  const pollStatus = useCallback(async () => {
    pollCountRef.current += 1
    if (pollCountRef.current > MAX_POLL_ATTEMPTS) {
      setStatus('timed_out')
      return
    }

    const pollResult = await getScrapingStatus()
    if (pollResult.status === 'success') {
      setStatus('success')
      setScrapeData(pollResult.result as ScrapingResultData)
    } else if (pollResult.status === 'failed') {
      setStatus('failed')
      setError(pollResult.error || 'Scraping misslyckades')
    } else if (pollResult.status) {
      setStatus(pollResult.status)
    }
  }, [])

  useEffect(() => {
    if (status === 'success' || status === 'failed' || status === 'timed_out') return
    const interval = setInterval(pollStatus, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [status, pollStatus])

  function toggleTreatment(i: number) {
    const next = new Set(selectedTreatments)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    setSelectedTreatments(next)
  }

  function toggleStaff(i: number) {
    const next = new Set(selectedStaff)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    setSelectedStaff(next)
  }

  async function handleConfirm() {
    if (!scrapeData) return
    setSubmitting(true)
    setConfirmError(null)

    const confirmed = {
      treatments: scrapeData.data.treatments.filter((_, i) => selectedTreatments.has(i)),
      staff: scrapeData.data.staff.filter((_, i) => selectedStaff.has(i)),
      opening_hours: includeHours ? scrapeData.data.opening_hours : null,
      policies: {
        cancellation: includeCancellation ? scrapeData.data.policies.cancellation : null,
        consultation: includeConsultation ? scrapeData.data.policies.consultation : null,
        payment: includePayment ? scrapeData.data.policies.payment : null,
      },
      booking_url: includeBooking ? scrapeData.data.booking_url : null,
    }

    try {
      const response = await fetch('/api/scrape/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId,
          sourceUrl: scrapeData.url,
          confirmed,
        }),
        signal: AbortSignal.timeout(30_000),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Kunde inte spara')
      }

      router.push('/onboarding/complete')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Kunde inte spara'
      setConfirmError(msg)
      setSubmitting(false)
    }
  }

  function handleSkip() {
    router.push('/onboarding/complete')
  }

  // ----- Loading state -----
  if (status === 'pending' || status === 'in_progress' || status === null) {
    return (
      <div className="py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
          <Loader2 className="h-7 w-7 text-primary animate-spin" />
        </div>
        <h2 className="text-xl font-medium mb-2">{aiName} läser din hemsida</h2>
        <p className="text-sm text-muted-foreground mb-6">{LOADING_MESSAGES[loadingMsgIndex]}</p>
        <p className="text-xs text-muted-foreground">Detta brukar ta 30-90 sekunder</p>
      </div>
    )
  }

  // ----- Timed out state -----
  if (status === 'timed_out') {
    return (
      <div className="py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-5">
          <AlertCircle className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-medium mb-2">Det tar längre tid än väntat</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {aiName} jobbar fortfarande med din hemsida i bakgrunden. Du kan fortsätta utan
          att vänta — vi sparar resultatet automatiskt när det är klart.
        </p>
        <Button onClick={handleSkip} className="w-full" size="lg">
          Fortsätt ändå
        </Button>
      </div>
    )
  }

  // ----- Failed state -----
  if (status === 'failed') {
    return (
      <div className="py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-5">
          <AlertCircle className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-medium mb-2">Vi kunde inte läsa din hemsida</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {error ||
            'Något gick fel. Du kan fortsätta utan att vi läser hemsidan — du kan alltid lägga till information manuellt senare.'}
        </p>
        <Button onClick={handleSkip} className="w-full" size="lg">
          Fortsätt ändå
        </Button>
      </div>
    )
  }

  // ----- Success state -----
  if (status === 'success' && scrapeData) {
    const hasPolicies =
      !!scrapeData.data.policies.cancellation ||
      !!scrapeData.data.policies.consultation ||
      !!scrapeData.data.policies.payment

    return (
      <div className="py-6">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-xl font-medium mb-1">Här är vad {aiName} hittade</h2>
          {scrapeData.data.clinic_name && (
            <p className="text-sm text-muted-foreground mb-1">
              Klinik: <span className="font-medium">{scrapeData.data.clinic_name}</span>
            </p>
          )}
          <p className="text-sm text-muted-foreground">Avmarkera det som inte stämmer</p>
        </div>

        {scrapeData.data.treatments.length > 0 && (
          <Card className="mb-4">
            <CardContent className="pt-4">
              <h3 className="font-medium text-sm mb-3">
                Behandlingar ({scrapeData.data.treatments.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {scrapeData.data.treatments.map((t, i) => (
                  <label
                    key={i}
                    className="flex items-start gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedTreatments.has(i)}
                      onCheckedChange={() => toggleTreatment(i)}
                      className="mt-1"
                    />
                    <div className="text-sm flex-1">
                      <div>{t.name}</div>
                      {t.price_sek !== null && (
                        <div className="text-xs text-muted-foreground">
                          {t.price_type === 'from' && 'från '}
                          {t.price_sek.toLocaleString('sv-SE')} kr
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {scrapeData.data.staff.length > 0 && (
          <Card className="mb-4">
            <CardContent className="pt-4">
              <h3 className="font-medium text-sm mb-3">
                Personal ({scrapeData.data.staff.length})
              </h3>
              <div className="space-y-2">
                {scrapeData.data.staff.map((s, i) => (
                  <label key={i} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedStaff.has(i)}
                      onCheckedChange={() => toggleStaff(i)}
                    />
                    <div className="text-sm">
                      {s.name}
                      {s.role && <span className="text-muted-foreground"> — {s.role}</span>}
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {scrapeData.data.opening_hours && (
          <Card className="mb-4">
            <CardContent className="pt-4">
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={includeHours}
                  onCheckedChange={(v) => setIncludeHours(v === true)}
                  className="mt-1"
                />
                <div className="text-sm flex-1">
                  <div className="font-medium mb-1">Öppettider</div>
                  <div className="text-xs text-muted-foreground">
                    {scrapeData.data.opening_hours}
                  </div>
                </div>
              </label>
            </CardContent>
          </Card>
        )}

        {hasPolicies && (
          <Card className="mb-4">
            <CardContent className="pt-4">
              <h3 className="font-medium text-sm mb-3">Policies</h3>
              <div className="space-y-2">
                {scrapeData.data.policies.cancellation && (
                  <label className="flex items-start gap-2 cursor-pointer">
                    <Checkbox
                      checked={includeCancellation}
                      onCheckedChange={(v) => setIncludeCancellation(v === true)}
                      className="mt-1"
                    />
                    <div className="text-sm flex-1">
                      <div className="font-medium mb-1">Avbokning</div>
                      <div className="text-xs text-muted-foreground">
                        {scrapeData.data.policies.cancellation}
                      </div>
                    </div>
                  </label>
                )}
                {scrapeData.data.policies.consultation && (
                  <label className="flex items-start gap-2 cursor-pointer">
                    <Checkbox
                      checked={includeConsultation}
                      onCheckedChange={(v) => setIncludeConsultation(v === true)}
                      className="mt-1"
                    />
                    <div className="text-sm flex-1">
                      <div className="font-medium mb-1">Konsultation</div>
                      <div className="text-xs text-muted-foreground">
                        {scrapeData.data.policies.consultation}
                      </div>
                    </div>
                  </label>
                )}
                {scrapeData.data.policies.payment && (
                  <label className="flex items-start gap-2 cursor-pointer">
                    <Checkbox
                      checked={includePayment}
                      onCheckedChange={(v) => setIncludePayment(v === true)}
                      className="mt-1"
                    />
                    <div className="text-sm flex-1">
                      <div className="font-medium mb-1">Betalning</div>
                      <div className="text-xs text-muted-foreground">
                        {scrapeData.data.policies.payment}
                      </div>
                    </div>
                  </label>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {scrapeData.data.booking_url && (
          <Card className="mb-4">
            <CardContent className="pt-4">
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={includeBooking}
                  onCheckedChange={(v) => setIncludeBooking(v === true)}
                  className="mt-1"
                />
                <div className="text-sm flex-1">
                  <div className="font-medium mb-1">Bokningssida</div>
                  <div className="text-xs text-muted-foreground break-all">
                    {scrapeData.data.booking_url}
                  </div>
                </div>
              </label>
            </CardContent>
          </Card>
        )}

        <Button
          onClick={handleConfirm}
          disabled={submitting}
          className="w-full"
          size="lg"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Bekräfta och fortsätt'
          )}
        </Button>

        {confirmError && (
          <p className="text-sm text-destructive mt-3 text-center">{confirmError}</p>
        )}

        <button
          type="button"
          onClick={handleSkip}
          className="w-full text-sm text-muted-foreground hover:text-foreground mt-3 py-2"
        >
          Hoppa över
        </button>
      </div>
    )
  }

  // Fallback
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-muted-foreground">Laddar...</p>
    </div>
  )
}
