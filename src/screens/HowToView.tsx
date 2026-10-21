import { useState, useEffect } from 'react'
import { SCENARIO_GIFS, resolveScenarioGifUrl, type ScenarioGif } from '../scenarios/scenarioGifs'
import { DataManagement } from '../components/DataManagement'

type HowToViewProps = {
  onBack: () => void
}

const ChevronDown = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
)

const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
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

  return (
    <div className="statsPageShell">
      <div className="statsHeroBanner animate-fade-in-up">
        <div className="statsHeroTopRow">
          <button type="button" className="button secondary" onClick={onBack}>
            ← Back
          </button>
          <span className="heroBadge statsBadgePill">
            <span className="heroBadgeDot" aria-hidden="true" />
            OPERATIONS MANUAL • ELEMENT #02 He
          </span>
        </div>

        <div className="statsHeroMain">
          <div className="statsHeroTile" aria-hidden="true">
            <span className="statsHeroTileNum">#02</span>
            <span className="statsHeroTileSym">Gd</span>
            <span className="statsHeroTileMass">MANUAL</span>
          </div>

          <div className="statsHeroCopy">
            <h1 className="statsHeroTitle">
              How it <span className="textGradient">Works</span>
            </h1>
            <p className="statsHeroSubtitle">
              Interactive visual demonstrations, lab workflow shortcuts, and local data backup controls to master your training console.
            </p>
          </div>
        </div>

        <div className="howToQuickTipsGrid" aria-label="Workflow highlights">
          <div className="howToTipCard">
            <span className="howToTipCode">01 · FORMULAS</span>
            <strong>Periodic Element Synthesis</strong>
            <p>Every routine and exercise automatically synthesizes a Periodic Table symbol, atomic mass, and muscle group tags.</p>
          </div>
          <div className="howToTipCard">
            <span className="howToTipCode">02 · LIVE SETS</span>
            <strong>Inline Set & Plate Tracking</strong>
            <p>Check off individual sets during a session to calculate live volume and view 2D/3D Olympic barbell plate stacks.</p>
          </div>
          <div className="howToTipCard">
            <span className="howToTipCode">03 · 2D MINI-GAME</span>
            <strong>Iron Press Power Rack</strong>
            <p>Switch between Bench, OHP, and Deadlift on the home deck, time Sweet-Spot 2× Crits, and run 30s AMRAP blitzes.</p>
          </div>
        </div>
      </div>

      {SCENARIO_GIFS.length === 0 ? (
        <div className="glassPanel" style={{ borderRadius: 24, padding: 32, textAlign: 'center' }}>
          <div className="empty">
            No how-to demos found yet. Generate them with <code>npm run generate:scenario-gifs</code>.
          </div>
        </div>
      ) : isLargeScreen ? (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 28, alignItems: 'start' }}>
          {/* Sidebar */}
          <div className="glassPanel" style={{ borderRadius: 24, overflow: 'hidden' }}>
            <div className="panelHeaderPlain">
              <div className="panelHeaderTitleGroup">
                <span className="panelEyebrow">VISUAL PROTOCOLS</span>
                <div className="panelTitlePlain">Interactive Guides</div>
              </div>
              <span className="panelCountBadge">{SCENARIO_GIFS.length}</span>
            </div>
            <div style={{ padding: 12, display: 'grid', gap: 8 }}>
              {SCENARIO_GIFS.map((s, idx) => {
                const isActive = selected?.fileName === s.fileName
                return (
                  <button
                    key={s.fileName}
                    onClick={() => setSelected(s)}
                    style={{
                      appearance: 'none',
                      border: '1px solid',
                      borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                      background: isActive ? 'var(--accent-soft)' : 'var(--surface-2)',
                      color: isActive ? 'var(--accent-hover)' : 'var(--muted)',
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: 14,
                      cursor: 'pointer',
                      fontSize: '0.92rem',
                      fontWeight: isActive ? 700 : 600,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        flex: '0 0 auto',
                        background: isActive ? 'var(--accent)' : 'var(--surface-3)',
                        color: isActive ? 'var(--on-accent)' : 'inherit',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      {isActive ? <PlayIcon /> : `#0${idx + 1}`}
                    </div>
                    <span style={{ color: isActive ? 'var(--text)' : 'inherit', lineHeight: 1.35 }}>
                      {s.title}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Main Content */}
          <div className="glassPanel" style={{ borderRadius: 24, overflow: 'hidden', padding: 12 }}>
            {selected && (
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    background: '#000',
                    borderRadius: 16,
                    overflow: 'hidden',
                    boxShadow: '0 20px 50px -10px rgba(0,0,0,0.5)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <img
                    src={resolveScenarioGifUrl(selected.fileName)}
                    alt={selected.title}
                    style={{ display: 'block', width: '100%', height: 'auto' }}
                  />
                </div>
                <div style={{ marginTop: 18, padding: '0 12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                    {selected.title}
                  </h2>
                  <span className="panelCountBadge">Visual Playback</span>
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

      <DataManagement />
    </div>
  )
}
