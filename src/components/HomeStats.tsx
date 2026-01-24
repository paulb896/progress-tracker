import { useMemo, useState, useEffect } from 'react'
import type { RoutineCompletion } from '../completions/types'

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
  return num.toString()
}

const CountUp = ({ value, duration = 1000 }: { value: number; duration?: number }) => {
  const [displayValue, setDisplayValue] = useState(0)
  
  useEffect(() => {
    let startTime: number | null = null
    let animationFrame: number

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      
      // Easing function (easeOutExpo)
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      
      // Use round instead of floor to prevent small numbers (like 1) from staying 0 until the very end
      setDisplayValue(Math.round(ease * value))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [value, duration])

  return <>{formatNumber(displayValue)}</>
}

// Icons
const WeightIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 5h12"/><rect x="4" y="5" width="2" height="14" rx="1"/><rect x="18" y="5" width="2" height="14" rx="1"/><path d="M6 19h12"/></svg>
)

const RepsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
)

const SetsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>
)

const FireIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.115.385-2.256 1-3.5 1.072 2.143 2.224 4.054 2 6Z"/></svg>
)

const TrophyIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
)

export const HomeStats = ({ completions }: { completions: RoutineCompletion[] }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const stats = useMemo(() => {
    const totalWorkouts = completions.length
    
    let totalSets = 0
    let totalReps = 0
    let totalVolume = 0

    completions.forEach(c => {
        if (c.exercises) {
            c.exercises.forEach(e => {
                const sets = e.sets || 1
                totalSets += sets
                const reps = e.reps || 0
                const weight = e.weight || 0
                totalReps += sets * reps
                totalVolume += sets * reps * weight
            })
        }
    })

    // Weekly
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day
    const startOfWeek = new Date(now.setDate(diff))
    startOfWeek.setHours(0, 0, 0, 0)
    const thisWeek = completions.filter(c => new Date(c.completedAt) >= startOfWeek)
    const weeklyCount = thisWeek.length

    return { totalWorkouts, totalReps, totalVolume, totalSets, weeklyCount }
  }, [completions])

  if (completions.length === 0) return null

  // Determine what to display in the center
  // Priority: Hovered -> Selected -> Default (Sessions)
  const activeIndex = hoveredIndex !== null ? hoveredIndex : selectedIndex
  
  const getHubContent = () => {
    switch (activeIndex) {
      case 0: // Weight
        return {
          value: stats.totalVolume,
          label: 'Lbs Lifted',
          icon: <WeightIcon />
        }
      case 1: // Reps
        return {
          value: stats.totalReps,
          label: 'Total Reps',
          icon: <RepsIcon />
        }
      case 2: // Streak
        return {
          value: stats.weeklyCount,
          label: 'Weekly Streak',
          icon: <FireIcon />
        }
      case 3: // Sets
        return {
          value: stats.totalSets,
          label: 'Total Sets',
          icon: <SetsIcon />
        }
      default: // Sessions (Default)
        return {
          value: stats.totalWorkouts,
          label: 'Sessions',
          icon: <TrophyIcon />
        }
    }
  }

  const hubContent = getHubContent()
  const isHubActive = activeIndex !== null

  return (
    <section className="infoContainer">
      <div className="infoGrid">
        {/* Central Hub */}
        <div className="infoHubWrapper" onClick={() => setSelectedIndex(null)}>
           <div className={`infoHub ${isHubActive ? 'active' : ''}`}>
             <div className="infoHubRing">
               <div className="infoHubInner">
                 <div className="infoHubIconWrapper">
                   <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     {hubContent.icon}
                   </div>
                 </div>
                 <div className="infoHubValue" key={hubContent.label}>
                    <CountUp value={hubContent.value} />
                 </div>
                 <div className="infoHubLabel">{hubContent.label}</div>
               </div>
             </div>
           </div>
           
           {/* Glow effect behind hub */}
           <div className={`infoHubGlow ${isHubActive ? 'active' : ''}`} />
        </div>
        
        {/* Connecting Lines SVG Layer - Moved to Grid container level */}
        <svg className="infoConnections" viewBox="0 0 400 300" preserveAspectRatio="none">
           <path 
             d="M 180 150 C 230 150, 230 50, 280 50" 
             className={`infoLine ${activeIndex === 0 ? 'active' : ''} ${activeIndex !== null && activeIndex !== 0 ? 'dimmed' : ''}`} 
           />
           <path 
             d="M 180 150 C 230 150, 230 115, 280 115" 
             className={`infoLine ${activeIndex === 1 ? 'active' : ''} ${activeIndex !== null && activeIndex !== 1 ? 'dimmed' : ''}`} 
           />
           <path 
             d="M 180 150 C 230 150, 230 185, 280 185" 
             className={`infoLine ${activeIndex === 2 ? 'active' : ''} ${activeIndex !== null && activeIndex !== 2 ? 'dimmed' : ''}`} 
           />
           <path 
             d="M 180 150 C 230 150, 230 250, 280 250" 
             className={`infoLine ${activeIndex === 3 ? 'active' : ''} ${activeIndex !== null && activeIndex !== 3 ? 'dimmed' : ''}`} 
           />
        </svg>

        {/* Info Cards Column */}
        <div className="infoCardsCol">
          
          <div 
            className={`infoCard infoCardPink ${activeIndex === 0 ? 'active' : ''} ${selectedIndex === 0 ? 'selected' : ''}`}
            onMouseEnter={() => setHoveredIndex(0)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => setSelectedIndex(selectedIndex === 0 ? null : 0)}
          >
            <div className="infoCardIcon"><WeightIcon /></div>
            <div className="infoCardContent">
              <div className="infoCardLabel">Total Weight Lifted</div>
              <div className="infoCardValue"><CountUp value={stats.totalVolume} /> <span className="unit">lbs</span></div>
            </div>
            <div className="infoCardDecor" />
            <div className="infoCardShine" />
          </div>

          <div 
            className={`infoCard infoCardPurple ${activeIndex === 1 ? 'active' : ''} ${selectedIndex === 1 ? 'selected' : ''}`}
            onMouseEnter={() => setHoveredIndex(1)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => setSelectedIndex(selectedIndex === 1 ? null : 1)}
          >
            <div className="infoCardIcon"><RepsIcon /></div>
            <div className="infoCardContent">
              <div className="infoCardLabel">Total Reps</div>
              <div className="infoCardValue"><CountUp value={stats.totalReps} /></div>
            </div>
            <div className="infoCardDecor" />
            <div className="infoCardShine" />
          </div>

          <div 
            className={`infoCard infoCardOrange ${activeIndex === 2 ? 'active' : ''} ${selectedIndex === 2 ? 'selected' : ''}`}
            onMouseEnter={() => setHoveredIndex(2)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => setSelectedIndex(selectedIndex === 2 ? null : 2)}
          >
            <div className="infoCardIcon"><FireIcon /></div>
            <div className="infoCardContent">
              <div className="infoCardLabel">Weekly Streak</div>
              <div className="infoCardValue">{stats.weeklyCount} <span className="unit">/ 4</span></div>
            </div>
            <div className="infoCardDecor" />
            <div className="infoCardShine" />
          </div>

          <div 
            className={`infoCard infoCardTeal ${activeIndex === 3 ? 'active' : ''} ${selectedIndex === 3 ? 'selected' : ''}`}
            onMouseEnter={() => setHoveredIndex(3)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => setSelectedIndex(selectedIndex === 3 ? null : 3)}
          >
            <div className="infoCardIcon"><SetsIcon /></div>
            <div className="infoCardContent">
              <div className="infoCardLabel">Total Sets</div>
              <div className="infoCardValue"><CountUp value={stats.totalSets} /></div>
            </div>
            <div className="infoCardDecor" />
            <div className="infoCardShine" />
          </div>

        </div>
      </div>
    </section>
  )
}
