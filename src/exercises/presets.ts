export type ExercisePreset = {
  name: string
  imageUrl?: string
}

export const EXERCISE_PRESETS: ExercisePreset[] = [
  { name: 'Lat pull down', imageUrl: 'exercises/lat-pull-down.webp' },
  { name: 'Face pull', imageUrl: 'exercises/face-pull.webp' },
  {
    name: 'Rowing machine',
    imageUrl: 'exercises/rowing-machine.webp',
  },
  { name: 'Lateral raise dumbbell', imageUrl: 'exercises/lateral-raise.webp' },
  { name: 'Shoulder press dumbbell', imageUrl: 'exercises/shoulder-press-dumbbell.webp' },
  { name: 'Shrugs dumbbell', imageUrl: 'exercises/shrugs-dumbbell.webp' },
  { name: 'Triceps cable', imageUrl: 'exercises/triceps-cable.webp' },
  { name: 'Reverse fly', imageUrl: 'exercises/reverse-fly.webp' },
  { name: 'Treadmill intervals' },
  { name: 'Quads machine', imageUrl: 'exercises/quads-machine.webp' },
  { name: 'Squat with dumbbell', imageUrl: 'exercises/squat-with-dumbbell.webp' },
  { name: 'Hams machine', imageUrl: 'exercises/seated-hamstring-curl.webp' },
  { name: 'Sumo squat', imageUrl: 'exercises/sumo-squat.webp' },
  { name: 'Hip thrust', imageUrl: 'exercises/hip-thrust.webp' },
  { name: 'Seated Calf Raise', imageUrl: 'exercises/seated-calf-raise.webp' },
  { name: 'Chest press dumbbell', imageUrl: 'exercises/chest-press-dumbbell.webp' },
  { name: 'Upper chest dumbbell', imageUrl: 'exercises/upper-chest-press.webp' },
  { name: 'Push ups', imageUrl: 'exercises/push-ups.webp' },
  { name: 'Arnold biceps', imageUrl: 'exercises/arnold-biceps.webp' },
  { name: 'Hammer biceps', imageUrl: 'exercises/bicep-curl.webp' },
  { name: 'Bench Press', imageUrl: 'exercises/bench-press.webp' },
  { name: 'Wall sit', imageUrl: 'exercises/wall-sit.webp' },
  { name: 'Superman', imageUrl: 'exercises/superman.webp' },
  { name: 'Planks', imageUrl: 'exercises/planks.webp' },
]
