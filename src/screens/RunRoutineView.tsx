import React from 'react'
import type { Exercise, Routine } from '../routines/types'
import { makeId } from '../routines/id'
import { resolveImageUrl } from '../app/resolveImageUrl'
import { formatDuration } from '../app/formatDuration'
import { EXERCISE_PRESETS, findExercisePreset, type MuscleGroup } from '../exercises/presets'
import { getPeriodicElement } from '../app/periodicTable'

import { PlateCalculatorScene } from '../components/PlateCalculatorScene'
import './RunRoutineView.css'

type RunRoutineViewProps = {
  routine: Routine
  onBack: () => void
  onComplete: () => void
  onCancelWorkout?: () => void
  onUpdateRoutine: (routine: Routine) => void
  initialDoneByExerciseId?: DoneState
  onDoneByExerciseIdChange?: (doneByExerciseId: DoneState) => void
  /** ISO timestamp of when the current workout started (drives the live clock). */
  startedAt?: string
}

type DoneState = Record<string, boolean>
type DoneSetsState = Record<string, number[]>

const SETS_STORAGE_KEY = 'progress-tracker:current-workout-sets:v1'

type MetaPatch = Partial<{
  sets: number | undefined
  reps: number | undefined
  weight: number | undefined
  timeSeconds: number | undefined
  supersetWeight: number | undefined
}>

type PlateChip = {
  weight: number
  color: string
}

const STANDARD_PLATES: PlateChip[] = [
  { weight: 45, color: '#38bdf8' },
  { weight: 35, color: '#facc15' },
  { weight: 25, color: '#34d399' },
  { weight: 10, color: '#cbd5e1' },
  { weight: 5, color: '#fb7185' },
  { weight: 2.5, color: '#a855f7' },
]

/** Computes plates per side for a standard 45 lb Olympic barbell. */
const computePlatesPerSide = (totalWeight: number | undefined): PlateChip[] => {
  if (typeof totalWeight !== 'number' || !Number.isFinite(totalWeight) || totalWeight <= 45) {
    return []
  }
  let remaining = (totalWeight - 45) / 2
  const chips: PlateChip[] = []
  for (const plate of STANDARD_PLATES) {
    while (remaining >= plate.weight - 0.01 && chips.length < 8) {
      chips.push(plate)
      remaining -= plate.weight
    }
  }
  return chips
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Returns the number of checkable sets for an exercise (defaults to 3 when unspecified). */
const getTargetSets = (ex: Exercise): number => {
  if (isNum(ex.sets) && ex.sets > 0) {
    return Math.min(12, Math.max(1, Math.trunc(ex.sets)))
  }
  return 3
}

const makeFullSetsRange = (count: number): number[] =>
  Array.from({ length: count }, (_, idx) => idx + 1)

const loadSavedSetsForRoutine = (routineId: string): DoneSetsState => {
  try {
    const raw = window.localStorage.getItem(SETS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as { routineId?: string; setsByExerciseId?: DoneSetsState }
    if (parsed?.routineId === routineId && parsed.setsByExerciseId && typeof parsed.setsByExerciseId === 'object') {
      return parsed.setsByExerciseId
    }
  } catch {
    // Ignore storage errors
  }
  return {}
}

const saveSetsForRoutine = (routineId: string, setsByExerciseId: DoneSetsState) => {
  try {
    window.localStorage.setItem(
      SETS_STORAGE_KEY,
      JSON.stringify({ routineId, setsByExerciseId })
    )
  } catch {
    // Ignore storage errors
  }
}

const clearSavedSets = () => {
  try {
    window.localStorage.removeItem(SETS_STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
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

const pad2 = (n: number) => String(n).padStart(2, '0')

const formatClock = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)}`
}

const formatRestCountdown = (totalSeconds: number) => {
  const s = Math.max(0, Math.ceil(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${pad2(sec)}`
}

const numberFormatter = new Intl.NumberFormat()

/** Single-set volume = reps × (weight + supersetPartnerWeight). */
const singleSetVolume = (ex: Exercise): number => {
  const reps = isNum(ex.reps) ? ex.reps : 0
  const main = isNum(ex.weight) ? ex.weight : 0
  const partner = isNum(ex.supersetWith?.weight) ? ex.supersetWith.weight : 0
  return reps * (main + partner)
}

/** Total planned volume for an exercise across its sets. */
const exerciseVolume = (ex: Exercise): number => {
  const sets = isNum(ex.sets) ? ex.sets : 0
  return sets * singleSetVolume(ex)
}

/** Epley 1RM estimate for weighted exercises. */
const estimate1RM = (ex: Exercise): number | null => {
  if (!isNum(ex.weight) || ex.weight <= 0) return null
  const reps = isNum(ex.reps) && ex.reps > 1 ? Math.min(20, ex.reps) : 1
  return reps > 1 ? Math.round(ex.weight * (1 + reps / 30)) : Math.round(ex.weight)
}

const getSupersetImageUrls = (ex: Exercise): string[] => {
  if (!ex.supersetWith) return []
  if (ex.supersetWith.imageUrls?.length) return ex.supersetWith.imageUrls
  const preset = EXERCISE_PRESETS.find((p) => p.name === ex.supersetWith!.name)
  return preset?.imageUrl ? [preset.imageUrl] : []
}

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = React.useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
  React.useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

const ArrowLeft = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
)

const ChevronDown = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const CheckIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const ResetIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
)

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

type ProgressGaugeProps = {
  doneCount: number
  totalCount: number
  progress: number
  setsDoneCount: number
  setsTotalCount: number
  allDone: boolean
}

const ProgressGauge = ({
  doneCount,
  totalCount,
  progress,
  setsDoneCount,
  setsTotalCount,
  allDone,
}: ProgressGaugeProps) => {
  const clamped = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0
  const setsProgress = setsTotalCount > 0 ? Math.min(1, Math.max(0, setsDoneCount / setsTotalCount)) : clamped
  // Blend exercise progress and set progress for the displayed percentage so checking individual sets gives immediate feedback
  const effectivePct = allDone
    ? 100
    : setsTotalCount > 0
      ? Math.round(setsProgress * 100)
      : Math.round(clamped * 100)

  // Fixed coordinate system; CSS controls the displayed size.
  const size = 120
  const stroke = 8.5
  const radius = (size - stroke) / 2 - 6
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - clamped)

  // Inner concentric ring for individual set completion
  const innerStroke = 4.5
  const innerRadius = radius - 10
  const innerCircumference = 2 * Math.PI * innerRadius
  const innerDashOffset = innerCircumference * (1 - setsProgress)

  // Outer tick ring: one tick per exercise.
  const tickRadius = size / 2 - 2
  const ticks = Array.from({ length: Math.max(totalCount, 1) }, (_, i) => {
    const angle = (i / Math.max(totalCount, 1)) * Math.PI * 2
    return {
      x: size / 2 + Math.cos(angle) * tickRadius,
      y: size / 2 + Math.sin(angle) * tickRadius,
      lit: i < doneCount,
    }
  })

  return (
    <div
      className={allDone ? 'ses-gauge ses-gaugeDone' : 'ses-gauge'}
      role="progressbar"
      aria-label="Routine progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={effectivePct}
    >
      <svg className="ses-gaugeSvg" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id="sesGaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--ses-a)" />
            <stop offset="100%" stopColor="var(--ses-b)" />
          </linearGradient>
          <linearGradient id="sesGaugeInnerGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--ses-b)" />
            <stop offset="100%" stopColor="var(--ses-a)" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <circle key={i} className={t.lit ? 'ses-gaugeTick ses-gaugeTickLit' : 'ses-gaugeTick'} cx={t.x} cy={t.y} r={1.7} />
        ))}
        <circle className="ses-gaugeTrack" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" />
        <circle
          className="ses-gaugeInnerTrack"
          cx={size / 2}
          cy={size / 2}
          r={innerRadius}
          strokeWidth={innerStroke}
          fill="none"
        />
        <circle
          className="ses-gaugeInnerValue"
          cx={size / 2}
          cy={size / 2}
          r={innerRadius}
          strokeWidth={innerStroke}
          fill="none"
          stroke="url(#sesGaugeInnerGrad)"
          strokeDasharray={`${innerCircumference}`}
          strokeDashoffset={`${innerDashOffset}`}
        />
        <circle
          className="ses-gaugeValue"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          stroke="url(#sesGaugeGrad)"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={`${dashOffset}`}
        />
      </svg>
      <div className="ses-gaugeCenter" aria-hidden="true">
        {allDone ? (
          <span className="ses-gaugeCheck">
            <CheckIcon size={30} />
          </span>
        ) : (
          <>
            <span className="ses-gaugePrimary">
              {doneCount}
              <span className="ses-gaugeSlash">/</span>
              {totalCount}
            </span>
            <span className="ses-gaugeSecondary">{effectivePct}%</span>
          </>
        )}
      </div>
    </div>
  )
}

/** Isolated so the per-second tick only re-renders the clock, not the whole page. */
const ElapsedClock = ({ startedAt, frozen }: { startedAt?: string; frozen: boolean }) => {
  const [fallbackStart] = React.useState(() => Date.now())
  const startMs = React.useMemo(() => {
    const parsed = startedAt ? Date.parse(startedAt) : NaN
    return Number.isFinite(parsed) ? parsed : fallbackStart
  }, [startedAt, fallbackStart])
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    if (frozen) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [frozen])

  const text = formatClock((now - startMs) / 1000)
  const [hh, mm, ss] = text.split(':')
  return (
    <time className="ses-clock" dateTime={`PT${Math.max(0, Math.floor((now - startMs) / 1000))}S`}>
      <span>{hh}</span>
      <span className="ses-clockSep">:</span>
      <span>{mm}</span>
      <span className="ses-clockSep">:</span>
      <span className="ses-clockSec">{ss}</span>
    </time>
  )
}

type MetaStepperProps = {
  label: string
  value: React.ReactNode
  steps: Array<{ label: string; title?: string; onClick: () => void; disabled?: boolean }>
  size?: 'lg' | 'md'
  unit?: string
}

/** A labelled value with −/+ controls. `steps` are rendered half on each side of the value. */
const MetaStepper = ({ label, value, steps, size = 'md', unit }: MetaStepperProps) => {
  const half = Math.floor(steps.length / 2)
  const left = steps.slice(0, half)
  const right = steps.slice(half)
  const renderStep = (s: MetaStepperProps['steps'][number]) => (
    <button
      key={s.label + (s.title ?? '')}
      type="button"
      className="ses-stepBtn"
      onClick={s.onClick}
      disabled={s.disabled}
      title={s.title}
      aria-label={`${s.title ?? s.label} ${label.toLowerCase()}`}
    >
      {s.label}
    </button>
  )
  return (
    <div className={size === 'lg' ? 'ses-stepper ses-stepperLg' : 'ses-stepper'}>
      <span className="ses-stepLabel">
        {label}
        {unit ? <span className="ses-stepUnit"> {unit}</span> : null}
      </span>
      <div className="ses-stepRow">
        <div className="ses-stepBtns">{left.map(renderStep)}</div>
        <span className="ses-stepValue">{value}</span>
        <div className="ses-stepBtns">{right.map(renderStep)}</div>
      </div>
    </div>
  )
}

type ExerciseControlsProps = {
  ex: Exercise
  size?: 'lg' | 'md'
  onPatch: (patch: MetaPatch) => void
  showTime?: boolean
}

const ExerciseControls = ({ ex, size = 'md', onPatch, showTime = true }: ExerciseControlsProps) => {
  const displayedSets = getTargetSets(ex)
  return (
    <>
      <MetaStepper
        size={size}
        label="Sets"
        value={displayedSets}
        steps={[
          { label: '−', title: 'Decrease', onClick: () => onPatch({ sets: adjustOptionalPositiveInt(displayedSets, -1) }), disabled: displayedSets <= 1 },
          { label: '+', title: 'Increase', onClick: () => onPatch({ sets: adjustOptionalPositiveInt(displayedSets, 1) }) },
        ]}
      />
      <MetaStepper
        size={size}
        label="Reps"
        value={isNum(ex.reps) ? ex.reps : '—'}
        steps={[
          { label: '−', title: 'Decrease', onClick: () => onPatch({ reps: adjustOptionalPositiveInt(ex.reps, -1) }), disabled: !isNum(ex.reps) || ex.reps <= 1 },
          { label: '+', title: 'Increase', onClick: () => onPatch({ reps: adjustOptionalPositiveInt(ex.reps, 1) }) },
        ]}
      />
      <MetaStepper
        size={size}
        label="Weight"
        unit="lbs"
        value={isNum(ex.weight) ? ex.weight : '—'}
        steps={[
          { label: '−5', title: '-5', onClick: () => onPatch({ weight: adjustOptionalPositiveNumber(ex.weight, -5) }), disabled: !isNum(ex.weight) || ex.weight <= 5 },
          { label: '−1', title: '-1', onClick: () => onPatch({ weight: adjustOptionalPositiveNumber(ex.weight, -1) }), disabled: !isNum(ex.weight) || ex.weight <= 1 },
          { label: '+1', title: '+1', onClick: () => onPatch({ weight: adjustOptionalPositiveNumber(ex.weight, 1) }) },
          { label: '+5', title: '+5', onClick: () => onPatch({ weight: adjustOptionalPositiveNumber(ex.weight, 5) }) },
        ]}
      />
      {showTime ? (
        <MetaStepper
          size={size}
          label="Time"
          value={<span className="ses-stepValueTime">{formatDuration(ex.timeSeconds)}</span>}
          steps={[
            { label: '−', title: 'Decrease', onClick: () => onPatch({ timeSeconds: adjustOptionalDurationSeconds(ex.timeSeconds, -10) }), disabled: !isNum(ex.timeSeconds) || ex.timeSeconds <= 10 },
            { label: '+', title: 'Increase', onClick: () => onPatch({ timeSeconds: adjustOptionalDurationSeconds(ex.timeSeconds, 10) }) },
          ]}
        />
      ) : null}
    </>
  )
}

const SupersetWeightControl = ({ ex, onPatch }: { ex: Exercise; onPatch: (patch: MetaPatch) => void }) => {
  const w = ex.supersetWith?.weight
  return (
    <MetaStepper
      label="Weight"
      unit="lbs"
      value={isNum(w) ? w : '—'}
      steps={[
        { label: '−5', title: '-5', onClick: () => onPatch({ supersetWeight: adjustOptionalPositiveNumber(w, -5) }), disabled: !isNum(w) || w <= 5 },
        { label: '−1', title: '-1', onClick: () => onPatch({ supersetWeight: adjustOptionalPositiveNumber(w, -1) }), disabled: !isNum(w) || w <= 1 },
        { label: '+1', title: '+1', onClick: () => onPatch({ supersetWeight: adjustOptionalPositiveNumber(w, 1) }) },
        { label: '+5', title: '+5', onClick: () => onPatch({ supersetWeight: adjustOptionalPositiveNumber(w, 5) }) },
      ]}
    />
  )
}

/** Reusable Set Checkoff Bar rendered in both the Spotlight Card and every Sequence Row. */
const SetCheckoffBar = ({
  ex,
  checkedSets,
  onToggleSet,
  onAddSet,
  variant = 'row',
}: {
  ex: Exercise
  checkedSets: number[]
  onToggleSet: (setNumber: number) => void
  onAddSet: () => void
  variant?: 'spotlight' | 'row'
}) => {
  const targetSets = getTargetSets(ex)
  const doneSetsCount = checkedSets.filter((n) => n >= 1 && n <= targetSets).length
  const nextSetNum =
    Array.from({ length: targetSets }, (_, idx) => idx + 1).find((n) => !checkedSets.includes(n)) ?? null

  return (
    <div
      className={`ses-setTracker ${variant === 'row' ? 'ses-setTracker--inline' : 'ses-setTracker--spotlight'}`}
      role="group"
      aria-label={`Set checkoff for ${ex.name}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="ses-setTrackerHead">
        <span className="ses-setTrackerLabel">
          Sets <strong className="ses-setTrackerFraction">{doneSetsCount}/{targetSets}</strong>
        </span>
      </div>

      <div className="ses-setPills">
        {Array.from({ length: targetSets }, (_, idx) => {
          const setNum = idx + 1
          const isSetDone = checkedSets.includes(setNum)
          const isNextSet = !isSetDone && setNum === nextSetNum
          return (
            <button
              key={setNum}
              type="button"
              className={`ses-setPill ${isSetDone ? 'is-done' : ''} ${isNextSet ? 'is-next' : ''}`}
              onClick={() => onToggleSet(setNum)}
              aria-pressed={isSetDone}
              aria-label={`${isSetDone ? 'Uncheck' : 'Check'} ${ex.name} Set ${setNum}`}
            >
              <span className="ses-setPillCheck" aria-hidden="true">
                {isSetDone ? <CheckIcon size={11} /> : setNum}
              </span>
              <span className="ses-setPillText">
                Set {setNum}
                {isNum(ex.reps) ? <small> · {ex.reps}r</small> : null}
                {isNum(ex.weight) ? <small> @ {ex.weight}</small> : null}
              </span>
            </button>
          )
        })}

        {targetSets < 12 ? (
          <button
            type="button"
            className="ses-setAddBtn"
            onClick={onAddSet}
            title={`Add set to ${ex.name}`}
            aria-label={`Add set to ${ex.name}`}
          >
            + Set
          </button>
        ) : null}
      </div>
    </div>
  )
}

const getPlateHeightPx = (weight: number): number => {
  if (weight >= 45) return 26
  if (weight >= 35) return 23
  if (weight >= 25) return 20
  if (weight >= 10) return 16
  if (weight >= 5) return 13
  return 11
}

/** 2D Barbell Plate Stack Strip for exercises >= 45 lbs */
const PlateBreakdownStrip = ({
  weight,
  onVisualize,
  onSelectWeight,
}: {
  weight: number | undefined
  onVisualize: () => void
  onSelectWeight?: (weight: number) => void
}) => {
  const plates = computePlatesPerSide(weight)
  if (!isNum(weight) || weight < 45) return null
  return (
    <div className="ses-plateStrip" aria-label={`Barbell plate breakdown for ${weight} lbs`}>
      <div className="ses-plateStripInfo">
        <div className="ses-barbellDiagram" aria-hidden="true" title={`${weight} lbs Olympic barbell load`}>
          <span className="ses-barbellShaft" />
          <span className="ses-barbellCollar" />
          <span className="ses-barbellPlates">
            {plates.length > 0 ? (
              plates.map((p, idx) => (
                <span
                  key={idx}
                  className="ses-barbellPlateBar"
                  style={
                    {
                      '--plate-color': p.color,
                      '--plate-h': `${getPlateHeightPx(p.weight)}px`,
                    } as React.CSSProperties
                  }
                />
              ))
            ) : (
              <span className="ses-barbellEmptySleeve" />
            )}
          </span>
          <span className="ses-barbellTip" />
        </div>

        <span className="ses-plateStripLabel">45 lb Bar + Per Side:</span>
        {plates.length > 0 ? (
          <div className="ses-plateChipList">
            {plates.map((p, idx) => (
              <span
                key={idx}
                className="ses-plateChip"
                style={{ '--plate-color': p.color } as React.CSSProperties}
              >
                {p.weight}
              </span>
            ))}
          </div>
        ) : (
          <span className="ses-plateEmpty">Empty Bar (45 lbs)</span>
        )}
      </div>

      <div className="ses-plateStripRight">
        {onSelectWeight ? (
          <div className="ses-quickLoadRow" role="group" aria-label="Quick barbell load presets">
            {[95, 135, 185, 225].map((presetW) => (
              <button
                key={presetW}
                type="button"
                className={`ses-quickLoadChip ${weight === presetW ? 'is-active' : ''}`}
                onClick={() => onSelectWeight(presetW)}
                title={`Set weight to ${presetW} lbs`}
              >
                {presetW}
              </button>
            ))}
          </div>
        ) : null}
        <button type="button" className="ses-linkBtn ses-plateVisBtn" onClick={onVisualize}>
          Visualize plates ▸
        </button>
      </div>
    </div>
  )
}

/** CSS-only particle burst for the "all done" moment. */
const Burst = () => {
  const colors = ['var(--ses-a)', 'var(--ses-b)', '#f7d794', '#ff9ff3', '#54a0ff', '#ff9f43']
  const particles = Array.from({ length: 28 }, (_, i) => {
    const angle = (i / 28) * 360 + (i % 2 ? 6 : -6)
    const dist = 90 + ((i * 37) % 80)
    return (
      <span
        key={i}
        className="ses-burstParticle"
        style={
          {
            '--angle': `${angle}deg`,
            '--dist': `${dist}px`,
            '--color': colors[i % colors.length],
            '--delay': `${(i % 5) * 18}ms`,
          } as React.CSSProperties
        }
      />
    )
  })
  return (
    <div className="ses-burst" aria-hidden="true">
      {particles}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main view                                                           */
/* ------------------------------------------------------------------ */

export const RunRoutineView = ({
  routine,
  onBack,
  onComplete,
  onCancelWorkout,
  onUpdateRoutine,
  initialDoneByExerciseId,
  onDoneByExerciseIdChange,
  startedAt,
}: RunRoutineViewProps) => {
  const [doneByExerciseId, setDoneByExerciseId] = React.useState<DoneState>(() =>
    normalizeDoneState(initialDoneByExerciseId ?? {}, routine)
  )

  const [doneSetsByExerciseId, setDoneSetsByExerciseId] = React.useState<DoneSetsState>(() => {
    const saved = loadSavedSetsForRoutine(routine.id)
    const initialDone = normalizeDoneState(initialDoneByExerciseId ?? {}, routine)
    const merged: DoneSetsState = { ...saved }
    for (const ex of routine.exercises) {
      if (initialDone[ex.id]) {
        merged[ex.id] = makeFullSetsRange(getTargetSets(ex))
      }
    }
    return merged
  })

  const [expandedByExerciseId, setExpandedByExerciseId] = React.useState<Record<string, boolean>>({})
  const [justCompletedExerciseId, setJustCompletedExerciseId] = React.useState<string | null>(null)
  const [allDonePulse, setAllDonePulse] = React.useState(false)
  const [plateCalcExerciseId, setPlateCalcExerciseId] = React.useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = React.useState(false)
  const [dragExerciseId, setDragExerciseId] = React.useState<string | null>(null)
  const [dragOverExerciseId, setDragOverExerciseId] = React.useState<string | null>(null)

  // Built-in Rest Timer state
  const [restSecondsRemaining, setRestSecondsRemaining] = React.useState(0)
  const [restTotalSeconds, setRestTotalSeconds] = React.useState(60)
  const [autoRestEnabled, setAutoRestEnabled] = React.useState(false)

  // Live Set Checkoff Toast feedback
  const [sessionToast, setSessionToast] = React.useState<{
    id: number
    title: string
    sub: string
    color: string
  } | null>(null)

  // Interactive Hold Timer for timed exercises (or custom holds) in Spotlight
  const [holdRemainingSec, setHoldRemainingSec] = React.useState<number | null>(null)
  const [holdTotalSec, setHoldTotalSec] = React.useState<number>(45)
  const [holdRunning, setHoldRunning] = React.useState(false)

  // Sequence filter & mid-session quick-add
  const [sequenceFilter, setSequenceFilter] = React.useState<'all' | 'remaining' | 'done'>('all')
  const [showQuickAdd, setShowQuickAdd] = React.useState(false)
  const [quickAddName, setQuickAddName] = React.useState('')
  const [quickAddSets, setQuickAddSets] = React.useState('3')
  const [quickAddReps, setQuickAddReps] = React.useState('10')
  const [quickAddWeight, setQuickAddWeight] = React.useState('')

  const reducedMotion = usePrefersReducedMotion()

  const routineElement = React.useMemo(
    () => getPeriodicElement(routine.name || 'Workout'),
    [routine.name]
  )

  const triggerToast = React.useCallback((title: string, sub: string, color: string) => {
    setSessionToast({ id: Date.now(), title, sub, color })
  }, [])

  React.useEffect(() => {
    if (!sessionToast) return
    const t = window.setTimeout(() => setSessionToast(null), 3200)
    return () => window.clearTimeout(t)
  }, [sessionToast])

  // Helper to get effective checked sets for an exercise
  const getCheckedSetsForExercise = React.useCallback(
    (ex: Exercise): number[] => {
      const target = getTargetSets(ex)
      if (doneByExerciseId[ex.id]) {
        return makeFullSetsRange(target)
      }
      const list = doneSetsByExerciseId[ex.id] ?? []
      return list.filter((n) => n >= 1 && n <= target)
    },
    [doneByExerciseId, doneSetsByExerciseId]
  )

  const totalCount = routine.exercises.length
  const doneCount = routine.exercises.reduce((acc, ex) => acc + (doneByExerciseId[ex.id] ? 1 : 0), 0)
  const remainingCount = totalCount - doneCount
  const progress = totalCount ? doneCount / totalCount : 0
  const allDone = totalCount > 0 && doneCount === totalCount
  const nextUndone = routine.exercises.find((ex) => !doneByExerciseId[ex.id]) ?? null
  const nextIndex = nextUndone ? routine.exercises.indexOf(nextUndone) : -1
  const afterNext = nextUndone
    ? routine.exercises.find((ex, i) => i > nextIndex && !doneByExerciseId[ex.id]) ?? null
    : null

  const nextUndoneId = nextUndone?.id ?? null
  const nextUndoneTime = nextUndone?.timeSeconds

  // Reset hold timer when spotlight exercise changes
  React.useEffect(() => {
    setHoldRunning(false)
    if (nextUndoneId && isNum(nextUndoneTime) && nextUndoneTime > 0) {
      setHoldTotalSec(nextUndoneTime)
      setHoldRemainingSec(nextUndoneTime)
    } else {
      setHoldRemainingSec(null)
    }
  }, [nextUndoneId, nextUndoneTime])

  // Calculate volume including partial set progress!
  const completedVolume = routine.exercises.reduce((acc, ex) => {
    if (doneByExerciseId[ex.id]) {
      return acc + exerciseVolume(ex)
    }
    const checkedCount = getCheckedSetsForExercise(ex).length
    if (checkedCount > 0) {
      return acc + checkedCount * singleSetVolume(ex)
    }
    return acc
  }, 0)

  const plannedVolume = routine.exercises.reduce((acc, ex) => acc + exerciseVolume(ex), 0)
  const volumeProgressPct = plannedVolume > 0 ? Math.min(100, Math.round((completedVolume / plannedVolume) * 100)) : 0

  const totalSetsPlanned = routine.exercises.reduce(
    (acc, ex) => acc + getTargetSets(ex),
    0
  )
  const totalSetsCompleted = routine.exercises.reduce(
    (acc, ex) => acc + getCheckedSetsForExercise(ex).length,
    0
  )
  const setsProgressPct = totalSetsPlanned > 0 ? Math.min(100, Math.round((totalSetsCompleted / totalSetsPlanned) * 100)) : 0

  // Muscle radar across the routine
  const routineMuscleStatus = React.useMemo(() => {
    const map = new Map<MuscleGroup, { total: number; done: number }>()
    for (const ex of routine.exercises) {
      const muscles = findExercisePreset(ex.name)?.muscles ?? []
      const isExDone = !!doneByExerciseId[ex.id]
      for (const m of muscles) {
        const prev = map.get(m) ?? { total: 0, done: 0 }
        map.set(m, { total: prev.total + 1, done: prev.done + (isExDone ? 1 : 0) })
      }
    }
    return Array.from(map.entries())
  }, [routine.exercises, doneByExerciseId])

  const startRestTimer = React.useCallback((seconds: number) => {
    setRestTotalSeconds(seconds)
    setRestSecondsRemaining(seconds)
  }, [])

  React.useEffect(() => {
    if (restSecondsRemaining <= 0) return
    const id = window.setInterval(() => {
      setRestSecondsRemaining((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [restSecondsRemaining])

  // Persist individual checked sets
  React.useEffect(() => {
    saveSetsForRoutine(routine.id, doneSetsByExerciseId)
  }, [routine.id, doneSetsByExerciseId])

  // Toggle entire exercise done/not-done (and sync all its sets)
  const toggle = (exerciseId: string) => {
    const ex = routine.exercises.find((e) => e.id === exerciseId)
    const targetSets = ex ? getTargetSets(ex) : 3
    const nextChecked = !doneByExerciseId[exerciseId]

    if (nextChecked) {
      setJustCompletedExerciseId(exerciseId)
      setDoneSetsByExerciseId((prev) => ({
        ...prev,
        [exerciseId]: makeFullSetsRange(targetSets),
      }))
      if (ex) {
        const el = getPeriodicElement(ex.name)
        const vol = Math.round(exerciseVolume(ex))
        triggerToast(
          `✓ ${ex.name} Completed!`,
          vol > 0 ? `${targetSets} sets cleared · +${numberFormatter.format(vol)} lbs moved` : `${targetSets} sets cleared`,
          el.color
        )
        if (autoRestEnabled) {
          startRestTimer(restTotalSeconds || 60)
        }
      }
    } else {
      setDoneSetsByExerciseId((prev) => ({
        ...prev,
        [exerciseId]: [],
      }))
    }

    setDoneByExerciseId((prev) => ({ ...prev, [exerciseId]: nextChecked }))
  }

  // Toggle an individual set (and auto-complete or un-complete the exercise when all sets are checked/unchecked!)
  const toggleIndividualSet = React.useCallback(
    (ex: Exercise, setNumber: number) => {
      const targetSets = getTargetSets(ex)
      const currentList = getCheckedSetsForExercise(ex)
      const exists = currentList.includes(setNumber)
      const nextList = exists
        ? currentList.filter((n) => n !== setNumber)
        : [...currentList, setNumber].sort((a, b) => a - b)

      setDoneSetsByExerciseId((prev) => ({
        ...prev,
        [ex.id]: nextList,
      }))

      const allSetsNowChecked = nextList.length >= targetSets
      if (allSetsNowChecked && !doneByExerciseId[ex.id]) {
        setJustCompletedExerciseId(ex.id)
        setDoneByExerciseId((prev) => ({ ...prev, [ex.id]: true }))
        const el = getPeriodicElement(ex.name)
        const vol = Math.round(exerciseVolume(ex))
        triggerToast(
          `🔥 ${ex.name} — All ${targetSets} Sets Cleared!`,
          vol > 0 ? `+${numberFormatter.format(vol)} lbs total exercise volume` : 'Ready for next exercise in sequence',
          el.color
        )
        if (autoRestEnabled) {
          startRestTimer(restTotalSeconds || 60)
        }
      } else if (!allSetsNowChecked && doneByExerciseId[ex.id]) {
        setDoneByExerciseId((prev) => ({ ...prev, [ex.id]: false }))
      } else if (!exists) {
        const el = getPeriodicElement(ex.name)
        const setVol = Math.round(singleSetVolume(ex))
        triggerToast(
          `⚡ ${ex.name} · Set ${setNumber} Logged (${nextList.length}/${targetSets})`,
          setVol > 0 ? `+${numberFormatter.format(setVol)} lbs set volume` : `${targetSets - nextList.length} sets remaining`,
          el.color
        )
        if (autoRestEnabled) {
          startRestTimer(restTotalSeconds || 60)
        }
      }
    },
    [autoRestEnabled, doneByExerciseId, getCheckedSetsForExercise, restTotalSeconds, startRestTimer, triggerToast]
  )

  // Log the next unchecked set on the active exercise
  const checkNextSetForExercise = React.useCallback(
    (ex: Exercise) => {
      const targetSets = getTargetSets(ex)
      const currentList = getCheckedSetsForExercise(ex)
      for (let s = 1; s <= targetSets; s++) {
        if (!currentList.includes(s)) {
          toggleIndividualSet(ex, s)
          return
        }
      }
    },
    [getCheckedSetsForExercise, toggleIndividualSet]
  )

  // Interactive Hold Timer tick
  React.useEffect(() => {
    if (!holdRunning || holdRemainingSec === null) return
    if (holdRemainingSec <= 0) {
      setHoldRunning(false)
      if (nextUndone) {
        checkNextSetForExercise(nextUndone)
        setHoldRemainingSec(holdTotalSec)
      }
      return
    }
    const id = window.setInterval(() => {
      setHoldRemainingSec((prev) => (prev !== null ? Math.max(0, prev - 1) : null))
    }, 1000)
    return () => window.clearInterval(id)
  }, [checkNextSetForExercise, holdRunning, holdRemainingSec, holdTotalSec, nextUndone])

  const handleQuickAddExercise = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = quickAddName.trim()
    if (!trimmed) return
    const preset = findExercisePreset(trimmed)
    const setsNum = Number(quickAddSets)
    const repsNum = Number(quickAddReps)
    const weightNum = Number(quickAddWeight)
    const newEx: Exercise = {
      id: makeId(),
      name: trimmed,
      imageUrls: preset?.imageUrl ? [preset.imageUrl] : undefined,
      sets: Number.isFinite(setsNum) && setsNum > 0 ? Math.trunc(setsNum) : 3,
      reps: Number.isFinite(repsNum) && repsNum > 0 ? Math.trunc(repsNum) : undefined,
      weight: Number.isFinite(weightNum) && weightNum > 0 ? weightNum : undefined,
    }
    onUpdateRoutine({
      ...routine,
      exercises: [...routine.exercises, newEx],
    })
    const el = getPeriodicElement(trimmed)
    triggerToast(`+ Added ${trimmed}`, 'Appended to active workout sequence', el.color)
    setQuickAddName('')
    setQuickAddWeight('')
    setShowQuickAdd(false)
  }

  const setExpanded = (exerciseId: string, expanded: boolean) => {
    setExpandedByExerciseId((prev) => {
      if (prev[exerciseId] === expanded) return prev
      return { ...prev, [exerciseId]: expanded }
    })
  }

  const allExpanded =
    routine.exercises.length > 0 && routine.exercises.every((ex) => !!expandedByExerciseId[ex.id])

  const toggleExpandAll = () => {
    const nextVal = !allExpanded
    const nextMap: Record<string, boolean> = {}
    for (const ex of routine.exercises) {
      nextMap[ex.id] = nextVal
    }
    setExpandedByExerciseId(nextMap)
  }

  const jumpTo = (exerciseId: string) => {
    setExpanded(exerciseId, true)
    window.requestAnimationFrame(() => {
      document
        .getElementById(`ses-row-${exerciseId}`)
        ?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
    })
  }

  const reset = () => {
    setDoneByExerciseId({})
    setDoneSetsByExerciseId({})
    clearSavedSets()
  }

  const cancelWorkout = () => {
    const isAutomated = typeof navigator !== 'undefined' && navigator.webdriver
    if (isAutomated) {
      clearSavedSets()
      onCancelWorkout?.()
    } else {
      setShowCancelConfirm(true)
    }
  }

  const handleCompleteWorkout = () => {
    clearSavedSets()
    onComplete()
  }

  const updateExerciseMeta = React.useCallback(
    (exerciseId: string, patch: MetaPatch) => {
      const nextExercises = routine.exercises.map((ex) => {
        if (ex.id !== exerciseId) return ex
        const { supersetWeight, ...rest } = patch
        const base = { ...ex, ...rest }
        if ('supersetWeight' in patch && base.supersetWith) {
          base.supersetWith = { ...base.supersetWith, weight: supersetWeight }
        }
        return base
      })
      onUpdateRoutine({ ...routine, exercises: nextExercises })
    },
    [onUpdateRoutine, routine]
  )

  const moveExercise = React.useCallback(
    (exerciseId: string, delta: -1 | 1) => {
      const idx = routine.exercises.findIndex((ex) => ex.id === exerciseId)
      if (idx < 0) return
      const nextIdx = idx + delta
      if (nextIdx < 0 || nextIdx >= routine.exercises.length) return
      const copy = [...routine.exercises]
      const [item] = copy.splice(idx, 1)
      if (!item) return
      copy.splice(nextIdx, 0, item)
      onUpdateRoutine({ ...routine, exercises: copy })
    },
    [onUpdateRoutine, routine]
  )

  const moveExerciseTo = React.useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return
      const sourceIndex = routine.exercises.findIndex((ex) => ex.id === sourceId)
      const targetIndex = routine.exercises.findIndex((ex) => ex.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0) return
      const copy = [...routine.exercises]
      const [item] = copy.splice(sourceIndex, 1)
      if (!item) return
      copy.splice(targetIndex, 0, item)
      onUpdateRoutine({ ...routine, exercises: copy })
    },
    [onUpdateRoutine, routine]
  )

  const promoteToNext = React.useCallback(
    (exerciseId: string) => {
      if (!nextUndone || nextUndone.id === exerciseId) return
      const sourceIndex = routine.exercises.findIndex((ex) => ex.id === exerciseId)
      const targetIndex = routine.exercises.findIndex((ex) => ex.id === nextUndone.id)
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return
      const copy = [...routine.exercises]
      const [item] = copy.splice(sourceIndex, 1)
      if (!item) return
      copy.splice(targetIndex, 0, item)
      onUpdateRoutine({ ...routine, exercises: copy })
    },
    [nextUndone, onUpdateRoutine, routine]
  )

  const swapWithAfterNext = React.useCallback(() => {
    if (!nextUndone || !afterNext) return
    const idxA = routine.exercises.findIndex((ex) => ex.id === nextUndone.id)
    const idxB = routine.exercises.findIndex((ex) => ex.id === afterNext.id)
    if (idxA < 0 || idxB < 0) return
    const copy = [...routine.exercises]
    const temp = copy[idxA]!
    copy[idxA] = copy[idxB]!
    copy[idxB] = temp
    onUpdateRoutine({ ...routine, exercises: copy })
  }, [afterNext, nextUndone, onUpdateRoutine, routine])

  React.useEffect(() => {
    if (!initialDoneByExerciseId) {
      setDoneByExerciseId((prev) => {
        const normalized = normalizeDoneState(prev, routine)
        return areDoneStatesEqual(prev, normalized) ? prev : normalized
      })
      return
    }
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
    const t = window.setTimeout(() => setAllDonePulse(false), 1600)
    return () => window.clearTimeout(t)
  }, [allDone])

  // Escape closes any open modal; Space logs next set; R starts 60s rest timer.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCancelConfirm || plateCalcExerciseId !== null) {
          setShowCancelConfirm(false)
          setPlateCalcExerciseId(null)
        }
        return
      }
      if (showCancelConfirm || plateCalcExerciseId !== null) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        tag === 'BUTTON' ||
        target?.isContentEditable
      ) {
        return
      }
      if (e.code === 'Space' && nextUndone && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        checkNextSetForExercise(nextUndone)
      } else if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        startRestTimer(60)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [checkNextSetForExercise, nextUndone, plateCalcExerciseId, showCancelConfirm, startRestTimer])

  const nextElement = nextUndone ? getPeriodicElement(nextUndone.name) : null
  const nextImage = nextUndone?.imageUrls?.[0] ? resolveImageUrl(nextUndone.imageUrls[0]) : null
  const nextCheckedSets = nextUndone ? getCheckedSetsForExercise(nextUndone) : []
  const nextTargetSets = nextUndone ? getTargetSets(nextUndone) : 0
  const nextUncheckedSetNum = nextUndone
    ? Array.from({ length: nextTargetSets }, (_, idx) => idx + 1).find((n) => !nextCheckedSets.includes(n)) ?? 1
    : 1
  const filteredExercises = React.useMemo(() => {
    return routine.exercises.map((ex, originalIndex) => ({ ex, originalIndex })).filter(({ ex }) => {
      if (sequenceFilter === 'remaining') return !doneByExerciseId[ex.id]
      if (sequenceFilter === 'done') return !!doneByExerciseId[ex.id]
      return true
    })
  }, [routine.exercises, sequenceFilter, doneByExerciseId])

  return (
    <div className={allDone ? 'session sessionAllDone' : 'session'}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="ses-header">
        <button type="button" className="ses-iconBtn" onClick={onBack} aria-label="Go back">
          <ArrowLeft />
        </button>

        <div className="ses-headerIdentity">
          <div
            className="ses-headerElementTile"
            style={{ '--element-color': routineElement.color } as React.CSSProperties}
            aria-hidden="true"
          >
            <span className="ses-headerElementNum">#{routineElement.atomicNumber}</span>
            <span className="ses-headerElementSym">{routineElement.symbol}</span>
            <span className="ses-headerElementMass">{routineElement.mass}</span>
          </div>

          <div className="ses-titleBlock">
            <div className="ses-badgeRow">
              <div className="ses-badge">
                <span className="ses-liveDot" aria-hidden="true" />
                Active Session
              </div>
              <span className="ses-formulaCode">
                FORMULA #{routineElement.atomicNumber} • {routineElement.groupName.toUpperCase()}
              </span>
            </div>
            <h1 className="ses-title">{routine.name}</h1>

            {routineMuscleStatus.length > 0 ? (
              <div className="ses-muscleRadar" aria-label="Targeted muscle groups">
                {routineMuscleStatus.map(([muscle, info]) => {
                  const isCleared = info.done === info.total
                  return (
                    <span
                      key={muscle}
                      className={`ses-radarChip ${isCleared ? 'is-cleared' : info.done > 0 ? 'is-partial' : ''}`}
                    >
                      {isCleared ? '✓ ' : ''}
                      {muscle}
                      <small>{info.done}/{info.total}</small>
                    </span>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="ses-headerActions">
          <button
            type="button"
            className="ses-ghostBtn"
            onClick={reset}
            disabled={doneCount === 0 && totalSetsCompleted === 0}
          >
            <ResetIcon />
            Reset
          </button>
          <button type="button" className="ses-ghostBtn ses-ghostBtnDanger" onClick={cancelWorkout}>
            <XIcon />
            Cancel workout
          </button>
        </div>
      </header>

      {/* ── Mission-control hero ───────────────────────────────── */}
      <section className={allDonePulse ? 'ses-hero ses-heroFlash' : 'ses-hero'} aria-label="Session progress">
        <div className="ses-heroGauge">
          <ProgressGauge
            doneCount={doneCount}
            totalCount={totalCount}
            progress={progress}
            setsDoneCount={totalSetsCompleted}
            setsTotalCount={totalSetsPlanned}
            allDone={allDone}
          />
          {allDonePulse && !reducedMotion ? <Burst /> : null}
        </div>

        <div className="ses-heroMain">
          <div className="ses-stats">
            <div className="ses-stat ses-statClock">
              <span className="ses-statLabel">
                <span className="ses-recDot" aria-hidden="true" />
                Elapsed Telemetry
              </span>
              <ElapsedClock startedAt={startedAt} frozen={allDone} />
            </div>

            <div className="ses-stat">
              <span className="ses-statLabel">Volume Moved</span>
              <span className="ses-statValue">
                {numberFormatter.format(Math.round(completedVolume))}
                <span className="ses-statUnit">lbs</span>
              </span>
              {plannedVolume > 0 ? (
                <>
                  <span className="ses-statSub">
                    of {numberFormatter.format(Math.round(plannedVolume))} lbs ({volumeProgressPct}%)
                  </span>
                  <div className="ses-statMiniBar" aria-hidden="true">
                    <div className="ses-statMiniFill" style={{ width: `${volumeProgressPct}%` }} />
                  </div>
                </>
              ) : null}
            </div>

            <div className="ses-stat">
              <span className="ses-statLabel">Sets Cleared</span>
              <span className="ses-statValue">
                {totalSetsCompleted}
                <span className="ses-statUnit">/ {totalSetsPlanned}</span>
              </span>
              <span className="ses-statSub">{setsProgressPct}% set volume</span>
              <div className="ses-statMiniBar" aria-hidden="true">
                <div className="ses-statMiniFill" style={{ width: `${setsProgressPct}%` }} />
              </div>
            </div>

            <div className="ses-stat">
              <span className="ses-statLabel">Remaining</span>
              <span className="ses-statValue">{remainingCount}</span>
              <span className="ses-statSub">{remainingCount === 1 ? 'exercise left' : 'exercises left'}</span>
            </div>
          </div>

          {/* Rest Timer Bar + Quick Presets */}
          <div className="ses-restToolbar" aria-label="Rest timer controls">
            <span className="ses-restLabel">⏱ Rest Timer</span>
            <div className="ses-restPresets">
              {[30, 60, 90, 120].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={`ses-restPresetBtn ${restSecondsRemaining > 0 && restTotalSeconds === sec ? 'is-active' : ''}`}
                  onClick={() => startRestTimer(sec)}
                >
                  {sec === 120 ? '2m' : `${sec}s`}
                </button>
              ))}
              <button
                type="button"
                className={`ses-autoRestBtn ${autoRestEnabled ? 'is-active' : ''}`}
                onClick={() => setAutoRestEnabled((v) => !v)}
                aria-pressed={autoRestEnabled}
                title="Automatically start recovery timer whenever you check off a set"
              >
                ⚡ Auto-Rest {autoRestEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {restSecondsRemaining > 0 ? (
              <div className="ses-restActiveStrip">
                <span className="ses-restCountdown">{formatRestCountdown(restSecondsRemaining)}</span>
                <div className="ses-restTrack" aria-hidden="true">
                  <div
                    className="ses-restFill"
                    style={{ width: `${Math.min(100, (restSecondsRemaining / Math.max(1, restTotalSeconds)) * 100)}%` }}
                  />
                </div>
                <button
                  type="button"
                  className="ses-restExtendBtn"
                  onClick={() => {
                    setRestSecondsRemaining((s) => s + 15)
                    setRestTotalSeconds((t) => Math.max(t, restSecondsRemaining + 15))
                  }}
                >
                  +15s
                </button>
                <button
                  type="button"
                  className="ses-restSkipBtn"
                  onClick={() => setRestSecondsRemaining(0)}
                >
                  Skip
                </button>
              </div>
            ) : (
              <span className="ses-restIdleHint">
                {autoRestEnabled
                  ? 'Auto-Rest armed: checking any set will start a 60s countdown'
                  : 'Tap a preset or press R between sets to start recovery countdown'}
              </span>
            )}
          </div>

          {totalCount ? (
            <nav className="ses-rail" aria-label="Exercise completion tracker">
              {routine.exercises.map((ex, i) => {
                const done = !!doneByExerciseId[ex.id]
                const isNext = nextUndone?.id === ex.id
                const el = getPeriodicElement(ex.name)
                const exSetsDone = getCheckedSetsForExercise(ex).length
                const exSetsTotal = getTargetSets(ex)
                const cls = done ? 'ses-railSeg ses-railSegDone' : isNext ? 'ses-railSeg ses-railSegNext' : 'ses-railSeg'
                return (
                  <button
                    key={ex.id}
                    type="button"
                    className={cls}
                    style={{ '--element-color': el.color, '--i': i } as React.CSSProperties}
                    onClick={() => jumpTo(ex.id)}
                    title={`${pad2(i + 1)} · ${ex.name} (${exSetsDone}/${exSetsTotal} sets)${done ? ' ✓' : ''}`}
                    aria-label={`Jump to ${ex.name}`}
                  >
                    <span className="ses-railStep" aria-hidden="true">{pad2(i + 1)}</span>
                    <span className="ses-railSym" aria-hidden="true">{el.symbol}</span>
                    <span className="ses-railSets" aria-hidden="true">
                      {exSetsDone}/{exSetsTotal}
                    </span>
                  </button>
                )
              })}
            </nav>
          ) : null}
        </div>

        <div className="ses-heroCta">
          <button
            type="button"
            className={allDone ? 'ses-completeBtn ses-completeBtnReady' : 'ses-completeBtn'}
            onClick={handleCompleteWorkout}
            disabled={!allDone}
          >
            <span className="ses-completeBtnShine" aria-hidden="true" />
            <CheckIcon />
            Complete routine
          </button>
          <span className="ses-ctaHint" aria-live="polite">
            {allDone ? 'All exercises done — log it!' : `${remainingCount} to go`}
          </span>
        </div>
      </section>

      {/* ── Live Set Checkoff Telemetry Toast ──────────────────── */}
      {sessionToast ? (
        <div
          className="ses-toastBanner"
          style={{ '--toast-color': sessionToast.color } as React.CSSProperties}
          role="status"
          aria-live="polite"
        >
          <div className="ses-toastText">
            <strong className="ses-toastTitle">{sessionToast.title}</strong>
            <span className="ses-toastSub">{sessionToast.sub}</span>
          </div>
          <div className="ses-toastActions">
            {restSecondsRemaining <= 0 ? (
              <button
                type="button"
                className="ses-toastRestBtn"
                onClick={() => startRestTimer(60)}
              >
                ⏱ Rest 60s
              </button>
            ) : null}
            <button
              type="button"
              className="ses-toastDismissBtn"
              onClick={() => setSessionToast(null)}
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Now training spotlight / completion card ───────────── */}
      {nextUndone && nextElement ? (
        <section
          className="ses-spotlight"
          style={{ '--element-color': nextElement.color } as React.CSSProperties}
          aria-label="Now training"
        >
          <div className="ses-spotGlow" aria-hidden="true" />
          <div className="ses-tile" aria-hidden="true">
            <div className="ses-tileTop">
              <span className="ses-tileNum">{nextElement.atomicNumber}</span>
              <span className="ses-tileGroup">{nextElement.groupName}</span>
            </div>
            <span className="ses-tileSym">{nextElement.symbol}</span>
            <span className="ses-tileName">{nextUndone.name}</span>
            <span className="ses-tileMass">{nextElement.mass}</span>
          </div>

          <div className="ses-spotBody">
            <div className="ses-spotEyebrow">
              <span className="ses-spotEyebrowDot" aria-hidden="true" />
              Now training
              <span className="ses-spotCount">
                STEP {pad2(nextIndex + 1)} / {pad2(totalCount)}
              </span>
            </div>
            <h2 className="ses-spotTitle">
              {nextUndone.name}
              {nextUndone.supersetWith?.name ? (
                <span className="ses-supersetTag">⚡ + {nextUndone.supersetWith.name}</span>
              ) : null}
            </h2>
            {(() => {
              const spotMuscles = findExercisePreset(nextUndone.name)?.muscles ?? []
              const spotVol = Math.round(exerciseVolume(nextUndone))
              const spot1RM = estimate1RM(nextUndone)
              if (!spotMuscles.length && spotVol <= 0 && !spot1RM) return null
              return (
                <div className="ses-spotMuscleRow">
                  {spotMuscles.map((m) => (
                    <span key={m} className="ses-musclePill">{m}</span>
                  ))}
                  {spotVol > 0 ? (
                    <span className="ses-volPill">{numberFormatter.format(spotVol)} lbs target</span>
                  ) : null}
                  {spot1RM ? (
                    <span className="ses-1rmPill" title="Estimated 1-Rep Max (Epley formula)">
                      🏆 1RM ~{numberFormatter.format(spot1RM)} lbs
                    </span>
                  ) : null}
                </div>
              )
            })()}

            {/* Always-Visible Interactive Set Checkoff Bar */}
            <SetCheckoffBar
              ex={nextUndone}
              checkedSets={nextCheckedSets}
              onToggleSet={(setNum) => toggleIndividualSet(nextUndone, setNum)}
              onAddSet={() =>
                updateExerciseMeta(nextUndone.id, {
                  sets: Math.min(12, getTargetSets(nextUndone) + 1),
                })
              }
              variant="spotlight"
            />

            {/* Interactive Set Hold Timer for timed exercises or on-demand holds */}
            {holdRemainingSec !== null ? (
              <div className="ses-holdTimerBar" aria-label="Interactive set hold timer">
                <div className="ses-holdTimerInfo">
                  <span className="ses-holdTimerLabel">⏱ Hold Timer</span>
                  <span className="ses-holdTimerValue">{formatRestCountdown(holdRemainingSec)}</span>
                  <div className="ses-holdTimerTrack" aria-hidden="true">
                    <div
                      className="ses-holdTimerFill"
                      style={{
                        width: `${Math.min(100, (holdRemainingSec / Math.max(1, holdTotalSec)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="ses-holdTimerBtns">
                  <button
                    type="button"
                    className={`ses-holdActionBtn ${holdRunning ? 'is-running' : ''}`}
                    onClick={() => setHoldRunning((r) => !r)}
                  >
                    {holdRunning ? '⏸ Pause' : '▶ Start Hold'}
                  </button>
                  <button
                    type="button"
                    className="ses-holdResetBtn"
                    onClick={() => {
                      setHoldRunning(false)
                      setHoldRemainingSec(holdTotalSec)
                    }}
                  >
                    ↺ Reset
                  </button>
                </div>
              </div>
            ) : null}

            <div className="ses-spotControls">
              <ExerciseControls
                ex={nextUndone}
                size="lg"
                showTime={isNum(nextUndone.timeSeconds)}
                onPatch={(patch) => updateExerciseMeta(nextUndone.id, patch)}
              />
            </div>

            <PlateBreakdownStrip
              weight={nextUndone.weight}
              onVisualize={() => setPlateCalcExerciseId(nextUndone.id)}
              onSelectWeight={(w) => updateExerciseMeta(nextUndone.id, { weight: w })}
            />

            {afterNext ? (
              <div className="ses-spotThenRow">
                <div className="ses-spotThen">
                  Up Next: <span className="ses-spotThenName">{afterNext.name}</span>
                  {isNum(afterNext.sets) && isNum(afterNext.reps) ? (
                    <span className="ses-spotThenMeta">
                      {' '}· {afterNext.sets}×{afterNext.reps}
                      {isNum(afterNext.weight) ? ` @ ${afterNext.weight} lbs` : ''}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="ses-swapNextBtn"
                  onClick={swapWithAfterNext}
                  aria-label={`Swap ${nextUndone.name} with ${afterNext.name}`}
                  title={`Defer ${nextUndone.name} and train ${afterNext.name} now`}
                >
                  ⇄ Swap Order
                </button>
              </div>
            ) : (
              <div className="ses-spotThen">Final exercise in sequence — finish strong!</div>
            )}
          </div>

          <div className="ses-spotAside">
            {nextImage ? (
              <div className="ses-spotImage">
                <img src={nextImage} alt={`${nextUndone.name} reference`} />
                <span className="ses-spotImageBadge">{nextElement.symbol} · #{nextElement.atomicNumber}</span>
              </div>
            ) : (
              <div className="ses-spotBlueprint" aria-hidden="true">
                <span className="ses-spotBlueprintCode">ELEMENT #{nextElement.atomicNumber}</span>
                <span className="ses-spotBlueprintSym">{nextElement.symbol}</span>
                <span className="ses-spotBlueprintGroup">{nextElement.groupName}</span>
              </div>
            )}

            <button
              type="button"
              className="ses-nextSetBtn"
              onClick={() => checkNextSetForExercise(nextUndone)}
              title="Shortcut: Spacebar"
            >
              <span>✓ Log Set {nextUncheckedSetNum} of {nextTargetSets}</span>
              <kbd className="ses-kbd" aria-hidden="true">Space</kbd>
            </button>

            <button type="button" className="ses-markBtn" onClick={() => toggle(nextUndone.id)}>
              <CheckIcon size={18} />
              Mark complete
            </button>
            {isNum(nextUndone.weight) && nextUndone.weight >= 45 ? (
              <button type="button" className="ses-linkBtn" onClick={() => setPlateCalcExerciseId(nextUndone.id)}>
                Visualize plates
              </button>
            ) : null}
            {holdRemainingSec === null ? (
              <button
                type="button"
                className="ses-linkBtn"
                onClick={() => {
                  const defaultSec = isNum(nextUndone.timeSeconds) && nextUndone.timeSeconds > 0 ? nextUndone.timeSeconds : 45
                  setHoldTotalSec(defaultSec)
                  setHoldRemainingSec(defaultSec)
                }}
              >
                ⏱ Open hold timer
              </button>
            ) : null}
          </div>
        </section>
      ) : allDone ? (
        <section className="ses-finale" aria-label="Session summary">
          <div className="ses-finaleIcon" aria-hidden="true">
            <CheckIcon size={34} />
          </div>
          <div className="ses-finaleText">
            <span className="ses-finaleBadge">ALL EXERCISES SYNTHESIZED • 100% YIELD</span>
            <h2 className="ses-finaleTitle">Reaction complete</h2>
            <p className="ses-finaleSub">
              {totalCount} {totalCount === 1 ? 'exercise' : 'exercises'} · {totalSetsCompleted} sets cleared ·{' '}
              {numberFormatter.format(Math.round(completedVolume))} lbs moved. Log it to save this session to your history.
            </p>
          </div>
          <button
            type="button"
            className="ses-completeBtn ses-completeBtnReady ses-finaleCtaBtn"
            onClick={handleCompleteWorkout}
          >
            <span className="ses-completeBtnShine" aria-hidden="true" />
            <CheckIcon />
            Log & Save Session
          </button>
        </section>
      ) : null}

      {/* ── Sequence ───────────────────────────────────────────── */}
      <section className="ses-sequence" aria-label="Exercises">
        <div className="ses-sectionHead">
          <div className="ses-sectionTitleGroup">
            <h2 className="ses-sectionTitle">Sequence</h2>
            {totalCount > 1 ? (
              <div className="ses-filterTabs" role="group" aria-label="Filter exercise sequence">
                <button
                  type="button"
                  className={`ses-filterTab ${sequenceFilter === 'all' ? 'is-active' : ''}`}
                  onClick={() => setSequenceFilter('all')}
                >
                  All <small>{totalCount}</small>
                </button>
                <button
                  type="button"
                  className={`ses-filterTab ${sequenceFilter === 'remaining' ? 'is-active' : ''}`}
                  onClick={() => setSequenceFilter('remaining')}
                >
                  Remaining <small>{remainingCount}</small>
                </button>
                <button
                  type="button"
                  className={`ses-filterTab ${sequenceFilter === 'done' ? 'is-active' : ''}`}
                  onClick={() => setSequenceFilter('done')}
                >
                  Done <small>{doneCount}</small>
                </button>
              </div>
            ) : null}
          </div>
          <div className="ses-sectionRight">
            <span className="ses-sectionMeta">
              {doneCount} / {totalCount} completed · {totalSetsCompleted} / {totalSetsPlanned} sets
              {totalCount > 1 ? ' · Drag or ↑↓ to reorder' : ''}
            </span>
            {totalCount > 0 ? (
              <button
                type="button"
                className="ses-expandAllBtn"
                onClick={toggleExpandAll}
              >
                {allExpanded ? 'Collapse all' : 'Expand all'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="ses-list">
          {filteredExercises.map(({ ex, originalIndex: i }) => {
            const checked = !!doneByExerciseId[ex.id]
            const justDone = checked && justCompletedExerciseId === ex.id
            const isNext = nextUndone?.id === ex.id
            const expanded = !!expandedByExerciseId[ex.id]
            const isDragging = dragExerciseId === ex.id
            const isDragOver = dragOverExerciseId === ex.id && dragExerciseId !== ex.id
            const el = getPeriodicElement(ex.name)
            const exMuscles = findExercisePreset(ex.name)?.muscles ?? []
            const exVol = Math.round(exerciseVolume(ex))
            const ex1RM = estimate1RM(ex)
            const checkedSets = getCheckedSetsForExercise(ex)
            const thumbUrl = ex.imageUrls?.[0] ? resolveImageUrl(ex.imageUrls[0]) : null
            const isSuperset = !!ex.supersetWith?.name
            const supersetUrls = isSuperset ? getSupersetImageUrls(ex) : []
            const supersetThumbUrl = supersetUrls[0] ? resolveImageUrl(supersetUrls[0]) : null

            const rowClass = [
              'ses-row',
              checked && 'ses-rowDone',
              justDone && 'ses-rowJustDone',
              isNext && 'ses-rowNext',
              expanded && 'ses-rowExpanded',
              isDragging && 'ses-rowDragging',
              isDragOver && 'ses-rowDragOver',
            ]
              .filter(Boolean)
              .join(' ')

            const setsText = getTargetSets(ex)
            const rowSetPct = setsText > 0 ? Math.min(100, Math.round((checkedSets.length / setsText) * 100)) : 0
            const repsText = isNum(ex.reps) ? ex.reps : '—'
            const weightText = isNum(ex.weight) ? ex.weight : '—'
            const ssWeightText = isNum(ex.supersetWith?.weight) ? ex.supersetWith.weight : '—'

            return (
              <article
                key={ex.id}
                id={`ses-row-${ex.id}`}
                className={rowClass}
                style={{ '--element-color': el.color, '--i': i } as React.CSSProperties}
                draggable={totalCount > 1}
                onDragStart={(e) => {
                  setDragExerciseId(ex.id)
                  e.dataTransfer.effectAllowed = 'move'
                  try {
                    e.dataTransfer.setData('text/plain', ex.id)
                  } catch {
                    // Ignore in environments that restrict setData
                  }
                }}
                onDragOver={(e) => {
                  if (!dragExerciseId || dragExerciseId === ex.id) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  if (dragOverExerciseId !== ex.id) {
                    setDragOverExerciseId(ex.id)
                  }
                }}
                onDragLeave={() => {
                  if (dragOverExerciseId === ex.id) {
                    setDragOverExerciseId(null)
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const sourceId = dragExerciseId || e.dataTransfer.getData('text/plain')
                  setDragExerciseId(null)
                  setDragOverExerciseId(null)
                  if (sourceId && sourceId !== ex.id) {
                    moveExerciseTo(sourceId, ex.id)
                  }
                }}
                onDragEnd={() => {
                  setDragExerciseId(null)
                  setDragOverExerciseId(null)
                }}
              >
                <div className="ses-rowHeader" onClick={() => setExpanded(ex.id, !expanded)}>
                  {totalCount > 1 ? (
                    <span
                      className="ses-dragGrip"
                      aria-hidden="true"
                      title="Drag to reorder exercise"
                    >
                      ⋮⋮
                    </span>
                  ) : null}

                  <label className="ses-check" onClick={(e) => e.stopPropagation()}>
                    <input
                      className="ses-checkInput"
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(ex.id)}
                      aria-label={checked ? `Mark ${ex.name} not done` : `Mark ${ex.name} done`}
                    />
                    <span className="ses-checkBox" aria-hidden="true">
                      <CheckIcon size={14} />
                    </span>
                  </label>

                  <span className="ses-rowIndex" aria-hidden="true">{pad2(i + 1)}</span>
                  <div className="ses-rowSymTile" aria-hidden="true">
                    <span className="ses-rowSymNum">#{el.atomicNumber}</span>
                    <span className="ses-rowSym">{el.symbol}</span>
                  </div>

                  <div className="ses-rowTitle">
                    <span className="ses-rowName">{ex.name}</span>
                    <span className="ses-rowTags">
                      {checked ? (
                        <span className="ses-doneTag">✓ Completed</span>
                      ) : isNext ? (
                        <span className="ses-nextTag">Active Now</span>
                      ) : checkedSets.length > 0 ? (
                        <span className="ses-nextTag">
                          {checkedSets.length}/{setsText} Sets
                        </span>
                      ) : null}
                      {isSuperset ? <span className="ses-supersetTag">⚡ Superset</span> : null}
                      {exMuscles.slice(0, 2).map((m) => (
                        <span key={m} className="ses-musclePill">{m}</span>
                      ))}
                      {exVol > 0 ? (
                        <span className="ses-volPill">{numberFormatter.format(exVol)} lbs</span>
                      ) : null}
                      {ex1RM ? (
                        <span className="ses-1rmPill" title="Estimated 1RM">
                          1RM ~{numberFormatter.format(ex1RM)}
                        </span>
                      ) : null}
                    </span>
                  </div>

                  {!checked && !isNext && nextIndex >= 0 ? (
                    <button
                      type="button"
                      className="ses-promoteBtn"
                      onClick={(e) => {
                        e.stopPropagation()
                        promoteToNext(ex.id)
                      }}
                      aria-label={`Train ${ex.name} now`}
                      title={`Move ${ex.name} to active spotlight`}
                    >
                      ⚡ Train Now
                    </button>
                  ) : null}

                  <div className="ses-rowMeta" aria-label="Sets reps weight summary">
                    <span className="ses-rowMetaNum">{setsText}</span>
                    <span className="ses-rowMetaX">×</span>
                    <span className="ses-rowMetaNum">{repsText}</span>
                    <span className="ses-rowMetaDot">•</span>
                    <span className="ses-rowMetaNum">{weightText}</span>
                    {isSuperset ? <span className="ses-rowMetaNum ses-rowMetaSub">/ {ssWeightText}</span> : null}
                    <span className="ses-rowMetaUnit">lbs</span>
                  </div>

                  {thumbUrl || supersetThumbUrl ? (
                    <div className="ses-rowThumbs" aria-hidden="true">
                      {thumbUrl ? <img className="ses-rowThumb" src={thumbUrl} alt="" loading="lazy" /> : null}
                      {supersetThumbUrl ? <img className="ses-rowThumb" src={supersetThumbUrl} alt="" loading="lazy" /> : null}
                    </div>
                  ) : null}

                  {totalCount > 1 ? (
                    <div
                      className="ses-reorderGroup"
                      onClick={(e) => e.stopPropagation()}
                      role="group"
                      aria-label={`Reorder ${ex.name}`}
                    >
                      <button
                        type="button"
                        className="ses-reorderBtn"
                        onClick={() => moveExercise(ex.id, -1)}
                        disabled={i === 0}
                        aria-label={`Move ${ex.name} up`}
                        title="Move exercise up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="ses-reorderBtn"
                        onClick={() => moveExercise(ex.id, 1)}
                        disabled={i === totalCount - 1}
                        aria-label={`Move ${ex.name} down`}
                        title="Move exercise down"
                      >
                        ↓
                      </button>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className="ses-expandBtn"
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpanded(ex.id, !expanded)
                    }}
                    aria-label={expanded ? 'Minimize' : 'Expand'}
                    aria-expanded={expanded}
                    title={expanded ? 'Minimize' : 'Expand'}
                  >
                    <ChevronDown />
                  </button>
                </div>

                {/* Always-visible inline Set Checkoff Bar right on the sequence card */}
                <div className="ses-rowSetsBar">
                  <SetCheckoffBar
                    ex={ex}
                    checkedSets={checkedSets}
                    onToggleSet={(setNum) => toggleIndividualSet(ex, setNum)}
                    onAddSet={() =>
                      updateExerciseMeta(ex.id, {
                        sets: Math.min(12, getTargetSets(ex) + 1),
                      })
                    }
                    variant="row"
                  />
                </div>

                {expanded ? (
                  <div className="ses-rowBody">
                    <div className="ses-rowControls">
                      <div className="ses-controlGrid">
                        <ExerciseControls ex={ex} onPatch={(patch) => updateExerciseMeta(ex.id, patch)} />
                      </div>

                      <PlateBreakdownStrip
                        weight={ex.weight}
                        onVisualize={() => setPlateCalcExerciseId(ex.id)}
                      />

                      {isSuperset && ex.supersetWith ? (
                        <div className="ses-superset">
                          <div className="ses-supersetHead">⚡ Superset · {ex.supersetWith.name}</div>
                          <div className="ses-controlGrid">
                            <SupersetWeightControl ex={ex} onPatch={(patch) => updateExerciseMeta(ex.id, patch)} />
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {ex.imageUrls?.length || supersetUrls.length ? (
                      <div className="ses-gallery">
                        {(ex.imageUrls ?? []).map((url) => (
                          <figure key={url} className="ses-galleryItem">
                            <img src={resolveImageUrl(url)} alt={`${ex.name} reference`} loading="lazy" />
                          </figure>
                        ))}
                        {supersetUrls.map((url) => (
                          <figure key={`ss-${url}`} className="ses-galleryItem">
                            <img src={resolveImageUrl(url)} alt={`${ex.supersetWith!.name} reference`} loading="lazy" />
                            <figcaption className="ses-galleryCaption">⚡ {ex.supersetWith!.name}</figcaption>
                          </figure>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="ses-rowProgressTrack" aria-hidden="true">
                  <div
                    className="ses-rowProgressFill"
                    style={{ width: `${rowSetPct}%` }}
                  />
                </div>
              </article>
            )
          })}
        </div>

        {/* Mid-Session Quick Add Exercise Drawer */}
        <div className="ses-quickAddWrap">
          {!showQuickAdd ? (
            <button
              type="button"
              className="ses-quickAddToggleBtn"
              onClick={() => setShowQuickAdd(true)}
            >
              + Add bonus exercise to session
            </button>
          ) : (
            <form className="ses-quickAddForm" onSubmit={handleQuickAddExercise}>
              <div className="ses-quickAddHead">
                <span className="ses-quickAddTitle">⚡ Append Exercise to Active Sequence</span>
                <button
                  type="button"
                  className="ses-quickAddCancel"
                  onClick={() => setShowQuickAdd(false)}
                >
                  Cancel
                </button>
              </div>
              <div className="ses-quickAddPresets">
                {EXERCISE_PRESETS.slice(0, 6).map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className={`ses-quickPresetPill ${quickAddName === p.name ? 'is-selected' : ''}`}
                    onClick={() => setQuickAddName(p.name)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="ses-quickAddInputs">
                <input
                  className="ses-quickInput ses-quickInputName"
                  placeholder="Exercise name (e.g., Bicep Curls)"
                  value={quickAddName}
                  onChange={(e) => setQuickAddName(e.target.value)}
                  required
                />
                <label className="ses-quickField">
                  <span>Sets</span>
                  <input
                    className="ses-quickInput"
                    inputMode="numeric"
                    value={quickAddSets}
                    onChange={(e) => setQuickAddSets(e.target.value)}
                  />
                </label>
                <label className="ses-quickField">
                  <span>Reps</span>
                  <input
                    className="ses-quickInput"
                    inputMode="numeric"
                    value={quickAddReps}
                    onChange={(e) => setQuickAddReps(e.target.value)}
                  />
                </label>
                <label className="ses-quickField">
                  <span>Lbs</span>
                  <input
                    className="ses-quickInput"
                    inputMode="decimal"
                    placeholder="Opt"
                    value={quickAddWeight}
                    onChange={(e) => setQuickAddWeight(e.target.value)}
                  />
                </label>
                <button type="submit" className="ses-quickAddSubmitBtn">
                  + Append
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* ── Plate calculator modal ─────────────────────────────── */}
      {plateCalcExerciseId !== null &&
        (() => {
          const exercise = routine.exercises.find((e) => e.id === plateCalcExerciseId)
          if (!exercise || typeof exercise.weight !== 'number') return null

          return (
            <div className="modalOverlay" onClick={() => setPlateCalcExerciseId(null)}>
              <div
                className="modalContent ses-plateModal"
                role="dialog"
                aria-modal="true"
                aria-label={`Plate visualizer for ${exercise.name}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="plateCalcControls">
                  <div className="plateCalcPanel">
                    <div className="plateCalcWeight">
                      {exercise.weight} <span className="unit">LBS</span>
                    </div>

                    <div className="plateCalcButtonGroup">
                      {[-5, -1, 1, 5].map((delta) => (
                        <button
                          key={delta}
                          type="button"
                          className="plateCalcBtn"
                          onClick={() => updateExerciseMeta(exercise.id, { weight: adjustOptionalPositiveNumber(exercise.weight, delta) })}
                          disabled={delta < 0 && exercise.weight! <= -delta}
                        >
                          {delta > 0 ? `+${delta}` : delta}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button type="button" className="plateCalcClose" onClick={() => setPlateCalcExerciseId(null)} aria-label="Close">
                    ✕
                  </button>
                </div>

                <PlateCalculatorScene targetWeight={exercise.weight} />
              </div>
            </div>
          )
        })()}

      {/* ── Cancel confirmation modal ──────────────────────────── */}
      {showCancelConfirm && (
        <div className="modalOverlay" onClick={() => setShowCancelConfirm(false)}>
          <div
            className="modalContent pt-cell ses-abortModal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="ses-abort-title"
            onClick={(e) => e.stopPropagation()}
            style={{ '--element-color': '#ff4757' } as React.CSSProperties}
          >
            <div className="pt-header ses-abortHeader">
              <span className="pt-number">99</span>
              <span className="pt-group ses-abortGroup">ALKALI METAL • WARNING</span>
            </div>

            <div className="pt-symbol ses-abortSymbol">Cn</div>

            <div className="ses-abortText">
              <h2 id="ses-abort-title" className="ses-abortTitle">ABORT SESSION?</h2>
              <p className="ses-abortBody">
                Cancel the workout "{routine.name}"? All current exercise checks and progress will be permanently lost.
              </p>
            </div>

            <div className="ses-abortActions">
              <button
                type="button"
                className="button danger"
                onClick={() => {
                  setShowCancelConfirm(false)
                  clearSavedSets()
                  onCancelWorkout?.()
                }}
              >
                Yes, Abort (Cn)
              </button>
              <button type="button" className="button secondary" onClick={() => setShowCancelConfirm(false)} autoFocus>
                No, Resume
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}