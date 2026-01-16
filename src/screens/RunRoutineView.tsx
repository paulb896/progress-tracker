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

type ProgressGaugeProps = {
  doneCount: number
  totalCount: number
  progress: number
}

const ProgressGauge = ({ doneCount, totalCount, progress }: ProgressGaugeProps) => {
  const clamped = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0
  const percent = Math.round(clamped * 100)

  const size = 52
  const stroke = 6
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - clamped)

  return (
    <div
      className="runGauge"
      role="progressbar"
      aria-label="Routine progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <svg className="runGaugeSvg" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="runGaugeTrack" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" />
        <circle
          className="runGaugeValue"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={`${dashOffset}`}
        />
      </svg>
      <div className="runGaugeCenter" aria-hidden="true">
        <div className="runGaugePrimary">
          {doneCount}/{totalCount}
        </div>
        <div className="runGaugeSecondary">{percent}%</div>
      </div>
    </div>
  )
}

const adjustOptionalPositiveInt = (current: number | undefined, delta: number): number | undefined => {
  const base = typeof current === 'number' && Number.isFinite(current) ? Math.trunc(current) : 0
  const next = base + delta
  return next > 0 ? next : undefined
}

const adjustOptionalPositiveNumber = (current: number | undefined, delta: number): number | undefined => {
  const base = typeof current === 'number' && Number.isFinite(current) ? current : 0
  const next = base + delta
  return next > 0 ? next : undefined
}

export const RunRoutineView = ({ routine, onBack, onComplete, onUpdateRoutine }: RunRoutineViewProps) => {
  const [doneByExerciseId, setDoneByExerciseId] = React.useState<DoneState>({})
  const [justCompletedExerciseId, setJustCompletedExerciseId] = React.useState<string | null>(null)
  const [allDonePulse, setAllDonePulse] = React.useState(false)

  const doneCount = routine.exercises.reduce((acc, ex) => acc + (doneByExerciseId[ex.id] ? 1 : 0), 0)
  const totalCount = routine.exercises.length
  const progress = totalCount ? doneCount / totalCount : 0
  const progressPercent = totalCount ? Math.round(progress * 100) : 0

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

            <div className="runStickyRight" aria-label={`Progress ${progressPercent}%`}>
              <ProgressGauge doneCount={doneCount} totalCount={totalCount} progress={progress} />
              <button type="button" className="button" onClick={onComplete} disabled={!allDone}>
                Complete routine
              </button>
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
                  <span className="runName">{ex.name}</span>
                </label>

                <div className="runMeta" aria-label="Sets, reps, weight">
                  <div className="runMetaField">
                    <span className="runMetaLabel">Sets</span>
                    <div className="runMetaControls">
                      <div className="runMetaButtons" aria-label="Adjust sets">
                        <button
                          type="button"
                          className="runMetaButton"
                          onClick={() => updateExerciseMeta(ex.id, { sets: adjustOptionalPositiveInt(ex.sets, -1) })}
                          disabled={typeof ex.sets !== 'number' || ex.sets <= 1}
                          aria-label="Decrement sets"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          className="runMetaButton"
                          onClick={() => updateExerciseMeta(ex.id, { sets: adjustOptionalPositiveInt(ex.sets, 1) })}
                          aria-label="Increment sets"
                        >
                          +
                        </button>
                      </div>
                      <span className="runMetaValue" aria-label="Current sets">
                        {typeof ex.sets === 'number' ? ex.sets : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="runMetaField">
                    <span className="runMetaLabel">Reps</span>
                    <div className="runMetaControls">
                      <div className="runMetaButtons" aria-label="Adjust reps">
                        <button
                          type="button"
                          className="runMetaButton"
                          onClick={() => updateExerciseMeta(ex.id, { reps: adjustOptionalPositiveInt(ex.reps, -1) })}
                          disabled={typeof ex.reps !== 'number' || ex.reps <= 1}
                          aria-label="Decrement reps"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          className="runMetaButton"
                          onClick={() => updateExerciseMeta(ex.id, { reps: adjustOptionalPositiveInt(ex.reps, 1) })}
                          aria-label="Increment reps"
                        >
                          +
                        </button>
                      </div>
                      <span className="runMetaValue" aria-label="Current reps">
                        {typeof ex.reps === 'number' ? ex.reps : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="runMetaField">
                    <span className="runMetaLabel">Weight</span>
                    <div className="runMetaControls">
                      <div className="runMetaButtons" aria-label="Adjust weight">
                        <button
                          type="button"
                          className="runMetaButton"
                          onClick={() => updateExerciseMeta(ex.id, { weight: adjustOptionalPositiveNumber(ex.weight, -5) })}
                          disabled={typeof ex.weight !== 'number' || ex.weight <= 5}
                          aria-label="Decrement weight by 5"
                        >
                          −5
                        </button>
                        <button
                          type="button"
                          className="runMetaButton"
                          onClick={() => updateExerciseMeta(ex.id, { weight: adjustOptionalPositiveNumber(ex.weight, -1) })}
                          disabled={typeof ex.weight !== 'number' || ex.weight <= 1}
                          aria-label="Decrement weight by 1"
                        >
                          −1
                        </button>
                        <button
                          type="button"
                          className="runMetaButton"
                          onClick={() => updateExerciseMeta(ex.id, { weight: adjustOptionalPositiveNumber(ex.weight, 1) })}
                          aria-label="Increment weight by 1"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          className="runMetaButton"
                          onClick={() => updateExerciseMeta(ex.id, { weight: adjustOptionalPositiveNumber(ex.weight, 5) })}
                          aria-label="Increment weight by 5"
                        >
                          +5
                        </button>
                      </div>
                      <span className="runMetaValue" aria-label="Current weight">
                        {typeof ex.weight === 'number' ? ex.weight : '—'}
                      </span>
                    </div>
                  </div>
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
