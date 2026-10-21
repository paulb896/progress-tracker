import React, { useMemo } from 'react'
import type { RoutineCompletion } from '../completions/types'
import { HomeStats } from '../components/HomeStats'
import { MuscleHeatmap } from '../components/MuscleHeatmap'
import { ProgressCharts } from '../components/ProgressCharts'
import { RecentActivity } from '../components/RecentActivity'
import { getPeriodicElement } from '../app/periodicTable'
import { findExercisePreset } from '../exercises/presets'

type StatsViewProps = {
  completions: RoutineCompletion[]
  onBack: () => void
  onViewCompletion: (completionId: string) => void
}

type ExercisePR = {
  name: string
  maxWeight: number
  maxSetVolume: number
  sessionsLogged: number
}

const numberFormatter = new Intl.NumberFormat()

export const StatsView = ({ completions, onBack, onViewCompletion }: StatsViewProps) => {
  const analyticsSummary = useMemo(() => {
    let totalSets = 0
    let totalReps = 0
    let totalVolume = 0
    const prMap = new Map<string, ExercisePR>()

    for (const c of completions) {
      for (const ex of c.exercises ?? []) {
        const sets = typeof ex.sets === 'number' && Number.isFinite(ex.sets) ? ex.sets : 1
        const reps = typeof ex.reps === 'number' && Number.isFinite(ex.reps) ? ex.reps : 0
        const weight = typeof ex.weight === 'number' && Number.isFinite(ex.weight) ? ex.weight : 0
        const vol = sets * reps * weight
        totalSets += sets
        totalReps += sets * reps
        totalVolume += vol

        const key = ex.name.trim()
        if (key) {
          const prev = prMap.get(key)
          if (!prev) {
            prMap.set(key, {
              name: key,
              maxWeight: weight,
              maxSetVolume: vol,
              sessionsLogged: 1,
            })
          } else {
            prMap.set(key, {
              name: key,
              maxWeight: Math.max(prev.maxWeight, weight),
              maxSetVolume: Math.max(prev.maxSetVolume, vol),
              sessionsLogged: prev.sessionsLogged + 1,
            })
          }
        }
      }
    }

    const topPRs = Array.from(prMap.values())
      .sort((a, b) => b.maxWeight - a.maxWeight || b.maxSetVolume - a.maxSetVolume)
      .slice(0, 6)

    return {
      totalSessions: completions.length,
      totalSets,
      totalReps,
      totalVolume: Math.round(totalVolume),
      uniqueExercises: prMap.size,
      topPRs,
    }
  }, [completions])

  return (
    <div className="statsPageShell">
      <div className="statsHeroBanner animate-fade-in-up">
        <div className="statsHeroTopRow">
          <button type="button" className="button secondary" onClick={onBack}>
            ← Back
          </button>
          <span className="heroBadge statsBadgePill">
            <span className="heroBadgeDot" aria-hidden="true" />
            REACTOR ANALYTICS • ELEMENT #74 We
          </span>
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
              Explore comprehensive reaction telemetry, volume progression, personal records, and muscle recovery heatmap trends.
            </p>
          </div>
        </div>

        <div className="statsKpiGrid" aria-label="Career training summary">
          <div className="statsKpiCard">
            <span className="statsKpiLabel">Total Sessions</span>
            <span className="statsKpiValue">{analyticsSummary.totalSessions}</span>
          </div>
          <div className="statsKpiCard">
            <span className="statsKpiLabel">Lifetime Volume</span>
            <span className="statsKpiValue">
              {numberFormatter.format(analyticsSummary.totalVolume)}
              <small> lbs</small>
            </span>
          </div>
          <div className="statsKpiCard">
            <span className="statsKpiLabel">Sets Logged</span>
            <span className="statsKpiValue">{numberFormatter.format(analyticsSummary.totalSets)}</span>
          </div>
          <div className="statsKpiCard">
            <span className="statsKpiLabel">Cataloged Movements</span>
            <span className="statsKpiValue">{analyticsSummary.uniqueExercises}</span>
          </div>
        </div>
      </div>

      {/* Personal Records (PR) Vault */}
      {analyticsSummary.topPRs.length > 0 ? (
        <section className="panel glassPanel statsPrPanel animate-fade-in-up delay-100">
          <div className="panelHeaderPlain">
            <div className="panelHeaderTitleGroup">
              <span className="panelEyebrow">ISOTOPE BENCHMARKS</span>
              <h2 className="panelTitlePlain">Personal Record Vault</h2>
            </div>
            <span className="panelCountBadge">{analyticsSummary.topPRs.length} top movements</span>
          </div>

          <div className="panelBody">
            <div className="statsPrGrid">
              {analyticsSummary.topPRs.map((pr) => {
                const el = getPeriodicElement(pr.name)
                const muscles = findExercisePreset(pr.name)?.muscles ?? []
                return (
                  <div
                    key={pr.name}
                    className="statsPrCard"
                    style={{ '--element-color': el.color } as React.CSSProperties}
                  >
                    <div className="statsPrTile" aria-hidden="true">
                      <span className="statsPrTileNum">#{el.atomicNumber}</span>
                      <span className="statsPrTileSym">{el.symbol}</span>
                    </div>
                    <div className="statsPrBody">
                      <div className="statsPrName">{pr.name}</div>
                      <div className="statsPrMetrics">
                        <span className="statsPrPeak">
                          {pr.maxWeight > 0 ? `${pr.maxWeight} lbs Max` : `${pr.sessionsLogged}× Logged`}
                        </span>
                        {pr.maxSetVolume > 0 ? (
                          <span className="statsPrVol">
                            {numberFormatter.format(Math.round(pr.maxSetVolume))} lbs peak vol
                          </span>
                        ) : null}
                      </div>
                      {muscles.length > 0 ? (
                        <div className="statsPrMuscles">
                          {muscles.slice(0, 2).map((m) => (
                            <span key={m} className="homeMuscleTag">{m}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div className="animate-fade-in-up delay-100">
          <HomeStats completions={completions} />
        </div>
        <div className="animate-fade-in-up delay-200">
          <MuscleHeatmap completions={completions} />
        </div>
        <div className="animate-fade-in-up delay-300">
          <ProgressCharts completions={completions} />
        </div>
        <div className="animate-fade-in-up delay-400">
          <RecentActivity completions={completions} onViewCompletion={onViewCompletion} />
        </div>
      </div>
    </div>
  )
}
