import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[50vh]">
      <div className="space-y-4 w-full max-w-md">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="grid grid-cols-2 gap-4 mt-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    </div>
  )
}
