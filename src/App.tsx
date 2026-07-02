import React from 'react'
import './App.css'
import { ThreeDemo } from './ThreeDemo'
import { usePathRoute } from './app/usePathRoute'
import { HomeView } from './screens/HomeView'
import { HowToView } from './screens/HowToView'
import { StatsView } from './screens/StatsView'
import { CreateRoutineView } from './screens/CreateRoutineView'
import { RunRoutineView } from './screens/RunRoutineView'
import { CompletionDetailView } from './screens/CompletionDetailView'
import { useRoutines } from './routines/useRoutines'
import { useCompletions } from './completions/useCompletions'
import { makeId } from './routines/id'
import { ScenarioGifCursor } from './components/ScenarioGifCursor'
import { useCurrentWorkout } from './workout/useCurrentWorkout'

const ThemeToggle = ({ theme, onToggle }: { theme: 'light' | 'dark'; onToggle: () => void }) => {
  return (
    <button
      type="button"
      className="themeToggleBtn"
      onClick={onToggle}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
    >
      {theme === 'light' ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
        </svg>
      )}
    </button>
  )
}

function App() {
  const { route, navigate } = usePathRoute()
  const { routines, upsertRoutine, deleteRoutine } = useRoutines()
  const { completions, addCompletion, removeCompletion, updateCompletion } = useCompletions()
  const { currentWorkout, startWorkout, updateWorkoutProgress, clearCurrentWorkout } = useCurrentWorkout()

  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)

    const isAutomated = typeof navigator !== 'undefined' && navigator.webdriver
    if (isAutomated) {
      document.documentElement.classList.add('is-automated')
    }
  }, [theme])

  const toggleTheme = React.useCallback(() => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    const isAutomated = typeof navigator !== 'undefined' && navigator.webdriver
    if (!isAutomated && (document as any).startViewTransition) {
      (document as any).startViewTransition(() => {
        setTheme(nextTheme)
      })
    } else {
      setTheme(nextTheme)
    }
  }, [theme])

  const routineForRun = route.name === 'run' ? routines.find((r) => r.id === route.routineId) ?? null : null
  const routineForEdit = route.name === 'edit' ? routines.find((r) => r.id === route.routineId) ?? null : null
  const activeWorkoutRoutine = currentWorkout ? routines.find((r) => r.id === currentWorkout.routineId) ?? null : null
  const completionHistoryForEdit = routineForEdit ? completions.filter((c) => c.routineId === routineForEdit.id) : []
  const completionForView =
    route.name === 'completed' ? completions.find((c) => c.id === route.completionId) ?? null : null

  const isWide = route.name === 'run'
  const activeWorkoutDoneCount = activeWorkoutRoutine
    ? activeWorkoutRoutine.exercises.reduce((acc, ex) => acc + (currentWorkout?.doneByExerciseId[ex.id] ? 1 : 0), 0)
    : 0
  const activeWorkoutTotalCount = activeWorkoutRoutine?.exercises.length ?? 0
  const showActiveWorkoutBubble =
    route.name !== 'run' &&
    route.name !== 'edit' &&
    route.name !== 'create' &&
    !!activeWorkoutRoutine

  const cancelCurrentWorkout = React.useCallback(() => {
    clearCurrentWorkout()
    navigate({ name: 'home' })
  }, [clearCurrentWorkout, navigate])

  React.useEffect(() => {
    if (route.name !== 'run') return

    if (routineForRun) {
      startWorkout(routineForRun.id)
      return
    }

    if (currentWorkout?.routineId === route.routineId) {
      clearCurrentWorkout()
    }
  }, [clearCurrentWorkout, currentWorkout, route, routineForRun, startWorkout])

  React.useEffect(() => {
    if (currentWorkout && !activeWorkoutRoutine) {
      clearCurrentWorkout()
    }
  }, [activeWorkoutRoutine, clearCurrentWorkout, currentWorkout])

  return (
    <div className={`app ${isWide ? 'app--wide' : ''}`}>
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      <ScenarioGifCursor />
      {route.name === 'home' ? (
        <HomeView
          routines={routines}
          completions={completions}
          onCreate={() => navigate({ name: 'create' })}
          onHowTo={() => navigate({ name: 'howto' })}
          onStats={() => navigate({ name: 'stats' })}
          onEdit={(routineId) => navigate({ name: 'edit', routineId })}
          onRun={(routineId) => navigate({ name: 'run', routineId })}
          onViewCompletion={(completionId) => navigate({ name: 'completed', completionId })}
          onDelete={(routineId) => {
            deleteRoutine(routineId)
            if (currentWorkout?.routineId === routineId) {
              clearCurrentWorkout()
            }
            navigate({ name: 'home' })
          }}
          headerRight={
            !(window as any).__PROGRESS_TRACKER_SCENARIO_GIF__ ? (
              <div className="headerCube" aria-label="3D lifting weight demo">
                <ThreeDemo theme={theme} />
              </div>
            ) : null
          }
        />
      ) : null}

      {route.name === 'howto' ? (
        <main className="content">
          <HowToView onBack={() => navigate({ name: 'home' })} />
        </main>
      ) : null}

      {route.name === 'stats' ? (
        <main className="content">
          <StatsView
            completions={completions}
            onBack={() => navigate({ name: 'home' })}
            onViewCompletion={(completionId) => navigate({ name: 'completed', completionId })}
          />
        </main>
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
              onCancelWorkout={cancelCurrentWorkout}
              onComplete={() => {
                addCompletion({
                  id: makeId(),
                  routineId: routineForRun.id,
                  routineName: routineForRun.name,
                  exerciseCount: routineForRun.exercises.length,
                  exercises: routineForRun.exercises,
                  completedAt: new Date().toISOString(),
                })
                cancelCurrentWorkout()
              }}
              onUpdateRoutine={(nextRoutine) => upsertRoutine(nextRoutine)}
              initialDoneByExerciseId={
                currentWorkout?.routineId === routineForRun.id ? currentWorkout.doneByExerciseId : {}
              }
              onDoneByExerciseIdChange={(doneByExerciseId) => updateWorkoutProgress(routineForRun.id, doneByExerciseId)}
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
              onUpdate={(updated) => {
                updateCompletion(updated)
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

      {showActiveWorkoutBubble && activeWorkoutRoutine ? (
        <div className="currentWorkoutBubble" role="group" aria-label="Active workout actions">
          <button
            type="button"
            className="currentWorkoutBubbleResume"
            aria-label={`Resume active workout: ${activeWorkoutRoutine.name}`}
            onClick={() => navigate({ name: 'run', routineId: activeWorkoutRoutine.id })}
          >
            <span className="currentWorkoutBubbleLabel">Resume workout</span>
            <span className="currentWorkoutBubbleName">{activeWorkoutRoutine.name}</span>
            <span className="currentWorkoutBubbleMeta">
              {activeWorkoutDoneCount}/{activeWorkoutTotalCount} complete
            </span>
          </button>
          <button
            type="button"
            className="currentWorkoutBubbleCancel"
            onClick={() => {
              const ok = window.confirm(`Cancel workout "${activeWorkoutRoutine.name}"? Your current progress will be lost.`)
              if (!ok) return
              cancelCurrentWorkout()
            }}
            aria-label={`Cancel active workout: ${activeWorkoutRoutine.name}`}
          >
            Cancel workout
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default App
