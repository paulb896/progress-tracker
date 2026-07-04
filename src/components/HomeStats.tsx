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
          symbol: 'We',
          number: 74,
          group: 'TRANSITION METAL',
          color: '#ff6b6b'
        }
      case 1: // Reps
        return {
          value: stats.totalReps,
          label: 'Total Reps',
          symbol: 'Re',
          number: 75,
          group: 'TRANSITION METAL',
          color: '#a55eed'
        }
      case 2: // Streak
        return {
          value: stats.weeklyCount,
          label: 'Weekly Streak',
          symbol: 'St',
          number: 16,
          group: 'NONMETAL',
          color: '#ff9f43'
        }
      case 3: // Sets
        return {
          value: stats.totalSets,
          label: 'Total Sets',
          symbol: 'Se',
          number: 34,
          group: 'NONMETAL',
          color: '#00d2d3'
        }
      default: // Sessions (Default)
        return {
          value: stats.totalWorkouts,
          label: 'Sessions',
          symbol: 'Wo',
          number: 8,
          group: 'REACTIVE ELEMENT',
          color: 'var(--accent)'
        }
    }
  }

  const hubContent = getHubContent()
  const isHubActive = activeIndex !== null

  return (
    <section className="infoContainer">
      <div className="infoGrid">
        {/* Central Hub */}
        <div className="infoHubWrapper" onClick={() => setSelectedIndex(null)} style={{ border: 'none', background: 'none', display: 'flex', justifyContent: 'center' }}>
          <div 
            className={`pt-cell ${isHubActive ? 'active' : ''}`} 
            style={{ 
              width: '100%', 
              maxWidth: 200, 
              minHeight: 180, 
              padding: 16,
              alignSelf: 'center', 
              '--element-color': hubContent.color || 'var(--accent)'
            } as React.CSSProperties}
          >
            <div className="pt-header">
              <span className="pt-number">{hubContent.number}</span>
              <span className="pt-group">{hubContent.group}</span>
            </div>
            <div className="pt-symbol" style={{ fontSize: 44, margin: '12px 0' }}>{hubContent.symbol}</div>
            <div className="pt-footer">
              <div className="pt-name" style={{ fontSize: 13 }}>{hubContent.label}</div>
              <div className="pt-mass" style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>
                <CountUp value={hubContent.value} />
              </div>
            </div>
          </div>
        </div>
        
        {/* Connecting Lines SVG Layer */}
        {/* We use a narrower viewBox to span the gap between hub and cards */}
        <svg className="infoConnections" viewBox="0 0 200 300" preserveAspectRatio="none">
           {/* Paths start at X=0 (hub center relative to SVG) and end at X=200 (cards start) */}
           <path 
             d="M 0 150 C 100 150, 100 50, 200 50" 
             className={`infoLine ${activeIndex === 0 ? 'active' : ''} ${activeIndex !== null && activeIndex !== 0 ? 'dimmed' : ''}`} 
           />
           <path 
             d="M 0 150 C 100 150, 100 115, 200 115" 
             className={`infoLine ${activeIndex === 1 ? 'active' : ''} ${activeIndex !== null && activeIndex !== 1 ? 'dimmed' : ''}`} 
           />
           <path 
             d="M 0 150 C 100 150, 100 185, 200 185" 
             className={`infoLine ${activeIndex === 2 ? 'active' : ''} ${activeIndex !== null && activeIndex !== 2 ? 'dimmed' : ''}`} 
           />
           <path 
             d="M 0 150 C 100 150, 100 250, 200 250" 
             className={`infoLine ${activeIndex === 3 ? 'active' : ''} ${activeIndex !== null && activeIndex !== 3 ? 'dimmed' : ''}`} 
           />
        </svg>

        {/* Info Cards Column */}
        <div className="infoCardsCol" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          
          <div 
            className={`pt-cell ${activeIndex === 0 ? 'active' : ''} ${selectedIndex === 0 ? 'selected' : ''}`}
            style={{ '--element-color': '#ff6b6b', minHeight: 'auto', padding: 8 } as React.CSSProperties}
            onMouseEnter={() => setHoveredIndex(0)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => setSelectedIndex(selectedIndex === 0 ? null : 0)}
          >
            <div className="pt-header">
              <span className="pt-number">74</span>
              <span className="pt-group">TRANSITION METAL</span>
            </div>
            <div className="pt-symbol" style={{ fontSize: 22, margin: '2px 0' }}>We</div>
            <div className="pt-footer">
              <div className="pt-name" style={{ fontSize: 10 }}>Weight Lifted</div>
              <div className="pt-mass" style={{ fontSize: 12, fontWeight: 700 }}><CountUp value={stats.totalVolume} /> lbs</div>
            </div>
          </div>

          <div 
            className={`pt-cell ${activeIndex === 1 ? 'active' : ''} ${selectedIndex === 1 ? 'selected' : ''}`}
            style={{ '--element-color': '#a55eed', minHeight: 'auto', padding: 8 } as React.CSSProperties}
            onMouseEnter={() => setHoveredIndex(1)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => setSelectedIndex(selectedIndex === 1 ? null : 1)}
          >
            <div className="pt-header">
              <span className="pt-number">75</span>
              <span className="pt-group">TRANSITION METAL</span>
            </div>
            <div className="pt-symbol" style={{ fontSize: 22, margin: '2px 0' }}>Re</div>
            <div className="pt-footer">
              <div className="pt-name" style={{ fontSize: 10 }}>Total Reps</div>
              <div className="pt-mass" style={{ fontSize: 12, fontWeight: 700 }}><CountUp value={stats.totalReps} /></div>
            </div>
          </div>

          <div 
            className={`pt-cell ${activeIndex === 2 ? 'active' : ''} ${selectedIndex === 2 ? 'selected' : ''}`}
            style={{ '--element-color': '#ff9f43', minHeight: 'auto', padding: 8 } as React.CSSProperties}
            onMouseEnter={() => setHoveredIndex(2)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => setSelectedIndex(selectedIndex === 2 ? null : 2)}
          >
            <div className="pt-header">
              <span className="pt-number">16</span>
              <span className="pt-group">NONMETAL</span>
            </div>
            <div className="pt-symbol" style={{ fontSize: 22, margin: '2px 0' }}>St</div>
            <div className="pt-footer">
              <div className="pt-name" style={{ fontSize: 10 }}>Weekly Streak</div>
              <div className="pt-mass" style={{ fontSize: 12, fontWeight: 700 }}>{stats.weeklyCount} / 4</div>
            </div>
          </div>

          <div 
            className={`pt-cell ${activeIndex === 3 ? 'active' : ''} ${selectedIndex === 3 ? 'selected' : ''}`}
            style={{ '--element-color': '#00d2d3', minHeight: 'auto', padding: 8 } as React.CSSProperties}
            onMouseEnter={() => setHoveredIndex(3)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => setSelectedIndex(selectedIndex === 3 ? null : 3)}
          >
            <div className="pt-header">
              <span className="pt-number">34</span>
              <span className="pt-group">NONMETAL</span>
            </div>
            <div className="pt-symbol" style={{ fontSize: 22, margin: '2px 0' }}>Se</div>
            <div className="pt-footer">
              <div className="pt-name" style={{ fontSize: 10 }}>Total Sets</div>
              <div className="pt-mass" style={{ fontSize: 12, fontWeight: 700 }}><CountUp value={stats.totalSets} /></div>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
