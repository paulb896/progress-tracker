import React from 'react'
import type { RoutineCompletion } from '../completions/types'
import { getPeriodicElement } from '../app/periodicTable'

type RecentActivityProps = {
  completions: RoutineCompletion[]
  onViewCompletion: (completionId: string) => void
}

const numberFormatter = new Intl.NumberFormat()

const completionVolume = (c: RoutineCompletion): number => {
  if (!c.exercises?.length) return 0
  return c.exercises.reduce((acc, ex) => {
    const sets = typeof ex.sets === 'number' && Number.isFinite(ex.sets) ? ex.sets : 0
    const reps = typeof ex.reps === 'number' && Number.isFinite(ex.reps) ? ex.reps : 0
    const weight = typeof ex.weight === 'number' && Number.isFinite(ex.weight) ? ex.weight : 0
    const supersetWeight =
      typeof ex.supersetWith?.weight === 'number' && Number.isFinite(ex.supersetWith.weight)
        ? ex.supersetWith.weight
        : 0
    return acc + sets * reps * (weight + supersetWeight)
  }, 0)
}

export const RecentActivity = ({ completions, onViewCompletion }: RecentActivityProps) => {
  return (
    <section className="panel glassPanel activityPanel">
      <div className="panelHeaderPlain">
        <div className="panelHeaderTitleGroup">
          <span className="panelEyebrow">TELEMETRY LOG</span>
          <div className="panelTitle">Recent Activity</div>
        </div>
        {completions.length > 0 ? (
          <span className="panelCountBadge">{completions.length} logged</span>
        ) : null}
      </div>
      <div className="panelBody scrollableBody">
        {completions.length ? (
          <div className="activityList" role="list">
            {completions.slice(0, 10).map((c) => {
              const el = getPeriodicElement(c.routineName)
              const vol = Math.round(completionVolume(c))
              const exercises = c.exercises ?? []
              return (
                <div
                  key={c.id}
                  className="pt-mini-cell activityCard"
                  role="listitem"
                  style={{ '--element-color': el.color } as React.CSSProperties}
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
                  <div className="pt-mini-symbol activitySymbol">
                    <span>{el.symbol}</span>
                    <small>#{el.atomicNumber}</small>
                  </div>
                  <div className="activityInfo">
                    <div className="activityTopRow">
                      <div className="activityName">{c.routineName}</div>
                      <span className="activityDate">
                        {new Date(c.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="activityMetaRow">
                      <span className="activityMetaPill">
                        {c.exerciseCount} {c.exerciseCount === 1 ? 'exercise' : 'exercises'}
                      </span>
                      {vol > 0 ? (
                        <span className="activityMetaPill activityMetaVolume">
                          {numberFormatter.format(vol)} lbs
                        </span>
                      ) : null}
                    </div>
                    {exercises.length > 0 ? (
                      <div className="activityFormulaRow" aria-hidden="true">
                        {exercises.slice(0, 5).map((ex) => {
                          const exEl = getPeriodicElement(ex.name)
                          return (
                            <span
                              key={ex.id}
                              className="activityFormulaChip"
                              style={{ '--chip-color': exEl.color } as React.CSSProperties}
                              title={ex.name}
                            >
                              {exEl.symbol}
                            </span>
                          )
                        })}
                        {exercises.length > 5 ? (
                          <span className="activityFormulaMore">+{exercises.length - 5}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="activityChevron" aria-hidden="true">
                    →
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="emptyMini">
            <div className="emptyMiniIcon" aria-hidden="true">⚛</div>
            <div>No completed workouts logged yet.</div>
            <div className="emptyMiniSub">Run a routine to record your first session.</div>
          </div>
        )}
      </div>
    </section>
  )
}

