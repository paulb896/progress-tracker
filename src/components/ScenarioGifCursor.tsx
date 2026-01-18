import React from 'react'

const isScenarioGifMode = (): boolean => {
  try {
    return (window as any).__PROGRESS_TRACKER_SCENARIO_GIF__ === true
  } catch {
    return false
  }
}

export const ScenarioGifCursor = () => {
  const ref = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!isScenarioGifMode()) return

    const el = ref.current
    if (!el) return

    let raf = 0
    let lastX = 12
    let lastY = 12

    const update = (x: number, y: number) => {
      lastX = x
      lastY = y
      if (raf) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        el.style.transform = `translate3d(${lastX}px, ${lastY}px, 0)`
      })
    }

    const onMove = (ev: MouseEvent) => {
      update(ev.clientX, ev.clientY)
    }

    // Initialize position so the cursor is visible immediately.
    update(lastX, lastY)

    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])

  if (!isScenarioGifMode()) return null

  return <div ref={ref} className="scenarioGifCursor" aria-hidden="true" />
}
