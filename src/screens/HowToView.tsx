import { useState, useEffect } from 'react'
import { SCENARIO_GIFS, resolveScenarioGifUrl, type ScenarioGif } from '../scenarios/scenarioGifs'

type HowToViewProps = {
  onBack: () => void
}

const ChevronDown = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
)

const PlayIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M8 5v14l11-7z" />
  </svg>
)

export const HowToView = ({ onBack }: HowToViewProps) => {
  const [selected, setSelected] = useState<ScenarioGif | null>(SCENARIO_GIFS[0] || null)
  const [isLargeScreen, setIsLargeScreen] = useState(false)

  useEffect(() => {
    const check = () => setIsLargeScreen(window.innerWidth >= 900)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // On large screens, play the selected one in a large view.
  // On small screens, keep the accordion list but maybe style it better?
  // The user asked for "larger version ... on larger screens".
  // Let's implement a master-detail view for large screens.

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      <div className="headerRow" style={{ marginBottom: 32, alignItems: 'center' }}>
        <div>
          <button type="button" className="button secondary" onClick={onBack} style={{ marginBottom: 16 }}>
            ← Back
          </button>
          <h1 className="heroTitle" style={{ fontSize: '2.5rem', marginBottom: 8 }}>
            How it <span className="textGradient">Works</span>
          </h1>
          <p className="heroSubtitle" style={{ margin: 0, fontSize: '1rem', maxWidth: 600 }}>
            Short visual guides to help you get the most out of your workout tracking.
          </p>
        </div>
      </div>

      {SCENARIO_GIFS.length === 0 ? (
        <div className="glassPanel" style={{ borderRadius: 24, padding: 32, textAlign: 'center' }}>
          <div className="empty">
            No how-to demos found yet. Generate them with <code>npm run generate:scenario-gifs</code>.
          </div>
        </div>
      ) : isLargeScreen ? (
        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: 32, alignItems: 'start' }}>
          {/* Sidebar */}
          <div className="glassPanel" style={{ borderRadius: 24, overflow: 'hidden' }}>
            <div className="panelTitle" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              Guides
            </div>
            <div style={{ padding: 12, display: 'grid', gap: 8 }}>
              {SCENARIO_GIFS.map((s) => {
                const isActive = selected?.fileName === s.fileName
                return (
                  <button
                    key={s.fileName}
                    onClick={() => setSelected(s)}
                    style={{
                      appearance: 'none',
                      border: '1px solid',
                      borderColor: isActive ? 'var(--accent)' : 'transparent',
                      background: isActive ? 'var(--accent-soft)' : 'transparent',
                      color: isActive ? 'var(--accent-hover)' : 'var(--muted)',
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 16px',
                      borderRadius: 12,
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: isActive ? 600 : 500,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12
                    }}
                  >
                    <div style={{ 
                        width: 24, height: 24, flex: '0 0 auto', 
                        background: isActive ? 'var(--accent)' : 'var(--surface-3)', 
                        color: isActive ? '#000' : 'inherit',
                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                      {isActive ? <PlayIcon /> : <span style={{ fontSize: 12, fontWeight: 700 }}>{SCENARIO_GIFS.indexOf(s) + 1}</span>}
                    </div>
                    <span style={{ color: isActive ? 'var(--text)' : 'inherit' }}>
                      {s.title}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Main Content */}
          <div className="glassPanel" style={{ borderRadius: 24, overflow: 'hidden', padding: 8 }}>
            {selected && (
              <div style={{ position: 'relative' }}>
               <div style={{ 
                  background: '#000', 
                  borderRadius: 16, 
                  overflow: 'hidden', 
                  boxShadow: '0 20px 50px -10px rgba(0,0,0,0.5)',
                  border: '1px solid var(--border)' 
                }}>
                  <img
                    src={resolveScenarioGifUrl(selected.fileName)}
                    alt={selected.title}
                    style={{ display: 'block', width: '100%', height: 'auto' }}
                  />
               </div>
               <div style={{ marginTop: 20, padding: '0 12px 12px' }}>
                 <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                   {selected.title}
                 </h2>
               </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Mobile Layout - Refined Stack */
        <div className="glassPanel" style={{ borderRadius: 24, padding: 8, background: 'transparent', border: 'none', boxShadow: 'none' }}>
           <div className="scenarioGrid" style={{ gridTemplateColumns: '1fr' }}>
            {SCENARIO_GIFS.map((s) => (
              <details key={s.fileName} className="scenarioCard" style={{ background: 'var(--surface-glass)', backdropFilter: 'blur(10px)' }}>
                <summary className="scenarioSummary" style={{ fontSize: '1rem', padding: '20px' }}>
                  <span className="scenarioTitle" style={{ lineHeight: 1.4 }}>{s.title}</span>
                  <span className="scenarioIcon" style={{ flex: '0 0 auto', marginLeft: 16 }}><ChevronDown /></span>
                </summary>
                <div className="scenarioContent" style={{ background: '#000', padding: 0 }}>
                  <img
                    className="scenarioGif"
                    src={resolveScenarioGifUrl(s.fileName)}
                    alt={`Demo: ${s.title}`}
                    loading="lazy"
                    style={{ borderRadius: 0, border: 'none' }}
                  />
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
