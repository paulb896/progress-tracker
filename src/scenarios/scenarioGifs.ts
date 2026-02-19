export type ScenarioGif = { title: string; fileName: string }

export const SCENARIO_GIFS: ScenarioGif[] = [
  { title: "Create a routine, run it, and record completion history", fileName: "create-a-routine-run-it-and-record-completion-history.gif" },
  { title: "Edit a completed routine (name + exercises + images) and persist changes", fileName: "edit-a-completed-routine-name-exercises-images-and-persist-changes.gif" },
  { title: "Edit a routine and delete routine/history from home", fileName: "edit-a-routine-and-delete-routine-history-from-home.gif" },
  { title: "Start a routine, go back, and resume it from the workout bubble", fileName: "start-a-routine-go-back-and-resume-it-from-the-workout-bubble.gif" },
]

export const resolveScenarioGifUrl = (fileName: string) => import.meta.env.BASE_URL + 'scenario-gifs/' + fileName

