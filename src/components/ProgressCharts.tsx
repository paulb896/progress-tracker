import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { RoutineCompletion } from '../completions/types'

type ProgressChartsProps = {
  completions: RoutineCompletion[]
}

const ChartIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" />
    <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
  </svg>
)

export const ProgressCharts = ({ completions }: ProgressChartsProps) => {
  const [selectedExercise, setSelectedExercise] = useState<string>('')

  // 1. Aggregate data to find top exercises and prepare chart data
  const { exerciseOptions, chartData } = useMemo(() => {
    const exerciseMap = new Map<string, { count: number; history: { date: string; volume: number }[] }>()

    completions.forEach((c) => {
      if (!c.exercises) return
      const date = new Date(c.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

      c.exercises.forEach((ex) => {
        const name = ex.name.trim()
        if (!name) return

        const sets = ex.sets || 1
        const reps = ex.reps || 0
        const weight = ex.weight || 0
        const volume = sets * reps * weight

        if (volume === 0) return // Skip cardio or bodyweight-only for volume charts for now

        if (!exerciseMap.has(name)) {
          exerciseMap.set(name, { count: 0, history: [] })
        }
        
        const entry = exerciseMap.get(name)!
        entry.count += 1
        // If multiple entries for same day, take max or sum? Let's take max for "Personal Best" vibe, or just append.
        // Simple append for now.
        entry.history.push({ date, volume })
      })
    })

    // Sort exercises by frequency
    const sortedExercises = Array.from(exerciseMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name]) => name)

    // Default to top exercise
    const topExercise = sortedExercises[0] || ''
    
    // Prepare data for the selected exercise
    const currentName = selectedExercise || topExercise
    const rawHistory = exerciseMap.get(currentName)?.history || []
    
    // Reverse to be chronological (assuming completions are new->old)
    const history = [...rawHistory].reverse()

    return {
      exerciseOptions: sortedExercises,
      chartData: history,
      defaultExercise: topExercise
    }
  }, [completions, selectedExercise])

  // Set default selection if empty
  if (!selectedExercise && exerciseOptions.length > 0) {
     setSelectedExercise(exerciseOptions[0])
  }

  if (completions.length === 0 || exerciseOptions.length === 0) return null

  return (
    <section className="panel glassPanel" style={{ marginTop: 24, overflow: 'hidden' }}>
      <div className="panelHeaderPlain" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ color: 'var(--accent)' }}><ChartIcon /></div>
            <h2 className="panelTitlePlain">Progress Tracking</h2>
        </div>
        
        <select 
            className="input" 
            style={{ width: 'auto', minWidth: 150, padding: '6px 12px', fontSize: '0.9rem' }}
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
        >
            {exerciseOptions.map(name => (
                <option key={name} value={name}>{name}</option>
            ))}
        </select>
      </div>

      <div style={{ height: 300, width: '100%', marginTop: 20 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-2)" />
            <XAxis 
                dataKey="date" 
                tick={{ fill: 'var(--muted)', fontSize: 12 }} 
                tickLine={false}
                axisLine={false}
                minTickGap={30}
            />
            <YAxis 
                tick={{ fill: 'var(--muted)', fontSize: 12 }} 
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}
            />
            <Tooltip 
                contentStyle={{ 
                    backgroundColor: 'var(--surface-glass)', 
                    borderColor: 'var(--border)', 
                    borderRadius: 12,
                    backdropFilter: 'blur(10px)',
                    color: 'var(--text)'
                }}
                itemStyle={{ color: 'var(--accent)' }}
                cursor={{ stroke: 'var(--accent)', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Area 
                type="monotone" 
                dataKey="volume" 
                stroke="var(--accent)" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorVolume)" 
                activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      <div style={{ padding: '0 20px 20px', textAlign: 'center' }}>
         <div className="hint">Volume Load (Weight × Reps × Sets) over time</div>
      </div>
    </section>
  )
}
