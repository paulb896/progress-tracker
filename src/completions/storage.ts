import type { RoutineCompletion } from './types'

const STORAGE_KEY = 'progress-tracker:completions:v1'

type StorageShape = {
  completions: RoutineCompletion[]
}

const isString = (v: unknown): v is string => typeof v === 'string'
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString)

const isExercise = (v: unknown): boolean => {
  if (!v || typeof v !== 'object') return false
  const obj = v as Record<string, unknown>
  const imageUrls = obj.imageUrls
  const sets = obj.sets
  const reps = obj.reps
  const weight = obj.weight
  return isString(obj.id) && isString(obj.name) && (imageUrls === undefined || isStringArray(imageUrls))
    && (sets === undefined || isNumber(sets))
    && (reps === undefined || isNumber(reps))
    && (weight === undefined || isNumber(weight))
}

const isCompletion = (v: unknown): v is RoutineCompletion => {
  if (!v || typeof v !== 'object') return false
  const obj = v as Record<string, unknown>
  const exercises = obj.exercises
  return (
    isString(obj.id) &&
    isString(obj.routineId) &&
    isString(obj.routineName) &&
    isNumber(obj.exerciseCount) &&
    isString(obj.completedAt) &&
    (exercises === undefined || (Array.isArray(exercises) && exercises.every(isExercise)))
  )
}

export const loadCompletions = (): RoutineCompletion[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return []

    const shape = parsed as Partial<StorageShape>
    const completions = Array.isArray(shape.completions) ? shape.completions.filter(isCompletion) : []

    return completions.sort((a, b) => b.completedAt.localeCompare(a.completedAt))
  } catch {
    return []
  }
}

export const saveCompletions = (completions: RoutineCompletion[]) => {
  const shape: StorageShape = {
    completions,
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(shape))
}
