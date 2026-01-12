import React from 'react'
import type { Route } from './routes'
import { parsePathRoute, toPath } from './routes'

const normalizeBasePath = (basePath: string): string => {
  let normalized = (basePath || '/').trim()
  if (!normalized.startsWith('/')) normalized = `/${normalized}`
  if (!normalized.endsWith('/')) normalized = `${normalized}/`
  return normalized === '//' ? '/' : normalized
}

export const usePathRoute = (): {
  route: Route
  navigate: (next: Route) => void
} => {
  const basePath = normalizeBasePath(import.meta.env.BASE_URL || '/')
  const [route, setRoute] = React.useState<Route>(() => parsePathRoute(window.location.pathname, basePath))

  React.useEffect(() => {
    const onPopState = (): void => {
      setRoute(parsePathRoute(window.location.pathname, basePath))
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [basePath])

  const navigate = React.useCallback(
    (next: Route) => {
      const nextPath = toPath(next, basePath)
      if (window.location.pathname !== nextPath) {
        window.history.pushState(null, '', nextPath)
      }
      setRoute(next)
    },
    [basePath]
  )

  return { route, navigate }
}
