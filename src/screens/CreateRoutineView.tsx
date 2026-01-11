import React from 'react'
import type { Routine } from '../routines/types'
import { makeId } from '../routines/id'
import type { RoutineCompletion } from '../completions/types'

type DraftExercise = {
  id: string
  name: string
  imageUrl: string
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

export const CreateRoutineView = ({ initialRoutine = null, completionHistory = [], onCancel, onSave }: CreateRoutineViewProps) => {
  const isEdit = !!initialRoutine

  const [routineName, setRoutineName] = React.useState(() => initialRoutine?.name ?? '')
  const [exerciseDrafts, setExerciseDrafts] = React.useState<DraftExercise[]>(() => {
    if (initialRoutine?.exercises?.length) {
      return initialRoutine.exercises.map((ex) => ({
        id: ex.id,
        name: ex.name,
        imageUrl: ex.imageUrls?.[0] ?? '',
      }))
    }

    return [{ id: makeId(), name: '', imageUrl: '' }]
  })

  const [error, setError] = React.useState<string | null>(null)

  const addExercise = () => {
    setExerciseDrafts((prev) => [...prev, { id: makeId(), name: '', imageUrl: '' }])
  }

  const removeExercise = (id: string) => {
    setExerciseDrafts((prev) => prev.filter((e) => e.id !== id))
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
    <div className="panel">
      <div className="panelTitleRow">
        <div className="panelTitle">{isEdit ? 'Edit routine' : 'Create routine'}</div>
        <button type="button" className="button secondary" onClick={onCancel}>
          Back
        </button>
      </div>

      <form className="panelBody" onSubmit={onSubmit}>
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
          <button type="button" className="button" onClick={addExercise}>
            Add exercise
          </button>
        </div>

        <div className="exerciseList">
          {exerciseDrafts.map((ex, index) => (
            <div key={ex.id} className="exerciseRow">
              <div className="exerciseIndex">{index + 1}</div>
              <div className="exerciseFields">
                <input
                  className="input"
                  value={ex.name}
                  onChange={(ev) => updateExercise(ex.id, { name: ev.target.value })}
                  placeholder="Exercise name (e.g., Push-ups)"
                />
                <input
                  className="input"
                  value={ex.imageUrl}
                  onChange={(ev) => updateExercise(ex.id, { imageUrl: ev.target.value })}
                  placeholder="Image URL (optional)"
                />
              </div>
              <button
                type="button"
                className="iconButton"
                aria-label="Remove exercise"
                onClick={() => removeExercise(ex.id)}
                disabled={exerciseDrafts.length <= 1}
                title={exerciseDrafts.length <= 1 ? 'At least one row required' : 'Remove'}
              >
                ×
              </button>
            </div>
          ))}
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
