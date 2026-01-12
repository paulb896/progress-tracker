export type Exercise = {
  id: string
  name: string
  imageUrls?: string[]
  sets?: number
  reps?: number
  weight?: number
}

export type Routine = {
  id: string
  name: string
  exercises: Exercise[]
  createdAt: string
}
