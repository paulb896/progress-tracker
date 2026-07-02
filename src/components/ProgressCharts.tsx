import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

type ProgressChartsProps = {
  completions: RoutineCompletion[]
}

const ChartIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" />
    <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
  </svg>
)

const PIE_COLORS = ['#ff4d85', '#b25aff', '#8c52ff', '#5b8cff', '#00e5ff', '#32c8b4', '#ffb020']

export const ProgressCharts = ({ completions }: ProgressChartsProps) => {
  const [selectedExercise, setSelectedExercise] = useState<string>('')

  // 1. Aggregate data for specific exercise charts (Volume & Max Weight)
  const { exerciseOptions, exerciseData } = useMemo(() => {
    const exerciseMap = new Map<string, { count: number; history: Map<string, { volume: number; maxWeight: number }> }>()

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

        if (!exerciseMap.has(name)) {
          exerciseMap.set(name, { count: 0, history: new Map() })
        }
        
        const entry = exerciseMap.get(name)!
        entry.count += 1
        
        if (!entry.history.has(dateStr)) {
            entry.history.set(dateStr, { volume: 0, maxWeight: 0 })
        }
        const histEntry = entry.history.get(dateStr)!
        histEntry.volume += volume // sum volume for the day
        if (weight > histEntry.maxWeight) {
            histEntry.maxWeight = weight // max weight for the day
        }
      })
    })

    const sortedExercises = Array.from(exerciseMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name]) => name)

    const topExercise = sortedExercises[0] || ''
    const currentName = selectedExercise || topExercise
    
    // We must respect the chronological order: completions are sorted new to old?
    // Let's just grab the dates from the completions array preserving time
    // Actually our map used date strings, so let's rely on chronological order of completions:
    const uniqueDates = Array.from(new Set(completions.map(c => new Date(c.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })))).reverse()
    
    const histMap = exerciseMap.get(currentName)?.history || new Map()
    const history = uniqueDates.filter(d => histMap.has(d)).map(d => ({
        date: d,
        volume: histMap.get(d)!.volume,
        maxWeight: histMap.get(d)!.maxWeight
    }))

    return {
      exerciseOptions: sortedExercises,
      exerciseData: history,
      defaultExercise: topExercise
    }
  }, [completions, selectedExercise])

  if (!selectedExercise && exerciseOptions.length > 0) {
     setSelectedExercise(exerciseOptions[0])
  }

  // 2. Aggregate data for Muscle Distribution (Donut Chart)
  const muscleData = useMemo(() => {
    const muscles = new Map<string, number>()
    completions.forEach(c => {
      if (!c.exercises) return
      c.exercises.forEach(ex => {
        const preset = EXERCISE_PRESETS.find(p => p.name === ex.name)
        if (preset && preset.muscles) {
           preset.muscles.forEach(m => {
               muscles.set(m, (muscles.get(m) || 0) + 1)
           })
        }
      })
    })
    return Array.from(muscles.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6) // top 6
  }, [completions])

  // 3. Aggregate data for Workouts Per Week (Bar Chart)
  const weeklyData = useMemo(() => {
    const counts = new Map<string, number>()
    completions.forEach(c => {
       const d = new Date(c.completedAt)
       const day = d.getDay()
       const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
       const monday = new Date(d.setDate(diff))
       const label = monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
       counts.set(label, (counts.get(label) || 0) + 1)
    })
    
    // Generate last 8 weeks statically for a nice timeline
    const data = []
    for (let i = 7; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1) - i * 7)
        const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        data.push({
            name: label, // e.g., 'Oct 12'
            count: counts.get(label) || 0
        })
    }
    return data
  }, [completions])


  if (completions.length === 0 || exerciseOptions.length === 0) return null

  // Shared Tooltip Style
  const tooltipStyle = {
    backgroundColor: 'var(--surface-glass)', 
    borderColor: 'var(--border)', 
    borderRadius: 8,
    backdropFilter: 'blur(16px)',
    color: 'var(--text)',
    boxShadow: 'var(--shadow-sm)'
  }

  const labelStyle = {
    color: 'var(--text)',
    fontWeight: 600
  }

  return (
    <section className="panel glassPanel" style={{ marginTop: 24, overflow: 'hidden' }}>
      <div className="panelHeaderPlain" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ color: 'var(--accent)' }}><ChartIcon /></div>
            <h2 className="panelTitlePlain">Progress Tracking</h2>
        </div>
      </div>

      <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: 24, 
          padding: 24,
          alignItems: 'stretch'
      }}>
        
        {/* --- ROW 1: General Stats --- */}
        <div className="subPanel" style={{ background: 'var(--surface-sunken)', borderRadius: 16, padding: 16 }}>
            <h3 style={{ fontSize: '1rem', marginBottom: 16, color: 'var(--text)', textAlign: 'center' }}>Muscle Focus</h3>
            <div style={{ height: 260, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={muscleData}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={95}
                            paddingAngle={5}
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

        <div className="subPanel" style={{ background: 'var(--surface-sunken)', borderRadius: 16, padding: 16 }}>
            <h3 style={{ fontSize: '1rem', marginBottom: 16, color: 'var(--text)', textAlign: 'center' }}>Workouts Frequency</h3>
            <div style={{ height: 260, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-2)" />
                        <XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} cursor={{ fill: 'var(--surface-2)' }} />
                        <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={40}>
                            {weeklyData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.count > 0 ? 'var(--accent)' : 'var(--muted)'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* --- EXERCISE SECTION HEADER --- */}
        <div style={{ gridColumn: '1 / -1', marginTop: 16, marginBottom: -8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text)' }}>Exercise Performance</h3>
            <select 
                className="input" 
                style={{ width: 'auto', minWidth: 150, padding: '8px 12px', fontSize: '0.9rem', borderRadius: 8 }}
                value={selectedExercise}
                onChange={(e) => setSelectedExercise(e.target.value)}
            >
                {exerciseOptions.map(name => (
                    <option key={name} value={name}>{name}</option>
                ))}
            </select>
        </div>

        {/* --- ROW 2: Specific Exercise Stats --- */}
        <div className="subPanel" style={{ background: 'var(--surface-sunken)', borderRadius: 16, padding: 16 }}>
            <h3 style={{ fontSize: '1rem', marginBottom: 16, color: 'var(--text)', textAlign: 'center' }}>Max Weight Lifted</h3>
            <div style={{ height: 260, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={exerciseData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-2)" />
                        <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={20} />
                        <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} cursor={{ stroke: 'var(--accent)', strokeDasharray: '4 4' }} />
                        <Line type="monotone" dataKey="maxWeight" stroke="#ff4d85" strokeWidth={3} dot={{ r: 4, strokeWidth: 0, fill: '#ff4d85' }} activeDot={{ r: 6 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="subPanel" style={{ background: 'var(--surface-sunken)', borderRadius: 16, padding: 16 }}>
            <h3 style={{ fontSize: '1rem', marginBottom: 16, color: 'var(--text)', textAlign: 'center' }}>Volume Load (sets × reps × weight)</h3>
            <div style={{ height: 260, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={exerciseData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                        <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                        </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-2)" />
                        <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={20} />
                        <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} />
                        <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} cursor={{ stroke: 'var(--accent)', strokeDasharray: '4 4' }} />
                        <Area type="monotone" dataKey="volume" stroke="var(--accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorVolume)" activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

      </div>
    </section>
  )
}
