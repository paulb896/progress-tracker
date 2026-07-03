import React from 'react'
import type { Routine } from '../routines/types'
import type { RoutineCompletion } from '../completions/types'
import { resolveImageUrl } from '../app/resolveImageUrl'

import { RecentActivity } from '../components/RecentActivity'

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
  headerRight?: React.ReactNode
}

const DumbbellIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 12h10" />
    <rect x="2" y="6" width="3" height="12" rx="1" />
    <rect x="5" y="8" width="2" height="8" rx="1" />
    <rect x="17" y="8" width="2" height="8" rx="1" />
    <rect x="19" y="6" width="3" height="12" rx="1" />
  </svg>
)

export const HomeView = ({
  routines,
  completions,
  onCreate,
  onHowTo,
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
              {routines.length ? (
                <div className="routineGrid" role="list">
                  {routines.map((r) => (
                    <div key={r.id} className="summaryCard" role="listitem">
                      <div className="summaryCardInner" onClick={() => onRun(r.id)}>
                        <div className="summaryIcon">
                          <DumbbellIcon />
                        </div>
                        <div className="summaryContent">
                          <div className="routineName">{r.name}</div>
                          <div className="hint">{r.exercises.length} exercises</div>
                        </div>
                        <div className="summaryArrow">→</div>
                      </div>
                      <div className="summaryFooter">
                         <button className="textButton" onClick={(e) => { e.stopPropagation(); onEdit(r.id); }}>Edit</button>
                         <button className="textButton dangerText" onClick={(e) => { 
                           e.stopPropagation(); 
                           const ok = window.confirm(`Delete routine "${r.name}"?`)
                           if (ok) onDelete(r.id)
                         }}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty">No training routines found. Create your first routine to start logging workouts.</div>
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
