import type { RoutineCompletion } from '../completions/types'

type RecentActivityProps = {
  completions: RoutineCompletion[]
  onViewCompletion: (completionId: string) => void
}

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export const RecentActivity = ({ completions, onViewCompletion }: RecentActivityProps) => {
  return (
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
  )
}
