import { SCENARIO_GIFS, resolveScenarioGifUrl } from '../scenarios/scenarioGifs'

type HowToViewProps = {
  onBack: () => void
}

export const HowToView = ({ onBack }: HowToViewProps) => {
  return (
    <div className="panel">
      <div className="panelTitleRow">
        <div>
          <div className="panelTitle">How to</div>
          <div className="subtitle2">Short demos of common flows.</div>
        </div>
        <button type="button" className="button secondary" onClick={onBack}>
          Back
        </button>
      </div>

      <div className="panelBody">
        {SCENARIO_GIFS.length ? (
          <>
            <div className="scenarioList" role="list">
              {SCENARIO_GIFS.map((s) => (
                <details key={s.fileName} className="scenarioItem" role="listitem">
                  <summary className="scenarioSummary">{s.title}</summary>
                  <img
                    className="scenarioGif"
                    src={resolveScenarioGifUrl(s.fileName)}
                    alt={`Demo: ${s.title}`}
                    loading="lazy"
                  />
                </details>
              ))}
            </div>
            <div className="hint" style={{ marginTop: 10 }}>
              These are short demos generated from the Playwright BDD scenarios.
            </div>
          </>
        ) : (
          <div className="empty">
            No how-to demos found yet. Generate them with <code>npm run generate:scenario-gifs</code>.
          </div>
        )}
      </div>
    </div>
  )
}
