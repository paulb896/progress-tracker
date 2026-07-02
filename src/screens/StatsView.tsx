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
      <div className="headerRow animate-fade-in-up" style={{ marginBottom: 32, alignItems: 'center' }}>
        <div>
          <button type="button" className="button secondary" onClick={onBack} style={{ marginBottom: 16 }}>
            ← Back
          </button>
          <h1 className="heroTitle" style={{ fontSize: '2.5rem', marginBottom: 8 }}>
            Your <span className="textGradient">Progress</span>
          </h1>
          <p className="heroSubtitle" style={{ margin: 0, fontSize: '1rem', maxWidth: 600 }}>
            Visualize your gains and track your workout history over time.
          </p>
        </div>
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
