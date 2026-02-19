import React from 'react'
import type { CurrentWorkout } from './storage'
import { loadCurrentWorkout, saveCurrentWorkout } from './storage'

const cloneDoneMap = (doneByExerciseId: Record<string, boolean>): Record<string, boolean> => ({ ...doneByExerciseId })

const areDoneMapsEqual = (a: Record<string, boolean>, b: Record<string, boolean>): boolean => {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => a[key] === b[key])
}

export const useCurrentWorkout = (): {
  currentWorkout: CurrentWorkout | null
  startWorkout: (routineId: string) => void
  updateWorkoutProgress: (routineId: string, doneByExerciseId: Record<string, boolean>) => void
  clearCurrentWorkout: () => void
} => {
  const [currentWorkout, setCurrentWorkout] = React.useState<CurrentWorkout | null>(() => loadCurrentWorkout())

  React.useEffect(() => {
    saveCurrentWorkout(currentWorkout)
  }, [currentWorkout])

  const startWorkout = React.useCallback((routineId: string) => {
    setCurrentWorkout((prev) => {
      if (prev?.routineId === routineId) return prev
      return {
        routineId,
        doneByExerciseId: {},
        startedAt: new Date().toISOString(),
      }
    })
  }, [])

  const updateWorkoutProgress = React.useCallback((routineId: string, doneByExerciseId: Record<string, boolean>) => {
    setCurrentWorkout((prev) => {
      if (prev?.routineId !== routineId) {
        return {
          routineId,
          doneByExerciseId: cloneDoneMap(doneByExerciseId),
          startedAt: new Date().toISOString(),
        }
      }

      if (areDoneMapsEqual(prev.doneByExerciseId, doneByExerciseId)) {
        return prev
      }

      return {
        ...prev,
        doneByExerciseId: cloneDoneMap(doneByExerciseId),
      }
    })
  }, [])

  const clearCurrentWorkout = React.useCallback(() => {
    setCurrentWorkout(null)
  }, [])

  return { currentWorkout, startWorkout, updateWorkoutProgress, clearCurrentWorkout }
}
