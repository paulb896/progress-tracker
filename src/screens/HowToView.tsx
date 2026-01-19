import { SCENARIO_GIFS, resolveScenarioGifUrl } from '../scenarios/scenarioGifs'

type HowToViewProps = {
  onBack: () => void
}

const ChevronDown = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
)

export const HowToView = ({ onBack }: HowToViewProps) => {
  return (
    <>
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

      <div className="glassPanel" style={{ borderRadius: 24, padding: 24 }}>
        {SCENARIO_GIFS.length ? (
          <div className="scenarioGrid">
            {SCENARIO_GIFS.map((s) => (
              <details key={s.fileName} className="scenarioCard">
                <summary className="scenarioSummary">
                  <span className="scenarioTitle">{s.title}</span>
                  <span className="scenarioIcon"><ChevronDown /></span>
                </summary>
                <div className="scenarioContent">
                  <img
                    className="scenarioGif"
                    src={resolveScenarioGifUrl(s.fileName)}
                    alt={`Demo: ${s.title}`}
                    loading="lazy"
                  />
                </div>
              </details>
            ))}
          </div>
        ) : (
           <div className="empty">
            No how-to demos found yet. Generate them with <code>npm run generate:scenario-gifs</code>.
          </div>
        )}
      </div>
    </>
  )
}
