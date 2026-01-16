export const formatDuration = (seconds: number | undefined): string => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '—'

  const total = Math.max(0, Math.trunc(seconds))
  if (total === 0) return '—'

  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}
