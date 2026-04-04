export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return ''
  const now = new Date()
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'just nu'
  if (diffMin < 60) return `${diffMin} min sedan`
  if (diffHour < 24) return `${diffHour} tim sedan`
  if (diffDay === 1) return 'igår'
  if (diffDay < 7) {
    return d.toLocaleDateString('sv-SE', { weekday: 'long' })
  }
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

export function formatMessageTime(date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

export function formatDateLabel(date: string | Date): string {
  const d = new Date(date)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000)

  if (diffDays === 0) return 'Idag'
  if (diffDays === 1) return 'Igår'

  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
  }
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function getDateKey(date: string | Date): string {
  const d = new Date(date)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
