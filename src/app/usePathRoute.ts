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

  const scrollPositions = React.useRef<Record<string, number>>({})

  React.useLayoutEffect(() => {
    const scrollY = scrollPositions.current[window.location.pathname] ?? 0
    setTimeout(() => {
      window.scrollTo(0, scrollY)
    }, 100)
  }, [route])

  React.useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }

    const onPopState = (): void => {
      setRoute(parsePathRoute(window.location.pathname, basePath))
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [basePath])

  const navigate = React.useCallback(
    (next: Route) => {
      scrollPositions.current[window.location.pathname] = window.scrollY
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
