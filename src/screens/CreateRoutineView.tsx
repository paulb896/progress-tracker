import React from 'react'
import type { Routine } from '../routines/types'
import { makeId } from '../routines/id'
import type { RoutineCompletion } from '../completions/types'
import { EXERCISE_PRESETS } from '../exercises/presets'
import { getPeriodicElement } from '../app/periodicTable'
import { resolveImageUrl } from '../app/resolveImageUrl'

type DraftExercise = {
  id: string
  name: string
  imageUrl: string
  sets: string
  reps: string
  weight: string
  timeMins: string
  timeSecs: string
  supersetName: string
  supersetWeight: string
  supersetImageUrl: string
}

type CreateRoutineViewProps = {
  initialRoutine?: Routine | null
  completionHistory?: RoutineCompletion[]
  onCancel: () => void
  onSave: (routine: Routine) => void
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

export const CreateRoutineView = ({ initialRoutine = null, completionHistory = [], onCancel, onSave }: CreateRoutineViewProps) => {
  const isEdit = !!initialRoutine

  const presetByName = React.useMemo(() => {
    const byName = new Map<string, (typeof EXERCISE_PRESETS)[number]>()
    for (const preset of EXERCISE_PRESETS) {
      byName.set(preset.name.trim().toLowerCase(), preset)
    }
    return byName
  }, [])

  const [routineName, setRoutineName] = React.useState(() => initialRoutine?.name ?? '')
  const [exerciseDrafts, setExerciseDrafts] = React.useState<DraftExercise[]>(() => {
    if (initialRoutine?.exercises?.length) {
      return initialRoutine.exercises.map((ex) => ({
        id: ex.id,
        name: ex.name,
        imageUrl: ex.imageUrls?.[0] ?? '',
        sets: typeof ex.sets === 'number' ? String(ex.sets) : '',
        reps: typeof ex.reps === 'number' ? String(ex.reps) : '',
        weight: typeof ex.weight === 'number' ? String(ex.weight) : '',
        timeMins: typeof ex.timeSeconds === 'number' ? String(Math.floor(ex.timeSeconds / 60)) : '',
        timeSecs: typeof ex.timeSeconds === 'number' ? String(Math.floor(ex.timeSeconds % 60)) : '',
        supersetName: ex.supersetWith?.name ?? '',
        supersetWeight: typeof ex.supersetWith?.weight === 'number' ? String(ex.supersetWith.weight) : '',
        supersetImageUrl: ex.supersetWith?.imageUrls?.[0] ?? '',
      }))
    }

    return [{ id: makeId(), name: '', imageUrl: '', sets: '', reps: '', weight: '', timeMins: '', timeSecs: '', supersetName: '', supersetWeight: '', supersetImageUrl: '' }]
  })

  const [dragExerciseId, setDragExerciseId] = React.useState<string | null>(null)
  const [dragOverExerciseId, setDragOverExerciseId] = React.useState<string | null>(null)

  const [imagePreviewFailedById, setImagePreviewFailedById] = React.useState<Record<string, boolean>>({})
  const [presetMuscleFilter, setPresetMuscleFilter] = React.useState<string>('All')
  const [openPresetDrawerById, setOpenPresetDrawerById] = React.useState<Record<string, boolean>>({})

  const [error, setError] = React.useState<string | null>(null)

  const addExercise = () => {
    setExerciseDrafts((prev) => [...prev, { id: makeId(), name: '', imageUrl: '', sets: '', reps: '', weight: '', timeMins: '', timeSecs: '', supersetName: '', supersetWeight: '', supersetImageUrl: '' }])
  }

  const duplicateExercise = (id: string) => {
    setExerciseDrafts((prev) => {
      const idx = prev.findIndex((e) => e.id === id)
      if (idx < 0) return prev
      const source = prev[idx]!
      const clone: DraftExercise = {
        ...source,
        id: makeId(),
      }
      const copy = [...prev]
      copy.splice(idx + 1, 0, clone)
      return copy
    })
  }

  const removeExercise = (id: string) => {
    setExerciseDrafts((prev) => prev.filter((e) => e.id !== id))

    setImagePreviewFailedById((prev) => {
      if (!prev[id]) return prev
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
  }

  const moveExercise = (id: string, delta: -1 | 1) => {
    setExerciseDrafts((prev) => {
      const idx = prev.findIndex((e) => e.id === id)
      if (idx < 0) return prev
      const nextIdx = idx + delta
      if (nextIdx < 0 || nextIdx >= prev.length) return prev

      const copy = [...prev]
      const [item] = copy.splice(idx, 1)
      copy.splice(nextIdx, 0, item!)
      return copy
    })
  }

  const moveExerciseTo = (sourceId: string, targetId: string) => {
    setExerciseDrafts((prev) => {
      if (sourceId === targetId) return prev
      const sourceIndex = prev.findIndex((e) => e.id === sourceId)
      const targetIndex = prev.findIndex((e) => e.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0) return prev

      const copy = [...prev]
      const [item] = copy.splice(sourceIndex, 1)
      const insertAt = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
      copy.splice(insertAt, 0, item!)
      return copy
    })
  }

  const updateExercise = (id: string, patch: Partial<DraftExercise>) => {
    setExerciseDrafts((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))

    if (Object.prototype.hasOwnProperty.call(patch, 'imageUrl')) {
      setImagePreviewFailedById((prev) => {
        if (!prev[id]) return prev
        const copy = { ...prev }
        delete copy[id]
        return copy
      })
    }
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const name = routineName.trim()
    if (!name) {
      setError('Routine name is required.')
      return
    }

    const exercises = exerciseDrafts
      .map((d) => {
        const supersetName = d.supersetName.trim()
        return {
          id: d.id,
          name: d.name.trim(),
          imageUrls: normalizeImageUrls(d.imageUrl),
          sets: normalizeOptionalInt(d.sets),
          reps: normalizeOptionalInt(d.reps),
          weight: normalizeOptionalNumber(d.weight),
          timeSeconds: normalizeOptionalDurationSeconds(d.timeMins, d.timeSecs),
          supersetWith: supersetName
            ? {
                name: supersetName,
                weight: normalizeOptionalNumber(d.supersetWeight),
                imageUrls: normalizeImageUrls(d.supersetImageUrl),
              }
            : undefined,
        }
      })
      .filter((ex) => ex.name.length > 0)

    if (exercises.length === 0) {
      setError('Add at least one exercise.')
      return
    }

    const routine: Routine = isEdit
      ? {
          id: initialRoutine!.id,
          name,
          exercises,
          createdAt: initialRoutine!.createdAt,
        }
      : {
          id: makeId(),
          name,
          exercises,
          createdAt: new Date().toISOString(),
        }

    onSave(routine)
  }

  const routineEl = getPeriodicElement(routineName.trim() || 'New Routine')
  const quickPresets =
    presetMuscleFilter === 'All'
      ? EXERCISE_PRESETS.filter((p) => p.imageUrl).slice(0, 10)
      : EXERCISE_PRESETS.filter((p) => p.muscles?.includes(presetMuscleFilter as never)).slice(0, 10)

  const draftStats = React.useMemo(() => {
    const muscles = new Set<string>()
    let totalVol = 0
    let namedCount = 0
    for (const d of exerciseDrafts) {
      if (d.name.trim()) namedCount++
      const p = presetByName.get(d.name.trim().toLowerCase())
      if (p?.muscles) {
        for (const m of p.muscles) muscles.add(m)
      }
      const sets = normalizeOptionalInt(d.sets) ?? 0
      const reps = normalizeOptionalInt(d.reps) ?? 0
      const weight = normalizeOptionalNumber(d.weight) ?? 0
      const ssWeight = normalizeOptionalNumber(d.supersetWeight) ?? 0
      totalVol += sets * reps * (weight + ssWeight)
    }
    return {
      namedCount,
      muscles: Array.from(muscles),
      totalVol: Math.round(totalVol),
    }
  }, [exerciseDrafts, presetByName])

  return (
    <div
      className="panel glassPanel createPanel"
      style={{ '--routine-color': routineEl.color } as React.CSSProperties}
    >
      <div className="panelTitleRow createHeaderRow">
        <div className="createHeaderTitleBlock">
          <span className="panelEyebrow">FORMULA ARCHITECT • LAB EDITOR</span>
          <div className="panelTitle">{isEdit ? 'Edit routine' : 'Create routine'}</div>
        </div>
        <button type="button" className="button secondary" onClick={onCancel}>
          Back
        </button>
      </div>

      <form className="panelBody" onSubmit={onSubmit}>
        <datalist id="exercise-presets">
          {EXERCISE_PRESETS.map((p) => (
            <option key={p.name} value={p.name} />
          ))}
        </datalist>

        <div className="createFormulaBanner">
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
            <label className="field" style={{ marginBottom: 10 }}>
              <div className="fieldLabel">Routine name</div>
              <input
                className="input createRoutineNameInput"
                value={routineName}
                onChange={(ev) => setRoutineName(ev.target.value)}
                placeholder="e.g., Upper body"
              />
            </label>

            <div className="createFormulaStatsRow" aria-label="Routine draft summary">
              <span className="createStatChip">
                <strong>{exerciseDrafts.length}</strong> {exerciseDrafts.length === 1 ? 'exercise slot' : 'exercise slots'}
              </span>
              {draftStats.totalVol > 0 ? (
                <span className="createStatChip createStatChipAccent">
                  <strong>{draftStats.totalVol.toLocaleString()}</strong> lbs planned
                </span>
              ) : null}
              {draftStats.muscles.map((m) => (
                <span key={m} className="homeMuscleTag">{m}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="divider" />

        <div className="rowBetween createExercisesHeader">
          <div>
            <div className="fieldLabel">Exercises</div>
            <div className="hint">
              Select a preset or enter custom exercises. Reference images and muscle groups auto-link when matching a preset.
            </div>
          </div>
          <button type="button" className="button secondary" onClick={addExercise}>
            + Add slot
          </button>
        </div>

        <div className="exerciseList">
          {exerciseDrafts.map((ex, index) => {
            const el = getPeriodicElement(ex.name.trim() || `Exercise ${index + 1}`)
            const matchedPreset = presetByName.get(ex.name.trim().toLowerCase())
            const hasPreview = ex.imageUrl.trim().length > 0
            const setsNum = normalizeOptionalInt(ex.sets) ?? 0
            const repsNum = normalizeOptionalInt(ex.reps) ?? 0
            const weightNum = normalizeOptionalNumber(ex.weight) ?? 0
            const exVol = Math.round(setsNum * repsNum * weightNum)
            const est1RM =
              weightNum > 0
                ? repsNum > 1
                  ? Math.round(weightNum * (1 + Math.min(20, repsNum) / 30))
                  : Math.round(weightNum)
                : 0
            const showPresetDrawer = !ex.name.trim() || !!openPresetDrawerById[ex.id]

            const rowClasses = [
              'exerciseRow',
              dragOverExerciseId === ex.id ? 'exerciseRowDragOver' : '',
              hasPreview ? 'has-preview' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <div
                key={ex.id}
                className={rowClasses}
                style={{ '--element-color': el.color } as React.CSSProperties}
                onDragOver={(ev) => {
                  if (!dragExerciseId) return
                  ev.preventDefault()
                  setDragOverExerciseId(ex.id)
                }}
                onDragLeave={() => {
                  setDragOverExerciseId((prev) => (prev === ex.id ? null : prev))
                }}
                onDrop={(ev) => {
                  ev.preventDefault()
                  const sourceId = ev.dataTransfer.getData('text/plain') || dragExerciseId
                  if (!sourceId) return
                  moveExerciseTo(sourceId, ex.id)
                  setDragExerciseId(null)
                  setDragOverExerciseId(null)
                }}
              >
                <div
                  className="exerciseIndex exerciseDragHandle pt-mini-symbol createExerciseTile"
                  draggable
                  role="button"
                  tabIndex={0}
                  aria-label="Drag to reorder"
                  title="Drag to reorder"
                  onDragStart={(ev) => {
                    setDragExerciseId(ex.id)
                    setDragOverExerciseId(ex.id)
                    ev.dataTransfer.effectAllowed = 'move'
                    ev.dataTransfer.setData('text/plain', ex.id)
                  }}
                  onDragEnd={() => {
                    setDragExerciseId(null)
                    setDragOverExerciseId(null)
                  }}
                >
                  <span className="createExerciseTileStep">{String(index + 1).padStart(2, '0')}</span>
                  <span className="createExerciseTileSym">{el.symbol}</span>
                  <span className="createExerciseTileNum">#{el.atomicNumber}</span>
                </div>

                <div className="exerciseFields">
                  <div className="createExerciseTopBar">
                    <span className="createExerciseBadge">
                      SLOT {String(index + 1).padStart(2, '0')} • {el.groupName}
                    </span>
                    <div className="createExerciseTopTags">
                      {matchedPreset?.muscles?.map((m) => (
                        <span key={m} className="homeMuscleTag">{m}</span>
                      ))}
                      {exVol > 0 ? (
                        <span className="homeCardVolumePill">{exVol.toLocaleString()} lbs vol</span>
                      ) : null}
                      {est1RM > 0 ? (
                        <span className="create1rmBadge" title="Estimated 1RM">
                          🏆 1RM ~{est1RM} lbs
                        </span>
                      ) : null}
                      {ex.name.trim() ? (
                        <button
                          type="button"
                          className="createPresetToggleBtn"
                          onClick={() =>
                            setOpenPresetDrawerById((prev) => ({
                              ...prev,
                              [ex.id]: !prev[ex.id],
                            }))
                          }
                        >
                          {openPresetDrawerById[ex.id] ? 'Hide presets' : '🧪 Swap preset'}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {showPresetDrawer ? (
                    <div className="createQuickPresets" aria-label="Quick exercise presets">
                      <div className="createQuickPresetsFilterRow">
                        <span className="createQuickPresetsLabel">Preset Library:</span>
                        {['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'].map((mGroup) => (
                          <button
                            key={mGroup}
                            type="button"
                            className={`createMuscleFilterBtn ${presetMuscleFilter === mGroup ? 'is-active' : ''}`}
                            onClick={() => setPresetMuscleFilter(mGroup)}
                          >
                            {mGroup}
                          </button>
                        ))}
                      </div>
                      <div className="createQuickPresetsChips">
                        {quickPresets.map((qp) => (
                          <button
                            key={qp.name}
                            type="button"
                            className="createQuickPresetChip"
                            onClick={() => {
                              updateExercise(ex.id, {
                                name: qp.name,
                                imageUrl: qp.imageUrl ?? ex.imageUrl,
                              })
                              setOpenPresetDrawerById((prev) => ({ ...prev, [ex.id]: false }))
                            }}
                          >
                            {qp.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="createExerciseMainGrid">
                    <div className="createExerciseInputsCol">
                      <input
                        className="input createExerciseNameInput"
                        list="exercise-presets"
                        value={ex.name}
                        onChange={(ev) => {
                          const nextName = ev.target.value
                          const preset = presetByName.get(nextName.trim().toLowerCase())

                          updateExercise(ex.id, {
                            name: nextName,
                            imageUrl: !ex.imageUrl && preset?.imageUrl ? preset.imageUrl : ex.imageUrl,
                          })
                        }}
                        placeholder="Exercise name (e.g., Push-ups)"
                      />
                      <input
                        className="input"
                        value={ex.imageUrl}
                        onChange={(ev) => updateExercise(ex.id, { imageUrl: ev.target.value })}
                        placeholder="Image URL (optional)"
                      />

                      {/* One-Tap Rep & Load Scheme Bar */}
                      <div className="createSchemeBar" aria-label="Quick training schemes">
                        <span className="createSchemeLabel">Quick scheme:</span>
                        <button
                          type="button"
                          className={`createSchemeChip ${ex.sets === '5' && ex.reps === '5' ? 'is-active' : ''}`}
                          onClick={() => updateExercise(ex.id, { sets: '5', reps: '5' })}
                        >
                          5×5 Strength
                        </button>
                        <button
                          type="button"
                          className={`createSchemeChip ${ex.sets === '3' && ex.reps === '10' ? 'is-active' : ''}`}
                          onClick={() => updateExercise(ex.id, { sets: '3', reps: '10' })}
                        >
                          3×10 Hypertrophy
                        </button>
                        <button
                          type="button"
                          className={`createSchemeChip ${ex.sets === '4' && ex.reps === '12' ? 'is-active' : ''}`}
                          onClick={() => updateExercise(ex.id, { sets: '4', reps: '12' })}
                        >
                          4×12 Volume
                        </button>
                        <button
                          type="button"
                          className={`createSchemeChip ${ex.sets === '3' && ex.timeMins === '1' ? 'is-active' : ''}`}
                          onClick={() => updateExercise(ex.id, { sets: '3', timeMins: '1', timeSecs: '0' })}
                        >
                          3×60s Hold
                        </button>
                      </div>

                      <div className="exerciseMetaRow" aria-label="Optional training details">
                        <label className="metaField">
                          <span className="metaLabel">Sets</span>
                          <input
                            className="input metaInput"
                            inputMode="numeric"
                            value={ex.sets}
                            onChange={(ev) => updateExercise(ex.id, { sets: ev.target.value })}
                            placeholder="Optional"
                          />
                        </label>
                        <label className="metaField">
                          <span className="metaLabel">Reps</span>
                          <input
                            className="input metaInput"
                            inputMode="numeric"
                            value={ex.reps}
                            onChange={(ev) => updateExercise(ex.id, { reps: ev.target.value })}
                            placeholder="Optional"
                          />
                        </label>
                        <label className="metaField">
                          <span className="metaLabel">Weight (lbs)</span>
                          <input
                            className="input metaInput"
                            inputMode="decimal"
                            value={ex.weight}
                            onChange={(ev) => updateExercise(ex.id, { weight: ev.target.value })}
                            placeholder="Optional"
                          />
                        </label>
                      </div>

                      {/* Quick Weight Plate Presets */}
                      <div className="createSchemeBar" aria-label="Quick weight presets">
                        <span className="createSchemeLabel">Load (lbs):</span>
                        {[45, 95, 135, 185, 225].map((wVal) => (
                          <button
                            key={wVal}
                            type="button"
                            className={`createSchemeChip ${ex.weight === String(wVal) ? 'is-active' : ''}`}
                            onClick={() => updateExercise(ex.id, { weight: String(wVal) })}
                          >
                            {wVal}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="createSchemeChip"
                          onClick={() => {
                            const cur = normalizeOptionalNumber(ex.weight) ?? 0
                            updateExercise(ex.id, { weight: String(cur + 5) })
                          }}
                        >
                          +5
                        </button>
                        <button
                          type="button"
                          className="createSchemeChip"
                          onClick={() => {
                            const cur = normalizeOptionalNumber(ex.weight) ?? 0
                            updateExercise(ex.id, { weight: String(cur + 10) })
                          }}
                        >
                          +10
                        </button>
                      </div>

                      <div className="exerciseTimeRow" aria-label="Optional time goal">
                        <label className="metaField">
                          <span className="metaLabel">Minutes</span>
                          <input
                            className="input metaInput"
                            inputMode="numeric"
                            value={ex.timeMins}
                            onChange={(ev) => updateExercise(ex.id, { timeMins: ev.target.value })}
                            placeholder="Optional"
                          />
                        </label>
                        <label className="metaField">
                          <span className="metaLabel">Seconds</span>
                          <input
                            className="input metaInput"
                            inputMode="numeric"
                            value={ex.timeSecs}
                            onChange={(ev) => updateExercise(ex.id, { timeSecs: ev.target.value })}
                            placeholder="Optional"
                          />
                        </label>
                      </div>
                    </div>

                    {hasPreview ? (
                      <div className="exerciseImagePreview" aria-label="Exercise image preview">
                        {imagePreviewFailedById[ex.id] ? (
                          <div className="exerciseImagePreviewFallback">Image failed to load.</div>
                        ) : (
                          <img
                            className="exerciseImagePreviewImg"
                            src={resolveImageUrl(ex.imageUrl.trim())}
                            alt={`${ex.name || 'Exercise'} preview`}
                            loading="lazy"
                            onError={() => {
                              setImagePreviewFailedById((prev) => ({ ...prev, [ex.id]: true }))
                            }}
                          />
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* Superset section */}
                  {ex.supersetName.trim() ? (
                    <div className="supersetSection">
                      <div className="supersetDivider">
                        <span className="supersetLabel">⚡ Superset with</span>
                        <button
                          type="button"
                          className="textButton smallTextButton"
                          onClick={() => updateExercise(ex.id, { supersetName: '', supersetWeight: '', supersetImageUrl: '' })}
                        >
                          Remove
                        </button>
                      </div>
                      <input
                        className="input"
                        list="exercise-presets"
                        value={ex.supersetName}
                        onChange={(ev) => {
                          const nextName = ev.target.value
                          const preset = presetByName.get(nextName.trim().toLowerCase())
                          updateExercise(ex.id, {
                            supersetName: nextName,
                            supersetImageUrl: !ex.supersetImageUrl && preset?.imageUrl ? preset.imageUrl : ex.supersetImageUrl,
                          })
                        }}
                        placeholder="Second exercise name"
                      />
                      <input
                        className="input"
                        value={ex.supersetImageUrl}
                        onChange={(ev) => updateExercise(ex.id, { supersetImageUrl: ev.target.value })}
                        placeholder="Image URL (optional)"
                      />
                      <div className="exerciseMetaRow">
                        <label className="metaField">
                          <span className="metaLabel">Weight</span>
                          <input
                            className="input metaInput"
                            inputMode="decimal"
                            value={ex.supersetWeight}
                            onChange={(ev) => updateExercise(ex.id, { supersetWeight: ev.target.value })}
                            placeholder="Optional"
                          />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="textButton smallTextButton supersetAddBtn"
                      onClick={() => updateExercise(ex.id, { supersetName: ' ' })}
                    >
                      + Add superset
                    </button>
                  )}
                </div>

                <div className="exerciseRowActions">
                  <button
                    type="button"
                    className="iconButton"
                    aria-label="Move exercise up"
                    onClick={() => moveExercise(ex.id, -1)}
                    disabled={index === 0}
                    title={index === 0 ? 'Already at top' : 'Move up'}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path
                        d="M12 5l-6 6m6-6l6 6M12 5v14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="iconButton"
                    aria-label="Move exercise down"
                    onClick={() => moveExercise(ex.id, 1)}
                    disabled={index === exerciseDrafts.length - 1}
                    title={index === exerciseDrafts.length - 1 ? 'Already at bottom' : 'Move down'}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path
                        d="M12 19l6-6m-6 6l-6-6M12 5v14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="iconButton"
                    aria-label="Duplicate exercise"
                    onClick={() => duplicateExercise(ex.id)}
                    title="Duplicate exercise slot"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="iconButton iconButtonDanger"
                    aria-label="Remove exercise"
                    onClick={() => {
                      if (isEdit) {
                        const label = ex.name.trim() ? `"${ex.name.trim()}"` : 'this exercise'
                        const ok = window.confirm(`Remove ${label} from the routine?`)
                        if (!ok) return
                      }

                      removeExercise(ex.id)
                    }}
                    disabled={exerciseDrafts.length <= 1}
                    title={exerciseDrafts.length <= 1 ? 'At least one row required' : 'Remove'}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                      <path
                        d="M9 3h6m-7 6h8m-9 0l1 12h6l1-12M10 6l.5-2h3L14 6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="exerciseActions">
          <button type="button" className="button secondary" onClick={addExercise}>
            Add exercise
          </button>
        </div>

        {error ? <div className="error">{error}</div> : null}

        {isEdit ? (
          <>
            <div className="divider" />
            <div>
              <div className="fieldLabel">History</div>
              {completionHistory.length ? (
                <div className="hint">
                  Completed {completionHistory.length} times. Last: {new Date(completionHistory[0]!.completedAt).toLocaleString()}
                </div>
              ) : (
                <div className="hint">No completed runs yet for this routine.</div>
              )}
            </div>
          </>
        ) : null}

        <div className="footerRow">
          <button type="button" className="button secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="button primary">
            {isEdit ? 'Save changes' : 'Save routine'}
          </button>
        </div>
      </form>
    </div>
  )
}

