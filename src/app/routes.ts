export type Route =
  | { name: 'home' }
  | { name: 'create' }
  | { name: 'edit'; routineId: string }
  | { name: 'run'; routineId: string }
  | { name: 'completed'; completionId: string }

const normalizeBasePath = (basePath: string): string => {
  let normalized = (basePath || '/').trim()
  if (!normalized.startsWith('/')) normalized = `/${normalized}`
  if (!normalized.endsWith('/')) normalized = `${normalized}/`
  return normalized === '//' ? '/' : normalized
}

const stripBasePath = (pathname: string, basePath: string): string => {
  const base = normalizeBasePath(basePath)
  const rawPath = (pathname || '/').trim() || '/'
  if (base !== '/' && rawPath.startsWith(base)) {
    return rawPath.slice(base.length).replace(/^\/+/, '')
  }
  return rawPath.replace(/^\/+/, '')
}

export const parsePathRoute = (pathname: string, basePath: string): Route => {
  const path = stripBasePath(pathname, basePath)

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

export const toPath = (route: Route, basePath: string): string => {
  const base = normalizeBasePath(basePath)
  const suffix = (() => {
    switch (route.name) {
      case 'home':
        return ''
      case 'create':
        return 'create'
      case 'edit':
        return `edit/${route.routineId}`
      case 'run':
        return `run/${route.routineId}`
      case 'completed':
        return `completed/${route.completionId}`
    }
  })()

  return suffix ? `${base}${suffix}` : base
}
