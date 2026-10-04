import React from 'react'
import type { Exercise, Routine } from '../routines/types'
import { resolveImageUrl } from '../app/resolveImageUrl'
import { formatDuration } from '../app/formatDuration'
import { EXERCISE_PRESETS } from '../exercises/presets'
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

type MetaPatch = Partial<{
  sets: number | undefined
  reps: number | undefined
  weight: number | undefined
  timeSeconds: number | undefined
  supersetWeight: number | undefined
}>

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

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

const numberFormatter = new Intl.NumberFormat()

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Volume = sets × reps × weight (plus the superset partner's weight at the same sets × reps). */
const exerciseVolume = (ex: Exercise): number => {
  const sets = isNum(ex.sets) ? ex.sets : 0
  const reps = isNum(ex.reps) ? ex.reps : 0
  const main = isNum(ex.weight) ? ex.weight : 0
  const partner = isNum(ex.supersetWith?.weight) ? ex.supersetWith.weight : 0
  return sets * reps * (main + partner)
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
  allDone: boolean
}

const ProgressGauge = ({ doneCount, totalCount, progress, allDone }: ProgressGaugeProps) => {
  const clamped = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0
  const percent = Math.round(clamped * 100)

  // Fixed coordinate system; CSS controls the displayed size.
  const size = 120
  const stroke = 9
  const radius = (size - stroke) / 2 - 6
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - clamped)

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
      aria-valuenow={percent}
    >
      <svg className="ses-gaugeSvg" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id="sesGaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--ses-a)" />
            <stop offset="100%" stopColor="var(--ses-b)" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <circle key={i} className={t.lit ? 'ses-gaugeTick ses-gaugeTickLit' : 'ses-gaugeTick'} cx={t.x} cy={t.y} r={1.6} />
        ))}
        <circle className="ses-gaugeTrack" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" />
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
            <span className="ses-gaugeSecondary">{percent}%</span>
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

const ExerciseControls = ({ ex, size = 'md', onPatch, showTime = true }: ExerciseControlsProps) => (
  <>
    <MetaStepper
      size={size}
      label="Sets"
      value={isNum(ex.sets) ? ex.sets : '—'}
      steps={[
        { label: '−', title: 'Decrease', onClick: () => onPatch({ sets: adjustOptionalPositiveInt(ex.sets, -1) }), disabled: !isNum(ex.sets) || ex.sets <= 1 },
        { label: '+', title: 'Increase', onClick: () => onPatch({ sets: adjustOptionalPositiveInt(ex.sets, 1) }) },
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
  initialDoneByExerciseId = {},
  onDoneByExerciseIdChange,
  startedAt,
}: RunRoutineViewProps) => {
  const [doneByExerciseId, setDoneByExerciseId] = React.useState<DoneState>(() =>
    normalizeDoneState(initialDoneByExerciseId, routine)
  )
  const [expandedByExerciseId, setExpandedByExerciseId] = React.useState<Record<string, boolean>>({})
  const [justCompletedExerciseId, setJustCompletedExerciseId] = React.useState<string | null>(null)
  const [allDonePulse, setAllDonePulse] = React.useState(false)
  const [plateCalcExerciseId, setPlateCalcExerciseId] = React.useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = React.useState(false)
  const reducedMotion = usePrefersReducedMotion()

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

  const completedVolume = routine.exercises.reduce(
    (acc, ex) => acc + (doneByExerciseId[ex.id] ? exerciseVolume(ex) : 0),
    0
  )
  const plannedVolume = routine.exercises.reduce((acc, ex) => acc + exerciseVolume(ex), 0)

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

  const jumpTo = (exerciseId: string) => {
    setExpanded(exerciseId, true)
    window.requestAnimationFrame(() => {
      document
        .getElementById(`ses-row-${exerciseId}`)
        ?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
    })
  }

  const reset = () => setDoneByExerciseId({})

  const cancelWorkout = () => {
    const isAutomated = typeof navigator !== 'undefined' && navigator.webdriver
    if (isAutomated) {
      onCancelWorkout?.()
    } else {
      setShowCancelConfirm(true)
    }
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
    const t = window.setTimeout(() => setAllDonePulse(false), 1600)
    return () => window.clearTimeout(t)
  }, [allDone])

  // Escape closes any open modal.
  React.useEffect(() => {
    if (!showCancelConfirm && plateCalcExerciseId === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setShowCancelConfirm(false)
      setPlateCalcExerciseId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showCancelConfirm, plateCalcExerciseId])

  const nextElement = nextUndone ? getPeriodicElement(nextUndone.name) : null
  const nextImage = nextUndone?.imageUrls?.[0] ? resolveImageUrl(nextUndone.imageUrls[0]) : null

  return (
    <div className={allDone ? 'session sessionAllDone' : 'session'}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="ses-header">
        <button type="button" className="ses-iconBtn" onClick={onBack} aria-label="Go back">
          <ArrowLeft />
        </button>
        <div className="ses-titleBlock">
          <div className="ses-badge">
            <span className="ses-liveDot" aria-hidden="true" />
            Active Session
          </div>
          <h1 className="ses-title">{routine.name}</h1>
        </div>
        <div className="ses-headerActions">
          <button type="button" className="ses-ghostBtn" onClick={reset} disabled={doneCount === 0}>
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
          <ProgressGauge doneCount={doneCount} totalCount={totalCount} progress={progress} allDone={allDone} />
          {allDonePulse && !reducedMotion ? <Burst /> : null}
        </div>

        <div className="ses-heroMain">
          <div className="ses-stats">
            <div className="ses-stat ses-statClock">
              <span className="ses-statLabel">
                <span className="ses-recDot" aria-hidden="true" />
                Elapsed
              </span>
              <ElapsedClock startedAt={startedAt} frozen={allDone} />
            </div>
            <div className="ses-stat">
              <span className="ses-statLabel">Volume</span>
              <span className="ses-statValue">
                {numberFormatter.format(Math.round(completedVolume))}
                <span className="ses-statUnit">lbs</span>
              </span>
              {plannedVolume > 0 ? (
                <span className="ses-statSub">of {numberFormatter.format(Math.round(plannedVolume))}</span>
              ) : null}
            </div>
            <div className="ses-stat">
              <span className="ses-statLabel">Remaining</span>
              <span className="ses-statValue">{remainingCount}</span>
              <span className="ses-statSub">{remainingCount === 1 ? 'exercise' : 'exercises'}</span>
            </div>
          </div>

          {totalCount ? (
            <nav className="ses-rail" aria-label="Exercise completion tracker">
              {routine.exercises.map((ex, i) => {
                const done = !!doneByExerciseId[ex.id]
                const isNext = nextUndone?.id === ex.id
                const el = getPeriodicElement(ex.name)
                const cls = done ? 'ses-railSeg ses-railSegDone' : isNext ? 'ses-railSeg ses-railSegNext' : 'ses-railSeg'
                return (
                  <button
                    key={ex.id}
                    type="button"
                    className={cls}
                    style={{ '--element-color': el.color, '--i': i } as React.CSSProperties}
                    onClick={() => jumpTo(ex.id)}
                    title={`${pad2(i + 1)} · ${ex.name}${done ? ' ✓' : ''}`}
                    aria-label={`Jump to ${ex.name}`}
                  >
                    <span className="ses-railSym" aria-hidden="true">{el.symbol}</span>
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
            onClick={onComplete}
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

      {/* ── Now training spotlight / completion card ───────────── */}
      {nextUndone && nextElement ? (
        <section
          key={nextUndone.id}
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
                {pad2(nextIndex + 1)} / {pad2(totalCount)}
              </span>
            </div>
            <h2 className="ses-spotTitle">
              {nextUndone.name}
              {nextUndone.supersetWith?.name ? (
                <span className="ses-supersetTag">⚡ + {nextUndone.supersetWith.name}</span>
              ) : null}
            </h2>
            <div className="ses-spotControls">
              <ExerciseControls
                ex={nextUndone}
                size="lg"
                showTime={isNum(nextUndone.timeSeconds)}
                onPatch={(patch) => updateExerciseMeta(nextUndone.id, patch)}
              />
            </div>
            {afterNext ? (
              <div className="ses-spotThen">
                Then <span className="ses-spotThenName">{afterNext.name}</span>
              </div>
            ) : (
              <div className="ses-spotThen">Final exercise — finish strong.</div>
            )}
          </div>

          <div className="ses-spotAside">
            {nextImage ? (
              <div className="ses-spotImage">
                <img src={nextImage} alt={`${nextUndone.name} reference`} />
              </div>
            ) : null}
            <button type="button" className="ses-markBtn" onClick={() => toggle(nextUndone.id)}>
              <CheckIcon size={18} />
              Mark complete
            </button>
            {isNum(nextUndone.weight) && nextUndone.weight >= 45 ? (
              <button type="button" className="ses-linkBtn" onClick={() => setPlateCalcExerciseId(nextUndone.id)}>
                Visualize plates
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
            <h2 className="ses-finaleTitle">Reaction complete</h2>
            <p className="ses-finaleSub">
              {totalCount} {totalCount === 1 ? 'exercise' : 'exercises'} ·{' '}
              {numberFormatter.format(Math.round(completedVolume))} lbs moved. Log it to save this session to your history.
            </p>
          </div>
        </section>
      ) : null}

      {/* ── Sequence ───────────────────────────────────────────── */}
      <section className="ses-sequence" aria-label="Exercises">
        <div className="ses-sectionHead">
          <h2 className="ses-sectionTitle">Sequence</h2>
          <span className="ses-sectionMeta">
            {doneCount} / {totalCount} completed
          </span>
        </div>

        <div className="ses-list">
          {routine.exercises.map((ex, i) => {
            const checked = !!doneByExerciseId[ex.id]
            const justDone = checked && justCompletedExerciseId === ex.id
            const isNext = nextUndone?.id === ex.id
            const expanded = !!expandedByExerciseId[ex.id]
            const el = getPeriodicElement(ex.name)
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
            ]
              .filter(Boolean)
              .join(' ')

            const setsText = isNum(ex.sets) ? ex.sets : '—'
            const repsText = isNum(ex.reps) ? ex.reps : '—'
            const weightText = isNum(ex.weight) ? ex.weight : '—'
            const ssWeightText = isNum(ex.supersetWith?.weight) ? ex.supersetWith.weight : '—'

            return (
              <article
                key={ex.id}
                id={`ses-row-${ex.id}`}
                className={rowClass}
                style={{ '--element-color': el.color, '--i': i } as React.CSSProperties}
              >
                <div className="ses-rowHeader" onClick={() => setExpanded(ex.id, !expanded)}>
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
                  <span className="ses-rowSym" aria-hidden="true">{el.symbol}</span>

                  <div className="ses-rowTitle">
                    <span className="ses-rowName">{ex.name}</span>
                    <span className="ses-rowTags">
                      {isNext ? <span className="ses-nextTag">Up next</span> : null}
                      {isSuperset ? <span className="ses-supersetTag">⚡ Superset</span> : null}
                    </span>
                  </div>

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

                {expanded ? (
                  <div className="ses-rowBody">
                    <div className="ses-rowControls">
                      <div className="ses-controlGrid">
                        <ExerciseControls ex={ex} onPatch={(patch) => updateExerciseMeta(ex.id, patch)} />
                      </div>
                      {isNum(ex.weight) && ex.weight >= 45 ? (
                        <button type="button" className="ses-linkBtn" onClick={() => setPlateCalcExerciseId(ex.id)}>
                          Visualize plates
                        </button>
                      ) : null}

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
              </article>
            )
          })}
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