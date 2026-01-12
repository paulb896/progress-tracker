export type ExercisePreset = {
  name: string
  imageUrl?: string
}

export const EXERCISE_PRESETS: ExercisePreset[] = [
  { name: 'Lat pull down', imageUrl: 'exercises/lat-pull-down.png' },
  { name: 'Face pull', imageUrl: 'exercises/face-pull.png' },
  {
    name: 'Rowing machine',
    imageUrl: 'exercises/rowing-machine.png',
  },
  { name: 'Lateral raise dumbbell', imageUrl: 'exercises/lateral-raise.png' },
  { name: 'Shoulder press dumbbell', imageUrl: 'exercises/shoulder-press-dumbbell.png' },
  { name: 'Shrugs dumbbell', imageUrl: 'exercises/shrugs-dumbbell.png' },
  { name: 'Triceps cable', imageUrl: 'exercises/triceps-cable.png' },
  { name: 'Reverse fly', imageUrl: 'exercises/reverse-fly.png' },
  { name: 'Treadmill intervals' },
  { name: 'Quads machine', imageUrl: 'exercises/quads-machine.jpg' },
  { name: 'Squat with dumbbell' },
  { name: 'Hams machine' },
  { name: 'Sumo squat' },
  { name: 'Hip thrust' },
  { name: 'Calves' },
  { name: 'Chest press dumbbell', imageUrl: 'exercises/chest-press-dumbbell.jpg' },
  { name: 'Upper chest dumbbell' },
  { name: 'Push ups on knee' },
  { name: 'Arnold biceps' },
  { name: 'Hammer biceps', imageUrl: 'exercises/hammer-biceps.png' },
  { name: 'Chest press barbell' },
  { name: 'Wall sit', imageUrl: 'exercises/wall-sit.jpg' },
]
