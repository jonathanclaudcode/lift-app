'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Phone, Mail, Calendar, FileText } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

const stageLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  new: { label: 'Ny kund', variant: 'secondary' },
  consultation_booked: { label: 'Konsultation bokad', variant: 'outline' },
  treated: { label: 'Behandlad', variant: 'default' },
  follow_up_due: { label: 'Uppföljning', variant: 'destructive' },
  loyal: { label: 'Stamkund', variant: 'default' },
}

export default function CustomerProfile({
  customerId,
  open,
  onOpenChange,
}: {
  customerId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single()
      return data
    },
    enabled: open && !!customerId,
  })

  const stage = customer?.pipeline_stage ? stageLabels[customer.pipeline_stage] : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 sm:w-96">
        <SheetHeader>
          <SheetTitle>Kundprofil</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4 mt-6">
            <Skeleton className="h-16 w-16 rounded-full mx-auto" />
            <Skeleton className="h-5 w-32 mx-auto" />
            <Skeleton className="h-4 w-24 mx-auto" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : customer ? (
          <div className="mt-6">
            <div className="flex flex-col items-center">
              <Avatar className="h-16 w-16 text-xl">
                <AvatarFallback>
                  {customer.name
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <p className="text-lg font-semibold text-center mt-2">{customer.name}</p>
              {stage && (
                <Badge variant={stage.variant} className="mt-1">
                  {stage.label}
                </Badge>
              )}
            </div>

            <Separator className="my-4" />

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{customer.phone || 'Inget nummer'}</span>
              </div>
              {customer.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{customer.email}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>
                  Senaste besök:{' '}
                  {customer.last_visit_at
                    ? new Date(customer.last_visit_at).toLocaleDateString('sv-SE')
                    : 'Inget besök ännu'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{customer.treatment_count || 0} behandlingar</span>
              </div>
            </div>

            {customer.notes && (
              <>
                <Separator className="my-4" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Anteckningar
                </p>
                <p className="text-sm">{customer.notes}</p>
              </>
            )}

            {customer.skin_type && (
              <>
                <Separator className="my-4" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Hudtyp
                </p>
                <p className="text-sm">{customer.skin_type}</p>
              </>
            )}

            {customer.allergies && customer.allergies.length > 0 && (
              <>
                <Separator className="my-4" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Allergier
                </p>
                <div className="flex gap-1 flex-wrap">
                  {customer.allergies.map((allergy: string) => (
                    <Badge key={allergy} variant="destructive">
                      {allergy}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
