import React from 'react'
import type { Routine } from '../routines/types'
import { resolveImageUrl } from '../app/resolveImageUrl'
import { formatDuration } from '../app/formatDuration'
import { EXERCISE_PRESETS } from '../exercises/presets'

import { PlateCalculatorScene } from '../components/PlateCalculatorScene'

type RunRoutineViewProps = {
  routine: Routine
  onBack: () => void
  onComplete: () => void
  onCancelWorkout?: () => void
  onUpdateRoutine: (routine: Routine) => void
  initialDoneByExerciseId?: DoneState
  onDoneByExerciseIdChange?: (doneByExerciseId: DoneState) => void
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

  // We use a fixed coordinate system for the SVG path, but let CSS control the display size
  const size = 100
  const stroke = 8
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
      <svg className="runGaugeSvg" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id="runGaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-hover)" />
          </linearGradient>
        </defs>
        <circle className="runGaugeTrack" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" />
        <circle
          className="runGaugeValue"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          stroke="url(#runGaugeGrad)"
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

const adjustOptionalDurationSeconds = (current: number | undefined, deltaSeconds: number): number | undefined => {
  const base = typeof current === 'number' && Number.isFinite(current) ? Math.trunc(current) : 0
  const next = base + deltaSeconds
  return next > 0 ? next : undefined
}


const ArrowLeft = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"></line>
    <polyline points="12 19 5 12 12 5"></polyline>
  </svg>
)

const ChevronDown = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
)

const ChevronRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
)

const normalizeDoneState = (doneByExerciseId: DoneState, routine: Routine): DoneState => {
  const allowedIds = new Set(routine.exercises.map((ex) => ex.id))
  const next: DoneState = {}
  for (const [exerciseId, done] of Object.entries(doneByExerciseId)) {
    if (allowedIds.has(exerciseId) && done) next[exerciseId] = true
  }
  return next
}

const areDoneStatesEqual = (a: DoneState, b: DoneState): boolean => {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => a[key] === b[key])
}

export const RunRoutineView = ({
  routine,
  onBack,
  onComplete,
  onCancelWorkout,
  onUpdateRoutine,
  initialDoneByExerciseId = {},
  onDoneByExerciseIdChange,
}: RunRoutineViewProps) => {
  const [doneByExerciseId, setDoneByExerciseId] = React.useState<DoneState>(() =>
    normalizeDoneState(initialDoneByExerciseId, routine)
  )
  const [expandedByExerciseId, setExpandedByExerciseId] = React.useState<Record<string, boolean>>({})
  const [justCompletedExerciseId, setJustCompletedExerciseId] = React.useState<string | null>(null)
  const [allDonePulse, setAllDonePulse] = React.useState(false)
  const [plateCalcExerciseId, setPlateCalcExerciseId] = React.useState<string | null>(null)

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

  const setExpanded = (exerciseId: string, expanded: boolean) => {
    setExpandedByExerciseId((prev) => {
      if (prev[exerciseId] === expanded) return prev
      return { ...prev, [exerciseId]: expanded }
    })
  }

  const reset = () => setDoneByExerciseId({})

  const cancelWorkout = () => {
    const ok = window.confirm(`Cancel workout "${routine.name}"? Your current progress will be lost.`)
    if (!ok) return
    onCancelWorkout?.()
  }

  const updateExerciseMeta = React.useCallback(
    (
      exerciseId: string,
      patch: Partial<{ sets: number | undefined; reps: number | undefined; weight: number | undefined; timeSeconds: number | undefined; supersetWeight: number | undefined }>
    ) => {
      const nextExercises = routine.exercises.map((ex) => {
        if (ex.id !== exerciseId) return ex
        const { supersetWeight, ...rest } = patch
        const base = { ...ex, ...rest }
        if (supersetWeight !== undefined && base.supersetWith) {
          base.supersetWith = { ...base.supersetWith, weight: supersetWeight }
        } else if (supersetWeight !== undefined && !base.supersetWith) {
          // no-op
        }
        return base
      })
      onUpdateRoutine({ ...routine, exercises: nextExercises })
    },
    [onUpdateRoutine, routine]
  )

  const nextUndone = routine.exercises.find((ex) => !doneByExerciseId[ex.id]) ?? null
  const allDone = totalCount > 0 && doneCount === totalCount

  React.useEffect(() => {
    const normalized = normalizeDoneState(initialDoneByExerciseId, routine)
    setDoneByExerciseId((prev) => (areDoneStatesEqual(prev, normalized) ? prev : normalized))
  }, [initialDoneByExerciseId, routine])

  React.useEffect(() => {
    onDoneByExerciseIdChange?.(doneByExerciseId)
  }, [doneByExerciseId, onDoneByExerciseIdChange])

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
    <div className="runContainer">
      <header className="runHeader">
        <button type="button" className="iconButton" onClick={onBack} aria-label="Go back">
          <ArrowLeft />
        </button>
        <div className="runHeaderContent">
           <div className="heroBadge">Active Session</div>
           <h1 className="runPageTitle textGradient">{routine.name}</h1>
        </div>
        <div className="runHeaderActions">
          <button type="button" className="button secondary" onClick={reset}>
            Reset
          </button>
          <button type="button" className="button danger" onClick={cancelWorkout}>
            Cancel workout
          </button>
        </div>
      </header>

      <div className="panel glassPanel runMainPanel">
        <div className={allDonePulse ? 'runStatus runStatusAllDone runSticky' : 'runStatus runSticky'}>
          <div className="rowBetween runStatusRow">

            <div>
              <div className="runStatusTitle">
                {doneCount} / {totalCount} completed
              </div>
              <div className="runNextContainer">
                {nextUndone ? (
                  <>
                    <span className="runNextBadge">Next Up</span>
                    <span className="runNextName">{nextUndone.name}</span>
                  </>
                ) : (
                  <span className="runAllDoneBadge">✓ Routine Completed</span>
                )}
              </div>
            </div>

            <div className="runStickyRight" aria-label={`Progress ${progressPercent}%`}>
              <ProgressGauge doneCount={doneCount} totalCount={totalCount} progress={progress} />
              <button
                type="button"
                className={allDone ? 'button primary runCompleteBtnPulse' : 'button primary'}
                onClick={onComplete}
                disabled={!allDone}
              >
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
            const expanded = !!expandedByExerciseId[ex.id]
            const miniThumbUrl = ex.imageUrls?.[0] ? resolveImageUrl(ex.imageUrls[0]) : null
            const setsText = typeof ex.sets === 'number' ? String(ex.sets) : '—'
            const repsText = typeof ex.reps === 'number' ? String(ex.reps) : '—'
            const weightText = typeof ex.weight === 'number' ? String(ex.weight) : '—'
            const isSuperset = !!ex.supersetWith?.name
            const supersetWeightText = typeof ex.supersetWith?.weight === 'number' ? String(ex.supersetWith.weight) : '—'
            const supersetPreset = isSuperset ? EXERCISE_PRESETS.find(p => p.name === ex.supersetWith!.name) : null
            const supersetThumbUrl = ex.supersetWith?.imageUrls?.[0]
              ? resolveImageUrl(ex.supersetWith.imageUrls[0])
              : supersetPreset?.imageUrl ? resolveImageUrl(supersetPreset.imageUrl) : null
            return (
              <div
                key={ex.id}
                className={
                  checked
                    ? justDone
                      ? 'runRow runRowDone runRowJustDone'
                      : 'runRow runRowDone'
                    : expanded
                      ? 'runRow'
                      : 'runRow runRowMinimized'
                }
              >
                <div className="runRowHeader" onClick={() => setExpanded(ex.id, !expanded)}>
                  <label className="runRowTop" onClick={(e) => e.stopPropagation()} aria-label={checked ? `Mark ${ex.name} not done` : `Mark ${ex.name} done`}>
                    <input
                      className="runCheckboxInput"
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(ex.id)}
                    />
                    <span className="runName">
                      {ex.name}
                      {isSuperset && <span className="supersetBadge">⚡ Superset</span>}
                    </span>
                  </label>

                  {!expanded && (
                    <div className="runRowHeaderRight">
                      <div className="runMiniMeta" aria-label="Sets reps weight time summary">
                        {setsText} x {repsText}
                        {isSuperset ? (
                          <>
                            <span className="dot">•</span>
                            <span>{weightText}</span> <span className="unit">/ {supersetWeightText}</span> <span className="unit">lbs</span>
                          </>
                        ) : (
                          <><span className="dot">•</span> {weightText} <span className="unit">lbs</span></>
                        )}
                      </div>
                      {miniThumbUrl ? <img className="runMiniThumb" src={miniThumbUrl} alt="" loading="lazy" /> : null}
                      {isSuperset && supersetThumbUrl ? <img className="runMiniThumb" src={supersetThumbUrl} alt="" loading="lazy" /> : null}
                    </div>
                  )}

                  <button
                    type="button"
                    className="runExpandButton"
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpanded(ex.id, !expanded)
                    }}
                    aria-label={expanded ? 'Minimize' : 'Expand'}
                    title={expanded ? 'Minimize' : 'Expand'}
                  >
                    {expanded ? <ChevronDown /> : <ChevronRight />}
                  </button>
                </div>

                {expanded ? (
                  <div className="runCardExpanded">
                    <div className="runMetaGrid">
                      <div className="runMetaPill">
                        <span className="runMetaLabel">SETS</span>
                        <div className="runStepper">
                          <button
                            type="button"
                            className="runStepperBtn"
                            onClick={() => updateExerciseMeta(ex.id, { sets: adjustOptionalPositiveInt(ex.sets, -1) })}
                            disabled={typeof ex.sets !== 'number' || ex.sets <= 1}
                          >
                            −
                          </button>
                          <div className="runStepperValue">{typeof ex.sets === 'number' ? ex.sets : '—'}</div>
                          <button
                            type="button"
                            className="runStepperBtn"
                            onClick={() => updateExerciseMeta(ex.id, { sets: adjustOptionalPositiveInt(ex.sets, 1) })}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="runMetaPill">
                        <span className="runMetaLabel">REPS</span>
                        <div className="runStepper">
                          <button
                            type="button"
                            className="runStepperBtn"
                            onClick={() => updateExerciseMeta(ex.id, { reps: adjustOptionalPositiveInt(ex.reps, -1) })}
                            disabled={typeof ex.reps !== 'number' || ex.reps <= 1}
                          >
                            −
                          </button>
                          <div className="runStepperValue">{typeof ex.reps === 'number' ? ex.reps : '—'}</div>
                          <button
                            type="button"
                            className="runStepperBtn"
                            onClick={() => updateExerciseMeta(ex.id, { reps: adjustOptionalPositiveInt(ex.reps, 1) })}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="runMetaPill">
                        <span className="runMetaLabel">WEIGHT (LBS)</span>
                        <div className="runStepper">
                          <button
                            type="button"
                            className="runStepperBtn"
                            onClick={() => updateExerciseMeta(ex.id, { weight: adjustOptionalPositiveNumber(ex.weight, -5) })}
                            disabled={typeof ex.weight !== 'number' || ex.weight <= 5}
                            title="-5"
                          >
                            −
                          </button>
                          <button
                            type="button"
                            className="runStepperBtn"
                            onClick={() => updateExerciseMeta(ex.id, { weight: adjustOptionalPositiveNumber(ex.weight, -1) })}
                            disabled={typeof ex.weight !== 'number' || ex.weight <= 1}
                            title="-1"
                          >
                            −
                          </button>
                          <div className="runStepperValue">{typeof ex.weight === 'number' ? ex.weight : '—'}</div>
                          <button
                            type="button"
                            className="runStepperBtn"
                            onClick={() => updateExerciseMeta(ex.id, { weight: adjustOptionalPositiveNumber(ex.weight, 1) })}
                            title="+1"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="runStepperBtn"
                            onClick={() => updateExerciseMeta(ex.id, { weight: adjustOptionalPositiveNumber(ex.weight, 5) })}
                            title="+5"
                          >
                            +
                          </button>
                        </div>
                        {typeof ex.weight === 'number' && ex.weight >= 45 && (
                          <button
                            type="button"
                            className="textButton smallTextButton"
                            style={{ marginTop: 8, width: '100%', justifyContent: 'center', fontSize: '0.8rem', opacity: 0.8 }}
                            onClick={() => setPlateCalcExerciseId(ex.id)}
                          >
                            Visualize Plates
                          </button>
                        )}
                      </div>

                      <div className="runMetaPill">
                        <span className="runMetaLabel">TIME</span>
                        <div className="runStepper">
                          <button
                            type="button"
                            className="runStepperBtn"
                            onClick={() => updateExerciseMeta(ex.id, { timeSeconds: adjustOptionalDurationSeconds(ex.timeSeconds, -10) })}
                            disabled={typeof ex.timeSeconds !== 'number' || ex.timeSeconds <= 10}
                          >
                            −
                          </button>
                          <div className="runStepperValue minWidthTime">
                            {formatDuration(ex.timeSeconds)}
                          </div>
                          <button
                            type="button"
                            className="runStepperBtn"
                            onClick={() => updateExerciseMeta(ex.id, { timeSeconds: adjustOptionalDurationSeconds(ex.timeSeconds, 10) })}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {ex.imageUrls?.length ? (
                      <div className="runImagesGrid">
                        {ex.imageUrls.map((url) => (
                          <div key={url} className="runImageFrame">
                             <img
                              className="runImageFull"
                              src={resolveImageUrl(url)}
                              alt={`${ex.name} reference`}
                              loading="lazy"
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {isSuperset && ex.supersetWith ? (
                      <div className="supersetExpandedSection">
                        <div className="supersetExpandedDivider">
                          <span className="supersetExpandedLabel">⚡ Superset: {ex.supersetWith.name}</span>
                        </div>
                        <div className="runMetaGrid">
                          <div className="runMetaPill">
                            <span className="runMetaLabel">WEIGHT (LBS)</span>
                            <div className="runStepper">
                              <button
                                type="button"
                                className="runStepperBtn"
                                onClick={() => updateExerciseMeta(ex.id, { supersetWeight: adjustOptionalPositiveNumber(ex.supersetWith!.weight, -5) })}
                                disabled={typeof ex.supersetWith.weight !== 'number' || ex.supersetWith.weight <= 5}
                                title="-5"
                              >
                                −
                              </button>
                              <button
                                type="button"
                                className="runStepperBtn"
                                onClick={() => updateExerciseMeta(ex.id, { supersetWeight: adjustOptionalPositiveNumber(ex.supersetWith!.weight, -1) })}
                                disabled={typeof ex.supersetWith.weight !== 'number' || ex.supersetWith.weight <= 1}
                                title="-1"
                              >
                                −
                              </button>
                              <div className="runStepperValue">
                                {typeof ex.supersetWith.weight === 'number' ? ex.supersetWith.weight : '—'}
                              </div>
                              <button
                                type="button"
                                className="runStepperBtn"
                                onClick={() => updateExerciseMeta(ex.id, { supersetWeight: adjustOptionalPositiveNumber(ex.supersetWith!.weight, 1) })}
                                title="+1"
                              >
                                +
                              </button>
                              <button
                                type="button"
                                className="runStepperBtn"
                                onClick={() => updateExerciseMeta(ex.id, { supersetWeight: adjustOptionalPositiveNumber(ex.supersetWith!.weight, 5) })}
                                title="+5"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                        {(() => {
                          const urls = ex.supersetWith.imageUrls?.length
                            ? ex.supersetWith.imageUrls
                            : supersetThumbUrl ? [supersetPreset!.imageUrl!] : []
                          return urls.length ? (
                            <div className="runImagesGrid">
                              {urls.map((url) => (
                                <div key={url} className="runImageFrame">
                                  <img
                                    className="runImageFull"
                                    src={resolveImageUrl(url)}
                                    alt={`${ex.supersetWith!.name} reference`}
                                    loading="lazy"
                                  />
                                </div>
                              ))}
                            </div>
                          ) : null
                        })()}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {plateCalcExerciseId !== null && (() => {
        const exercise = routine.exercises.find((e) => e.id === plateCalcExerciseId)
        if (!exercise || typeof exercise.weight !== 'number') return null
        
        return (
          <div className="modalOverlay" onClick={() => setPlateCalcExerciseId(null)}>
            <div className="modalContent" onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: 600, height: 400, padding: 0, overflow: 'hidden' }}>
              
              {/* Header Controls */}
              <div className="plateCalcControls">
                <div className="plateCalcPanel">
                   <div className="plateCalcWeight">
                      {exercise.weight} <span className="unit">LBS</span>
                   </div>
                   
                   <div className="plateCalcButtonGroup">
                      <button
                        type="button"
                        className="plateCalcBtn"
                        onClick={() => updateExerciseMeta(exercise.id, { weight: adjustOptionalPositiveNumber(exercise.weight, -5) })}
                        disabled={exercise.weight <= 5}
                      >
                        -5
                      </button>
                      <button
                        type="button"
                        className="plateCalcBtn"
                        onClick={() => updateExerciseMeta(exercise.id, { weight: adjustOptionalPositiveNumber(exercise.weight, -1) })}
                        disabled={exercise.weight <= 1}
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        className="plateCalcBtn"
                        onClick={() => updateExerciseMeta(exercise.id, { weight: adjustOptionalPositiveNumber(exercise.weight, 1) })}
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        className="plateCalcBtn"
                        onClick={() => updateExerciseMeta(exercise.id, { weight: adjustOptionalPositiveNumber(exercise.weight, 5) })}
                      >
                        +5
                      </button>
                   </div>
                </div>

                <button 
                  type="button" 
                  className="plateCalcClose" 
                  onClick={() => setPlateCalcExerciseId(null)}
                >
                  ✕
                </button>
              </div>

              <PlateCalculatorScene targetWeight={exercise.weight} />
            </div>
          </div>
        )
      })()}
    </div>
  )
}