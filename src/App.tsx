import './App.css'
import { ThreeDemo } from './ThreeDemo'
import { usePathRoute } from './app/usePathRoute'
import { HomeView } from './screens/HomeView'
import { CreateRoutineView } from './screens/CreateRoutineView'
import { RunRoutineView } from './screens/RunRoutineView'
import { CompletionDetailView } from './screens/CompletionDetailView'
import { useRoutines } from './routines/useRoutines'
import { useCompletions } from './completions/useCompletions'
import { makeId } from './routines/id'

function App() {
  const { route, navigate } = usePathRoute()
  const { routines, upsertRoutine, deleteRoutine } = useRoutines()
  const { completions, addCompletion, removeCompletion } = useCompletions()

  const routineForRun = route.name === 'run' ? routines.find((r) => r.id === route.routineId) ?? null : null
  const routineForEdit = route.name === 'edit' ? routines.find((r) => r.id === route.routineId) ?? null : null
  const completionHistoryForEdit = routineForEdit ? completions.filter((c) => c.routineId === routineForEdit.id) : []
  const completionForView =
    route.name === 'completed' ? completions.find((c) => c.id === route.completionId) ?? null : null

  return (
    <div className="app">
      {route.name === 'home' ? (
        <HomeView
          routines={routines}
          completions={completions}
          onCreate={() => navigate({ name: 'create' })}
          onEdit={(routineId) => navigate({ name: 'edit', routineId })}
          onRun={(routineId) => navigate({ name: 'run', routineId })}
          onViewCompletion={(completionId) => navigate({ name: 'completed', completionId })}
          onDeleteCompletion={(completionId) => removeCompletion(completionId)}
          onDelete={(routineId) => {
            deleteRoutine(routineId)
            navigate({ name: 'home' })
          }}
          headerRight={
            <div className="headerCube" aria-label="3D lifting weight demo">
              <ThreeDemo />
            </div>
          }
        />
      ) : null}

      {route.name === 'create' ? (
        <main className="content">
          <CreateRoutineView
            onCancel={() => navigate({ name: 'home' })}
            onSave={(routine) => {
              upsertRoutine(routine)
              navigate({ name: 'run', routineId: routine.id })
            }}
          />
        </main>
      ) : null}

      {route.name === 'edit' ? (
        <main className="content">
          {routineForEdit ? (
            <CreateRoutineView
              initialRoutine={routineForEdit}
              completionHistory={completionHistoryForEdit}
              onCancel={() => navigate({ name: 'home' })}
              onSave={(routine) => {
                upsertRoutine(routine)
                navigate({ name: 'run', routineId: routine.id })
              }}
            />
          ) : (
            <div className="panel">
              <div className="panelTitleRow">
                <div className="panelTitle">Routine not found</div>
                <button type="button" className="button secondary" onClick={() => navigate({ name: 'home' })}>
                  Back
                </button>
              </div>
              <div className="panelBody">
                <div className="empty">That routine may have been deleted.</div>
              </div>
            </div>
          )}
        </main>
      ) : null}

      {route.name === 'run' ? (
        <main className="content">
          {routineForRun ? (
            <RunRoutineView
              routine={routineForRun}
              onBack={() => navigate({ name: 'home' })}
              onComplete={() => {
                addCompletion({
                  id: makeId(),
                  routineId: routineForRun.id,
                  routineName: routineForRun.name,
                  exerciseCount: routineForRun.exercises.length,
                  exercises: routineForRun.exercises,
                  completedAt: new Date().toISOString(),
                })
                navigate({ name: 'home' })
              }}
              onUpdateRoutine={(nextRoutine) => upsertRoutine(nextRoutine)}
            />
          ) : (
            <div className="panel">
              <div className="panelTitleRow">
                <div className="panelTitle">Routine not found</div>
                <button type="button" className="button secondary" onClick={() => navigate({ name: 'home' })}>
                  Back
                </button>
              </div>
              <div className="panelBody">
                <div className="empty">That routine may have been deleted.</div>
              </div>
            </div>
          )}
        </main>
      ) : null}

      {route.name === 'completed' ? (
        <main className="content">
          {completionForView ? (
            <CompletionDetailView
              completion={completionForView}
              onBack={() => navigate({ name: 'home' })}
              onDelete={(completionId) => {
                removeCompletion(completionId)
                navigate({ name: 'home' })
              }}
            />
          ) : (
            <div className="panel">
              <div className="panelTitleRow">
                <div className="panelTitle">Completion not found</div>
                <button type="button" className="button secondary" onClick={() => navigate({ name: 'home' })}>
                  Back
                </button>
              </div>
              <div className="panelBody">
                <div className="empty">That completion may have been cleared from local history.</div>
              </div>
            </div>
          )}
        </main>
      ) : null}
    </div>
  )
}

export default App
