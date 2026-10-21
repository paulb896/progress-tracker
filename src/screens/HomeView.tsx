import React from 'react'
import type { Exercise, Routine } from '../routines/types'
import type { RoutineCompletion } from '../completions/types'
import { resolveImageUrl } from '../app/resolveImageUrl'
import { RecentActivity } from '../components/RecentActivity'
import { getPeriodicElement } from '../app/periodicTable'
import { findExercisePreset, type MuscleGroup } from '../exercises/presets'

type HomeViewProps = {
  routines: Routine[]
  completions: RoutineCompletion[]
  onCreate: () => void
  onHowTo: () => void
  onEdit: (routineId: string) => void
  onRun: (routineId: string) => void
  onDelete: (routineId: string) => void
  onViewCompletion: (completionId: string) => void
  onStats: () => void
  onPlayGame: () => void
  headerRight?: React.ReactNode
}

const numberFormatter = new Intl.NumberFormat()

const calcExerciseVolume = (ex: Exercise): number => {
  const sets = typeof ex.sets === 'number' && Number.isFinite(ex.sets) ? ex.sets : 0
  const reps = typeof ex.reps === 'number' && Number.isFinite(ex.reps) ? ex.reps : 0
  const weight = typeof ex.weight === 'number' && Number.isFinite(ex.weight) ? ex.weight : 0
  const partner =
    typeof ex.supersetWith?.weight === 'number' && Number.isFinite(ex.supersetWith.weight)
      ? ex.supersetWith.weight
      : 0
  return sets * reps * (weight + partner)
}

const calcRoutineVolume = (exercises: Exercise[]): number =>
  exercises.reduce((acc, ex) => acc + calcExerciseVolume(ex), 0)

const getRoutineMuscles = (exercises: Exercise[]): MuscleGroup[] => {
  const seen = new Set<MuscleGroup>()
  for (const ex of exercises) {
    const preset = findExercisePreset(ex.name)
    if (preset?.muscles) {
      for (const m of preset.muscles) seen.add(m)
    }
    if (ex.supersetWith?.name) {
      const ssPreset = findExercisePreset(ex.supersetWith.name)
      if (ssPreset?.muscles) {
        for (const m of ssPreset.muscles) seen.add(m)
      }
    }
  }
  return Array.from(seen)
}

export const HomeView = ({
  routines,
  completions,
  onCreate,
  onHowTo,
  onPlayGame,
  onEdit,
  onRun,
  onDelete,
  onViewCompletion,
  onStats,
  headerRight,
}: HomeViewProps) => {
  const totalVolumeMoved = React.useMemo(
    () =>
      Math.round(
        completions.reduce((acc, c) => acc + calcRoutineVolume(c.exercises ?? []), 0)
      ),
    [completions]
  )

  const totalExercisesCataloged = React.useMemo(
    () => routines.reduce((acc, r) => acc + r.exercises.length, 0),
    [routines]
  )

  const completionsByRoutineId = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const c of completions) {
      map.set(c.routineId, (map.get(c.routineId) ?? 0) + 1)
    }
    return map
  }, [completions])

  const [selectedMuscle, setSelectedMuscle] = React.useState<MuscleGroup | 'ALL'>('ALL')

  const availableMuscles = React.useMemo(() => {
    const set = new Set<MuscleGroup>()
    for (const r of routines) {
      for (const m of getRoutineMuscles(r.exercises)) {
        set.add(m)
      }
    }
    return Array.from(set)
  }, [routines])

  const filteredRoutines = React.useMemo(() => {
    if (selectedMuscle === 'ALL') return routines
    return routines.filter((r) => getRoutineMuscles(r.exercises).includes(selectedMuscle))
  }, [routines, selectedMuscle])

  return (
    <>
      <section className="heroSection">
        <div className="heroAmbientGlow" aria-hidden="true" />
        <img src={resolveImageUrl('/logo.png')} alt="Progress Tracker" className="heroLogo" />
        <div className="heroContent">
          <div className="heroBadge">
            <span className="heroBadgeDot" aria-hidden="true" />
            REACTOR TELEMETRY • OFFLINE-FIRST LAB
          </div>
          <h1
            className="heroTitle"
            aria-label="Create your routines with custom exercises and achieve your fitness goals."
          >
            Design your routines. <br />
            Log your power. <br />
            Track your <span className="textGradient">progress.</span>
          </h1>
          <p className="heroSubtitle">
            A precision, element-driven training console engineered to visualize muscle recovery, barbell plate loading, and volume progression over time.
          </p>

          <div className="heroActions">
            <button className="button primary bigButton" type="button" onClick={onCreate}>
              Start New Routine
            </button>
            <button className="button secondary bigButton outlineButton" type="button" onClick={onStats}>
              Progress Stats
            </button>
            <button className="button secondary bigButton outlineButton" type="button" onClick={onHowTo}>
              How to Guides
            </button>
          </div>

          <div className="heroTelemetryStrip" aria-label="Training telemetry summary">
            <div className="heroTelemetryItem">
              <span className="heroTelemetryLabel">Formulas</span>
              <span className="heroTelemetryValue">{routines.length}</span>
            </div>
            <div className="heroTelemetryItem">
              <span className="heroTelemetryLabel">Exercises</span>
              <span className="heroTelemetryValue">{totalExercisesCataloged}</span>
            </div>
            <div className="heroTelemetryItem">
              <span className="heroTelemetryLabel">Sessions</span>
              <span className="heroTelemetryValue">{completions.length}</span>
            </div>
            <div className="heroTelemetryItem">
              <span className="heroTelemetryLabel">Volume Moved</span>
              <span className="heroTelemetryValue">
                {numberFormatter.format(totalVolumeMoved)}
                <small> lbs</small>
              </span>
            </div>
          </div>
        </div>

        <div className="heroCanvasWrapper">
          <div className="heroCanvasFadeTop" />
          <div className="heroCanvasFadeBottom" />
          <div className="heroCanvasFadeLeft" />
          {headerRight}
        </div>
      </section>

      <div className="dashboardGrid">
        <main className="mainColumn">
          <section className="panel glassPanel routinesPanel">
            <div className="panelHeaderPlain">
              <div className="panelHeaderTitleGroup">
                <span className="panelEyebrow">ACTIVE FORMULAS</span>
                <h2 className="panelTitlePlain">Your Routines</h2>
              </div>
              <button className="iconButton addRoutineIconBtn" onClick={onCreate} aria-label="Add routine" title="Create new routine">
                +
              </button>
            </div>

            {availableMuscles.length > 0 ? (
              <div className="homeFilterBar" role="group" aria-label="Filter routines by muscle group">
                <button
                  type="button"
                  className={`homeFilterChip ${selectedMuscle === 'ALL' ? 'is-active' : ''}`}
                  onClick={() => setSelectedMuscle('ALL')}
                >
                  All Formulas ({routines.length})
                </button>
                {availableMuscles.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`homeFilterChip ${selectedMuscle === m ? 'is-active' : ''}`}
                    onClick={() => setSelectedMuscle(selectedMuscle === m ? 'ALL' : m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="panelBody">
              <div className="pt-routine-grid" role="list">
                {/* Gym Press simulator element */}
                <div
                  className="pt-cell homeRoutineCard homeSimulatorCard"
                  style={{ '--element-color': 'var(--accent)' } as React.CSSProperties}
                  onClick={onPlayGame}
                >
                  <div className="pt-header">
                    <span className="pt-number">#100</span>
                    <span className="pt-group">GYM LAB • ACTIVE</span>
                    <span className="homeCardRunPill">PLAY ▸</span>
                  </div>

                  <div className="homeCardMain">
                    <div className="homeCardTile" aria-hidden="true">
                      <span className="homeCardTileNumber">100</span>
                      <span className="pt-symbol">Gp</span>
                      <span className="homeCardTileMass">3D.SIM</span>
                    </div>
                    <div className="homeCardBody">
                      <span className="pt-name">Gym Press Simulator</span>
                      <span className="pt-mass">3D Balance Game</span>
                      <div className="homeCardTags">
                        <span className="homeMuscleTag">Physics Engine</span>
                        <span className="homeMuscleTag">Live Challenge</span>
                      </div>
                    </div>
                  </div>

                  <div className="homeExerciseFormulaList" aria-hidden="true">
                    <div className="homeExerciseChip">
                      <span className="homeExerciseChipSym">3D</span>
                      <span className="homeExerciseChipName">Barbell Stabilizer</span>
                    </div>
                  </div>

                  <div className="summaryFooter homeCardFooter">
                    <span className="homeSimLaunchText">Launch Interactive Lab →</span>
                  </div>
                </div>

                {filteredRoutines.map((r) => {
                  const el = getPeriodicElement(r.name)
                  const plannedVol = Math.round(calcRoutineVolume(r.exercises))
                  const muscles = getRoutineMuscles(r.exercises)
                  const runCount = completionsByRoutineId.get(r.id) ?? 0

                  return (
                    <div
                      key={r.id}
                      className="pt-cell summaryCard homeRoutineCard"
                      role="listitem"
                      style={{ '--element-color': el.color } as React.CSSProperties}
                      onClick={() => onRun(r.id)}
                    >
                      <div className="pt-header">
                        <span className="pt-number">#{el.atomicNumber}</span>
                        <span className="pt-group">{el.groupName}</span>
                        <span className="homeCardRunPill">RUN ▸</span>
                      </div>

                      <div className="homeCardMain">
                        <div className="homeCardTile" aria-hidden="true">
                          <span className="homeCardTileNumber">{el.atomicNumber}</span>
                          <span className="pt-symbol">{el.symbol}</span>
                          <span className="homeCardTileMass">{el.mass}</span>
                        </div>
                        <div className="homeCardBody">
                          <span className="pt-name" title={r.name}>{r.name}</span>
                          <div className="homeCardStatsRow">
                            <span className="pt-mass">{r.exercises.length} exercises</span>
                            {plannedVol > 0 ? (
                              <span className="homeCardVolumePill">
                                {numberFormatter.format(plannedVol)} lbs
                              </span>
                            ) : null}
                            {runCount > 0 ? (
                              <span className="homeCardRunsPill">
                                {runCount}× logged
                              </span>
                            ) : null}
                          </div>
                          {muscles.length > 0 ? (
                            <div className="homeCardTags" aria-label="Targeted muscle groups">
                              {muscles.slice(0, 3).map((m) => (
                                <span key={m} className="homeMuscleTag">{m}</span>
                              ))}
                              {muscles.length > 3 ? (
                                <span className="homeMuscleTag">+{muscles.length - 3}</span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {r.exercises.length > 0 ? (
                        <div className="homeExerciseFormulaList" aria-label="Routine exercises preview">
                          {r.exercises.slice(0, 4).map((ex) => {
                            const exEl = getPeriodicElement(ex.name)
                            const hasSetsReps = typeof ex.sets === 'number' && typeof ex.reps === 'number'
                            return (
                              <div
                                key={ex.id}
                                className="homeExerciseChip"
                                style={{ '--ex-color': exEl.color } as React.CSSProperties}
                              >
                                <span className="homeExerciseChipSym" aria-hidden="true">{exEl.symbol}</span>
                                <span className="homeExerciseChipName">{ex.name}</span>
                                {hasSetsReps ? (
                                  <span className="homeExerciseChipMeta">
                                    {ex.sets}×{ex.reps}
                                  </span>
                                ) : typeof ex.weight === 'number' ? (
                                  <span className="homeExerciseChipMeta">{ex.weight} lbs</span>
                                ) : null}
                              </div>
                            )
                          })}
                          {r.exercises.length > 4 ? (
                            <div className="homeExerciseChip homeExerciseChipMore">
                              +{r.exercises.length - 4} more
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="summaryFooter homeCardFooter">
                        <button
                          type="button"
                          className="textButton homeCardActionBtn"
                          onClick={(e) => {
                            e.stopPropagation()
                            onEdit(r.id)
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="textButton dangerText homeCardActionBtn"
                          onClick={(e) => {
                            e.stopPropagation()
                            const ok = window.confirm(`Delete routine "${r.name}"?`)
                            if (ok) onDelete(r.id)
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {!routines.length && (
                <div className="empty homeEmptyFormulaBox" style={{ marginTop: 16 }}>
                  <span className="homeEmptyBadge">ELEMENT #00 • READY TO SYNTHESIZE</span>
                  <div>No training routines found. Create your first routine to start logging workouts.</div>
                </div>
              )}
            </div>
          </section>
        </main>

        <aside className="sideColumn">
          <RecentActivity completions={completions} onViewCompletion={onViewCompletion} />
        </aside>
      </div>
    </>
  )
}

