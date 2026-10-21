import { useState, useEffect, useRef, useCallback } from 'react'

const STORAGE_KEY = 'progress-tracker:lift-minigame-enabled:v1'
const STATS_STORAGE_KEY = 'progress-tracker:lift-minigame-stats:v1'

type LiftMode = 'bench' | 'ohp' | 'deadlift'

type LiftModeConfig = {
  id: LiftMode
  shortName: string
  fullName: string
  symbol: string
  atomicNum: number
  driveMultiplier: number
  gravityMultiplier: number
}

const LIFT_MODES: LiftModeConfig[] = [
  {
    id: 'bench',
    shortName: 'Bench',
    fullName: 'Bench Press',
    symbol: 'Bp',
    atomicNum: 26,
    driveMultiplier: 1.0,
    gravityMultiplier: 1.0,
  },
  {
    id: 'ohp',
    shortName: 'Strict OHP',
    fullName: 'Overhead Press',
    symbol: 'Op',
    atomicNum: 22,
    driveMultiplier: 0.88,
    gravityMultiplier: 1.1,
  },
  {
    id: 'deadlift',
    shortName: 'Deadlift',
    fullName: 'Sumo / Conv Pull',
    symbol: 'Dl',
    atomicNum: 74,
    driveMultiplier: 1.12,
    gravityMultiplier: 0.95,
  },
]

type WeightTier = {
  weightLbs: number
  label: string
  platesPerSide: number
  plateColors: string[]
  gravity: number
  pumpImpulse: number
  holdDrive: number
  staminaCost: number
  xpReward: number
}

const WEIGHT_TIERS: WeightTier[] = [
  {
    weightLbs: 135,
    label: '1 Plate • Warmup',
    platesPerSide: 1,
    plateColors: ['#2dd4bf'],
    gravity: 0.38,
    pumpImpulse: 0.30,
    holdDrive: 0.88,
    staminaCost: 8,
    xpReward: 15,
  },
  {
    weightLbs: 225,
    label: '2 Plates • Working',
    platesPerSide: 2,
    plateColors: ['#2dd4bf', '#38bdf8'],
    gravity: 0.48,
    pumpImpulse: 0.25,
    holdDrive: 0.76,
    staminaCost: 13,
    xpReward: 30,
  },
  {
    weightLbs: 315,
    label: '3 Plates • Heavy',
    platesPerSide: 3,
    plateColors: ['#2dd4bf', '#38bdf8', '#818cf8'],
    gravity: 0.58,
    pumpImpulse: 0.21,
    holdDrive: 0.68,
    staminaCost: 18,
    xpReward: 50,
  },
  {
    weightLbs: 405,
    label: '4 Plates • Elite',
    platesPerSide: 4,
    plateColors: ['#2dd4bf', '#38bdf8', '#818cf8', '#f59e0b'],
    gravity: 0.68,
    pumpImpulse: 0.17,
    holdDrive: 0.60,
    staminaCost: 24,
    xpReward: 80,
  },
  {
    weightLbs: 495,
    label: '5 Plates • Reactor Max',
    platesPerSide: 5,
    plateColors: ['#2dd4bf', '#38bdf8', '#818cf8', '#f59e0b', '#fb7185'],
    gravity: 0.78,
    pumpImpulse: 0.14,
    holdDrive: 0.52,
    staminaCost: 30,
    xpReward: 125,
  },
  {
    weightLbs: 585,
    label: '6 Plates • Isotope PR',
    platesPerSide: 6,
    plateColors: ['#2dd4bf', '#38bdf8', '#818cf8', '#f59e0b', '#fb7185', '#a855f7'],
    gravity: 0.88,
    pumpImpulse: 0.12,
    holdDrive: 0.46,
    staminaCost: 36,
    xpReward: 180,
  },
]

type LifterRank = {
  level: number
  symbol: string
  title: string
  minXp: number
  color: string
}

const LIFTER_RANKS: LifterRank[] = [
  { level: 1, symbol: 'Li', title: 'Lithium Novice', minXp: 0, color: '#2dd4bf' },
  { level: 2, symbol: 'Mg', title: 'Magnesium Lifter', minXp: 100, color: '#38bdf8' },
  { level: 3, symbol: 'Ti', title: 'Titanium Presser', minXp: 280, color: '#818cf8' },
  { level: 4, symbol: 'Fe', title: 'Iron Vanguard', minXp: 550, color: '#f59e0b' },
  { level: 5, symbol: 'W', title: 'Tungsten Titan', minXp: 950, color: '#fb7185' },
  { level: 6, symbol: 'U', title: 'Uranium Reactor God', minXp: 1500, color: '#c084fc' },
]

type FloatingPopup = {
  id: number
  text: string
  subtext?: string
  color: string
  x: number
}

type SavedMiniGameStats = {
  xp: number
  bestWeightLbs: number
  bestStreak: number
  bestAmrapReps: number
}

const loadSavedStats = (): SavedMiniGameStats => {
  try {
    const raw = window.localStorage.getItem(STATS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedMiniGameStats>
      return {
        xp: typeof parsed.xp === 'number' ? parsed.xp : 0,
        bestWeightLbs: typeof parsed.bestWeightLbs === 'number' ? parsed.bestWeightLbs : 0,
        bestStreak: typeof parsed.bestStreak === 'number' ? parsed.bestStreak : 0,
        bestAmrapReps: typeof parsed.bestAmrapReps === 'number' ? parsed.bestAmrapReps : 0,
      }
    }
  } catch {
    // Ignore storage errors
  }
  return { xp: 0, bestWeightLbs: 0, bestStreak: 0, bestAmrapReps: 0 }
}

const getRankForXp = (xp: number): { current: LifterRank; next: LifterRank | null; progressPct: number } => {
  let current = LIFTER_RANKS[0]
  for (const r of LIFTER_RANKS) {
    if (xp >= r.minXp) current = r
  }
  const idx = LIFTER_RANKS.indexOf(current)
  const next = idx < LIFTER_RANKS.length - 1 ? LIFTER_RANKS[idx + 1] : null
  if (!next) return { current, next: null, progressPct: 100 }
  const span = Math.max(1, next.minXp - current.minXp)
  const progressPct = Math.min(100, Math.round(((xp - current.minXp) / span) * 100))
  return { current, next, progressPct }
}

const numberFormatter = new Intl.NumberFormat()

// Lightweight WebAudio synthesizer for optional gym sound effects
const playGymTone = (kind: 'pump' | 'lockout' | 'crit' | 'plate' | 'buff', soundEnabled: boolean) => {
  if (!soundEnabled || typeof window === 'undefined') return
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return
  try {
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    if (kind === 'pump') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(140, now)
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.07)
      gain.gain.setValueAtTime(0.05, now)
      gain.gain.linearRampToValueAtTime(0.001, now + 0.07)
      osc.start(now)
      osc.stop(now + 0.07)
    } else if (kind === 'lockout') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(330, now)
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.16)
      gain.gain.setValueAtTime(0.07, now)
      gain.gain.linearRampToValueAtTime(0.001, now + 0.16)
      osc.start(now)
      osc.stop(now + 0.16)
    } else if (kind === 'crit') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.22)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.linearRampToValueAtTime(0.001, now + 0.22)
      osc.start(now)
      osc.stop(now + 0.22)
    } else if (kind === 'plate') {
      osc.type = 'square'
      osc.frequency.setValueAtTime(110, now)
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.08)
      gain.gain.setValueAtTime(0.04, now)
      gain.gain.linearRampToValueAtTime(0.001, now + 0.08)
      osc.start(now)
      osc.stop(now + 0.08)
    } else if (kind === 'buff') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(261.6, now)
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.2)
      gain.gain.setValueAtTime(0.06, now)
      gain.gain.linearRampToValueAtTime(0.001, now + 0.2)
      osc.start(now)
      osc.stop(now + 0.2)
    }
    setTimeout(() => {
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
  const [liftMode, setLiftMode] = useState<LiftMode>('bench')
  const [tierIndex, setTierIndex] = useState(1) // Default 225 lbs (2 plates)
  const [repCount, setRepCount] = useState(0)
  const [totalVolume, setTotalVolume] = useState(0)
  const [streak, setStreak] = useState(0)
  const [liftHeight, setLiftHeight] = useState(0) // 0 (bottom) to 1 (lockout)
  const [stamina, setStamina] = useState(100) // 0..100
  const [overdriveCharge, setOverdriveCharge] = useState(0) // 0..100
  const [overdriveActive, setOverdriveActive] = useState(false)
  const [chalkRemaining, setChalkRemaining] = useState(0) // seconds
  const [pulsePos, setPulsePos] = useState(0.5) // 0..1 oscillating sweet-spot meter
  const [phase, setPhase] = useState<'IDLE' | 'LIFTING' | 'LOCKOUT'>('IDLE')
  const [lastRepCrit, setLastRepCrit] = useState(false)
  const [statusMessage, setStatusMessage] = useState('Tap LIFT or click the stage to press! Hit the Gold Pulse for 2× CRIT!')
  const [isHolding, setIsHolding] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [popups, setPopups] = useState<FloatingPopup[]>([])

  // 30-second AMRAP Blitz Challenge state
  const [amrapActive, setAmrapActive] = useState(false)
  const [amrapSecondsLeft, setAmrapSecondsLeft] = useState(0)
  const [amrapReps, setAmrapReps] = useState(0)

  const tier = WEIGHT_TIERS[tierIndex] ?? WEIGHT_TIERS[1]
  const modeConfig = LIFT_MODES.find((m) => m.id === liftMode) ?? LIFT_MODES[0]
  const rankInfo = getRankForXp(savedStats.xp)

  const popupIdRef = useRef(1)
  const spawnPopup = useCallback((text: string, color: string, subtext?: string) => {
    const id = popupIdRef.current++
    const x = 135 + ((id * 37) % 110)
    setPopups((prev) => [...prev.slice(-3), { id, text, subtext, color, x }])
    window.setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== id))
    }, 1050)
  }, [])

  const stateRef = useRef({
    height: 0,
    velocity: 0,
    stamina: 100,
    overdriveCharge: 0,
    overdriveActive: false,
    overdriveTimer: 0,
    chalkTimer: 0,
    pulsePhase: 0,
    pulseValue: 0.5,
    phase: 'IDLE' as 'IDLE' | 'LIFTING' | 'LOCKOUT',
    lockoutTimer: 0,
    holding: false,
    tier,
    modeConfig,
    amrapActive: false,
    amrapTimer: 0,
    soundEnabled: false,
  })

  useEffect(() => {
    stateRef.current.tier = tier
    stateRef.current.modeConfig = modeConfig
    stateRef.current.soundEnabled = soundEnabled
  }, [tier, modeConfig, soundEnabled])

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

  const completeRep = useCallback(
    (weightLbs: number, xpBase: number) => {
      const st = stateRef.current
      // Sweet spot window is 0.36..0.64 in pulseValue (or automatic during Overdrive)
      const isSweetSpot = st.overdriveActive || (st.pulseValue >= 0.36 && st.pulseValue <= 0.64)
      const multiplier = isSweetSpot ? 2 : 1
      const earnedXp = xpBase * multiplier

      setLastRepCrit(isSweetSpot)
      setRepCount((c) => c + 1)
      setTotalVolume((v) => v + weightLbs)

      if (st.amrapActive) {
        setAmrapReps((r) => {
          const nextAmrap = r + 1
          persistStats((prev) => ({
            ...prev,
            bestAmrapReps: Math.max(prev.bestAmrapReps, nextAmrap),
          }))
          return nextAmrap
        })
      }

      if (!st.overdriveActive) {
        const nextCharge = Math.min(100, st.overdriveCharge + (isSweetSpot ? 34 : 20))
        st.overdriveCharge = nextCharge
        setOverdriveCharge(nextCharge)
      }

      setStreak((s) => {
        const nextStreak = s + 1
        const isNewPr = weightLbs > savedStats.bestWeightLbs

        persistStats((prev) => ({
          ...prev,
          xp: prev.xp + earnedXp,
          bestWeightLbs: Math.max(prev.bestWeightLbs, weightLbs),
          bestStreak: Math.max(prev.bestStreak, nextStreak),
        }))

        if (isNewPr) {
          spawnPopup(`NEW PR! ${weightLbs} LBS`, '#f59e0b', `+${earnedXp} XP`)
        } else if (isSweetSpot) {
          spawnPopup(`PERFECT LOCKOUT ×2!`, '#2dd4bf', `+${weightLbs} lbs • +${earnedXp} XP`)
        } else {
          spawnPopup(`+${weightLbs} LBS`, '#38bdf8', `+${earnedXp} XP`)
        }

        setStatusMessage(
          isSweetSpot
            ? `CRIT LOCKOUT! +${weightLbs} lbs (+${earnedXp} XP) • ${nextStreak}× Streak!`
            : `LOCKOUT COMPLETE! +${weightLbs} lbs (+${earnedXp} XP)`
        )
        return nextStreak
      })

      playGymTone(isSweetSpot ? 'crit' : 'lockout', st.soundEnabled)
    },
    [persistStats, savedStats.bestWeightLbs, spawnPopup]
  )

  const triggerPump = useCallback(() => {
    if (!enabled) return
    const st = stateRef.current
    if (st.phase === 'LOCKOUT') return

    // Calculate buffs
    const chalkBoost = st.chalkTimer > 0 ? 1.28 : 1.0
    const overdriveBoost = st.overdriveActive ? 1.65 : 1.0
    const staminaFactor = st.stamina < 20 ? 0.62 : 1.0

    const impulse =
      st.tier.pumpImpulse *
      st.modeConfig.driveMultiplier *
      chalkBoost *
      overdriveBoost *
      staminaFactor

    // Drain stamina slightly unless in overdrive
    if (!st.overdriveActive) {
      const cost = st.tier.staminaCost * (st.chalkTimer > 0 ? 0.65 : 1.0) * 0.45
      st.stamina = Math.max(5, st.stamina - cost)
      setStamina(Math.round(st.stamina))
    }

    st.phase = 'LIFTING'
    setPhase('LIFTING')
    const nextHeight = Math.min(1, st.height + impulse)
    st.height = nextHeight
    st.velocity = Math.max(st.velocity, 0.45)

    playGymTone('pump', st.soundEnabled)

    if (nextHeight >= 0.91) {
      st.height = 1
      st.velocity = 0
      st.phase = 'LOCKOUT'
      st.lockoutTimer = 0.42
      setPhase('LOCKOUT')
      setLiftHeight(1)
      completeRep(st.tier.weightLbs, st.tier.xpReward)
    } else {
      setLiftHeight(nextHeight)
      setStatusMessage(
        `Driving ${st.tier.weightLbs} lbs ${st.modeConfig.shortName}... (${Math.round(nextHeight * 100)}%)`
      )
    }
  }, [completeRep, enabled])

  const handleActivateChalk = () => {
    const st = stateRef.current
    st.chalkTimer = 8.0
    st.stamina = Math.min(100, st.stamina + 35)
    setChalkRemaining(8)
    setStamina(Math.round(st.stamina))
    setStatusMessage('CHALKED UP! +28% Grip Drive & +35% Stamina restored!')
    spawnPopup('CHALKED UP! +GRIP', '#38bdf8', '8s Boost Active')
    playGymTone('buff', st.soundEnabled)
  }

  const handleActivateOverdrive = () => {
    const st = stateRef.current
    if (st.overdriveCharge < 100 && !st.overdriveActive) {
      // Act as Spotter Boost if not at 100% yet: give instant stamina & upward bump
      st.stamina = 100
      setStamina(100)
      if (st.phase !== 'LOCKOUT' && st.height > 0 && st.height < 0.9) {
        st.height = Math.min(0.9, st.height + 0.25)
        setLiftHeight(st.height)
      }
      spawnPopup('SPOTTER ASSIST!', '#a855f7', 'Stamina 100%')
      setStatusMessage('Spotter hyped you up! Stamina refilled to 100%!')
      playGymTone('buff', st.soundEnabled)
      return
    }
    st.overdriveActive = true
    st.overdriveTimer = 7.0
    st.overdriveCharge = 0
    st.stamina = 100
    setOverdriveActive(true)
    setOverdriveCharge(0)
    setStamina(100)
    spawnPopup('REACTOR OVERDRIVE!', '#f59e0b', '2× Speed & Auto-Crit!')
    setStatusMessage('REACTOR OVERDRIVE ENGAGED! Unlimited Stamina + Auto 2× CRIT for 7s!')
    playGymTone('crit', st.soundEnabled)
  }

  const handleToggleAmrap = () => {
    const st = stateRef.current
    if (st.amrapActive) {
      st.amrapActive = false
      st.amrapTimer = 0
      setAmrapActive(false)
      setAmrapSecondsLeft(0)
      setStatusMessage(`AMRAP ended at ${amrapReps} reps!`)
      return
    }
    st.amrapActive = true
    st.amrapTimer = 30.0
    st.stamina = 100
    setAmrapActive(true)
    setAmrapSecondsLeft(30)
    setAmrapReps(0)
    setStamina(100)
    spawnPopup('30s AMRAP START!', '#fb7185', 'Max reps in 30s!')
    setStatusMessage('30s AMRAP BLITZ! Hit as many lockouts as possible!')
    playGymTone('buff', st.soundEnabled)
  }

  useEffect(() => {
    if (!enabled) return

    let rafId = 0
    let lastTime = performance.now()

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      const st = stateRef.current

      // Oscillate sweet-spot timing pulse
      st.pulsePhase += dt * 2.5
      st.pulseValue = (Math.sin(st.pulsePhase) + 1) * 0.5
      setPulsePos(st.pulseValue)

      // Update Chalk timer
      if (st.chalkTimer > 0) {
        const prevCeil = Math.ceil(st.chalkTimer)
        st.chalkTimer = Math.max(0, st.chalkTimer - dt)
        const nextCeil = Math.ceil(st.chalkTimer)
        if (nextCeil !== prevCeil) setChalkRemaining(nextCeil)
      }

      // Update Overdrive timer
      if (st.overdriveActive) {
        st.overdriveTimer = Math.max(0, st.overdriveTimer - dt)
        if (st.overdriveTimer <= 0) {
          st.overdriveActive = false
          setOverdriveActive(false)
        }
      }

      // Update AMRAP timer
      if (st.amrapActive) {
        const prevSec = Math.ceil(st.amrapTimer)
        st.amrapTimer = Math.max(0, st.amrapTimer - dt)
        const nextSec = Math.ceil(st.amrapTimer)
        if (nextSec !== prevSec) setAmrapSecondsLeft(nextSec)
        if (st.amrapTimer <= 0) {
          st.amrapActive = false
          setAmrapActive(false)
          setStatusMessage('AMRAP TIME UP! Great set on the platform!')
        }
      }

      // Regenerate stamina when not holding
      if (!st.holding && st.stamina < 100) {
        st.stamina = Math.min(100, st.stamina + 22 * dt)
        setStamina(Math.round(st.stamina))
      }

      if (st.phase === 'LOCKOUT') {
        st.lockoutTimer -= dt
        if (st.lockoutTimer <= 0) {
          st.phase = 'IDLE'
          st.height = 0
          st.velocity = 0
          setPhase('IDLE')
          setLiftHeight(0)
        }
      } else if (st.holding || st.height > 0) {
        if (st.holding) {
          st.phase = 'LIFTING'
          const chalkBoost = st.chalkTimer > 0 ? 1.25 : 1.0
          const overdriveBoost = st.overdriveActive ? 1.65 : 1.0
          const staminaFactor = st.stamina < 15 ? 0.55 : 1.0
          const drive =
            st.tier.holdDrive *
            st.modeConfig.driveMultiplier *
            chalkBoost *
            overdriveBoost *
            staminaFactor

          if (!st.overdriveActive) {
            st.stamina = Math.max(5, st.stamina - st.tier.staminaCost * 0.7 * dt)
            setStamina(Math.round(st.stamina))
          }

          st.height = Math.min(1, st.height + drive * dt)
          if (st.height >= 0.91) {
            st.height = 1
            st.velocity = 0
            st.phase = 'LOCKOUT'
            st.lockoutTimer = 0.42
            setPhase('LOCKOUT')
            setLiftHeight(1)
            completeRep(st.tier.weightLbs, st.tier.xpReward)
          } else {
            setPhase('LIFTING')
            setLiftHeight(st.height)
          }
        } else {
          // Gravity pulls bar back down if not locked out
          const grav = st.tier.gravity * st.modeConfig.gravityMultiplier
          st.height = Math.max(0, st.height - grav * dt)
          setLiftHeight(st.height)
          if (st.height === 0 && st.phase === 'LIFTING') {
            st.phase = 'IDLE'
            setPhase('IDLE')
            setStreak(0)
            setStatusMessage('Barbell racked. Tap LIFT to press again!')
          }
        }
      }

      rafId = window.requestAnimationFrame(step)
    }

    rafId = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(rafId)
  }, [completeRep, enabled])

  const handleReset = () => {
    stateRef.current.height = 0
    stateRef.current.velocity = 0
    stateRef.current.phase = 'IDLE'
    stateRef.current.stamina = 100
    setLiftHeight(0)
    setPhase('IDLE')
    setRepCount(0)
    setTotalVolume(0)
    setStreak(0)
    setStamina(100)
    setStatusMessage('Session telemetry zeroed. Ready to lift!')
  }

  // Compute 2D SVG geometry based on LiftMode & liftHeight (0..1)
  const startY = liftMode === 'deadlift' ? 196 : liftMode === 'ohp' ? 156 : 178
  const endY = liftMode === 'deadlift' ? 116 : liftMode === 'ohp' ? 58 : 72
  const barY = startY - liftHeight * (startY - endY)

  // Add subtle grinder tremor when lifting heavy at mid-range
  const isGrinding = phase === 'LIFTING' && liftHeight > 0.35 && (tierIndex >= 3 || stamina < 35)
  const tremorX = isGrinding ? Math.sin(liftHeight * 45) * 2.2 : 0

  const strainBend =
    phase === 'LOCKOUT'
      ? 3 + tier.platesPerSide * 1.4
      : liftHeight > 0.08
        ? (2 + tier.platesPerSide * 1.8) * Math.sin(liftHeight * Math.PI)
        : 1

  const gripLeftX = (liftMode === 'deadlift' ? 142 : 118) + tremorX
  const gripRightX = (liftMode === 'deadlift' ? 218 : 242) + tremorX
  const shoulderLeftX = 152 + tremorX * 0.5
  const shoulderRightX = 208 + tremorX * 0.5
  const shoulderY =
    liftMode === 'deadlift'
      ? 148 - liftHeight * 24
      : liftMode === 'ohp'
        ? 148
        : 188

  const headY =
    liftMode === 'deadlift'
      ? 122 - liftHeight * 24
      : liftMode === 'ohp'
        ? 120 - liftHeight * 3
        : 165 - liftHeight * 4

  const elbowFlare = (1 - liftHeight) * (liftMode === 'deadlift' ? 10 : 26) + 6
  const elbowY = (barY + shoulderY) * 0.5 + (1 - liftHeight) * (liftMode === 'deadlift' ? 6 : 18)
  const elbowLeftX = gripLeftX - elbowFlare * 0.4
  const elbowRightX = gripRightX + elbowFlare * 0.4

  const pct = Math.round(liftHeight * 100)
  const isSweetSpotNow = overdriveActive || (pulsePos >= 0.36 && pulsePos <= 0.64)

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
            Enable the interactive 2D barbell mini-game to switch between Bench, OHP, and Deadlift, hit Sweet-Spot 2× Crits, and level up your Periodic Lifter Rank.
          </p>
          <div className="miniGameSavedStats">
            <span>
              Lv.{rankInfo.current.level} [{rankInfo.current.symbol}] {rankInfo.current.title}
            </span>
            {savedStats.bestWeightLbs > 0 ? (
              <>
                <span>•</span>
                <span>PR: {savedStats.bestWeightLbs} lbs</span>
              </>
            ) : null}
          </div>
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
      <div className={`miniGameCard ${overdriveActive ? 'miniGameCard--overdrive' : ''}`}>
        {/* Top Bar with Rank Badge, Sound Toggle, and Enable/Disable Button */}
        <div className="miniGameHeader">
          <div className="miniGameTitleGroup">
            <span className="miniGameEyebrow">
              <span className="miniGameDot" aria-hidden="true" />
              2D POWER LAB • #{modeConfig.atomicNum} {modeConfig.symbol}
            </span>
            <div className="miniGameTitleRow">
              <span className="miniGameTitle">Iron Press Mini-Game</span>
              <span
                className="miniGameRankPill"
                style={{ '--rank-color': rankInfo.current.color } as React.CSSProperties}
                title={
                  rankInfo.next
                    ? `${savedStats.xp} / ${rankInfo.next.minXp} XP to ${rankInfo.next.title}`
                    : `${savedStats.xp} XP • Max Rank`
                }
              >
                Lv.{rankInfo.current.level} {rankInfo.current.symbol}
              </span>
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

        {/* Exercise Mode Selector + AMRAP Challenge Trigger */}
        <div className="miniGameModeBar">
          <div className="miniGameModeTabs" role="tablist" aria-label="Select lift movement">
            {LIFT_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={liftMode === m.id}
                className={`miniGameModeTab ${liftMode === m.id ? 'is-active' : ''}`}
                onClick={() => {
                  setLiftMode(m.id)
                  stateRef.current.height = 0
                  setLiftHeight(0)
                  setPhase('IDLE')
                  setStatusMessage(`Switched to ${m.fullName}. Tap LIFT to drive!`)
                }}
              >
                <span className="miniGameModeSym">{m.symbol}</span>
                <span>{m.shortName}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`miniGameAmrapBtn ${amrapActive ? 'is-active' : ''}`}
            onClick={handleToggleAmrap}
            title="30-Second As Many Reps As Possible Blitz"
          >
            {amrapActive ? `⏱ ${amrapSecondsLeft}s (${amrapReps})` : '⚡ 30s Blitz'}
          </button>
        </div>

        {/* Live Telemetry Readout */}
        <div className="miniGameHud" aria-label="Mini-game stats">
          <div className="miniGameStat">
            <span className="miniGameStatLabel">Reps</span>
            <span className="miniGameStatValue">{repCount}</span>
          </div>
          <div className="miniGameStat">
            <span className="miniGameStatLabel">Bar Load</span>
            <span className="miniGameStatValue">
              {tier.weightLbs}
              <small> lbs</small>
            </span>
          </div>
          <div className="miniGameStat">
            <span className="miniGameStatLabel">Streak</span>
            <span className="miniGameStatValue">{streak}×</span>
          </div>
          <div className="miniGameStat">
            <span className="miniGameStatLabel">Best PR</span>
            <span className="miniGameStatValue">
              {Math.max(savedStats.bestWeightLbs, repCount > 0 ? tier.weightLbs : 0)}
              <small> lbs</small>
            </span>
          </div>
        </div>

        {/* Interactive 2D SVG Weightlifting Stage */}
        <div
          className={`miniGameStage ${phase === 'LOCKOUT' ? 'is-lockout' : ''} ${overdriveActive ? 'is-overdrive' : ''} ${isHolding ? 'is-holding' : ''}`}
          role="button"
          tabIndex={0}
          aria-label={`Lift ${tier.weightLbs} pound barbell (${modeConfig.fullName}). Current height ${pct} percent.`}
          onClick={triggerPump}
          onPointerDown={() => {
            stateRef.current.holding = true
            setIsHolding(true)
          }}
          onPointerUp={() => {
            stateRef.current.holding = false
            setIsHolding(false)
          }}
          onPointerLeave={() => {
            stateRef.current.holding = false
            setIsHolding(false)
          }}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault()
              triggerPump()
            }
          }}
        >
          {/* Floating Popups Overlay */}
          <div className="miniGamePopups" aria-hidden="true">
            {popups.map((p) => (
              <div
                key={p.id}
                className="miniGamePopupItem"
                style={{ left: `${(p.x / 380) * 100}%`, '--popup-color': p.color } as React.CSSProperties}
              >
                <strong>{p.text}</strong>
                {p.subtext ? <span>{p.subtext}</span> : null}
              </div>
            ))}
          </div>

          <svg viewBox="0 0 380 232" className="miniGameSvg" aria-hidden="true">
            <defs>
              <linearGradient id="rackPostGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={theme === 'light' ? '#64748b' : '#334155'} />
                <stop offset="50%" stopColor={theme === 'light' ? '#94a3b8' : '#64748b'} />
                <stop offset="100%" stopColor={theme === 'light' ? '#475569' : '#1e293b'} />
              </linearGradient>
              <linearGradient id="lockoutZoneGrad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={overdriveActive ? 'rgba(245, 158, 11, 0.36)' : 'rgba(13, 148, 136, 0.24)'}
                />
                <stop offset="100%" stopColor="rgba(13, 148, 136, 0.04)" />
              </linearGradient>
              <linearGradient id="barSteelGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={overdriveActive ? '#fef08a' : theme === 'light' ? '#64748b' : '#f8fafc'} />
                <stop offset="50%" stopColor={overdriveActive ? '#f59e0b' : theme === 'light' ? '#334155' : '#94a3b8'} />
                <stop offset="100%" stopColor={theme === 'light' ? '#0f172a' : '#475569'} />
              </linearGradient>
            </defs>

            {/* Target Lockout Zone Banner */}
            <rect
              x="28"
              y={endY - 16}
              width="290"
              height="30"
              rx="6"
              fill="url(#lockoutZoneGrad)"
              stroke={overdriveActive ? 'rgba(245, 158, 11, 0.75)' : theme === 'light' ? 'rgba(5, 150, 105, 0.55)' : 'rgba(45, 212, 191, 0.45)'}
              strokeDasharray="4 4"
            />
            <text
              x="173"
              y={endY + 2}
              textAnchor="middle"
              fill={overdriveActive ? (theme === 'light' ? '#d97706' : '#fbbf24') : theme === 'light' ? '#059669' : 'rgba(45, 212, 191, 0.9)'}
              fontSize="8.5"
              fontWeight="800"
              letterSpacing="1.6"
            >
              {overdriveActive ? '⚡ REACTOR OVERDRIVE LOCKOUT ⚡' : '▲ LOCKOUT ZONE ▲'}
            </text>

            {/* Power Rack Uprights */}
            <rect x="78" y="28" width="10" height="184" rx="3" fill="url(#rackPostGrad)" />
            <rect x="272" y="28" width="10" height="184" rx="3" fill="url(#rackPostGrad)" />

            {/* Rack J-Hooks (for Bench & OHP) */}
            {liftMode !== 'deadlift' && (
              <>
                <path
                  d={`M 88 ${startY - 2} L 98 ${startY - 2} L 98 ${startY - 10}`}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <path
                  d={`M 272 ${startY - 2} L 262 ${startY - 2} L 262 ${startY - 10}`}
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
              y1="212"
              x2="326"
              y2="212"
              stroke={phase === 'LOCKOUT' ? '#2dd4bf' : 'rgba(148, 163, 184, 0.45)'}
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Lifter Lower Body / Bench depending on LiftMode */}
            {liftMode === 'bench' ? (
              <rect
                x="144"
                y="186"
                width="72"
                height="24"
                rx="8"
                fill="#1e293b"
                stroke="#475569"
                strokeWidth="1.5"
              />
            ) : (
              /* Standing Legs for OHP & Deadlift */
              <g stroke="#475569" strokeWidth="7" strokeLinecap="round">
                <line x1="164" y1="176" x2="154" y2="210" />
                <line x1="196" y1="176" x2="206" y2="210" />
              </g>
            )}

            {/* Overdrive / Chalk Aura */}
            {(overdriveActive || chalkRemaining > 0) && (
              <ellipse
                cx="180"
                cy="165"
                rx="64"
                ry="44"
                fill="none"
                stroke={overdriveActive ? 'rgba(245, 158, 11, 0.4)' : 'rgba(56, 189, 248, 0.3)'}
                strokeWidth="2"
                strokeDasharray="6 4"
              />
            )}

            {/* Lifter Torso */}
            <path
              d={`M ${shoulderLeftX} ${shoulderY} Q 180 ${shoulderY - 10} ${shoulderRightX} ${shoulderY} L 200 ${liftMode === 'bench' ? 208 : 180} L 160 ${liftMode === 'bench' ? 208 : 180} Z`}
              fill="#1e293b"
              stroke={overdriveActive ? '#f59e0b' : '#334155'}
              strokeWidth="2"
            />

            {/* Lifter Head & Expression */}
            <circle
              cx={180 + tremorX * 0.5}
              cy={headY}
              r="13.5"
              fill="#0f172a"
              stroke={
                overdriveActive
                  ? '#f59e0b'
                  : phase === 'LOCKOUT'
                    ? '#2dd4bf'
                    : '#38bdf8'
              }
              strokeWidth="2.5"
            />
            {/* Eyes */}
            <circle cx={175 + tremorX * 0.5} cy={headY - 2} r="1.6" fill="#f8fafc" />
            <circle cx={185 + tremorX * 0.5} cy={headY - 2} r="1.6" fill="#f8fafc" />
            {/* Mouth (grin on lockout, grit when grinding) */}
            {phase === 'LOCKOUT' ? (
              <path
                d={`M ${175 + tremorX * 0.5} ${headY + 3} Q ${180 + tremorX * 0.5} ${headY + 8} ${185 + tremorX * 0.5} ${headY + 3}`}
                fill="none"
                stroke="#2dd4bf"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            ) : (
              <line
                x1={176 + tremorX * 0.5}
                y1={headY + 4}
                x2={184 + tremorX * 0.5}
                y2={headY + 4}
                stroke="#94a3b8"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            )}

            {/* Sweat Drops when grinding */}
            {isGrinding && (
              <g fill="#38bdf8" opacity="0.85">
                <circle cx={160 + tremorX} cy={headY - 6} r="2.2" />
                <circle cx={200 + tremorX} cy={headY - 4} r="1.8" />
              </g>
            )}

            {/* Lifter Arms (Upper & Forearms) */}
            <polyline
              points={`${shoulderLeftX},${shoulderY} ${elbowLeftX},${elbowY} ${gripLeftX},${barY}`}
              fill="none"
              stroke={
                overdriveActive
                  ? '#f59e0b'
                  : phase === 'LOCKOUT'
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
                overdriveActive
                  ? '#f59e0b'
                  : phase === 'LOCKOUT'
                    ? '#2dd4bf'
                    : '#38bdf8'
              }
              strokeWidth="7.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Lockout Burst Ring */}
            {phase === 'LOCKOUT' && (
              <ellipse
                cx="180"
                cy={barY}
                rx="130"
                ry="16"
                fill="none"
                stroke={lastRepCrit ? '#fbbf24' : '#2dd4bf'}
                strokeWidth="2.5"
                strokeDasharray="8 6"
              />
            )}

            {/* Olympic Barbell Shaft (with dynamic flex under load) */}
            <path
              d={`M 22 ${barY + strainBend} Q 180 ${barY - strainBend} 338 ${barY + strainBend}`}
              fill="none"
              stroke="url(#barSteelGrad)"
              strokeWidth="5.5"
              strokeLinecap="round"
            />

            {/* Grip Hands (with Chalk glow when active) */}
            <circle
              cx={gripLeftX}
              cy={barY}
              r="5.5"
              fill={chalkRemaining > 0 ? '#e0f2fe' : '#f8fafc'}
              stroke={chalkRemaining > 0 ? '#38bdf8' : '#0f172a'}
              strokeWidth="2"
            />
            <circle
              cx={gripRightX}
              cy={barY}
              r="5.5"
              fill={chalkRemaining > 0 ? '#e0f2fe' : '#f8fafc'}
              stroke={chalkRemaining > 0 ? '#38bdf8' : '#0f172a'}
              strokeWidth="2"
            />

            {/* Left & Right Bumper Plates */}
            {Array.from({ length: tier.platesPerSide }).map((_, idx) => {
              const color = tier.plateColors[idx] ?? '#2dd4bf'
              const offset = idx * 9
              const plateH = 54 - idx * 2.5
              const leftX = 64 - offset + tremorX * 0.4
              const rightX = 288 + offset + tremorX * 0.4
              const plateY = barY + strainBend * 0.65 - plateH / 2
              return (
                <g key={idx}>
                  <rect
                    x={leftX}
                    y={plateY}
                    width="7.5"
                    height={plateH}
                    rx="3"
                    fill={color}
                    stroke="#0f172a"
                    strokeWidth="1.1"
                  />
                  <rect
                    x={rightX}
                    y={plateY}
                    width="7.5"
                    height={plateH}
                    rx="3"
                    fill={color}
                    stroke="#0f172a"
                    strokeWidth="1.1"
                  />
                </g>
              )
            })}

            {/* Right-side Vertical Power Gauge */}
            <g transform="translate(342, 34)">
              <rect
                x="0"
                y="0"
                width="16"
                height="174"
                rx="8"
                fill={theme === 'light' ? 'rgba(15, 23, 42, 0.10)' : 'rgba(15, 23, 42, 0.78)'}
                stroke={theme === 'light' ? 'rgba(15, 23, 42, 0.22)' : 'rgba(148, 163, 184, 0.3)'}
              />
              <rect x="2" y="2" width="12" height="24" rx="6" fill="rgba(16, 185, 129, 0.25)" />
              <rect
                x="3"
                y={171 - Math.max(6, liftHeight * 168)}
                width="10"
                height={Math.max(6, liftHeight * 168)}
                rx="5"
                fill={
                  overdriveActive
                    ? '#f59e0b'
                    : phase === 'LOCKOUT'
                      ? theme === 'light'
                        ? '#059669'
                        : '#2dd4bf'
                      : theme === 'light'
                        ? '#0284c7'
                        : '#38bdf8'
                }
              />
            </g>
          </svg>

          {/* Sweet-Spot Timing Bar & Stamina Strip inside stage footer */}
          <div className="miniGameMetersRow" aria-hidden="true">
            <div className="miniGameMeterCol">
              <div className="miniGameMeterHeader">
                <span>Stamina</span>
                <span>{stamina}%</span>
              </div>
              <div className="miniGameMeterTrack">
                <div
                  className={`miniGameMeterFill ${stamina < 25 ? 'is-low' : ''}`}
                  style={{ width: `${stamina}%` }}
                />
              </div>
            </div>

            <div className="miniGameMeterCol">
              <div className="miniGameMeterHeader">
                <span>Crit Pulse (2× XP)</span>
                <span className={isSweetSpotNow ? 'miniGameSweetText' : ''}>
                  {isSweetSpotNow ? 'SWEET SPOT!' : 'SYNC'}
                </span>
              </div>
              <div className="miniGamePulseTrack">
                <div className="miniGamePulseZone" />
                <div
                  className={`miniGamePulseCursor ${isSweetSpotNow ? 'is-sweet' : ''}`}
                  style={{ left: `${pulsePos * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="miniGameStageFooter">
            <span className={`miniGameStatusText ${phase === 'LOCKOUT' ? 'is-lockout' : ''}`}>
              {statusMessage}
            </span>
            <span className="miniGamePctBadge">{pct}%</span>
          </div>
        </div>

        {/* Power-Ups & Weight Controls */}
        <div className="miniGameControls">
          {/* Gym Buffs / Power-Up Row */}
          <div className="miniGameBuffRow">
            <button
              type="button"
              className={`miniGameBuffBtn ${chalkRemaining > 0 ? 'is-active' : ''}`}
              onClick={handleActivateChalk}
              title="Apply lifting chalk for +28% Grip Drive and +35% Stamina"
            >
              <span>✋ Chalk Up</span>
              <small>{chalkRemaining > 0 ? `${chalkRemaining}s active` : '+28% Grip'}</small>
            </button>

            <button
              type="button"
              className={`miniGameBuffBtn miniGameBuffBtn--overdrive ${overdriveActive ? 'is-active' : ''} ${overdriveCharge >= 100 ? 'is-ready' : ''}`}
              onClick={handleActivateOverdrive}
              title={
                overdriveCharge >= 100
                  ? 'Trigger Reactor Overdrive (2× speed & auto-crit)'
                  : 'Call Spotter for instant 100% Stamina boost'
              }
            >
              <span>{overdriveActive ? '⚡ Overdrive!' : overdriveCharge >= 100 ? '⚡ Overdrive Ready!' : '🤝 Spotter Boost'}</span>
              <small>{overdriveActive ? '2× CRIT ON' : `${overdriveCharge}% Charged`}</small>
            </button>
          </div>

          <div className="miniGameWeightPicker" role="group" aria-label="Barbell plate load">
            <button
              type="button"
              className="miniGamePlateBtn"
              onClick={() => {
                setTierIndex((i) => Math.max(0, i - 1))
                playGymTone('plate', soundEnabled)
              }}
              disabled={tierIndex === 0}
              aria-label="Decrease barbell weight"
            >
              − Plate
            </button>
            <div className="miniGameWeightLabel">
              <strong>{tier.weightLbs} lbs</strong>
              <span>{tier.label}</span>
            </div>
            <button
              type="button"
              className="miniGamePlateBtn"
              onClick={() => {
                setTierIndex((i) => Math.min(WEIGHT_TIERS.length - 1, i + 1))
                playGymTone('plate', soundEnabled)
              }}
              disabled={tierIndex === WEIGHT_TIERS.length - 1}
              aria-label="Increase barbell weight"
            >
              + Plate
            </button>
          </div>

          <div className="miniGameActionRow">
            <button
              type="button"
              className={`button primary miniGameLiftBtn ${overdriveActive ? 'is-overdrive' : ''}`}
              onPointerDown={() => {
                stateRef.current.holding = true
                setIsHolding(true)
              }}
              onPointerUp={() => {
                stateRef.current.holding = false
                setIsHolding(false)
              }}
              onPointerLeave={() => {
                stateRef.current.holding = false
                setIsHolding(false)
              }}
              onClick={triggerPump}
            >
              ▲ LIFT {modeConfig.shortName.toUpperCase()} ({tier.weightLbs} LBS)
            </button>
            <button
              type="button"
              className="button secondary miniGameResetBtn"
              onClick={handleReset}
              aria-label="Reset mini-game stats"
              title={`Total session volume: ${numberFormatter.format(totalVolume)} lbs`}
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
