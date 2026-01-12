import React from 'react'
import type { Routine } from '../routines/types'
import { resolveImageUrl } from '../app/resolveImageUrl'

type RunRoutineViewProps = {
  routine: Routine
  onBack: () => void
  onComplete: () => void
  onUpdateRoutine: (routine: Routine) => void
}

type DoneState = Record<string, boolean>

const normalizeOptionalIntFromInput = (raw: string): number | undefined => {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return undefined
  const i = Math.trunc(n)
  return i > 0 ? i : undefined
}

const normalizeOptionalNumberFromInput = (raw: string): number | undefined => {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const n = Number(trimmed)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export const RunRoutineView = ({ routine, onBack, onComplete, onUpdateRoutine }: RunRoutineViewProps) => {
  const [doneByExerciseId, setDoneByExerciseId] = React.useState<DoneState>({})
  const [justCompletedExerciseId, setJustCompletedExerciseId] = React.useState<string | null>(null)
  const [allDonePulse, setAllDonePulse] = React.useState(false)

  const doneCount = routine.exercises.reduce((acc, ex) => acc + (doneByExerciseId[ex.id] ? 1 : 0), 0)
  const totalCount = routine.exercises.length
  const progress = totalCount ? doneCount / totalCount : 0

  const toggle = (exerciseId: string) => {
    setDoneByExerciseId((prev) => {
      const nextChecked = !prev[exerciseId]
      if (nextChecked) setJustCompletedExerciseId(exerciseId)
      return { ...prev, [exerciseId]: nextChecked }
    })
  }

  const reset = () => setDoneByExerciseId({})

  const updateExerciseMeta = React.useCallback(
    (exerciseId: string, patch: Partial<{ sets: number | undefined; reps: number | undefined; weight: number | undefined }>) => {
      const nextExercises = routine.exercises.map((ex) => (ex.id === exerciseId ? { ...ex, ...patch } : ex))
      onUpdateRoutine({ ...routine, exercises: nextExercises })
    },
    [onUpdateRoutine, routine]
  )

  const nextUndone = routine.exercises.find((ex) => !doneByExerciseId[ex.id]) ?? null
  const allDone = totalCount > 0 && doneCount === totalCount

  React.useEffect(() => {
    if (!justCompletedExerciseId) return
    const t = window.setTimeout(() => setJustCompletedExerciseId(null), 900)
    return () => window.clearTimeout(t)
  }, [justCompletedExerciseId])

  React.useEffect(() => {
    if (!allDone) return
    setAllDonePulse(true)
    const t = window.setTimeout(() => setAllDonePulse(false), 1200)
    return () => window.clearTimeout(t)
  }, [allDone])

  return (
    <div className="panel runPanel">
      <div className="panelTitleRow">
        <div>
          <div className="panelTitle">Run routine</div>
          <div className="subtitle2">{routine.name}</div>
        </div>
        <div className="rowGap">
          <button type="button" className="button secondary" onClick={reset}>
            Reset
          </button>
          <button type="button" className="button secondary" onClick={onBack}>
            Back
          </button>
        </div>
      </div>

      <div className="panelBody">
        <div className={allDonePulse ? 'runStatus runStatusAllDone runSticky' : 'runStatus runSticky'}>
          <div className="rowBetween runStatusRow">
            <div>
              <div className="runStatusTitle">
                {doneCount} / {totalCount} completed
              </div>
              <div className="hint">
                {nextUndone ? (
                  <>
                    Next up: <span className="runNextName">{nextUndone.name}</span>
                  </>
                ) : (
                  <span>All done.</span>
                )}
              </div>
            </div>

            <div className="runStickyRight">
              <button type="button" className="button" onClick={onComplete} disabled={!allDone}>
                Complete routine
              </button>

              <div
                className="runProgress"
                role="progressbar"
                aria-label="Routine progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
              >
                <div className="runProgressFill" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            </div>
          </div>

          {totalCount ? (
            <div className="runDots" aria-label="Exercise completion tracker">
              {routine.exercises.map((ex) => {
                const checked = !!doneByExerciseId[ex.id]
                const isNext = nextUndone?.id === ex.id
                const className = checked ? 'runDot runDotDone' : isNext ? 'runDot runDotNext' : 'runDot'
                return <span key={ex.id} className={className} aria-hidden="true" />
              })}
            </div>
          ) : null}
        </div>

        <div className="exerciseRunList">
          {routine.exercises.map((ex) => {
            const checked = !!doneByExerciseId[ex.id]
            const justDone = checked && justCompletedExerciseId === ex.id
            return (
              <div
                key={ex.id}
                className={
                  checked
                    ? justDone
                      ? 'runRow runRowDone runRowJustDone'
                      : 'runRow runRowDone'
                    : 'runRow'
                }
              >
                <label className="runRowTop">
                  <input className="runCheckboxInput" type="checkbox" checked={checked} onChange={() => toggle(ex.id)} />
                  <span className="runName">
                    {ex.name}
                  </span>
                </label>

                <div className="runMeta" aria-label="Sets, reps, weight">
                  <label className="runMetaField">
                    <span className="runMetaLabel">Sets</span>
                    <input
                      className="runMetaInput"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={typeof ex.sets === 'number' ? ex.sets : ''}
                      onChange={(ev) => updateExerciseMeta(ex.id, { sets: normalizeOptionalIntFromInput(ev.target.value) })}
                      placeholder="-"
                    />
                  </label>
                  <label className="runMetaField">
                    <span className="runMetaLabel">Reps</span>
                    <input
                      className="runMetaInput"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={typeof ex.reps === 'number' ? ex.reps : ''}
                      onChange={(ev) => updateExerciseMeta(ex.id, { reps: normalizeOptionalIntFromInput(ev.target.value) })}
                      placeholder="-"
                    />
                  </label>
                  <label className="runMetaField">
                    <span className="runMetaLabel">Weight</span>
                    <input
                      className="runMetaInput"
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min={0}
                      value={typeof ex.weight === 'number' ? ex.weight : ''}
                      onChange={(ev) => updateExerciseMeta(ex.id, { weight: normalizeOptionalNumberFromInput(ev.target.value) })}
                      placeholder="-"
                    />
                  </label>
                </div>

                {ex.imageUrls?.length ? (
                  <div className="imageStrip" aria-label="Exercise reference images">
                    {ex.imageUrls.map((url) => (
                      <img key={url} className="imageThumb" src={resolveImageUrl(url)} alt={`${ex.name} reference`} loading="lazy" />
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
