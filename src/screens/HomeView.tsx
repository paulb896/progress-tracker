import React from 'react'
import type { Routine } from '../routines/types'
import type { RoutineCompletion } from '../completions/types'
import { resolveImageUrl } from '../app/resolveImageUrl'

import { RecentActivity } from '../components/RecentActivity'

import { getPeriodicElement } from '../app/periodicTable'

type HomeViewProps = {
  routines: Routine[]
  completions: RoutineCompletion[]
  onCreate: () => void
  onHowTo: () => void
  onEdit: (routineId: string) => void
  onRun: (routineId: string) => void
  onDelete: (routineId: string) => void
  onViewCompletion: (completionId: string) => void
  onStats: () => void
  onPlayGame: () => void
  headerRight?: React.ReactNode
}

export const HomeView = ({
  routines,
  completions,
  onCreate,
  onHowTo,
  onPlayGame,
  onEdit,
  onRun,
  onDelete,
  onViewCompletion,
  onStats,
  headerRight,
}: HomeViewProps) => {
  return (
    <>
      <section className="heroSection">
        <img src={resolveImageUrl('/logo.png')} alt="Progress Tracker" className="heroLogo" />
        <div className="heroContent">
          <h1 className="heroTitle" aria-label="Create your routines with custom exercises and achieve your fitness goals.">
            Design your routines. <br />
            Log your power. <br />
            Track your <span className="textGradient">progress.</span>
          </h1>
          <p className="heroSubtitle">
            A premium, offline-first dashboard designed to visualize your muscle recovery, plate loading, and training volume progression over time.
          </p>

          <div className="heroActions">
            <button className="button primary bigButton" type="button" onClick={onCreate}>
              Start New Routine
            </button>
            <button className="button secondary bigButton outlineButton" type="button" onClick={onStats}>
              Progress Stats
            </button>
            <button className="button secondary bigButton outlineButton" type="button" onClick={onHowTo}>
              How to Guides
            </button>
          </div>
        </div>

        <div className="heroCanvasWrapper">
          <div className="heroCanvasFadeTop" />
          <div className="heroCanvasFadeBottom" />
          <div className="heroCanvasFadeLeft" />
          {headerRight}
        </div>
      </section>

      <div className="dashboardGrid">
        <main className="mainColumn">
          <section className="panel glassPanel">
            <div className="panelHeaderPlain">
              <h2 className="panelTitlePlain">Your Routines</h2>
              <button className="iconButton" onClick={onCreate} aria-label="Add routine">
                +
              </button>
            </div>
            
            <div className="panelBody">
              <div className="pt-routine-grid" role="list">
                {/* Gym Press simulator element */}
                <div
                  className="pt-cell"
                  style={{ '--element-color': 'var(--accent)' } as React.CSSProperties}
                  onClick={onPlayGame}
                >
                  <div className="pt-header">
                    <span className="pt-number">100</span>
                    <span className="pt-group">GYM LAB • ACTIVE</span>
                  </div>
                  <div className="pt-symbol">Gp</div>
                  <div className="pt-footer">
                    <span className="pt-name">Gym Press Simulator</span>
                    <span className="pt-mass">3D Balance Game</span>
                  </div>
                </div>

                {routines.map((r) => {
                  const el = getPeriodicElement(r.name)
                  return (
                    <div
                      key={r.id}
                      className="pt-cell summaryCard"
                      role="listitem"
                      style={{ '--element-color': el.color } as React.CSSProperties}
                      onClick={() => onRun(r.id)}
                    >
                      <div className="pt-header">
                        <span className="pt-number">{el.atomicNumber}</span>
                        <span className="pt-group">{el.groupName}</span>
                      </div>
                      <div className="pt-symbol">{el.symbol}</div>
                      <div className="pt-footer">
                        <span className="pt-name" title={r.name}>{r.name}</span>
                        <span className="pt-mass">{r.exercises.length} exercises</span>
                      </div>
                      <div className="summaryFooter" style={{ marginTop: 8, padding: 0, justifyContent: 'center', gap: 12 }}>
                         <button className="textButton" onClick={(e) => { e.stopPropagation(); onEdit(r.id); }}>Edit</button>
                         <button className="textButton dangerText" onClick={(e) => { 
                           e.stopPropagation(); 
                           const ok = window.confirm(`Delete routine "${r.name}"?`)
                           if (ok) onDelete(r.id)
                         }}>Delete</button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {!routines.length && (
                <div className="empty" style={{ marginTop: 16 }}>No training routines found. Create your first routine to start logging workouts.</div>
              )}
            </div>
          </section>
        </main>

        <aside className="sideColumn">
          <RecentActivity completions={completions} onViewCompletion={onViewCompletion} />
        </aside>
      </div>
    </>
  )
}
