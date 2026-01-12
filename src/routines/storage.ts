import type { Routine } from './types'

const STORAGE_KEY = 'progress-tracker:routines:v1'

const safeParseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const isRoutine = (value: unknown): value is Routine => {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>

  if (typeof v.id !== 'string') return false
  if (typeof v.name !== 'string') return false
  if (typeof v.createdAt !== 'string') return false
  if (!Array.isArray(v.exercises)) return false

  for (const ex of v.exercises) {
    if (!ex || typeof ex !== 'object') return false
    const e = ex as Record<string, unknown>
    if (typeof e.id !== 'string') return false
    if (typeof e.name !== 'string') return false

    if (typeof e.sets !== 'undefined' && typeof e.sets !== 'number') return false
    if (typeof e.reps !== 'undefined' && typeof e.reps !== 'number') return false
    if (typeof e.weight !== 'undefined' && typeof e.weight !== 'number') return false

    if (typeof e.imageUrls === 'undefined') continue
    if (!Array.isArray(e.imageUrls)) return false
    if (!e.imageUrls.every((u) => typeof u === 'string')) return false
  }

  return true
}

export const loadRoutines = (): Routine[] => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []

  const parsed = safeParseJson(raw)
  if (!Array.isArray(parsed)) return []

  const routines = parsed.filter(isRoutine)
  // newest first
  routines.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return routines
}

export const saveRoutines = (routines: Routine[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routines))
}
