import React, { useMemo, useState } from 'react'
import type { RoutineCompletion } from '../completions/types'
import { HomeStats } from '../components/HomeStats'
import { MuscleHeatmap } from '../components/MuscleHeatmap'
import { ProgressCharts } from '../components/ProgressCharts'
import { RecentActivity } from '../components/RecentActivity'
import { getPeriodicElement } from '../app/periodicTable'
import { findExercisePreset, type MuscleGroup } from '../exercises/presets'

type StatsViewProps = {
  completions: RoutineCompletion[]
  onBack: () => void
  onViewCompletion: (completionId: string) => void
}

type ExercisePR = {
  name: string
  maxWeight: number
  best1RM: number
  maxSetVolume: number
  totalVolume: number
  sessionsLogged: number
}

type TimeRangeFilter = 'all' | '90d' | '30d' | '7d'

const CORE_MUSCLES: MuscleGroup[] = [
  'Chest',
  'Back',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Core',
  'Calves',
]

const buildDemoCompletions = (): RoutineCompletion[] => {
  const now = Date.now()
  const dayMs = 86_400_000
  const samples: Array<{
    daysAgo: number
    routineId: string
    routineName: string
    exercises: Array<{ id: string; name: string; sets: number; reps: number; weight?: number }>
  }> = [
    {
      daysAgo: 1,
      routineId: 'demo-push',
      routineName: 'Heavy Push Synthesis',
      exercises: [
        { id: 'd1', name: 'Bench Press', sets: 4, reps: 8, weight: 195 },
        { id: 'd2', name: 'Overhead Press', sets: 3, reps: 8, weight: 120 },
        { id: 'd3', name: 'Tricep Dips', sets: 3, reps: 12, weight: 45 },
      ],
    },
    {
      daysAgo: 3,
      routineId: 'demo-pull',
      routineName: 'Posterior Chain & Pull',
      exercises: [
        { id: 'd4', name: 'Deadlift', sets: 4, reps: 5, weight: 315 },
        { id: 'd5', name: 'Barbell Row', sets: 4, reps: 8, weight: 165 },
        { id: 'd6', name: 'Pull-Ups', sets: 4, reps: 10, weight: 25 },
      ],
    },
    {
      daysAgo: 6,
      routineId: 'demo-legs',
      routineName: 'Lower Body Reactor',
      exercises: [
        { id: 'd7', name: 'Squat', sets: 4, reps: 6, weight: 265 },
        { id: 'd8', name: 'Romanian Deadlift', sets: 3, reps: 10, weight: 205 },
        { id: 'd9', name: 'Calf Raises', sets: 4, reps: 15, weight: 135 },
      ],
    },
    {
      daysAgo: 9,
      routineId: 'demo-push',
      routineName: 'Heavy Push Synthesis',
      exercises: [
        { id: 'd10', name: 'Bench Press', sets: 4, reps: 8, weight: 185 },
        { id: 'd11', name: 'Overhead Press', sets: 3, reps: 8, weight: 115 },
      ],
    },
    {
      daysAgo: 13,
      routineId: 'demo-legs',
      routineName: 'Lower Body Reactor',
      exercises: [
        { id: 'd12', name: 'Squat', sets: 4, reps: 6, weight: 255 },
        { id: 'd13', name: 'Deadlift', sets: 3, reps: 5, weight: 295 },
      ],
    },
  ]

  return samples.map((s, idx) => ({
    id: `demo-completion-${idx}`,
    routineId: s.routineId,
    routineName: s.routineName,
    exerciseCount: s.exercises.length,
    exercises: s.exercises,
    completedAt: new Date(now - s.daysAgo * dayMs).toISOString(),
  }))
}

const numberFormatter = new Intl.NumberFormat()

export const StatsView = ({ completions, onBack, onViewCompletion }: StatsViewProps) => {
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('all')
  const [showDemoData, setShowDemoData] = useState(false)
  const [focusedExercise, setFocusedExercise] = useState<string>('')
  const [nowMs] = useState(() => Date.now())

  const demoCompletions = useMemo(() => buildDemoCompletions(), [])
  const isUsingDemo = completions.length === 0 && showDemoData
  const sourceCompletions = isUsingDemo ? demoCompletions : completions

  const filteredCompletions = useMemo(() => {
    if (timeRange === 'all') return sourceCompletions
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    const cutoff = nowMs - days * 86_400_000
    return sourceCompletions.filter((c) => new Date(c.completedAt).getTime() >= cutoff)
  }, [nowMs, sourceCompletions, timeRange])

  const analyticsSummary = useMemo(() => {
    let totalSets = 0
    let totalReps = 0
    let totalVolume = 0
    let highest1RM = 0
    let highest1RMExercise = ''
    const prMap = new Map<string, ExercisePR>()

    const now = nowMs
    const startOfWeek = new Date(nowMs)
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    let weeklyCount = 0

    for (const c of filteredCompletions) {
      if (new Date(c.completedAt) >= startOfWeek) {
        weeklyCount += 1
      }
      for (const ex of c.exercises ?? []) {
        const sets = typeof ex.sets === 'number' && Number.isFinite(ex.sets) ? ex.sets : 1
        const reps = typeof ex.reps === 'number' && Number.isFinite(ex.reps) ? ex.reps : 0
        const weight = typeof ex.weight === 'number' && Number.isFinite(ex.weight) ? ex.weight : 0
        const vol = sets * reps * weight
        const est1RM =
          weight > 0
            ? reps > 1
              ? Math.round(weight * (1 + Math.min(20, reps) / 30))
              : Math.round(weight)
            : 0

        totalSets += sets
        totalReps += sets * reps
        totalVolume += vol

        if (est1RM > highest1RM) {
          highest1RM = est1RM
          highest1RMExercise = ex.name.trim()
        }

        const key = ex.name.trim()
        if (key) {
          const prev = prMap.get(key)
          if (!prev) {
            prMap.set(key, {
              name: key,
              maxWeight: weight,
              best1RM: est1RM,
              maxSetVolume: vol,
              totalVolume: vol,
              sessionsLogged: 1,
            })
          } else {
            prMap.set(key, {
              name: key,
              maxWeight: Math.max(prev.maxWeight, weight),
              best1RM: Math.max(prev.best1RM, est1RM),
              maxSetVolume: Math.max(prev.maxSetVolume, vol),
              totalVolume: prev.totalVolume + vol,
              sessionsLogged: prev.sessionsLogged + 1,
            })
          }
        }
      }
    }

    const topPRs = Array.from(prMap.values())
      .sort((a, b) => b.best1RM - a.best1RM || b.maxWeight - a.maxWeight || b.maxSetVolume - a.maxSetVolume)
      .slice(0, 6)

    const peak1RMInVault = topPRs.reduce((max, item) => Math.max(max, item.best1RM, item.maxWeight), 1)

    // 28-day cadence matrix
    const dayBuckets = new Map<string, { sessions: number; volume: number }>()
    for (const c of sourceCompletions) {
      const d = new Date(c.completedAt)
      const key = d.toISOString().split('T')[0]!
      const prev = dayBuckets.get(key) ?? { sessions: 0, volume: 0 }
      const cVol = (c.exercises ?? []).reduce((acc, ex) => {
        const s = typeof ex.sets === 'number' ? ex.sets : 1
        const r = typeof ex.reps === 'number' ? ex.reps : 0
        const w = typeof ex.weight === 'number' ? ex.weight : 0
        return acc + s * r * w
      }, 0)
      dayBuckets.set(key, { sessions: prev.sessions + 1, volume: prev.volume + cVol })
    }

    const cadenceDays: Array<{
      dateKey: string
      label: string
      sessions: number
      volume: number
      level: 0 | 1 | 2 | 3 | 4
    }> = []
    let activeDays28 = 0
    for (let i = 27; i >= 0; i--) {
      const d = new Date(now - i * 86_400_000)
      const key = d.toISOString().split('T')[0]!
      const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      const info = dayBuckets.get(key) ?? { sessions: 0, volume: 0 }
      if (info.sessions > 0) activeDays28 += 1
      const level: 0 | 1 | 2 | 3 | 4 =
        info.sessions === 0
          ? 0
          : info.volume >= 15000
            ? 4
            : info.volume >= 8000
              ? 3
              : info.volume >= 3000
                ? 2
                : 1
      cadenceDays.push({
        dateKey: key,
        label,
        sessions: info.sessions,
        volume: Math.round(info.volume),
        level,
      })
    }

    // 2D Muscle Recovery & Volume Matrix
    const muscleStats = CORE_MUSCLES.map((muscle) => {
      let lastWorkedAt: number | null = null
      let setsLogged = 0
      for (const c of sourceCompletions) {
        const t = new Date(c.completedAt).getTime()
        for (const ex of c.exercises ?? []) {
          const preset = findExercisePreset(ex.name)
          if (preset?.muscles?.includes(muscle)) {
            setsLogged += typeof ex.sets === 'number' && ex.sets > 0 ? ex.sets : 1
            if (lastWorkedAt === null || t > lastWorkedAt) {
              lastWorkedAt = t
            }
          }
        }
      }
      const hoursSince = lastWorkedAt !== null ? Math.max(0, (now - lastWorkedAt) / 3_600_000) : null
      const readinessPct =
        hoursSince === null ? 100 : Math.min(100, Math.max(15, Math.round((hoursSince / 72) * 100)))
      const statusLabel =
        hoursSince === null
          ? 'Fresh • Ready'
          : hoursSince < 24
            ? 'Recovering (24h)'
            : hoursSince < 48
              ? 'Rebuilding (48h)'
              : hoursSince < 72
                ? 'Nearly Fresh'
                : 'Peak Readiness'
      const statusTone =
        hoursSince === null || hoursSince >= 72
          ? 'fresh'
          : hoursSince >= 48
            ? 'recovering'
            : hoursSince >= 24
              ? 'fatigued'
              : 'hot'

      return {
        muscle,
        setsLogged,
        hoursSince,
        readinessPct,
        statusLabel,
        statusTone,
      }
    })

    const sessionsCount = filteredCompletions.length
    const avgVolumePerSession = sessionsCount > 0 ? Math.round(totalVolume / sessionsCount) : 0
    const avgSetsPerSession = sessionsCount > 0 ? Math.round(totalSets / sessionsCount) : 0

    return {
      totalSessions: sessionsCount,
      weeklyCount,
      totalSets,
      totalReps,
      totalVolume: Math.round(totalVolume),
      avgVolumePerSession,
      avgSetsPerSession,
      uniqueExercises: prMap.size,
      highest1RM,
      highest1RMExercise,
      topPRs,
      peak1RMInVault,
      cadenceDays,
      activeDays28,
      muscleStats,
    }
  }, [filteredCompletions, nowMs, sourceCompletions])

  const handleInspectExercise = (exerciseName: string) => {
    setFocusedExercise(exerciseName)
    document.getElementById('stats-progress-charts')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="statsPageShell">
      <div className="statsHeroBanner">
        <div className="statsHeroTopRow">
          <button type="button" className="button secondary" onClick={onBack}>
            ← Back
          </button>

          <div className="statsHeroControlsRow">
            {completions.length === 0 ? (
              <button
                type="button"
                className={`statsDemoToggleBtn ${showDemoData ? 'is-active' : ''}`}
                onClick={() => setShowDemoData((v) => !v)}
              >
                {showDemoData ? '✕ Exit Demo Telemetry' : '⚡ Preview Sample Telemetry'}
              </button>
            ) : null}

            <div className="statsRangeFilterBar" role="group" aria-label="Filter analytics timeframe">
              {(
                [
                  ['all', 'All Time'],
                  ['90d', '90 Days'],
                  ['30d', '30 Days'],
                  ['7d', '7 Days'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`statsRangePill ${timeRange === key ? 'is-active' : ''}`}
                  onClick={() => setTimeRange(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <span className="heroBadge statsBadgePill">
              <span className="heroBadgeDot" aria-hidden="true" />
              REACTOR ANALYTICS • ELEMENT #74 We
            </span>
          </div>
        </div>

        <div className="statsHeroMain">
          <div className="statsHeroTile" aria-hidden="true">
            <span className="statsHeroTileNum">#74</span>
            <span className="statsHeroTileSym">An</span>
            <span className="statsHeroTileMass">LAB.STAT</span>
          </div>

          <div className="statsHeroCopy">
            <h1 className="statsHeroTitle">
              Your <span className="textGradient">Progress</span>
            </h1>
            <p className="statsHeroSubtitle">
              Explore comprehensive reaction telemetry, Epley 1RM benchmarks, 28-day cadence intensity, and anatomical muscle recovery trends.
            </p>
          </div>
        </div>

        <div className="statsKpiGrid" aria-label="Career training summary">
          <div className="statsKpiCard">
            <div className="statsKpiHead">
              <span className="statsKpiLabel">Total Sessions</span>
              <span className="statsKpiSym">Wo #08</span>
            </div>
            <span className="statsKpiValue">{analyticsSummary.totalSessions}</span>
            <span className="statsKpiSub">{analyticsSummary.weeklyCount} / 4 weekly target</span>
            <div className="statsKpiBar" aria-hidden="true">
              <div
                className="statsKpiBarFill"
                style={{ width: `${Math.min(100, (analyticsSummary.weeklyCount / 4) * 100)}%` }}
              />
            </div>
          </div>

          <div className="statsKpiCard">
            <div className="statsKpiHead">
              <span className="ses-statLabel statsKpiLabel">Lifetime Volume</span>
              <span className="statsKpiSym">We #74</span>
            </div>
            <span className="statsKpiValue">
              {numberFormatter.format(analyticsSummary.totalVolume)}
              <small> lbs</small>
            </span>
            <span className="statsKpiSub">
              {analyticsSummary.avgVolumePerSession > 0
                ? `${numberFormatter.format(analyticsSummary.avgVolumePerSession)} lbs avg / session`
                : 'Log weighted sets to track load'}
            </span>
          </div>

          <div className="statsKpiCard">
            <div className="statsKpiHead">
              <span className="statsKpiLabel">Sets Logged</span>
              <span className="statsKpiSym">Se #34</span>
            </div>
            <span className="statsKpiValue">{numberFormatter.format(analyticsSummary.totalSets)}</span>
            <span className="statsKpiSub">
              {analyticsSummary.avgSetsPerSession > 0
                ? `${analyticsSummary.avgSetsPerSession} sets avg / workout`
                : `${numberFormatter.format(analyticsSummary.totalReps)} total reps`}
            </span>
          </div>

          <div className="statsKpiCard">
            <div className="statsKpiHead">
              <span className="statsKpiLabel">Total Reps</span>
              <span className="statsKpiSym">Re #75</span>
            </div>
            <span className="statsKpiValue">{numberFormatter.format(analyticsSummary.totalReps)}</span>
            <span className="statsKpiSub">{analyticsSummary.uniqueExercises} cataloged movements</span>
          </div>

          <div className="statsKpiCard">
            <div className="statsKpiHead">
              <span className="statsKpiLabel">Peak Est. 1RM</span>
              <span className="statsKpiSym">Pr #94</span>
            </div>
            <span className="statsKpiValue">
              {analyticsSummary.highest1RM > 0 ? (
                <>
                  ~{numberFormatter.format(analyticsSummary.highest1RM)}
                  <small> lbs</small>
                </>
              ) : (
                '—'
              )}
            </span>
            <span className="statsKpiSub">
              {analyticsSummary.highest1RMExercise || 'Epley 1-Rep Max benchmark'}
            </span>
          </div>

          <div className="statsKpiCard">
            <div className="statsKpiHead">
              <span className="statsKpiLabel">28d Consistency</span>
              <span className="statsKpiSym">St #16</span>
            </div>
            <span className="statsKpiValue">
              {analyticsSummary.activeDays28}
              <small> days</small>
            </span>
            <span className="statsKpiSub">Active training days in last 4 wks</span>
            <div className="statsKpiBar" aria-hidden="true">
              <div
                className="statsKpiBarFill"
                style={{ width: `${Math.min(100, Math.round((analyticsSummary.activeDays28 / 16) * 100))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 28-Day Cadence Matrix & 2D Muscle Readiness Radar */}
      <div className="statsTelemetrySplitGrid">
        <section className="panel glassPanel statsCadencePanel" aria-label="28-day workout consistency matrix">
          <div className="panelHeaderPlain">
            <div className="panelHeaderTitleGroup">
              <span className="panelEyebrow">28-DAY REACTION CADENCE</span>
              <h2 className="panelTitlePlain">Consistency Heatmap</h2>
            </div>
            <span className="panelCountBadge">{analyticsSummary.activeDays28} active days</span>
          </div>
          <div className="panelBody">
            <div className="statsCadenceGrid" role="list">
              {analyticsSummary.cadenceDays.map((d) => (
                <div
                  key={d.dateKey}
                  role="listitem"
                  className={`statsCadenceCell level-${d.level}`}
                  title={`${d.label}: ${d.sessions} session(s) • ${numberFormatter.format(d.volume)} lbs`}
                >
                  <span className="statsCadenceDate">{d.label.split(' ')[1]}</span>
                  {d.sessions > 0 ? <span className="statsCadenceDot" /> : null}
                </div>
              ))}
            </div>
            <div className="statsCadenceLegend" aria-hidden="true">
              <span>Rest</span>
              <span className="statsCadenceSwatch level-0" />
              <span className="statsCadenceSwatch level-1" />
              <span className="statsCadenceSwatch level-2" />
              <span className="statsCadenceSwatch level-3" />
              <span className="statsCadenceSwatch level-4" />
              <span>Peak Volume</span>
            </div>
          </div>
        </section>

        <section className="panel glassPanel statsReadinessPanel" aria-label="Muscle recovery readiness radar">
          <div className="panelHeaderPlain">
            <div className="panelHeaderTitleGroup">
              <span className="panelEyebrow">BIOMECHANICAL RECOVERY TELEMETRY</span>
              <h2 className="panelTitlePlain">Muscle Readiness Radar</h2>
            </div>
            <span className="panelCountBadge">
              {analyticsSummary.muscleStats.filter((m) => m.readinessPct >= 85).length} fresh groups
            </span>
          </div>
          <div className="panelBody">
            <div className="statsReadinessGrid">
              {analyticsSummary.muscleStats.map((m) => (
                <div key={m.muscle} className={`statsReadinessCard tone-${m.statusTone}`}>
                  <div className="statsReadinessTop">
                    <strong className="statsReadinessName">{m.muscle}</strong>
                    <span className="statsReadinessPct">{m.readinessPct}%</span>
                  </div>
                  <div className="statsReadinessTrack" aria-hidden="true">
                    <div className="statsReadinessFill" style={{ width: `${m.readinessPct}%` }} />
                  </div>
                  <div className="statsReadinessMeta">
                    <span>{m.statusLabel}</span>
                    <span>{m.setsLogged} sets</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Personal Records (PR) Vault */}
      {analyticsSummary.topPRs.length > 0 ? (
        <section className="panel glassPanel statsPrPanel">
          <div className="panelHeaderPlain">
            <div className="panelHeaderTitleGroup">
              <span className="panelEyebrow">ISOTOPE BENCHMARKS • CLICK TO INSPECT CURVE</span>
              <h2 className="panelTitlePlain">Personal Record & 1RM Vault</h2>
            </div>
            <span className="panelCountBadge">{analyticsSummary.topPRs.length} top movements</span>
          </div>

          <div className="panelBody">
            <div className="statsPrGrid">
              {analyticsSummary.topPRs.map((pr, index) => {
                const el = getPeriodicElement(pr.name)
                const muscles = findExercisePreset(pr.name)?.muscles ?? []
                const relPct = Math.min(
                  100,
                  Math.max(18, Math.round(((pr.best1RM || pr.maxWeight) / analyticsSummary.peak1RMInVault) * 100))
                )
                const isFocused = focusedExercise === pr.name
                return (
                  <button
                    key={pr.name}
                    type="button"
                    className={`statsPrCard statsPrCardBtn ${isFocused ? 'is-focused' : ''}`}
                    style={{ '--element-color': el.color } as React.CSSProperties}
                    onClick={() => handleInspectExercise(pr.name)}
                    title={`Inspect ${pr.name} progression curves`}
                  >
                    <div className="statsPrTile" aria-hidden="true">
                      <span className="statsPrTileNum">#{el.atomicNumber}</span>
                      <span className="statsPrTileSym">{el.symbol}</span>
                    </div>
                    <div className="statsPrBody">
                      <div className="statsPrTopLine">
                        <div className="statsPrName">{pr.name}</div>
                        <span className="statsPrRank">#{index + 1}</span>
                      </div>
                      <div className="statsPrMetrics">
                        <span className="statsPrPeak">
                          {pr.maxWeight > 0 ? `${pr.maxWeight} lbs Max` : `${pr.sessionsLogged}× Logged`}
                        </span>
                        {pr.best1RM > 0 ? (
                          <span className="statsPr1rmBadge">🏆 1RM ~{pr.best1RM}</span>
                        ) : null}
                        {pr.maxSetVolume > 0 ? (
                          <span className="statsPrVol">
                            {numberFormatter.format(Math.round(pr.maxSetVolume))} lbs peak vol
                          </span>
                        ) : null}
                      </div>
                      <div className="statsPrBarTrack" aria-hidden="true">
                        <div className="statsPrBarFill" style={{ width: `${relPct}%` }} />
                      </div>
                      {muscles.length > 0 ? (
                        <div className="statsPrMuscles">
                          {muscles.slice(0, 2).map((m) => (
                            <span key={m} className="homeMuscleTag">{m}</span>
                          ))}
                          <span className="statsPrInspectHint">View curve →</span>
                        </div>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      ) : null}

      <div className="statsSectionsStack">
        <HomeStats completions={filteredCompletions} />
        <MuscleHeatmap completions={sourceCompletions} />
        <ProgressCharts
          completions={filteredCompletions}
          selectedExerciseProp={focusedExercise}
          onSelectExercise={setFocusedExercise}
        />
        <RecentActivity completions={completions} onViewCompletion={onViewCompletion} />
      </div>
    </div>
  )
}

