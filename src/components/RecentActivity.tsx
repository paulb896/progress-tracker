import type { RoutineCompletion } from '../completions/types'

type RecentActivityProps = {
  completions: RoutineCompletion[]
  onViewCompletion: (completionId: string) => void
}



import { getPeriodicElement } from '../app/periodicTable'

export const RecentActivity = ({ completions, onViewCompletion }: RecentActivityProps) => {
  return (
    <section className="panel glassPanel">
      <div className="panelTitle">Recent Activity</div>
      <div className="panelBody scrollableBody">
        {completions.length ? (
          <div className="activityList" role="list">
            {completions.slice(0, 10).map((c) => {
              const el = getPeriodicElement(c.routineName)
              return (
                <div
                  key={c.id}
                  className="pt-mini-cell"
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
                  <div className="pt-mini-symbol">{el.symbol}</div>
                  <div className="activityInfo" style={{ flex: 1 }}>
                    <div className="activityName" style={{ fontWeight: 700 }}>{c.routineName}</div>
                    <div className="activityDate">
                      {new Date(c.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', opacity: 0.8 }}>
                    #{el.atomicNumber}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="emptyMini">No completed workouts logged yet.</div>
        )}
      </div>
    </section>
  )
}
