import React from 'react'
import type { RoutineCompletion } from './types'
import { loadCompletions, saveCompletions } from './storage'

export const useCompletions = () => {
  const [completions, setCompletions] = React.useState<RoutineCompletion[]>(() => loadCompletions())

  React.useEffect(() => {
    saveCompletions(completions)
  }, [completions])

  const addCompletion = (completion: RoutineCompletion) => {
    setCompletions((prev) => [completion, ...prev].sort((a, b) => b.completedAt.localeCompare(a.completedAt)))
  }

  const removeCompletion = (completionId: string) => {
    setCompletions((prev) => prev.filter((c) => c.id !== completionId))
  }

  return {
    completions,
    addCompletion,
    removeCompletion,
  }
}
