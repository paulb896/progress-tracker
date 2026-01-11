export type Route =
  | { name: 'home' }
  | { name: 'create' }
  | { name: 'edit'; routineId: string }
  | { name: 'run'; routineId: string }
  | { name: 'completed'; completionId: string }

export const parseHashRoute = (hash: string): Route => {
  const raw = (hash || '').replace(/^#/, '').trim()
  const path = raw.startsWith('/') ? raw.slice(1) : raw

  if (path === '') return { name: 'home' }
  if (path === 'create') return { name: 'create' }

  const editMatch = path.match(/^edit\/([^/]+)$/)
  if (editMatch) return { name: 'edit', routineId: editMatch[1] }

  const runMatch = path.match(/^run\/([^/]+)$/)
  if (runMatch) return { name: 'run', routineId: runMatch[1] }

  const completedMatch = path.match(/^completed\/([^/]+)$/)
  if (completedMatch) return { name: 'completed', completionId: completedMatch[1] }

  return { name: 'home' }
}

export const toHash = (route: Route): string => {
  switch (route.name) {
    case 'home':
      return '#'
    case 'create':
      return '#create'
    case 'edit':
      return `#edit/${route.routineId}`
    case 'run':
      return `#run/${route.routineId}`
    case 'completed':
      return `#completed/${route.completionId}`
  }
}
