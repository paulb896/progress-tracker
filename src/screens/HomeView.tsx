import React from 'react'
import type { Routine } from '../routines/types'
import type { RoutineCompletion } from '../completions/types'

type HomeViewProps = {
  routines: Routine[]
  completions: RoutineCompletion[]
  onCreate: () => void
  onEdit: (routineId: string) => void
  onRun: (routineId: string) => void
  onDelete: (routineId: string) => void
  onViewCompletion: (completionId: string) => void
  headerRight?: React.ReactNode
}

export const HomeView = ({
  routines,
  completions,
  onCreate,
  onEdit,
  onRun,
  onDelete,
  onViewCompletion,
  headerRight,
}: HomeViewProps) => {
  return (
    <>
      <header className="header">
        <div className="headerRow">
          <div>
            <h1 className="title">Progress Tracker</h1>
            <p className="subtitle">Create exercise routines and check them off as you go.</p>
          </div>
          <div className="headerRight">{headerRight}</div>
        </div>

        <div className="headerActions">
          <button className="button" type="button" onClick={onCreate}>
            Create routine
          </button>
        </div>
      </header>

      <main className="content">
        <section className="panel">
          <div className="panelTitle">Your routines</div>
          <div className="panelBody">
            {routines.length ? (
              <div className="routineList" role="list">
                {routines.map((r) => (
                  <div key={r.id} className="routineCard" role="listitem">
                    <div className="routineMain">
                      <div className="routineName">{r.name}</div>
                      <div className="hint">{r.exercises.length} exercises</div>
                    </div>
                    <div className="routineActions">
                      <button type="button" className="button" onClick={() => onRun(r.id)}>
                        Run
                      </button>
                      <button type="button" className="button secondary" onClick={() => onEdit(r.id)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => {
                          const ok = window.confirm(`Delete routine "${r.name}"?`)
                          if (ok) onDelete(r.id)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">No routines yet. Create one to get started.</div>
            )}
          </div>
        </section>

        <section className="panel" style={{ marginTop: 12 }}>
          <div className="panelTitle">Completed routines</div>
          <div className="panelBody">
            {completions.length ? (
              <div className="completionList" role="list">
                {completions.slice(0, 25).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="completionRow completionRowButton"
                    role="listitem"
                    onClick={() => onViewCompletion(c.id)}
                    aria-label={`View completed routine: ${c.routineName}`}
                  >
                    <div className="completionMain">
                      <div className="completionName">{c.routineName}</div>
                      <div className="hint">
                        {c.exerciseCount} exercises <span className="dot">•</span>{' '}
                        {new Date(c.completedAt).toLocaleString()}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty">No completed routines yet. Finish one to start your history.</div>
            )}
          </div>
        </section>
      </main>
    </>
  )
}
