export type Exercise = {
  id: string
  name: string
  imageUrls?: string[]
}

export type Routine = {
  id: string
  name: string
  exercises: Exercise[]
  createdAt: string
}
