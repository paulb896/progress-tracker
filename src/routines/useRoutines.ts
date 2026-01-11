import React from 'react'
import type { Routine } from './types'
import { loadRoutines, saveRoutines } from './storage'

export const useRoutines = (): {
  routines: Routine[]
  setRoutines: React.Dispatch<React.SetStateAction<Routine[]>>
  upsertRoutine: (routine: Routine) => void
  deleteRoutine: (routineId: string) => void
} => {
  const [routines, setRoutines] = React.useState<Routine[]>(() => loadRoutines())

  React.useEffect(() => {
    saveRoutines(routines)
  }, [routines])

  const upsertRoutine = React.useCallback(
    (routine: Routine) => {
      setRoutines((prev) => {
        const existingIndex = prev.findIndex((r) => r.id === routine.id)
        const next = [...prev]
        if (existingIndex >= 0) next[existingIndex] = routine
        else next.unshift(routine)
        next.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        return next
      })
    },
    [setRoutines]
  )

  const deleteRoutine = React.useCallback(
    (routineId: string) => {
      setRoutines((prev) => prev.filter((r) => r.id !== routineId))
    },
    [setRoutines]
  )

  return { routines, setRoutines, upsertRoutine, deleteRoutine }
}
