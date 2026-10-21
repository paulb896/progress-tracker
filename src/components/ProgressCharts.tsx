import React, { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { RoutineCompletion } from '../completions/types'
import { EXERCISE_PRESETS } from '../exercises/presets'
import { getPeriodicElement } from '../app/periodicTable'

type ProgressChartsProps = {
  completions: RoutineCompletion[]
  selectedExerciseProp?: string
  onSelectExercise?: (exerciseName: string) => void
}

const ChartIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 3v18h18" />
    <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
  </svg>
)

const PIE_COLORS = ['#34d399', '#22d3ee', '#38bdf8', '#818cf8', '#a855f7', '#fb7185', '#fbbf24']

const numberFormatter = new Intl.NumberFormat()

export const ProgressCharts = ({
  completions,
  selectedExerciseProp,
  onSelectExercise,
}: ProgressChartsProps) => {
  const [internalExercise, setInternalExercise] = useState<string>('')
  const [monthsRange, setMonthsRange] = useState<number>(3)

  const selectedExercise = selectedExerciseProp || internalExercise
  const handleSelectExercise = (name: string) => {
    setInternalExercise(name)
    onSelectExercise?.(name)
  }

  // 1. Aggregate data for specific exercise charts (Volume, Max Weight, 1RM & Totals)
  const { exerciseOptions, exerciseData, activeExerciseName, activeExerciseSummary } = useMemo(() => {
    const exerciseMap = new Map<
      string,
      {
        count: number
        totalVolume: number
        peakWeight: number
        best1RM: number
        history: Map<string, { volume: number; maxWeight: number }>
      }
    >()

    completions.forEach((c) => {
      if (!c.exercises) return
      const dateStr = new Date(c.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

      c.exercises.forEach((ex) => {
        const name = ex.name.trim()
        if (!name) return

        const sets = ex.sets || 1
        const reps = ex.reps || 0
        const weight = ex.weight || 0
        const volume = sets * reps * weight
        const est1RM =
          weight > 0
            ? reps > 1
              ? Math.round(weight * (1 + Math.min(20, reps) / 30))
              : Math.round(weight)
            : 0

        if (!exerciseMap.has(name)) {
          exerciseMap.set(name, {
            count: 0,
            totalVolume: 0,
            peakWeight: 0,
            best1RM: 0,
            history: new Map(),
          })
        }

        const entry = exerciseMap.get(name)!
        entry.count += 1
        entry.totalVolume += volume
        if (weight > entry.peakWeight) entry.peakWeight = weight
        if (est1RM > entry.best1RM) entry.best1RM = est1RM

        if (!entry.history.has(dateStr)) {
          entry.history.set(dateStr, { volume: 0, maxWeight: 0 })
        }
        const histEntry = entry.history.get(dateStr)!
        histEntry.volume += volume
        if (weight > histEntry.maxWeight) {
          histEntry.maxWeight = weight
        }
      })
    })

    const sortedExercises = Array.from(exerciseMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name]) => name)

    const topExercise = sortedExercises[0] || ''
    const currentName =
      selectedExercise && exerciseMap.has(selectedExercise) ? selectedExercise : topExercise

    const uniqueDates = Array.from(
      new Set(
        completions.map((c) =>
          new Date(c.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        )
      )
    ).reverse()

    const activeEntry = exerciseMap.get(currentName)
    const histMap = activeEntry?.history || new Map()
    const history = uniqueDates
      .filter((d) => histMap.has(d))
      .map((d) => ({
        date: d,
        volume: histMap.get(d)!.volume,
        maxWeight: histMap.get(d)!.maxWeight,
      }))

    return {
      exerciseOptions: sortedExercises,
      exerciseData: history,
      activeExerciseName: currentName,
      activeExerciseSummary: activeEntry ?? {
        count: 0,
        totalVolume: 0,
        peakWeight: 0,
        best1RM: 0,
      },
    }
  }, [completions, selectedExercise])

  // 2. Aggregate data for Muscle Distribution (Donut Chart)
  const muscleData = useMemo(() => {
    const muscles = new Map<string, number>()
    completions.forEach((c) => {
      if (!c.exercises) return
      c.exercises.forEach((ex) => {
        const preset = EXERCISE_PRESETS.find((p) => p.name === ex.name)
        if (preset && preset.muscles) {
          preset.muscles.forEach((m) => {
            muscles.set(m, (muscles.get(m) || 0) + 1)
          })
        }
      })
    })
    return Array.from(muscles.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [completions])

  // 3. Aggregate data for Workouts Per Week (Bar Chart)
  const weeklyData = useMemo(() => {
    const counts = new Map<string, number>()
    completions.forEach((c) => {
      const d = new Date(c.completedAt)
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(d.setDate(diff))
      const label = monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      counts.set(label, (counts.get(label) || 0) + 1)
    })

    const data = []
    for (let i = 7; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1) - i * 7)
      const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      data.push({
        name: label,
        count: counts.get(label) || 0,
      })
    }
    return data
  }, [completions])

  const repsWeightDailyData = useMemo(() => {
    if (!activeExerciseName) return []

    const cutoffDate = new Date()
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsRange)

    const dailyMap = new Map<string, { dateObj: Date; totalReps: number; maxWeight: number }>()

    completions.forEach((c) => {
      const d = new Date(c.completedAt)
      if (d < cutoffDate) return

      const dateKey = d.toISOString().split('T')[0]
      if (!c.exercises) return

      c.exercises.forEach((ex) => {
        if (ex.name.trim() !== activeExerciseName.trim()) return

        const sets = ex.sets || 1
        const reps = ex.reps || 0
        const weight = ex.weight || 0
        const totalReps = sets * reps

        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, { dateObj: d, totalReps: 0, maxWeight: 0 })
        }

        const dayEntry = dailyMap.get(dateKey)!
        dayEntry.totalReps += totalReps
        if (weight > dayEntry.maxWeight) {
          dayEntry.maxWeight = weight
        }
      })
    })

    return Array.from(dailyMap.values())
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
      .map((entry) => ({
        dateLabel: entry.dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        totalReps: entry.totalReps,
        maxWeight: entry.maxWeight,
      }))
  }, [completions, activeExerciseName, monthsRange])

  if (completions.length === 0 || exerciseOptions.length === 0) return null

  const activeEl = getPeriodicElement(activeExerciseName || 'Exercise')

  const tooltipStyle = {
    backgroundColor: 'var(--surface-glass)',
    borderColor: 'var(--border-2)',
    borderRadius: 12,
    backdropFilter: 'blur(16px)',
    color: 'var(--text)',
    boxShadow: 'var(--shadow)',
  }

  const labelStyle = {
    color: 'var(--text)',
    fontWeight: 700,
  }

  return (
    <section
      id="stats-progress-charts"
      className="panel glassPanel statsChartsSection"
      aria-label="Progress tracking charts"
    >
      <div className="panelHeaderPlain statsSectionHeader">
        <div className="panelHeaderTitleGroup">
          <span className="panelEyebrow">QUANTITATIVE TELEMETRY • CURVES</span>
          <div className="statsSectionTitleRow">
            <span className="statsSectionIconBadge" aria-hidden="true">
              <ChartIcon />
            </span>
            <h2 className="panelTitlePlain">Progress & Load Analytics</h2>
          </div>
        </div>
        <span className="panelCountBadge">{exerciseOptions.length} tracked movements</span>
      </div>

      <div className="statsChartsGrid">
        {/* --- ROW 1: Muscle Focus & Weekly Cadence --- */}
        <div className="statsChartCard">
          <div className="statsChartCardHead">
            <div>
              <span className="statsChartEyebrow">BIOMECHANICAL DISTRIBUTION</span>
              <h3 className="statsChartTitle">Muscle Focus</h3>
            </div>
            <span className="statsChartBadge">Top {muscleData.length} groups</span>
          </div>
          <div className="statsChartCanvas">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={muscleData}
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={94}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {muscleData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={{ color: 'var(--accent)' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="statsChartCard">
          <div className="statsChartCardHead">
            <div>
              <span className="statsChartEyebrow">8-WEEK CONSISTENCY</span>
              <h3 className="statsChartTitle">Workouts Frequency</h3>
            </div>
            <span className="statsChartBadge">Sessions / wk</span>
          </div>
          <div className="statsChartCanvas">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-2)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="count" fill="var(--accent)" radius={[6, 6, 0, 0]} maxBarSize={38}>
                  {weeklyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.count > 0 ? 'var(--accent)' : 'var(--border-2)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* --- EXERCISE PERFORMANCE COMMAND BAR --- */}
        <div
          className="statsExerciseSelectorBanner"
          style={{ '--element-color': activeEl.color } as React.CSSProperties}
        >
          <div className="statsExerciseSelectorTop">
            <div className="statsExerciseIdentity">
              <div className="statsExerciseTile" aria-hidden="true">
                <span className="statsExerciseTileNum">#{activeEl.atomicNumber}</span>
                <span className="statsExerciseTileSym">{activeEl.symbol}</span>
              </div>
              <div>
                <span className="statsChartEyebrow">ISOTOPE TELEMETRY SPOTLIGHT</span>
                <h3 className="statsExerciseActiveTitle">{activeExerciseName}</h3>
              </div>
            </div>

            <div className="statsExerciseKpiPills">
              <span className="statsExKpiPill">
                <small>Logged</small>
                <strong>{activeExerciseSummary.count}×</strong>
              </span>
              {activeExerciseSummary.peakWeight > 0 ? (
                <span className="statsExKpiPill">
                  <small>Peak Load</small>
                  <strong>{activeExerciseSummary.peakWeight} lbs</strong>
                </span>
              ) : null}
              {activeExerciseSummary.best1RM > 0 ? (
                <span className="statsExKpiPill statsExKpiPillGold">
                  <small>Est. 1RM</small>
                  <strong>~{activeExerciseSummary.best1RM} lbs</strong>
                </span>
              ) : null}
              {activeExerciseSummary.totalVolume > 0 ? (
                <span className="statsExKpiPill">
                  <small>Total Vol</small>
                  <strong>{numberFormatter.format(Math.round(activeExerciseSummary.totalVolume))} lbs</strong>
                </span>
              ) : null}

              <select
                className="input statsExerciseSelect"
                aria-label="Select exercise for performance charts"
                value={activeExerciseName}
                onChange={(e) => handleSelectExercise(e.target.value)}
              >
                {exerciseOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {exerciseOptions.length > 1 ? (
            <div className="statsExerciseChipsRow" role="group" aria-label="Quick select exercise">
              {exerciseOptions.slice(0, 10).map((name) => {
                const el = getPeriodicElement(name)
                const isSelected = name === activeExerciseName
                return (
                  <button
                    key={name}
                    type="button"
                    className={`statsExerciseChipBtn ${isSelected ? 'is-active' : ''}`}
                    style={{ '--chip-color': el.color } as React.CSSProperties}
                    onClick={() => handleSelectExercise(name)}
                  >
                    <span className="statsExerciseChipSym" aria-hidden="true">{el.symbol}</span>
                    <span>{name}</span>
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        {/* --- ROW 2: Specific Exercise Stats --- */}
        <div className="statsChartCard">
          <div className="statsChartCardHead">
            <div>
              <span className="statsChartEyebrow">STRENGTH PROGRESSION</span>
              <h3 className="statsChartTitle">Max Weight Lifted</h3>
            </div>
            <span className="statsChartBadge">{activeExerciseName}</span>
          </div>
          <div className="statsChartCanvas">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={exerciseData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-2)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={20} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} cursor={{ stroke: 'var(--accent)', strokeDasharray: '4 4' }} />
                <Line
                  type="monotone"
                  dataKey="maxWeight"
                  stroke="#fb7185"
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 0, fill: '#fb7185' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="statsChartCard">
          <div className="statsChartCardHead">
            <div>
              <span className="statsChartEyebrow">WORK CAPACITY (SETS × REPS × LBS)</span>
              <h3 className="statsChartTitle">Volume Load</h3>
            </div>
            <span className="statsChartBadge">lbs / session</span>
          </div>
          <div className="statsChartCanvas">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={exerciseData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.42} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-2)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={20} />
                <YAxis
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val)}
                />
                <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} cursor={{ stroke: 'var(--accent)', strokeDasharray: '4 4' }} />
                <Area
                  type="monotone"
                  dataKey="volume"
                  stroke="var(--accent)"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorVolume)"
                  activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--accent)' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* --- ROW 3: Daily Reps & Weight Composed Timeline --- */}
        <div className="statsChartCard statsChartCardWide">
          <div className="statsChartCardHead">
            <div>
              <span className="statsChartEyebrow">DUAL-AXIS OUTPUT TELEMETRY</span>
              <h3 className="statsChartTitle">Daily Reps & Weight Timeline</h3>
            </div>
            <div className="statsTimeframeTabs" role="group" aria-label="Chart timeframe">
              {(
                [
                  [1, '1M'],
                  [3, '3M'],
                  [6, '6M'],
                  [12, '1Y'],
                ] as const
              ).map(([mVal, label]) => (
                <button
                  key={mVal}
                  type="button"
                  className={`statsTimeframeTab ${monthsRange === mVal ? 'is-active' : ''}`}
                  onClick={() => setMonthsRange(mVal)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {repsWeightDailyData.length === 0 ? (
            <div className="statsChartEmpty">
              No recorded logs for <strong>{activeExerciseName}</strong> in the last {monthsRange} month(s).
            </div>
          ) : (
            <div className="statsChartCanvas statsChartCanvasTall">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={repsWeightDailyData} margin={{ top: 10, right: -5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-2)" />
                  <XAxis dataKey="dateLabel" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: 'var(--muted)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    label={{
                      value: 'Max Weight',
                      angle: -90,
                      position: 'insideLeft',
                      offset: 10,
                      style: { fill: 'var(--muted)', fontSize: 11, fontWeight: 600 },
                    }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: 'var(--muted)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    label={{
                      value: 'Total Reps',
                      angle: 90,
                      position: 'insideRight',
                      offset: 10,
                      style: { fill: 'var(--muted)', fontSize: 11, fontWeight: 600 },
                    }}
                  />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 0 }} />
                  <Bar
                    yAxisId="right"
                    dataKey="totalReps"
                    name="Total Reps"
                    fill="var(--accent)"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={32}
                    opacity={0.65}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="maxWeight"
                    name="Max Weight"
                    stroke="#fb7185"
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 0, fill: '#fb7185' }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

