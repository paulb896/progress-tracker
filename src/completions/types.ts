import type { Exercise } from '../routines/types'

export type RoutineCompletion = {
  id: string
  routineId: string
  routineName: string
  exerciseCount: number
  exercises?: Exercise[]
  completedAt: string
}
