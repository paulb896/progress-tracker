export type SupersetPartner = {
  name: string
  weight?: number
  imageUrls?: string[]
}

export type Exercise = {
  id: string
  name: string
  imageUrls?: string[]
  sets?: number
  reps?: number
  weight?: number
  timeSeconds?: number
  supersetWith?: SupersetPartner
}

export type Routine = {
  id: string
  name: string
  exercises: Exercise[]
  createdAt: string
}
