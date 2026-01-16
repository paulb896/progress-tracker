import type { RoutineCompletion } from '../completions/types'
import { resolveImageUrl } from '../app/resolveImageUrl'
import { formatDuration } from '../app/formatDuration'

type CompletionDetailViewProps = {
  completion: RoutineCompletion
  onBack: () => void
  onDelete: (completionId: string) => void
}

export const CompletionDetailView = ({ completion, onBack, onDelete }: CompletionDetailViewProps) => {
  const exercises = completion.exercises ?? []

  return (
    <div className="panel">
      <div className="panelTitleRow">
        <div>
          <div className="panelTitle">Completed routine</div>
          <div className="subtitle2">{completion.routineName}</div>
        </div>
        <div className="rowGap">
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              const ok = window.confirm('Delete this completed routine from history?')
              if (ok) onDelete(completion.id)
            }}
          >
            Delete
          </button>
          <button type="button" className="button secondary" onClick={onBack}>
            Back
          </button>
        </div>
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

                {ex.sets || ex.reps || ex.weight ? (
                  <div className="runMeta" aria-label="Sets, reps, weight">
                    <div className="runMetaField">
                      <span className="runMetaLabel">Sets</span>
                      <span className="runMetaValue">{typeof ex.sets === 'number' ? ex.sets : '-'}</span>
                    </div>
                    <div className="runMetaField">
                      <span className="runMetaLabel">Reps</span>
                      <span className="runMetaValue">{typeof ex.reps === 'number' ? ex.reps : '-'}</span>
                    </div>
                    <div className="runMetaField">
                      <span className="runMetaLabel">Weight</span>
                      <span className="runMetaValue">{typeof ex.weight === 'number' ? ex.weight : '-'}</span>
                    </div>
                  </div>
                ) : null}

                {typeof ex.timeSeconds === 'number' && ex.timeSeconds > 0 ? (
                  <div className="hint">Time: {formatDuration(ex.timeSeconds)}</div>
                ) : null}

                {ex.imageUrls?.length ? (
                  <div className="imageStrip" aria-label="Exercise reference images">
                    {ex.imageUrls.map((url) => (
                          <img key={url} className="imageThumb" src={resolveImageUrl(url)} alt={`${ex.name} reference`} loading="lazy" />
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
