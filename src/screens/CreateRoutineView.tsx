import React from 'react'
import type { Routine } from '../routines/types'
import { makeId } from '../routines/id'
import type { RoutineCompletion } from '../completions/types'
import { EXERCISE_PRESETS } from '../exercises/presets'

type DraftExercise = {
  id: string
  name: string
  imageUrl: string
  sets: string
  reps: string
  weight: string
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
      }))
    }

    return [{ id: makeId(), name: '', imageUrl: '', sets: '', reps: '', weight: '' }]
  })

  const [dragExerciseId, setDragExerciseId] = React.useState<string | null>(null)
  const [dragOverExerciseId, setDragOverExerciseId] = React.useState<string | null>(null)

  const [error, setError] = React.useState<string | null>(null)

  const addExercise = () => {
    setExerciseDrafts((prev) => [...prev, { id: makeId(), name: '', imageUrl: '', sets: '', reps: '', weight: '' }])
  }

  const removeExercise = (id: string) => {
    setExerciseDrafts((prev) => prev.filter((e) => e.id !== id))
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
      .map((d) => ({
        id: d.id,
        name: d.name.trim(),
        imageUrls: normalizeImageUrls(d.imageUrl),
        sets: normalizeOptionalInt(d.sets),
        reps: normalizeOptionalInt(d.reps),
        weight: normalizeOptionalNumber(d.weight),
      }))
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

  return (
    <div className="panel createPanel">
      <div className="panelTitleRow">
        <div className="panelTitle">{isEdit ? 'Edit routine' : 'Create routine'}</div>
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

        <label className="field">
          <div className="fieldLabel">Routine name</div>
          <input
            className="input"
            value={routineName}
            onChange={(ev) => setRoutineName(ev.target.value)}
            placeholder="e.g., Upper body"
          />
        </label>

        <div className="divider" />

        <div className="rowBetween">
          <div>
            <div className="fieldLabel">Exercises</div>
            <div className="hint">Optionally add an image URL for reference (you can expand this later to multiple images).</div>
          </div>
        </div>

        <div className="exerciseList">
          {exerciseDrafts.map((ex, index) => (
            <div
              key={ex.id}
              className={dragOverExerciseId === ex.id ? 'exerciseRow exerciseRowDragOver' : 'exerciseRow'}
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
                className="exerciseIndex exerciseDragHandle"
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
                {index + 1}
              </div>
              <div className="exerciseFields">
                <input
                  className="input"
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
                    <span className="metaLabel">Weight</span>
                    <input
                      className="input metaInput"
                      inputMode="decimal"
                      value={ex.weight}
                      onChange={(ev) => updateExercise(ex.id, { weight: ev.target.value })}
                      placeholder="Optional"
                    />
                  </label>
                </div>
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
                  ↑
                </button>
                <button
                  type="button"
                  className="iconButton"
                  aria-label="Move exercise down"
                  onClick={() => moveExercise(ex.id, 1)}
                  disabled={index === exerciseDrafts.length - 1}
                  title={index === exerciseDrafts.length - 1 ? 'Already at bottom' : 'Move down'}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="iconButton"
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
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="exerciseActions">
          <button type="button" className="button" onClick={addExercise}>
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
          <button type="submit" className="button">
            {isEdit ? 'Save changes' : 'Save routine'}
          </button>
        </div>
      </form>
    </div>
  )
}
