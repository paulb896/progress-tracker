export type MuscleGroup = 
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Biceps'
  | 'Triceps'
  | 'Quads'
  | 'Hamstrings'
  | 'Glutes'
  | 'Calves'
  | 'Core'

export type ExercisePreset = {
  name: string
  imageUrl?: string
  muscles?: MuscleGroup[]
}

export const EXERCISE_PRESETS: ExercisePreset[] = [
  { name: 'Lat pull down', imageUrl: 'exercises/lat-pull-down.webp', muscles: ['Back', 'Biceps'] },
  { name: 'Face pull', imageUrl: 'exercises/face-pull.webp', muscles: ['Shoulders', 'Back'] },
  { name: 'Face pull isometric', imageUrl: 'exercises/face-pull.webp', muscles: ['Shoulders', 'Back'] },
  {
    name: 'Rowing machine',
    imageUrl: 'exercises/rowing-machine.webp',
    muscles: ['Back']
  },
  { name: 'Lateral raise dumbbell', imageUrl: 'exercises/lateral-raise.webp', muscles: ['Shoulders'] },
  { name: 'Shoulder press dumbbell', imageUrl: 'exercises/shoulder-press-dumbbell.webp', muscles: ['Shoulders', 'Triceps'] },
  { name: 'Shrugs dumbbell', imageUrl: 'exercises/shrugs-dumbbell.webp', muscles: ['Back', 'Shoulders'] },
  { name: 'Triceps cable', imageUrl: 'exercises/triceps-cable.webp', muscles: ['Triceps'] },
  { name: 'Reverse fly', imageUrl: 'exercises/reverse-fly.webp', muscles: ['Back', 'Shoulders'] },
  { name: 'Treadmill intervals', muscles: ['Quads', 'Hamstrings', 'Calves'] },
  { name: 'Quads machine', imageUrl: 'exercises/quads-machine.webp', muscles: ['Quads'] },
  { name: 'Squat with dumbbell', imageUrl: 'exercises/squat-with-dumbbell.webp', muscles: ['Quads', 'Glutes', 'Hamstrings'] },
  { name: 'Hams machine', imageUrl: 'exercises/seated-hamstring-curl.webp', muscles: ['Hamstrings'] },
  { name: 'Sumo squat', imageUrl: 'exercises/sumo-squat.webp', muscles: ['Quads', 'Glutes', 'Hamstrings'] },
  { name: 'Hip thrust', imageUrl: 'exercises/hip-thrust.webp', muscles: ['Glutes', 'Hamstrings'] },
  { name: 'Seated Calf Raise', imageUrl: 'exercises/seated-calf-raise.webp', muscles: ['Calves'] },
  { name: 'Chest press dumbbell', imageUrl: 'exercises/chest-press-dumbbell.webp', muscles: ['Chest', 'Triceps', 'Shoulders'] },
  { name: 'Upper chest dumbbell', imageUrl: 'exercises/upper-chest-press.webp', muscles: ['Chest', 'Triceps', 'Shoulders'] },
  { name: 'Push ups', imageUrl: 'exercises/push-ups.webp', muscles: ['Chest', 'Triceps', 'Shoulders', 'Core'] },
  { name: 'Arnold biceps', imageUrl: 'exercises/arnold-biceps.webp', muscles: ['Biceps'] },
  { name: 'Hammer biceps', imageUrl: 'exercises/bicep-curl.webp', muscles: ['Biceps'] },
  { name: 'Bench Press', imageUrl: 'exercises/bench-press.webp', muscles: ['Chest', 'Triceps', 'Shoulders'] },
  { name: 'Wall sit', imageUrl: 'exercises/wall-sit.webp', muscles: ['Quads', 'Core'] },
  { name: 'Superman', imageUrl: 'exercises/superman.webp', muscles: ['Back', 'Glutes'] },
  { name: 'Planks', imageUrl: 'exercises/planks.webp', muscles: ['Core'] },
  { name: 'Dumbbell row', imageUrl: 'exercises/dumbbell-row.webp', muscles: ['Back', 'Biceps'] },
  { name: 'Pullover cable', imageUrl: 'exercises/pullover-cable.jpg', muscles: ['Back', 'Chest'] },
  { name: 'Seated row isometric', imageUrl: 'exercises/rowing-machine.webp', muscles: ['Back', 'Biceps'] },
  { name: 'Lateral raise + Frontal raise super set', imageUrl: 'exercises/lateral-raise.webp', muscles: ['Shoulders'] },
  { name: 'Shoulder press + Reverse fly super set', imageUrl: 'exercises/shoulder-press-dumbbell.webp', muscles: ['Shoulders', 'Back', 'Triceps'] },
  { name: 'Overhead triceps cable', imageUrl: 'exercises/triceps-cable.webp', muscles: ['Triceps'] },
  { name: 'Step Ups', imageUrl: 'exercises/step-ups.webp', muscles: ['Quads', 'Hamstrings'] },
  { name: 'Squats with Smith', imageUrl: 'exercises/squats-with-smith.webp', muscles: ['Quads', 'Hamstrings'] },
  { name: 'reverse fly + face pull super set', imageUrl: 'exercises/reverse-fly.webp', muscles: ['Back', 'Shoulders']},
  { name: 'Biceps with Barbell', imageUrl: 'exercises/biceps-with-barbell.webp', muscles: ['Biceps']},
  { name: 'Chest Press Parallel', imageUrl: 'exercises/chest-press-parallel.webp', muscles: ['Chest', 'Triceps', 'Shoulders']},
  { name: 'Standing Biceps with Dumbbell', imageUrl: 'exercises/standing-biceps-with-dumbbell.webp', muscles: ['Biceps']},
  { name: 'Standing Saw', imageUrl: 'exercises/standing-saw.png', muscles: ['Core']},
]
