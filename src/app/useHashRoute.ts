import React from 'react'
import type { Route } from './routes'
import { parseHashRoute, toHash } from './routes'

export const useHashRoute = (): {
  route: Route
  navigate: (next: Route) => void
} => {
  const [route, setRoute] = React.useState<Route>(() => parseHashRoute(window.location.hash))

  React.useEffect(() => {
    const onChange = (): void => {
      setRoute(parseHashRoute(window.location.hash))
    }

    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = React.useCallback((next: Route) => {
    const nextHash = toHash(next)
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash
    } else {
      setRoute(next)
    }
  }, [])

  return { route, navigate }
}
