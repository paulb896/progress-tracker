import React from 'react'
import type { Routine } from '../routines/types'
import type { RoutineCompletion } from '../completions/types'

type HomeViewProps = {
  routines: Routine[]
  completions: RoutineCompletion[]
  onCreate: () => void
  onHowTo: () => void
  onEdit: (routineId: string) => void
  onRun: (routineId: string) => void
  onDelete: (routineId: string) => void
  onViewCompletion: (completionId: string) => void
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

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
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
  headerRight,
}: HomeViewProps) => {
  return (
    <>
      <section className="heroSection">
        <div className="heroContent">
          <div className="heroBadge">
            <span className="heroBadgeDot" /> Fitness App
          </div>
          <h1 className="heroTitle">
            Create your routines <br />
            with <span className="textGradient">custom exercises</span> <br />
            and achieve your fitness goals.
          </h1>
          <p className="heroSubtitle">
            All of your completed workouts are tracked in one place, making it easy to monitor your progress over time.
          </p>

          <div className="heroActions">
            <button className="button primary bigButton" type="button" onClick={onCreate}>
              Start New Routine
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
                <div className="empty">No routines yet. Create one to get started.</div>
              )}
            </div>
          </section>
        </main>

        <aside className="sideColumn">
          <section className="panel glassPanel">
            <div className="panelTitle">Recent Activity</div>
            <div className="panelBody scrollableBody">
              {completions.length ? (
                <div className="activityList" role="list">
                  {completions.slice(0, 10).map((c) => (
                    <div
                      key={c.id}
                      className="activityItem"
                      role="listitem"
                      aria-label={`View completed routine: ${c.routineName}`}
                      onClick={() => onViewCompletion(c.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onViewCompletion(c.id)
                        }
                      }}
                      tabIndex={0}
                    >
                       <div className="activityIcon"><CheckIcon /></div>
                       <div className="activityInfo">
                          <div className="activityName">{c.routineName}</div>
                          <div className="activityDate">
                            {new Date(c.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="emptyMini">No history yet.</div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </>
  )
}
