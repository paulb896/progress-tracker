import type { RoutineCompletion } from '../completions/types'

type CompletionDetailViewProps = {
  completion: RoutineCompletion
  onBack: () => void
}

export const CompletionDetailView = ({ completion, onBack }: CompletionDetailViewProps) => {
  const exercises = completion.exercises ?? []

  return (
    <div className="panel">
      <div className="panelTitleRow">
        <div>
          <div className="panelTitle">Completed routine</div>
          <div className="subtitle2">{completion.routineName}</div>
        </div>
        <button type="button" className="button secondary" onClick={onBack}>
          Back
        </button>
      </div>

      <div className="panelBody">
        <div className="hint">
          {completion.exerciseCount} exercises <span className="dot">•</span> {new Date(completion.completedAt).toLocaleString()}
        </div>

        {exercises.length ? (
          <div className="exerciseRunList" style={{ marginTop: 12 }}>
            {exercises.map((ex) => (
              <div key={ex.id} className="runRow">
                <div className="runRowTop">
                  <span className="completionBullet" aria-hidden="true" />
                  <span className="runName">{ex.name}</span>
                </div>

                {ex.imageUrls?.length ? (
                  <div className="imageStrip" aria-label="Exercise reference images">
                    {ex.imageUrls.map((url) => (
                      <img key={url} className="imageThumb" src={url} alt={`${ex.name} reference`} loading="lazy" />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty" style={{ marginTop: 12 }}>
            No exercise snapshot was saved for this completion.
          </div>
        )}
      </div>
    </div>
  )
}
