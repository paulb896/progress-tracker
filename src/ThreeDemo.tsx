import { useState, useEffect, useRef, useCallback } from 'react'

const STORAGE_KEY = 'progress-tracker:lift-minigame-enabled:v1'
const STATS_STORAGE_KEY = 'progress-tracker:lift-minigame-stats:v2'

type LiftStyle = 'ohp' | 'bench' | 'deadlift'

type SavedMiniGameStats = {
  bestPrLbs: number
  bestStreak: number
}

type FloatingPopup = {
  id: number
  text: string
  subtext?: string
  color: string
}

type Spark = {
  id: number
  x: number
  y: number
  dx: number
  dy: number
  color: string
}

type AnimPhase = 'READY' | 'GRIND' | 'HIT' | 'MISS'

const LIFT_STYLES: Array<{ id: LiftStyle; label: string; fullName: string }> = [
  { id: 'ohp', label: 'OHP', fullName: 'Overhead Press' },
  { id: 'bench', label: 'Bench', fullName: 'Bench Press' },
  { id: 'deadlift', label: 'Deadlift', fullName: 'Deadlift' },
]

const PLATE_COLORS = ['#2dd4bf', '#38bdf8', '#818cf8', '#f59e0b', '#fb7185', '#c084fc']

const getWeightForLevel = (level: number): number => {
  const baseSteps = [135, 185, 225, 275, 315, 365, 405, 455, 495, 545, 585]
  if (level < baseSteps.length) return baseSteps[level]
  return 585 + (level - (baseSteps.length - 1)) * 50
}

const getPlatesForWeight = (weightLbs: number): Array<{ is25: boolean; color: string }> => {
  const perSide = Math.max(0, Math.round((weightLbs - 45) / 2))
  const count45 = Math.min(6, Math.floor(perSide / 45))
  const has25 = perSide % 45 >= 20
  const plates: Array<{ is25: boolean; color: string }> = []
  for (let i = 0; i < count45; i++) {
    plates.push({ is25: false, color: PLATE_COLORS[i % PLATE_COLORS.length] })
  }
  if (has25) {
    plates.push({ is25: true, color: '#a3e635' })
  }
  return plates
}

const getZoneConfig = (level: number, center: number) => {
  const goodWidth = Math.max(0.14, 0.34 - level * 0.02)
  const perfectWidth = Math.max(0.055, 0.11 - level * 0.005)
  const grindPad = 0.09 // Amber sticking-point zone on each side of green
  const speed = Math.min(3.5, 1.35 + level * 0.18)

  const halfGood = goodWidth / 2
  const halfPerfect = perfectWidth / 2
  const halfGrind = halfGood + grindPad
  const clampedCenter = Math.max(halfGrind + 0.03, Math.min(1 - halfGrind - 0.03, center))

  return {
    center: clampedCenter,
    grindStart: clampedCenter - halfGrind,
    grindEnd: clampedCenter + halfGrind,
    goodStart: clampedCenter - halfGood,
    goodEnd: clampedCenter + halfGood,
    perfectStart: clampedCenter - halfPerfect,
    perfectEnd: clampedCenter + halfPerfect,
    speed,
  }
}

const pickNextCenter = (nextLevel: number): number => {
  if (nextLevel < 2) return 0.5
  return 0.32 + Math.random() * 0.36
}

const loadSavedStats = (): SavedMiniGameStats => {
  try {
    const raw = window.localStorage.getItem(STATS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedMiniGameStats>
      return {
        bestPrLbs: typeof parsed.bestPrLbs === 'number' ? parsed.bestPrLbs : 0,
        bestStreak: typeof parsed.bestStreak === 'number' ? parsed.bestStreak : 0,
      }
    }
    const legacy = window.localStorage.getItem('progress-tracker:lift-minigame-stats:v1')
    if (legacy) {
      const parsed = JSON.parse(legacy) as { bestWeightLbs?: number; bestStreak?: number }
      return {
        bestPrLbs: typeof parsed.bestWeightLbs === 'number' ? parsed.bestWeightLbs : 0,
        bestStreak: typeof parsed.bestStreak === 'number' ? parsed.bestStreak : 0,
      }
    }
  } catch {
    // Ignore storage errors
  }
  return { bestPrLbs: 0, bestStreak: 0 }
}

const playGymTone = (
  kind: 'clean' | 'perfect' | 'grind' | 'plate' | 'miss',
  soundEnabled: boolean
) => {
  if (!soundEnabled || typeof window === 'undefined') return
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return
  try {
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    if (kind === 'clean') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(330, now)
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.16)
      gain.gain.setValueAtTime(0.07, now)
      gain.gain.linearRampToValueAtTime(0.001, now + 0.16)
      osc.start(now)
      osc.stop(now + 0.16)
    } else if (kind === 'perfect') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.22)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.linearRampToValueAtTime(0.001, now + 0.22)
      osc.start(now)
      osc.stop(now + 0.22)
    } else if (kind === 'grind') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(160, now)
      osc.frequency.exponentialRampToValueAtTime(270, now + 0.06)
      gain.gain.setValueAtTime(0.05, now)
      gain.gain.linearRampToValueAtTime(0.001, now + 0.06)
      osc.start(now)
      osc.stop(now + 0.06)
    } else if (kind === 'plate') {
      osc.type = 'square'
      osc.frequency.setValueAtTime(125, now)
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.07)
      gain.gain.setValueAtTime(0.035, now)
      gain.gain.linearRampToValueAtTime(0.001, now + 0.07)
      osc.start(now)
      osc.stop(now + 0.07)
    } else {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(140, now)
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.22)
      gain.gain.setValueAtTime(0.06, now)
      gain.gain.linearRampToValueAtTime(0.001, now + 0.22)
      osc.start(now)
      osc.stop(now + 0.22)
    }
    window.setTimeout(() => {
      ctx.close().catch(() => {})
    }, 300)
  } catch {
    // Ignore audio context restrictions
  }
}

export function ThreeDemo({ theme = 'dark' }: { theme?: 'light' | 'dark' }) {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved === 'false') return false
      if (saved === 'true') return true
    } catch {
      // Ignore storage access errors
    }
    return true
  })

  const [savedStats, setSavedStats] = useState<SavedMiniGameStats>(loadSavedStats)
  const [liftStyle, setLiftStyle] = useState<LiftStyle>('ohp')
  const [level, setLevel] = useState(0)
  const [streak, setStreak] = useState(0)
  const [zoneCenter, setZoneCenter] = useState(0.5)
  const [needlePos, setNeedlePos] = useState(0.5)
  const [liftHeight, setLiftHeight] = useState(0)
  const [animPhase, setAnimPhase] = useState<AnimPhase>('READY')
  const [lastHitPerfect, setLastHitPerfect] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [popups, setPopups] = useState<FloatingPopup[]>([])
  const [sparks, setSparks] = useState<Spark[]>([])
  const [statusHint, setStatusHint] = useState('Press in the green zone — amber triggers a grind!')

  const weightLbs = getWeightForLevel(level)
  const zone = getZoneConfig(level, zoneCenter)
  const plates = getPlatesForWeight(weightLbs)
  const isOnFire = streak >= 3
  const currentStyle = LIFT_STYLES.find((s) => s.id === liftStyle) ?? LIFT_STYLES[0]

  const popupIdRef = useRef(1)
  const spawnPopup = useCallback((text: string, color: string, subtext?: string) => {
    const id = popupIdRef.current++
    setPopups((prev) => [...prev.slice(-2), { id, text, subtext, color }])
    window.setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== id))
    }, 950)
  }, [])

  const spawnSparks = useCallback((isPerfect: boolean) => {
    const count = isPerfect ? 10 : 6
    const colors = isPerfect
      ? ['#fbbf24', '#f59e0b', '#fef08a', '#2dd4bf']
      : ['#2dd4bf', '#38bdf8', '#a3e635']
    const batch: Spark[] = Array.from({ length: count }).map((_, i) => {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4
      const dist = 26 + Math.random() * 34
      return {
        id: popupIdRef.current++,
        x: 180,
        y: 66,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist * 0.65 - 10,
        color: colors[i % colors.length],
      }
    })
    setSparks(batch)
    window.setTimeout(() => {
      setSparks([])
    }, 520)
  }, [])

  const persistStats = useCallback((updater: (prev: SavedMiniGameStats) => SavedMiniGameStats) => {
    setSavedStats((prev) => {
      const next = updater(prev)
      try {
        window.localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Ignore storage errors
      }
      return next
    })
  }, [])

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        // Ignore storage errors
      }
      return next
    })
  }, [])

  const engineRef = useRef({
    phase: 'READY' as AnimPhase,
    animTime: 0,
    grindHeight: 0.48,
    needlePhase: 0,
    needlePos: 0.5,
    level: 0,
    streak: 0,
    zoneCenter: 0.5,
    pendingNextLevel: 0,
    soundEnabled: false,
    bestPrLbs: savedStats.bestPrLbs,
  })

  useEffect(() => {
    engineRef.current.soundEnabled = soundEnabled
    engineRef.current.bestPrLbs = savedStats.bestPrLbs
  }, [soundEnabled, savedStats.bestPrLbs])

  const completeLift = useCallback(
    (kind: 'perfect' | 'clean' | 'clutch') => {
      const eng = engineRef.current
      const currentWeight = getWeightForLevel(eng.level)
      const nextStreak = eng.streak + 1
      const nextLevel = eng.level + 1
      const isPerfect = kind === 'perfect'

      eng.streak = nextStreak
      eng.pendingNextLevel = nextLevel
      eng.phase = 'HIT'
      eng.animTime = kind === 'clutch' ? 0.2 : 0

      setStreak(nextStreak)
      setAnimPhase('HIT')
      setLastHitPerfect(isPerfect)
      spawnSparks(isPerfect || kind === 'clutch')

      const isNewPr = currentWeight > eng.bestPrLbs
      persistStats((prev) => ({
        bestPrLbs: Math.max(prev.bestPrLbs, currentWeight),
        bestStreak: Math.max(prev.bestStreak, nextStreak),
      }))

      if (isNewPr) {
        spawnPopup(
          `NEW PR! ${currentWeight} LBS 🏆`,
          '#f59e0b',
          kind === 'clutch' ? 'CLUTCH GRIND SAVE!' : isPerfect ? 'PERFECT LOCKOUT!' : 'CLEAN LOCKOUT!'
        )
        setStatusHint(`NEW PR! Locked out ${currentWeight} lbs!`)
      } else if (kind === 'clutch') {
        spawnPopup('CLUTCH SAVE! 😤', '#f59e0b', `${currentWeight} lbs grinded out!`)
        setStatusHint(`Clutch grind at ${currentWeight} lbs!`)
      } else if (isPerfect) {
        spawnPopup('PERFECT! 🔥', '#fbbf24', `${currentWeight} lbs • ${nextStreak}× Streak`)
        setStatusHint(`PERFECT! Crushed ${currentWeight} lbs!`)
      } else {
        spawnPopup('CLEAN REP! 💪', '#2dd4bf', `${currentWeight} lbs`)
        setStatusHint(`Clean lift at ${currentWeight} lbs!`)
      }

      playGymTone(isPerfect || isNewPr || kind === 'clutch' ? 'perfect' : 'clean', eng.soundEnabled)
    },
    [persistStats, spawnPopup, spawnSparks]
  )

  const failLift = useCallback(
    (reason: string) => {
      const eng = engineRef.current
      const currentWeight = getWeightForLevel(eng.level)
      eng.streak = 0
      eng.phase = 'MISS'
      eng.animTime = 0

      setStreak(0)
      setAnimPhase('MISS')
      setLastHitPerfect(false)
      spawnPopup('MISSED!', '#fb7185', `${reason} ${currentWeight} lbs`)
      setStatusHint(`${reason} ${currentWeight} lbs — resetting to 135 lbs!`)
      playGymTone('miss', eng.soundEnabled)
    },
    [spawnPopup]
  )

  const adjustLevel = useCallback(
    (delta: number) => {
      const eng = engineRef.current
      if (eng.phase !== 'READY') return
      const next = Math.max(0, Math.min(12, eng.level + delta))
      if (next === eng.level) return
      eng.level = next
      eng.zoneCenter = pickNextCenter(next)
      setLevel(next)
      setZoneCenter(eng.zoneCenter)
      setStatusHint(`Loaded ${getWeightForLevel(next)} lbs — ready to lift!`)
      playGymTone('plate', eng.soundEnabled)
    },
    []
  )

  useEffect(() => {
    if (!enabled) return

    let rafId = 0
    let lastTime = performance.now()

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      const eng = engineRef.current

      if (eng.phase === 'READY') {
        const cfg = getZoneConfig(eng.level, eng.zoneCenter)
        eng.needlePhase += dt * cfg.speed
        eng.needlePos = (Math.sin(eng.needlePhase) + 1) * 0.5
        setNeedlePos(eng.needlePos)
      } else if (eng.phase === 'GRIND') {
        // Gravity pulls the bar down while you tap fast to save the lift
        const gravity = Math.min(0.52, 0.30 + eng.level * 0.024)
        eng.grindHeight = Math.max(0, eng.grindHeight - gravity * dt)
        setLiftHeight(eng.grindHeight)
        if (eng.grindHeight <= 0.03) {
          failLift('Dropped')
        }
      } else if (eng.phase === 'HIT') {
        eng.animTime += dt
        if (eng.animTime < 0.24) {
          const t = eng.animTime / 0.24
          const eased = 1 - Math.pow(1 - t, 3)
          setLiftHeight(eased)
        } else if (eng.animTime < 0.62) {
          setLiftHeight(1)
        } else if (eng.animTime < 0.78) {
          const t = (eng.animTime - 0.62) / 0.16
          setLiftHeight(1 - t)
        } else {
          const nextLvl = eng.pendingNextLevel
          const nextCenter = pickNextCenter(nextLvl)
          eng.level = nextLvl
          eng.zoneCenter = nextCenter
          eng.phase = 'READY'
          eng.animTime = 0
          setLevel(nextLvl)
          setZoneCenter(nextCenter)
          setAnimPhase('READY')
          setLiftHeight(0)
          setStatusHint(`Next up: ${getWeightForLevel(nextLvl)} lbs — time the green zone!`)
        }
      } else if (eng.phase === 'MISS') {
        eng.animTime += dt
        if (eng.animTime < 0.14) {
          const t = eng.animTime / 0.14
          setLiftHeight(t * 0.24)
        } else if (eng.animTime < 0.34) {
          const t = (eng.animTime - 0.14) / 0.2
          setLiftHeight(0.24 * (1 - t * t))
        } else if (eng.animTime < 0.58) {
          setLiftHeight(0)
        } else {
          eng.level = 0
          eng.zoneCenter = 0.5
          eng.phase = 'READY'
          eng.animTime = 0
          setLevel(0)
          setZoneCenter(0.5)
          setAnimPhase('READY')
          setLiftHeight(0)
          setStatusHint('Reset to 135 lbs. Press in the green zone!')
        }
      }

      rafId = window.requestAnimationFrame(tick)
    }

    rafId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(rafId)
  }, [enabled, failLift])

  const handlePress = useCallback(() => {
    if (!enabled) return
    const eng = engineRef.current

    // Interactive GRIND battle: rapid taps push the bar past the sticking point!
    if (eng.phase === 'GRIND') {
      const tapPower = Math.max(0.14, 0.21 - eng.level * 0.006)
      eng.grindHeight = Math.min(1, eng.grindHeight + tapPower)
      setLiftHeight(eng.grindHeight)
      playGymTone('grind', eng.soundEnabled)

      if (eng.grindHeight >= 0.96) {
        completeLift('clutch')
      }
      return
    }

    if (eng.phase !== 'READY') return

    const cfg = getZoneConfig(eng.level, eng.zoneCenter)
    const pos = eng.needlePos

    const isPerfect = pos >= cfg.perfectStart && pos <= cfg.perfectEnd
    const isGood = pos >= cfg.goodStart && pos <= cfg.goodEnd
    const isGrind = pos >= cfg.grindStart && pos <= cfg.grindEnd

    if (isPerfect) {
      completeLift('perfect')
    } else if (isGood) {
      completeLift('clean')
    } else if (isGrind) {
      eng.phase = 'GRIND'
      eng.grindHeight = 0.46
      setAnimPhase('GRIND')
      setLiftHeight(0.46)
      spawnPopup('STICKING POINT!', '#f59e0b', 'TAP FAST TO GRIND!')
      setStatusHint('GRIND IT OUT! Tap PRESS or Space rapidly!')
      playGymTone('grind', eng.soundEnabled)
    } else {
      failLift('Stalled at')
    }
  }, [completeLift, enabled, failLift, spawnPopup])

  // Visual geometry based on LiftStyle & liftHeight (0..1)
  const startY = liftStyle === 'deadlift' ? 186 : liftStyle === 'bench' ? 168 : 148
  const endY = liftStyle === 'deadlift' ? 112 : liftStyle === 'bench' ? 74 : 58
  const barY = startY - liftHeight * (startY - endY)

  const isLockedOut = animPhase === 'HIT' && liftHeight > 0.92
  const isGrinding = animPhase === 'GRIND'
  const isMissed = animPhase === 'MISS'
  const tremorX = isGrinding ? Math.sin(liftHeight * 60) * 2.8 : 0

  const plateCount = plates.length
  const barFlex = isLockedOut
    ? 2 + plateCount * 1.1
    : liftHeight > 0.05
      ? (2.5 + plateCount * 1.6) * Math.sin(liftHeight * Math.PI)
      : 1

  const gripLeftX = (liftStyle === 'deadlift' ? 142 : 118) + tremorX
  const gripRightX = (liftStyle === 'deadlift' ? 218 : 242) + tremorX
  const shoulderLeftX = 152 + tremorX * 0.5
  const shoulderRightX = 208 + tremorX * 0.5
  const shoulderY =
    liftStyle === 'deadlift'
      ? 144 - liftHeight * 22
      : liftStyle === 'bench'
        ? 178
        : 144
  const headY =
    liftStyle === 'deadlift'
      ? 118 - liftHeight * 22
      : liftStyle === 'bench'
        ? 156 - liftHeight * 3
        : 117 - liftHeight * 3
  const elbowFlare = (1 - liftHeight) * (liftStyle === 'deadlift' ? 10 : 24) + 5
  const elbowY = (barY + shoulderY) * 0.5 + (1 - liftHeight) * (liftStyle === 'deadlift' ? 6 : 16)
  const elbowLeftX = gripLeftX - elbowFlare * 0.4
  const elbowRightX = gripRightX + elbowFlare * 0.4

  const needleInPerfect = needlePos >= zone.perfectStart && needlePos <= zone.perfectEnd
  const needleInGood = needlePos >= zone.goodStart && needlePos <= zone.goodEnd
  const needleInGrind = needlePos >= zone.grindStart && needlePos <= zone.grindEnd

  if (!enabled) {
    return (
      <div className="miniGameShell miniGameShell--disabled" data-theme={theme}>
        <div className="miniGameDisabledCard">
          <div className="miniGameDisabledBadge">
            <span className="miniGameDot miniGameDot--paused" aria-hidden="true" />
            2D LIFT MINI-GAME • STANDBY
          </div>
          <div className="miniGameDisabledTitle">Barbell Reactor Mini-Game Paused</div>
          <p className="miniGameDisabledText">
            Enable the quick timing mini-game to test your reflexes, grind out heavy saves, and climb the PR ladder.
          </p>
          {savedStats.bestPrLbs > 0 ? (
            <div className="miniGameSavedStats">
              <span>Best PR: {savedStats.bestPrLbs} lbs</span>
              <span>•</span>
              <span>Best Streak: {savedStats.bestStreak}×</span>
            </div>
          ) : null}
          <button
            type="button"
            className="button primary miniGameToggleBtn"
            onClick={toggleEnabled}
            aria-pressed={false}
          >
            Enable Mini-Game
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="miniGameShell" data-theme={theme}>
      <div
        className={`miniGameCard ${isOnFire || isGrinding ? 'miniGameCard--overdrive' : ''}`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === '+' || e.key === '=') {
            e.preventDefault()
            adjustLevel(1)
          } else if (e.key === 'ArrowDown' || e.key === '-') {
            e.preventDefault()
            adjustLevel(-1)
          }
        }}
      >
        {/* Top Bar */}
        <div className="miniGameHeader">
          <div className="miniGameTitleGroup">
            <span className="miniGameEyebrow">
              <span className="miniGameDot" aria-hidden="true" />
              PR TIMING CHALLENGE
            </span>
            <div className="miniGameTitleRow">
              <span className="miniGameTitle">Iron Press Mini-Game</span>
            </div>
          </div>

          <div className="miniGameHeaderActions">
            <button
              type="button"
              className={`miniGameIconBtn ${soundEnabled ? 'is-active' : ''}`}
              onClick={() => setSoundEnabled((s) => !s)}
              aria-label={soundEnabled ? 'Mute mini-game sound effects' : 'Enable mini-game sound effects'}
              title={soundEnabled ? 'SFX On' : 'SFX Muted'}
            >
              {soundEnabled ? '🔊' : '🔇'}
            </button>
            <button
              type="button"
              className="miniGameToggleBtn miniGameToggleBtn--off"
              onClick={toggleEnabled}
              aria-pressed={true}
              title="Disable 2D weight lifting mini-game"
            >
              Disable Mini-Game
            </button>
          </div>
        </div>

        {/* Compact Lift Style Selector */}
        <div className="miniGameModeTabs" role="tablist" aria-label="Select lift style">
          {LIFT_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={liftStyle === s.id}
              className={`miniGameModeTab ${liftStyle === s.id ? 'is-active' : ''}`}
              onClick={() => {
                setLiftStyle(s.id)
                setStatusHint(`Switched to ${s.fullName} — press in the green zone!`)
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Clean 3-Stat HUD with Interactive Weight Adjuster */}
        <div className="miniGameHud miniGameHud--simple" aria-label="Mini-game stats">
          <div className="miniGameStat miniGameStat--weight">
            <span className="miniGameStatLabel">Bar Load</span>
            <div className="miniGameWeightStepRow">
              <button
                type="button"
                className="miniGameStepBtn"
                onClick={() => adjustLevel(-1)}
                disabled={level === 0 || animPhase !== 'READY'}
                aria-label="Decrease barbell weight"
                title="Remove weight"
              >
                −
              </button>
              <span className="miniGameStatValue">
                {weightLbs}
                <small> lb</small>
              </span>
              <button
                type="button"
                className="miniGameStepBtn"
                onClick={() => adjustLevel(1)}
                disabled={level >= 12 || animPhase !== 'READY'}
                aria-label="Increase barbell weight"
                title="Add weight"
              >
                +
              </button>
            </div>
          </div>
          <div className="miniGameStat">
            <span className="miniGameStatLabel">Streak</span>
            <span className="miniGameStatValue">
              {streak}×{isOnFire ? ' 🔥' : ''}
            </span>
          </div>
          <div className="miniGameStat">
            <span className="miniGameStatLabel">Best PR</span>
            <span className="miniGameStatValue">
              {savedStats.bestPrLbs}
              <small> lbs</small>
            </span>
          </div>
        </div>

        {/* Interactive 2D Stage */}
        <div
          className={`miniGameStage ${isLockedOut ? 'is-lockout' : ''} ${isOnFire || isGrinding ? 'is-overdrive' : ''} ${isMissed ? 'is-miss' : ''}`}
          role="button"
          tabIndex={0}
          aria-label={`Press ${weightLbs} pound barbell (${currentStyle.fullName}). Tap or press Space in the green zone.`}
          onClick={handlePress}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              handlePress()
            }
          }}
        >
          {/* Floating Popups */}
          <div className="miniGamePopups" aria-hidden="true">
            {popups.map((p) => (
              <div
                key={p.id}
                className="miniGamePopupItem"
                style={{ left: '50%', '--popup-color': p.color } as React.CSSProperties}
              >
                <strong>{p.text}</strong>
                {p.subtext ? <span>{p.subtext}</span> : null}
              </div>
            ))}
          </div>

          <svg viewBox="0 0 360 220" className="miniGameSvg" aria-hidden="true">
            <defs>
              <linearGradient id="rackPostGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={theme === 'light' ? '#64748b' : '#334155'} />
                <stop offset="50%" stopColor={theme === 'light' ? '#94a3b8' : '#64748b'} />
                <stop offset="100%" stopColor={theme === 'light' ? '#475569' : '#1e293b'} />
              </linearGradient>
              <linearGradient id="barSteelGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isOnFire || isGrinding ? '#fef08a' : theme === 'light' ? '#64748b' : '#f8fafc'} />
                <stop offset="50%" stopColor={isOnFire || isGrinding ? '#f59e0b' : theme === 'light' ? '#334155' : '#94a3b8'} />
                <stop offset="100%" stopColor={theme === 'light' ? '#0f172a' : '#475569'} />
              </linearGradient>
            </defs>

            {/* Power Rack Uprights */}
            <rect x="76" y="26" width="10" height="178" rx="3" fill="url(#rackPostGrad)" />
            <rect x="274" y="26" width="10" height="178" rx="3" fill="url(#rackPostGrad)" />

            {/* Rack J-Hooks (OHP & Bench) */}
            {liftStyle !== 'deadlift' && (
              <>
                <path
                  d={`M 86 ${startY - 2} L 96 ${startY - 2} L 96 ${startY - 10}`}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <path
                  d={`M 274 ${startY - 2} L 264 ${startY - 2} L 264 ${startY - 10}`}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </>
            )}

            {/* Floor Platform */}
            <line
              x1="20"
              y1="204"
              x2="340"
              y2="204"
              stroke={
                isMissed
                  ? '#fb7185'
                  : isGrinding
                    ? '#f59e0b'
                    : isLockedOut
                      ? lastHitPerfect
                        ? '#fbbf24'
                        : '#2dd4bf'
                      : 'rgba(148, 163, 184, 0.45)'
              }
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Fire Streak / Grind Aura */}
            {(isOnFire || isGrinding) && (
              <ellipse
                cx="180"
                cy="152"
                rx="60"
                ry="42"
                fill="none"
                stroke="rgba(245, 158, 11, 0.45)"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
            )}

            {/* Lower Body / Bench */}
            {liftStyle === 'bench' ? (
              <rect
                x="144"
                y="176"
                width="72"
                height="24"
                rx="8"
                fill="#1e293b"
                stroke="#475569"
                strokeWidth="1.5"
              />
            ) : (
              <g stroke="#475569" strokeWidth="7.5" strokeLinecap="round">
                <line x1="164" y1="172" x2="154" y2="202" />
                <line x1="196" y1="172" x2="206" y2="202" />
              </g>
            )}

            {/* Lifter Torso */}
            <path
              d={`M ${shoulderLeftX} ${shoulderY} Q 180 ${shoulderY - 10} ${shoulderRightX} ${shoulderY} L 200 ${liftStyle === 'bench' ? 198 : 176} L 160 ${liftStyle === 'bench' ? 198 : 176} Z`}
              fill="#1e293b"
              stroke={isMissed ? '#fb7185' : isOnFire || isGrinding ? '#f59e0b' : '#334155'}
              strokeWidth="2"
            />

            {/* Lifter Head & Expression */}
            <circle
              cx={180 + tremorX * 0.5}
              cy={headY}
              r="13.5"
              fill="#0f172a"
              stroke={
                isMissed
                  ? '#fb7185'
                  : isOnFire || isGrinding
                    ? '#f59e0b'
                    : isLockedOut
                      ? '#2dd4bf'
                      : '#38bdf8'
              }
              strokeWidth="2.5"
            />

            {isMissed ? (
              <>
                <path d={`M 173 ${headY - 4} L 177 ${headY} M 177 ${headY - 4} L 173 ${headY}`} stroke="#fb7185" strokeWidth="1.6" strokeLinecap="round" />
                <path d={`M 183 ${headY - 4} L 187 ${headY} M 187 ${headY - 4} L 183 ${headY}`} stroke="#fb7185" strokeWidth="1.6" strokeLinecap="round" />
                <path d={`M 175 ${headY + 6} Q 180 ${headY + 2} 185 ${headY + 6}`} fill="none" stroke="#fb7185" strokeWidth="1.8" strokeLinecap="round" />
              </>
            ) : (
              <>
                <circle cx={175 + tremorX * 0.5} cy={headY - 2} r="1.7" fill="#f8fafc" />
                <circle cx={185 + tremorX * 0.5} cy={headY - 2} r="1.7" fill="#f8fafc" />
                {isLockedOut ? (
                  <path
                    d={`M 174 ${headY + 3} Q 180 ${headY + 9} 186 ${headY + 3}`}
                    fill="none"
                    stroke={lastHitPerfect ? '#fbbf24' : '#2dd4bf'}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                ) : isGrinding ? (
                  <rect
                    x={175 + tremorX * 0.5}
                    y={headY + 2}
                    width="10"
                    height="4.5"
                    rx="2"
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="1.6"
                  />
                ) : (
                  <line
                    x1={176}
                    y1={headY + 4}
                    x2={184}
                    y2={headY + 4}
                    stroke="#94a3b8"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                )}
              </>
            )}

            {/* Sweat Drops when Grinding */}
            {isGrinding && (
              <g fill="#38bdf8" opacity="0.9">
                <circle cx={158 + tremorX} cy={headY - 6} r="2.4" />
                <circle cx={202 + tremorX} cy={headY - 4} r="2" />
              </g>
            )}

            {/* Lifter Arms */}
            <polyline
              points={`${shoulderLeftX},${shoulderY} ${elbowLeftX},${elbowY} ${gripLeftX},${barY}`}
              fill="none"
              stroke={
                isMissed
                  ? '#fb7185'
                  : isOnFire || isGrinding
                    ? '#f59e0b'
                    : isLockedOut
                      ? '#2dd4bf'
                      : '#38bdf8'
              }
              strokeWidth="7.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={`${shoulderRightX},${shoulderY} ${elbowRightX},${elbowY} ${gripRightX},${barY}`}
              fill="none"
              stroke={
                isMissed
                  ? '#fb7185'
                  : isOnFire || isGrinding
                    ? '#f59e0b'
                    : isLockedOut
                      ? '#2dd4bf'
                      : '#38bdf8'
              }
              strokeWidth="7.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Lockout Celebration Ring & Sparks */}
            {isLockedOut && (
              <ellipse
                cx="180"
                cy={barY}
                rx="126"
                ry="15"
                fill="none"
                stroke={lastHitPerfect ? '#fbbf24' : '#2dd4bf'}
                strokeWidth="2.5"
                strokeDasharray="8 6"
              />
            )}

            {sparks.map((s) => (
              <circle
                key={s.id}
                cx={s.x + s.dx}
                cy={s.y + s.dy}
                r="3.2"
                fill={s.color}
                className="miniGameSpark"
              />
            ))}

            {/* Olympic Barbell Shaft */}
            <path
              d={`M 20 ${barY + barFlex} Q 180 ${barY - barFlex} 340 ${barY + barFlex}`}
              fill="none"
              stroke="url(#barSteelGrad)"
              strokeWidth="5.5"
              strokeLinecap="round"
            />

            {/* Hands */}
            <circle cx={gripLeftX} cy={barY} r="5.5" fill="#f8fafc" stroke="#0f172a" strokeWidth="2" />
            <circle cx={gripRightX} cy={barY} r="5.5" fill="#f8fafc" stroke="#0f172a" strokeWidth="2" />

            {/* Bumper Plates (clickable on left to unload, right to add weight!) */}
            {plates.map((plate, idx) => {
              const offset = idx * 8.5
              const plateH = plate.is25 ? 36 : 54 - idx * 2
              const plateW = plate.is25 ? 6 : 7.5
              const leftX = 64 - offset + tremorX * 0.4
              const rightX = 288 + offset + tremorX * 0.4
              const plateY = barY + barFlex * 0.65 - plateH / 2
              return (
                <g key={idx}>
                  <rect
                    x={leftX}
                    y={plateY}
                    width={plateW}
                    height={plateH}
                    rx="3"
                    fill={plate.color}
                    stroke="#0f172a"
                    strokeWidth="1.1"
                  />
                  <rect
                    x={rightX}
                    y={plateY}
                    width={plateW}
                    height={plateH}
                    rx="3"
                    fill={plate.color}
                    stroke="#0f172a"
                    strokeWidth="1.1"
                  />
                </g>
              )
            })}
          </svg>

          {/* Dynamic Timing Bar (transforms into Grind Meter during a Sticking Point!) */}
          <div className="miniGameTimingWrap" aria-hidden="true">
            {isGrinding ? (
              <div className="miniGameTimingTrack miniGameTimingTrack--grind">
                <div
                  className="miniGameGrindFill"
                  style={{ width: `${Math.round(liftHeight * 100)}%` }}
                />
                <span className="miniGameGrindLabel">
                  🔥 TAP FAST! {Math.round(liftHeight * 100)}%
                </span>
              </div>
            ) : (
              <div className="miniGameTimingTrack">
                <div
                  className="miniGameTimingGrind"
                  style={{
                    left: `${zone.grindStart * 100}%`,
                    width: `${(zone.grindEnd - zone.grindStart) * 100}%`,
                  }}
                />
                <div
                  className="miniGameTimingGood"
                  style={{
                    left: `${zone.goodStart * 100}%`,
                    width: `${(zone.goodEnd - zone.goodStart) * 100}%`,
                  }}
                />
                <div
                  className="miniGameTimingPerfect"
                  style={{
                    left: `${zone.perfectStart * 100}%`,
                    width: `${(zone.perfectEnd - zone.perfectStart) * 100}%`,
                  }}
                />
                <div
                  className={`miniGameTimingNeedle ${
                    needleInPerfect
                      ? 'is-perfect'
                      : needleInGood
                        ? 'is-good'
                        : needleInGrind
                          ? 'is-grind'
                          : ''
                  }`}
                  style={{ left: `${needlePos * 100}%` }}
                />
              </div>
            )}
            <div className="miniGameStageFooter">
              <span
                className={`miniGameStatusText ${isLockedOut ? 'is-lockout' : ''} ${isGrinding ? 'is-grind' : ''} ${isMissed ? 'is-miss' : ''}`}
              >
                {statusHint}
              </span>
            </div>
          </div>
        </div>

        {/* One Big Action Button */}
        <button
          type="button"
          className={`button primary miniGameLiftBtn ${isOnFire || isGrinding ? 'is-overdrive' : ''} ${isGrinding ? 'is-grinding' : ''}`}
          onClick={handlePress}
        >
          {isGrinding ? `🔥 GRIND! TAP FAST!` : `▲ PRESS ${weightLbs} LBS`}
        </button>
      </div>
    </div>
  )
}
