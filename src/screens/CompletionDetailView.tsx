import React from 'react'
import type { RoutineCompletion } from '../completions/types'
import { resolveImageUrl } from '../app/resolveImageUrl'
import { formatDuration } from '../app/formatDuration'
import { EXERCISE_PRESETS } from '../exercises/presets'
import { getPeriodicElement } from '../app/periodicTable'

type DraftExercise = {
  id: string
  name: string
  imageUrl: string
  sets: string
  reps: string
  weight: string
  timeMins: string
  timeSecs: string
}

const normalizeImageUrls = (imageUrl: string): string[] | undefined => {
  const trimmed = imageUrl.trim()
  if (!trimmed) return undefined
  return [trimmed]
}

const normalizeOptionalInt = (raw: string): number | undefined => {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return undefined
  const i = Math.trunc(n)
  return i > 0 ? i : undefined
}

const normalizeOptionalNumber = (raw: string): number | undefined => {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const n = Number(trimmed)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

const normalizeOptionalDurationSeconds = (minsRaw: string, secsRaw: string): number | undefined => {
  const minsTrimmed = minsRaw.trim()
  const secsTrimmed = secsRaw.trim()
  if (!minsTrimmed && !secsTrimmed) return undefined

  const mins = minsTrimmed ? normalizeOptionalInt(minsTrimmed) ?? 0 : 0
  const secs = secsTrimmed ? normalizeOptionalInt(secsTrimmed) ?? 0 : 0
  const total = mins * 60 + secs
  return total > 0 ? total : undefined
}

type CompletionDetailViewProps = {
  completion: RoutineCompletion
  onBack: () => void
  onDelete: (completionId: string) => void
  onUpdate: (completion: RoutineCompletion) => void
}

export const CompletionDetailView = ({ completion, onBack, onDelete, onUpdate }: CompletionDetailViewProps) => {
  const exercises = React.useMemo(() => completion.exercises ?? [], [completion.exercises])

  const presetByName = React.useMemo(() => {
    const byName = new Map<string, (typeof EXERCISE_PRESETS)[number]>()
    for (const preset of EXERCISE_PRESETS) {
      byName.set(preset.name.trim().toLowerCase(), preset)
    }
    return byName
  }, [])

  const [isEditing, setIsEditing] = React.useState(false)
  const [draftRoutineName, setDraftRoutineName] = React.useState(completion.routineName)
  const [draftExercises, setDraftExercises] = React.useState<DraftExercise[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [imagePreviewFailedById, setImagePreviewFailedById] = React.useState<Record<string, boolean>>({})

  React.useEffect(() => {
    const nextExercises = completion.exercises ?? []
    setIsEditing(false)
    setDraftRoutineName(completion.routineName)
    setDraftExercises(
      nextExercises.map((ex) => ({
        id: ex.id,
        name: ex.name,
        imageUrl: ex.imageUrls?.[0] ?? '',
        sets: typeof ex.sets === 'number' ? String(ex.sets) : '',
        reps: typeof ex.reps === 'number' ? String(ex.reps) : '',
        weight: typeof ex.weight === 'number' ? String(ex.weight) : '',
        timeMins: typeof ex.timeSeconds === 'number' ? String(Math.floor(ex.timeSeconds / 60)) : '',
        timeSecs: typeof ex.timeSeconds === 'number' ? String(Math.floor(ex.timeSeconds % 60)) : '',
      }))
    )
    setImagePreviewFailedById({})
    setError(null)
  }, [completion.id, completion.routineName, completion.exercises])

  const updateDraftExercise = (id: string, patch: Partial<DraftExercise>) => {
    setDraftExercises((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))

    if (Object.prototype.hasOwnProperty.call(patch, 'imageUrl')) {
      setImagePreviewFailedById((prev) => {
        if (!prev[id]) return prev
        const copy = { ...prev }
        delete copy[id]
        return copy
      })
    }
  }

  const routineEl = getPeriodicElement(isEditing ? draftRoutineName.trim() || completion.routineName : completion.routineName)

  const summaryStats = React.useMemo(() => {
    const muscles = new Set<string>()
    let totalVol = 0
    let totalSets = 0
    for (const ex of exercises) {
      const p = presetByName.get(ex.name.trim().toLowerCase())
      if (p?.muscles) {
        for (const m of p.muscles) muscles.add(m)
      }
      const s = typeof ex.sets === 'number' && Number.isFinite(ex.sets) ? ex.sets : 0
      const r = typeof ex.reps === 'number' && Number.isFinite(ex.reps) ? ex.reps : 0
      const w = typeof ex.weight === 'number' && Number.isFinite(ex.weight) ? ex.weight : 0
      totalSets += s
      totalVol += s * r * w
    }
    return {
      muscles: Array.from(muscles),
      totalVol: Math.round(totalVol),
      totalSets,
    }
  }, [exercises, presetByName])

  return (
    <div
      className="panel glassPanel createPanel completionPanel"
      style={{ '--routine-color': routineEl.color } as React.CSSProperties}
    >
      <div className="panelTitleRow createHeaderRow">
        <div className="createHeaderTitleBlock">
          <span className="panelEyebrow">ARCHIVED REACTION LOG</span>
          <div className="panelTitle">Completed routine</div>
          {isEditing ? (
            <input
              className="input createRoutineNameInput"
              style={{ marginTop: 8 }}
              value={draftRoutineName}
              onChange={(ev) => setDraftRoutineName(ev.target.value)}
              aria-label="Routine name"
            />
          ) : (
            <div className="subtitle2 completionRoutineTitle">{completion.routineName}</div>
          )}
        </div>
        <div className="rowGap">
          {exercises.length ? (
            isEditing ? (
              <>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => {
                    setError(null)

                    const name = draftRoutineName.trim()
                    if (!name) {
                      setError('Routine name is required.')
                      return
                    }

                    const nextExercises = exercises.map((ex) => {
                      const d = draftExercises.find((e) => e.id === ex.id)
                      if (!d) return ex
                      const trimmedName = d.name.trim()
                      return {
                        ...ex,
                        name: trimmedName,
                        imageUrls: normalizeImageUrls(d.imageUrl),
                        sets: normalizeOptionalInt(d.sets),
                        reps: normalizeOptionalInt(d.reps),
                        weight: normalizeOptionalNumber(d.weight),
                        timeSeconds: normalizeOptionalDurationSeconds(d.timeMins, d.timeSecs),
                      }
                    })

                    if (nextExercises.some((ex) => !ex.name.trim())) {
                      setError('Exercise name cannot be blank.')
                      return
                    }

                    const updated: RoutineCompletion = {
                      ...completion,
                      routineName: name,
                      exercises: nextExercises,
                      exerciseCount: nextExercises.length,
                    }

                    onUpdate(updated)
                    setIsEditing(false)
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setIsEditing(false)
                    setDraftRoutineName(completion.routineName)
                    setDraftExercises(
                      exercises.map((ex) => ({
                        id: ex.id,
                        name: ex.name,
                        imageUrl: ex.imageUrls?.[0] ?? '',
                        sets: typeof ex.sets === 'number' ? String(ex.sets) : '',
                        reps: typeof ex.reps === 'number' ? String(ex.reps) : '',
                        weight: typeof ex.weight === 'number' ? String(ex.weight) : '',
                        timeMins: typeof ex.timeSeconds === 'number' ? String(Math.floor(ex.timeSeconds / 60)) : '',
                        timeSecs: typeof ex.timeSeconds === 'number' ? String(Math.floor(ex.timeSeconds % 60)) : '',
                      }))
                    )
                    setImagePreviewFailedById({})
                    setError(null)
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setIsEditing(true)
                  setError(null)
                }}
              >
                Edit
              </button>
            )
          ) : null}
          <button
            type="button"
            className="button danger"
            onClick={() => {
              const ok = window.confirm('Delete this completed routine from history?')
              if (ok) onDelete(completion.id)
            }}
          >
            Delete
          </button>
          <button type="button" className="button secondary" onClick={onBack}>
            Back
          </button>
        </div>
      </div>

      <div className="panelBody">
        <datalist id="exercise-presets">
          {EXERCISE_PRESETS.map((p) => (
            <option key={p.name} value={p.name} />
          ))}
        </datalist>

        <div className="createFormulaBanner completionBanner">
          <div
            className="createFormulaTile"
            style={{ '--element-color': routineEl.color } as React.CSSProperties}
            aria-hidden="true"
          >
            <div className="createFormulaTileTop">
              <span>#{routineEl.atomicNumber}</span>
              <span>{routineEl.groupName}</span>
            </div>
            <div className="createFormulaTileSymbol">{routineEl.symbol}</div>
            <div className="createFormulaTileMass">{routineEl.mass}</div>
          </div>

          <div className="createFormulaInputArea">
            <div className="hint completionTimestamp">
              {completion.exerciseCount} exercises <span className="dot">•</span>{' '}
              {new Date(completion.completedAt).toLocaleString()}
            </div>
            <div className="createFormulaStatsRow">
              <span className="createStatChip">
                <strong>{completion.exerciseCount}</strong> completed exercises
              </span>
              {summaryStats.totalSets > 0 ? (
                <span className="createStatChip">
                  <strong>{summaryStats.totalSets}</strong> total sets
                </span>
              ) : null}
              {summaryStats.totalVol > 0 ? (
                <span className="createStatChip createStatChipAccent">
                  <strong>{summaryStats.totalVol.toLocaleString()}</strong> lbs moved
                </span>
              ) : null}
              {summaryStats.muscles.map((m) => (
                <span key={m} className="homeMuscleTag">{m}</span>
              ))}
            </div>
          </div>
        </div>

        {error ? <div className="error" style={{ marginTop: 10 }}>{error}</div> : null}

        {exercises.length ? (
          <div className="exerciseRunList" style={{ marginTop: 16 }}>
            {exercises.map((ex, idx) => {
              const exName = isEditing
                ? (draftExercises.find((d) => d.id === ex.id)?.name ?? '').trim() || ex.name
                : ex.name
              const el = getPeriodicElement(exName)
              const matchedPreset = presetByName.get(exName.trim().toLowerCase())
              const exVol =
                typeof ex.sets === 'number' && typeof ex.reps === 'number' && typeof ex.weight === 'number'
                  ? Math.round(ex.sets * ex.reps * ex.weight)
                  : 0
              const ex1RM =
                typeof ex.weight === 'number' && ex.weight > 0
                  ? typeof ex.reps === 'number' && ex.reps > 1
                    ? Math.round(ex.weight * (1 + Math.min(20, ex.reps) / 30))
                    : Math.round(ex.weight)
                  : 0
              const volSharePct =
                summaryStats.totalVol > 0 && exVol > 0
                  ? Math.min(100, Math.round((exVol / summaryStats.totalVol) * 100))
                  : 0

              return (
                <div
                  key={ex.id}
                  className="runRow completionExerciseCard"
                  style={{ '--element-color': el.color } as React.CSSProperties}
                >
                  <div className="completionExerciseHeader">
                    <div className="createExerciseTile completionExerciseTile" aria-hidden="true">
                      <span className="createExerciseTileStep">{String(idx + 1).padStart(2, '0')}</span>
                      <span className="createExerciseTileSym">{el.symbol}</span>
                      <span className="createExerciseTileNum">#{el.atomicNumber}</span>
                    </div>

                    <div className="completionExerciseTitleBlock">
                      <div className="createExerciseTopBar">
                        <span className="createExerciseBadge">
                          EXERCISE {String(idx + 1).padStart(2, '0')} • {el.groupName}
                        </span>
                        <div className="createExerciseTopTags">
                          {matchedPreset?.muscles?.map((m) => (
                            <span key={m} className="homeMuscleTag">{m}</span>
                          ))}
                          {!isEditing && exVol > 0 ? (
                            <span className="homeCardVolumePill">{exVol.toLocaleString()} lbs</span>
                          ) : null}
                          {!isEditing && ex1RM > 0 ? (
                            <span className="create1rmBadge" title="Estimated 1-Rep Max">
                              🏆 1RM ~{ex1RM} lbs
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span className="runName completionExerciseName">{exName}</span>
                    </div>

                    {!isEditing && ex.imageUrls?.length ? (
                      <div className="imageStrip completionImageStrip" aria-label="Exercise reference images">
                        {ex.imageUrls.map((url) => (
                          <img
                            key={url}
                            className="imageThumb completionImageThumb"
                            src={resolveImageUrl(url)}
                            alt={`${ex.name} reference`}
                            loading="lazy"
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {isEditing ? (
                    <div className="exerciseFields" style={{ marginTop: 12 }}>
                      <input
                        className="input"
                        list="exercise-presets"
                        value={draftExercises.find((d) => d.id === ex.id)?.name ?? ex.name}
                        onChange={(ev) => {
                          const nextName = ev.target.value
                          const preset = presetByName.get(nextName.trim().toLowerCase())
                          const currentImageUrl = draftExercises.find((d) => d.id === ex.id)?.imageUrl ?? ''

                          const patch: Partial<DraftExercise> = {
                            name: nextName,
                          }

                          if (!currentImageUrl && preset?.imageUrl) {
                            patch.imageUrl = preset.imageUrl
                          }

                          updateDraftExercise(ex.id, patch)
                        }}
                        aria-label="Exercise name"
                        placeholder="Exercise name"
                      />

                      <input
                        className="input"
                        value={draftExercises.find((d) => d.id === ex.id)?.imageUrl ?? ''}
                        onChange={(ev) => updateDraftExercise(ex.id, { imageUrl: ev.target.value })}
                        aria-label="Image URL"
                        placeholder="Image URL (optional)"
                      />

                      {(draftExercises.find((d) => d.id === ex.id)?.imageUrl ?? '').trim() ? (
                        <div className="exerciseImagePreview" aria-label="Exercise image preview">
                          {imagePreviewFailedById[ex.id] ? (
                            <div className="exerciseImagePreviewFallback">Image failed to load.</div>
                          ) : (
                            <img
                              className="exerciseImagePreviewImg"
                              src={resolveImageUrl((draftExercises.find((d) => d.id === ex.id)?.imageUrl ?? '').trim())}
                              alt={`${(draftExercises.find((d) => d.id === ex.id)?.name ?? ex.name) || 'Exercise'} preview`}
                              loading="lazy"
                              onError={() => {
                                setImagePreviewFailedById((prev) => ({ ...prev, [ex.id]: true }))
                              }}
                            />
                          )}
                        </div>
                      ) : null}

                      <div className="createSchemeBar" aria-label="Quick training schemes">
                        <span className="createSchemeLabel">Quick scheme:</span>
                        <button
                          type="button"
                          className="createSchemeChip"
                          onClick={() => updateDraftExercise(ex.id, { sets: '5', reps: '5' })}
                        >
                          5×5
                        </button>
                        <button
                          type="button"
                          className="createSchemeChip"
                          onClick={() => updateDraftExercise(ex.id, { sets: '3', reps: '10' })}
                        >
                          3×10
                        </button>
                        <button
                          type="button"
                          className="createSchemeChip"
                          onClick={() => updateDraftExercise(ex.id, { sets: '4', reps: '12' })}
                        >
                          4×12
                        </button>
                      </div>

                      <div className="exerciseMetaRow" aria-label="Sets, reps, weight">
                        <label className="metaField">
                          <div className="metaLabel">Sets</div>
                          <input
                            className="input metaInput"
                            inputMode="numeric"
                            value={draftExercises.find((d) => d.id === ex.id)?.sets ?? ''}
                            onChange={(ev) => updateDraftExercise(ex.id, { sets: ev.target.value })}
                            placeholder="(optional)"
                          />
                        </label>
                        <label className="metaField">
                          <div className="metaLabel">Reps</div>
                          <input
                            className="input metaInput"
                            inputMode="numeric"
                            value={draftExercises.find((d) => d.id === ex.id)?.reps ?? ''}
                            onChange={(ev) => updateDraftExercise(ex.id, { reps: ev.target.value })}
                            placeholder="(optional)"
                          />
                        </label>
                        <label className="metaField">
                          <div className="metaLabel">Weight</div>
                          <input
                            className="input metaInput"
                            inputMode="decimal"
                            value={draftExercises.find((d) => d.id === ex.id)?.weight ?? ''}
                            onChange={(ev) => updateDraftExercise(ex.id, { weight: ev.target.value })}
                            placeholder="(optional)"
                          />
                        </label>
                      </div>

                      <div className="exerciseTimeRow" aria-label="Time">
                        <label className="metaField">
                          <div className="metaLabel">Minutes</div>
                          <input
                            className="input metaInput"
                            inputMode="numeric"
                            value={draftExercises.find((d) => d.id === ex.id)?.timeMins ?? ''}
                            onChange={(ev) => updateDraftExercise(ex.id, { timeMins: ev.target.value })}
                            placeholder="(optional)"
                          />
                        </label>
                        <label className="metaField">
                          <div className="metaLabel">Seconds</div>
                          <input
                            className="input metaInput"
                            inputMode="numeric"
                            value={draftExercises.find((d) => d.id === ex.id)?.timeSecs ?? ''}
                            onChange={(ev) => updateDraftExercise(ex.id, { timeSecs: ev.target.value })}
                            placeholder="(optional)"
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {!isEditing && (ex.sets || ex.reps || ex.weight || (typeof ex.timeSeconds === 'number' && ex.timeSeconds > 0)) ? (
                    <div className="runMeta completionMetricsGrid" aria-label="Sets, reps, weight">
                      <div className="runMetaField completionMetricBox">
                        <span className="runMetaLabel">Sets</span>
                        <span className="runMetaValue">{typeof ex.sets === 'number' ? ex.sets : '—'}</span>
                      </div>
                      <div className="runMetaField completionMetricBox">
                        <span className="runMetaLabel">Reps</span>
                        <span className="runMetaValue">{typeof ex.reps === 'number' ? ex.reps : '—'}</span>
                      </div>
                      <div className="runMetaField completionMetricBox">
                        <span className="runMetaLabel">Weight</span>
                        <span className="runMetaValue">
                          {typeof ex.weight === 'number' ? `${ex.weight} lbs` : '—'}
                        </span>
                      </div>
                      {typeof ex.timeSeconds === 'number' && ex.timeSeconds > 0 ? (
                        <div className="runMetaField completionMetricBox">
                          <span className="runMetaLabel">Duration</span>
                          <span className="runMetaValue">{formatDuration(ex.timeSeconds)}</span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {!isEditing && volSharePct > 0 ? (
                    <div className="completionVolShareRow">
                      <div className="completionVolShareHead">
                        <span>Session Volume Share</span>
                        <strong>{volSharePct}%</strong>
                      </div>
                      <div className="completionVolShareTrack" aria-hidden="true">
                        <div className="completionVolShareFill" style={{ width: `${volSharePct}%` }} />
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty" style={{ marginTop: 12 }}>
            No exercise records were saved for this workout.
          </div>
        )}
      </div>
    </div>
  )
}

