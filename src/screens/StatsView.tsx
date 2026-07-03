import type { RoutineCompletion } from '../completions/types'
import { HomeStats } from '../components/HomeStats'
import { MuscleHeatmap } from '../components/MuscleHeatmap'
import { ProgressCharts } from '../components/ProgressCharts'
import { RecentActivity } from '../components/RecentActivity'

type StatsViewProps = {
  completions: RoutineCompletion[]
  onBack: () => void
  onViewCompletion: (completionId: string) => void
}

export const StatsView = ({ completions, onBack, onViewCompletion }: StatsViewProps) => {
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', width: '100%', paddingBottom: 64 }}>
      <div className="animate-fade-in-up" style={{ marginBottom: 40 }}>
        <button type="button" className="button secondary" onClick={onBack} style={{ marginBottom: 20 }}>
          ← Back
        </button>
        <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 12 }}>
          Your <span className="textGradient">Progress</span>
        </h1>
        <p style={{ margin: 0, fontSize: '1.05rem', color: 'var(--muted)', maxWidth: 520, lineHeight: 1.7, fontWeight: 400 }}>
          Explore comprehensive analytics, volume tracking, and muscle recovery heatmap trends.
        </p>
      </div>

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
