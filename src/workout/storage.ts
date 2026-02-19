export type CurrentWorkout = {
  routineId: string
  doneByExerciseId: Record<string, boolean>
  startedAt: string
}

const STORAGE_KEY = 'progress-tracker:current-workout:v1'

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'

const isDoneMap = (value: unknown): value is Record<string, boolean> => {
  if (!isRecord(value)) return false
  return Object.values(value).every((entry) => typeof entry === 'boolean')
}

export const loadCurrentWorkout = (): CurrentWorkout | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) return null

    const routineId = parsed.routineId
    const doneByExerciseId = parsed.doneByExerciseId
    const startedAt = parsed.startedAt

    if (typeof routineId !== 'string' || !routineId) return null
    if (!isDoneMap(doneByExerciseId)) return null
    if (typeof startedAt !== 'string' || !startedAt) return null

    return { routineId, doneByExerciseId, startedAt }
  } catch {
    return null
  }
}

export const saveCurrentWorkout = (workout: CurrentWorkout | null): void => {
  if (!workout) {
    window.localStorage.removeItem(STORAGE_KEY)
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workout))
}
