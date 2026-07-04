import React, { useState, useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

class GameAudio {
  private ctx: AudioContext | null = null
  private pumpOsc: OscillatorNode | null = null
  private pumpGain: GainNode | null = null

  init() {
    if (this.ctx) return
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (AudioContextClass) {
      this.ctx = new AudioContextClass()
    }
  }

  playJump() {
    if (!this.ctx) return
    this.ctx.resume().catch(() => {})
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.connect(gain)
    gain.connect(this.ctx.destination)

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(130, this.ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.12)

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.12)

    osc.start()
    osc.stop(this.ctx.currentTime + 0.12)
  }

  playBoost() {
    if (!this.ctx) return
    const ctx = this.ctx
    ctx.resume().catch(() => {})
    const now = ctx.currentTime
    const freqs = [261.63, 329.63, 392.00, 523.25] // C Major Chord
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.type = 'sine'
      osc.frequency.setValueAtTime(f, now)
      osc.frequency.exponentialRampToValueAtTime(f * 1.2, now + 0.25)

      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.04, now + idx * 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3 + idx * 0.03)

      osc.start(now + idx * 0.03)
      osc.stop(now + 0.35 + idx * 0.03)
    })
  }

  playLanded() {
    if (!this.ctx) return
    this.ctx.resume().catch(() => {})
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.connect(gain)
    gain.connect(this.ctx.destination)

    osc.type = 'sine'
    osc.frequency.setValueAtTime(90, this.ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.08)

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.08)

    osc.start()
    osc.stop(this.ctx.currentTime + 0.08)
  }

  startPump() {
    if (!this.ctx) return
    this.ctx.resume().catch(() => {})
    if (this.pumpOsc) return

    this.pumpOsc = this.ctx.createOscillator()
    this.pumpGain = this.ctx.createGain()
    
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(150, this.ctx.currentTime)

    this.pumpOsc.connect(filter)
    filter.connect(this.pumpGain)
    this.pumpGain.connect(this.ctx.destination)

    this.pumpOsc.type = 'sawtooth'
    this.pumpOsc.frequency.setValueAtTime(55, this.ctx.currentTime)

    this.pumpGain.gain.setValueAtTime(0, this.ctx.currentTime)
    this.pumpGain.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 0.04)

    this.pumpOsc.start()
  }

  updatePumpPitch(velocity: number) {
    if (!this.ctx || !this.pumpOsc) return
    const targetFreq = 50 + (velocity * 3.5)
    this.pumpOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1)
  }

  stopPump() {
    if (!this.ctx || !this.pumpOsc || !this.pumpGain) return
    const now = this.ctx.currentTime
    try {
      this.pumpGain.gain.setValueAtTime(this.pumpGain.gain.value, now)
      this.pumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
      const osc = this.pumpOsc
      setTimeout(() => {
        try { osc.stop() } catch (err) {}
      }, 80)
    } catch (e) {}
    this.pumpOsc = null
    this.pumpGain = null
  }
}

const audio = new GameAudio()

// Procedural 3D spiral curve mapping for track geometry and loops
const getTerrainPos = (x: number): THREE.Vector3 => {
  const pos = new THREE.Vector3(x, 0, 0)
  if (x < 15) {
    pos.y = 0
    return pos
  }
  
  // Calculate base landscape wave height
  const yBase = Math.sin(x * 0.12) * 1.8 + Math.cos(x * 0.05) * 0.8
  pos.y = yBase

  // Corkscrew spiral loops every 350m starting at x = 300
  const loopInterval = 350
  const xLocal = (x - 150) % loopInterval
  const loopCenter = 150 // Centered in loop interval
  const loopHalfWidth = 16

  if (x > 200 && Math.abs(xLocal - loopCenter) < loopHalfWidth) {
    const t = (xLocal - (loopCenter - loopHalfWidth)) / (loopHalfWidth * 2)
    const R = 3.6
    const theta = -Math.PI / 2 + t * Math.PI * 2
    
    pos.y = yBase + (Math.sin(theta) + 1) * R
    pos.z = Math.cos(theta) * R
  }

  return pos
}

const getTerrainHeight = (x: number) => {
  return getTerrainPos(x).y
}

// Terrain slope derivative
const getTerrainSlope = (x: number) => {
  const epsilon = 0.05
  const h1 = getTerrainHeight(x - epsilon)
  const h2 = getTerrainHeight(x + epsilon)
  return (h2 - h1) / (2 * epsilon)
}

const BOOST_PADS = [80, 220, 430, 580, 780, 930, 1150, 1320, 1500]
const HOOPS = [140, 250, 390, 510, 720, 890, 1080, 1260, 1420]


const NEON_CYAN = '#06b6d4'

// Procedural Synthwave Monorail Track
const HillyTrack = ({ playerX }: { playerX: number }) => {
  const startSegment = Math.floor((playerX - 160) / 4.0)
  const endSegment = Math.floor((playerX + 180) / 4.0)
  const segments = []

  for (let i = startSegment; i < endSegment; i++) {
    const x1 = i * 4.0
    const x2 = (i + 1) * 4.0
    const pos1 = getTerrainPos(x1)
    const pos2 = getTerrainPos(x2)
    
    const mid = new THREE.Vector3().addVectors(pos1, pos2).multiplyScalar(0.5)
    const dir = new THREE.Vector3().subVectors(pos2, pos1)
    const length = dir.length()
    
    const rot = new THREE.Quaternion()
    if (length > 0.001) {
      const dirNorm = dir.clone().normalize()
      rot.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dirNorm)
    }

    segments.push({ id: i, pos1, pos2, mid, length, rot })
  }

  return (
    <group>
      {/* Grouped Coaster Rails, ties, and inline Boost Pads */}
      {segments.map((seg) => {
        const isBoostPad = BOOST_PADS.some((padX) => Math.abs(seg.mid.x - padX) < 2.0)
        return (
          <group key={`track-${seg.id}`} position={seg.mid} quaternion={seg.rot}>
            {/* Left Rail */}
            <mesh position={[0, -0.05, 0.28]}>
              <boxGeometry args={[seg.length, 0.06, 0.06]} />
              <meshBasicMaterial color={isBoostPad ? '#10b981' : NEON_CYAN} />
            </mesh>

            {/* Right Rail */}
            <mesh position={[0, -0.05, -0.28]}>
              <boxGeometry args={[seg.length, 0.06, 0.06]} />
              <meshBasicMaterial color={isBoostPad ? '#10b981' : NEON_CYAN} />
            </mesh>

            {/* Crossbar Tie 1 */}
            <mesh position={[-1.0, -0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.018, 0.018, 0.56, 6]} />
              <meshStandardMaterial color={isBoostPad ? '#059669' : '#475569'} metalness={0.5} roughness={0.5} />
            </mesh>

            {/* Crossbar Tie 2 */}
            <mesh position={[1.0, -0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.018, 0.018, 0.56, 6]} />
              <meshStandardMaterial color={isBoostPad ? '#059669' : '#475569'} metalness={0.5} roughness={0.5} />
            </mesh>

            {/* Inline Glow Boost Strip */}
            {isBoostPad && (
              <mesh position={[0, -0.07, 0]}>
                <boxGeometry args={[seg.length, 0.02, 0.48]} />
                <meshBasicMaterial color="#34d399" />
              </mesh>
            )}
          </group>
        )
      })}

      {/* Mid-Air Gravity Portal Hoops */}
      {HOOPS.map((hoopX) => {
        if (hoopX < playerX - 160 || hoopX > playerX + 180) return null
        const hoopPos = getTerrainPos(hoopX)
        return (
          <group key={`hoop-${hoopX}`} position={[hoopPos.x, hoopPos.y + 3.2, hoopPos.z]}>
            {/* Ring */}
            <mesh rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[1.5, 0.1, 4, 12]} />
              <meshStandardMaterial color="#c084fc" emissive="#a855f7" emissiveIntensity={1.2} />
            </mesh>
            {/* Inner Portal Field */}
            <mesh rotation={[0, Math.PI / 2, 0]}>
              <ringGeometry args={[0, 1.35, 12]} />
              <meshBasicMaterial color="#d8b4fe" transparent opacity={0.12} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )
      })}

      {/* Checkpoint milestone arches every 200m */}
      {(() => {
        const gates = []
        const nearPlayerStart = Math.floor((playerX - 60) / 200) * 200
        const nearPlayerEnd = Math.floor((playerX + 80) / 200) * 200
        for (let g = Math.max(200, nearPlayerStart); g <= nearPlayerEnd; g += 200) {
          gates.push(g)
        }
        return gates.map((gateX) => {
          const gatePos = getTerrainPos(gateX)
          return (
            <group key={`gate-${gateX}`} position={[gatePos.x, gatePos.y, gatePos.z]}>
              {/* Left pillar */}
              <mesh position={[0, 1.2, -1.0]}>
                <cylinderGeometry args={[0.08, 0.08, 2.4, 16]} />
                <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.5} />
              </mesh>
              {/* Right pillar */}
              <mesh position={[0, 1.2, 1.0]}>
                <cylinderGeometry args={[0.08, 0.08, 2.4, 16]} />
                <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.5} />
              </mesh>
              {/* Cross arch bar */}
              <mesh position={[0, 2.4, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.08, 0.08, 2.0, 16]} />
                <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.5} />
              </mesh>
              {/* Flashing warning spheres */}
              <mesh position={[0, 2.7, -0.5]}>
                <sphereGeometry args={[0.15, 16, 16]} />
                <meshBasicMaterial color="#ef4444" />
              </mesh>
              <mesh position={[0, 2.7, 0.5]}>
                <sphereGeometry args={[0.15, 16, 16]} />
                <meshBasicMaterial color="#ef4444" />
              </mesh>
            </group>
          )
        })
      })()}
    </group>
  )
}


const BackgroundStars = () => {
  const stars = useRef<{ x: number; y: number; size: number }[]>([])
  if (stars.current.length === 0) {
    for (let i = 0; i < 40; i++) {
      stars.current.push({
        x: (Math.random() - 0.5) * 80,
        y: Math.random() * 8 + 1,
        size: 0.03 + Math.random() * 0.04
      })
    }
  }

  const groupRef = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.x = state.camera.position.x * 0.82
      groupRef.current.position.y = state.camera.position.y * 0.82
    }
  })

  return (
    <group ref={groupRef}>
      {stars.current.map((star, idx) => (
        <mesh key={idx} position={[star.x, star.y, -6]}>
          <sphereGeometry args={[star.size, 8, 8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.65} />
        </mesh>
      ))}
    </group>
  )
}

interface GameEngineProps {
  isPlaying: boolean
  isGameOver: boolean
  onUpdateStats: (data: { score: number; distance: number; combo: number; velocity: number; timeLeft: number }) => void
  onFeedback: (text: string, color: string) => void
  onGameOver: (finalScore: number) => void
}

// High-Performance R3F Native Game Engine
const GameEngine = ({
  isPlaying,
  isGameOver,
  onUpdateStats,
  onFeedback,
  onGameOver
}: GameEngineProps) => {
  const sphereRef = useRef<THREE.Group>(null)
  const rollMeshRef = useRef<THREE.Group>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const shakeRef = useRef(0.0)

  // Local track positioning state (safe to re-render GameEngine only)
  const [trackPlayerX, setTrackPlayerX] = useState(0)

  // Physics local refs to avoid rendering overhead
  const xRef = useRef(0.0)
  const yRef = useRef(0.0)
  const vxRef = useRef(5.0)
  const vyRef = useRef(0.0)
  const angleRef = useRef(0.0)
  const keysRef = useRef({ Space: false })
  const isPlayingRef = useRef(isPlaying)
  const isGameOverRef = useRef(isGameOver)
  const scoreRef = useRef(0)
  const comboRef = useRef(1)
  const timeLeftRef = useRef(45)
  const hitBoostsRef = useRef(new Set<number>())
  const hitHoopsRef = useRef(new Set<number>())

  // Sync refs to frame loop
  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  useEffect(() => {
    isGameOverRef.current = isGameOver
  }, [isGameOver])

  // Single source input binding
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        if (!keysRef.current.Space) {
          keysRef.current.Space = true
          audio.startPump()
        }
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        keysRef.current.Space = false
        audio.stopPump()
      }
    }

    const handleStart = (_e: TouchEvent | MouseEvent) => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    }
    const handleEnd = () => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    const canvasContainer = document.getElementById('game-canvas-container')
    if (canvasContainer) {
      canvasContainer.addEventListener('mousedown', handleStart)
      canvasContainer.addEventListener('mouseup', handleEnd)
      canvasContainer.addEventListener('mouseleave', handleEnd)
      canvasContainer.addEventListener('touchstart', handleStart, { passive: true })
      canvasContainer.addEventListener('touchend', handleEnd)
      canvasContainer.addEventListener('touchcancel', handleEnd)
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      if (canvasContainer) {
        canvasContainer.removeEventListener('mousedown', handleStart)
        canvasContainer.removeEventListener('mouseup', handleEnd)
        canvasContainer.removeEventListener('mouseleave', handleEnd)
        canvasContainer.removeEventListener('touchstart', handleStart)
        canvasContainer.removeEventListener('touchend', handleEnd)
        canvasContainer.removeEventListener('touchcancel', handleEnd)
      }
    }
  }, [])

  // Timer Tick (Updated locally)
  useEffect(() => {
    let timerId: number
    if (isPlaying && !isGameOver) {
      timerId = window.setInterval(() => {
        timeLeftRef.current -= 1
        if (timeLeftRef.current <= 0) {
          timeLeftRef.current = 0
          onGameOver(scoreRef.current)
          clearInterval(timerId)
        }
      }, 1000)
    }
    return () => clearInterval(timerId)
  }, [isPlaying, isGameOver, onGameOver])

  // 60FPS Physics tick loop
  useFrame((state, delta) => {
    if (!isPlayingRef.current || isGameOverRef.current) return

    const dt = Math.min(delta, 0.03) // Cap tick steps
    const currentX = xRef.current

    // Downhill vs Uphill evaluation
    const slope = getTerrainSlope(currentX)
    const slopeAngle = Math.atan(slope)
    const groundY = getTerrainHeight(currentX)
    const isOnGround = yRef.current <= groundY + 0.01

    if (isOnGround) {
      yRef.current = groundY
      vyRef.current = 0
      angleRef.current = slopeAngle

      // Gravity slide accelerations
      const gravityPull = -Math.sin(slopeAngle) * 9.8
      const friction = -vxRef.current * 0.05
      
      let pumpForce = 0.0
      // Pump Boost: Pressing space going downhills builds speed!
      if (keysRef.current.Space && slope < -0.04) {
        pumpForce = 8.5
      }

      const ax = gravityPull + friction + pumpForce
      vxRef.current = Math.max(vxRef.current + ax * dt, 1.5)
      xRef.current += vxRef.current * dt

      // Crest Jump boost trigger
      if (keysRef.current.Space && !pumpForce) {
        vyRef.current = 5.2
        yRef.current += 0.06
        audio.playJump()
      }
    } else {
      // Mid-Air physics
      vyRef.current -= 9.8 * dt
      if (keysRef.current.Space) {
        vyRef.current = -10.0 // Dive downward quickly
      }

      // Visual angle trajectory alignment in air
      angleRef.current = Math.atan2(vyRef.current, vxRef.current)

      xRef.current += vxRef.current * dt
      yRef.current += vyRef.current * dt

      // Land thud detection
      const newGroundY = getTerrainHeight(xRef.current)
      if (yRef.current <= newGroundY) {
        yRef.current = newGroundY
        vyRef.current = 0

        const landSlope = getTerrainSlope(xRef.current)
        const isDownhill = landSlope < -0.04
        const isPumping = keysRef.current.Space

        if (isDownhill && isPumping) {
          // Downhill boost landing
          vxRef.current = Math.min(vxRef.current * 1.32, 22.0)
          comboRef.current = Math.min(comboRef.current + 1, 10)
          shakeRef.current = 0.08
          
          timeLeftRef.current = Math.min(timeLeftRef.current + 3, 99)
          const pts = Math.floor(100 * comboRef.current * vxRef.current)
          scoreRef.current += pts

          audio.playBoost()
          onFeedback(`BOOST! ⚡ +${pts} (+3s)`, '#34d399')
        } else {
          // Normal safe landing (No speed loss crashes!)
          vxRef.current = Math.max(vxRef.current * 1.02, 5.0)
          shakeRef.current = 0.04
          
          timeLeftRef.current = Math.min(timeLeftRef.current + 1, 99)
          const pts = Math.floor(40 * vxRef.current)
          scoreRef.current += pts

          audio.playLanded()
          onFeedback(`LANDED! +${pts} (+1s)`, '#3b82f6')
        }
      }
    }

    // Update real-time oscillator pitch if pumping
    if (keysRef.current.Space) {
      audio.updatePumpPitch(vxRef.current)
    }

    // Interactive Collision: Speed Boost Pads
    BOOST_PADS.forEach((padX) => {
      if (!hitBoostsRef.current.has(padX) && Math.abs(xRef.current - padX) < 1.4) {
        hitBoostsRef.current.add(padX)
        vxRef.current = Math.max(vxRef.current + 6.5, 17.0)
        timeLeftRef.current = Math.min(timeLeftRef.current + 2, 99)
        shakeRef.current = 0.08
        audio.playBoost()
        onFeedback('BOOST PAD! ⚡ +Speed (+2s)', '#10b981')
      }
    })

    // Interactive Collision: Gravity Portal Hoops
    if (yRef.current > getTerrainHeight(xRef.current) + 0.1) {
      HOOPS.forEach((hoopX) => {
        if (!hitHoopsRef.current.has(hoopX)) {
          const hoopY = getTerrainHeight(hoopX) + 3.2
          const dx = xRef.current - hoopX
          const dy = yRef.current - hoopY
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 1.6) {
            hitHoopsRef.current.add(hoopX)
            scoreRef.current += 500
            timeLeftRef.current = Math.min(timeLeftRef.current + 4, 99)
            shakeRef.current = 0.12
            audio.playBoost()
            onFeedback('PORTAL JUMP! 🌀 +500 (+4s)', '#a855f7')
          }
        }
      })
    }

    // Accumulate distance points
    scoreRef.current += Math.floor(vxRef.current * 0.02)

    // Position mirroring sphere group directly
    if (sphereRef.current) {
      // Offset sphere pos.z if inside a loop to match the 3D track loop
      const trackPos = getTerrainPos(xRef.current)
      sphereRef.current.position.set(xRef.current, yRef.current + 0.68, trackPos.z)
      sphereRef.current.rotation.z = angleRef.current
    }
    if (rollMeshRef.current) {
      rollMeshRef.current.rotation.z = -xRef.current * 2.2
    }

    // Update point light position
    if (lightRef.current) {
      const trackPos = getTerrainPos(xRef.current)
      lightRef.current.position.set(xRef.current - 2, yRef.current + 3, trackPos.z + 2)
    }

    // Update Camera Follower directly (zoomed out side-scrolling perspective)
    const trackPos = getTerrainPos(xRef.current)
    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, xRef.current + 4.5, 0.04)
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, yRef.current + 2.5, 0.04)
    
    // Camera shake
    const s = shakeRef.current
    if (s > 0.01) {
      state.camera.position.x += (Math.random() - 0.5) * s
      state.camera.position.y += (Math.random() - 0.5) * s
      shakeRef.current = s * 0.86
    }
    
    // Wide dynamic camera zoom: default Z=18.0 pulls out up to Z=26.0 at max speed
    const targetZ = 18.0 + Math.max(0, vxRef.current - 5.0) * 0.45
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetZ, 0.04)
    
    state.camera.lookAt(xRef.current + 3.0, yRef.current + 0.3, trackPos.z)

    // Throttle track segment generation triggers (every 2m)
    if (Math.abs(xRef.current - trackPlayerX) > 2.0) {
      setTrackPlayerX(xRef.current)
    }

    // Throttled HUD update callback
    onUpdateStats({
      score: scoreRef.current,
      distance: Math.floor(xRef.current),
      combo: comboRef.current,
      velocity: vxRef.current,
      timeLeft: timeLeftRef.current
    })
  })

  return (
    <group>
      <pointLight ref={lightRef} intensity={0.8} color="#34d399" />
      <BackgroundStars />
      <HillyTrack playerX={trackPlayerX} />
      
      {/* 3D Rolling Sphere */}
      <group ref={sphereRef}>
        <group ref={rollMeshRef} name="inner-roll">
          {/* Reflective Chrome Sphere */}
          <mesh>
            <sphereGeometry args={[0.78, 32, 32]} />
            <meshStandardMaterial color="#cbd5e1" metalness={1.0} roughness={0.02} />
          </mesh>
          {/* Orbital Neon hoops */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.785, 0.024, 8, 32]} />
            <meshBasicMaterial color={NEON_CYAN} />
          </mesh>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.785, 0.02, 8, 32]} />
            <meshBasicMaterial color={NEON_CYAN} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

type GameViewProps = {
  onBack: () => void
}

interface GameCanvasProps {
  isPlaying: boolean
  isGameOver: boolean
  onUpdateStats: (data: { score: number; distance: number; combo: number; velocity: number; timeLeft: number }) => void
  onFeedback: (text: string, color: string) => void
  onGameOver: (finalScore: number) => void
}

const GameCanvas = React.memo(({
  isPlaying,
  isGameOver,
  onUpdateStats,
  onFeedback,
  onGameOver
}: GameCanvasProps) => {
  return (
    <Canvas camera={{ position: [4.0, 3.0, 18.0], fov: 45 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} />
      <GameEngine 
        isPlaying={isPlaying}
        isGameOver={isGameOver}
        onUpdateStats={onUpdateStats}
        onFeedback={onFeedback}
        onGameOver={onGameOver}
      />
    </Canvas>
  )
})

export const GameView = ({ onBack }: GameViewProps) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [isVictory, setIsVictory] = useState(false)
  const [gameKey, setGameKey] = useState(0)

  // HUD state variables
  const [distance, setDistance] = useState(0)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(1)
  const [timeLeft, setTimeLeft] = useState(45)
  const [velocity, setVelocity] = useState(5.0)
  const [isPumping, setIsPumping] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; color: string } | null>(null)
  
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('gym_press_momentum_highscore')
    return saved ? parseInt(saved, 10) : 0
  })

  // Start keyboard pump detection for UI color updates
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        setIsPumping(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        setIsPumping(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const triggerFeedback = (text: string, color: string) => {
    setFeedback({ text, color })
    setTimeout(() => {
      setFeedback(null)
    }, 1000)
  }

  const resetGame = () => {
    audio.init()
    setDistance(0)
    setScore(0)
    setCombo(1)
    setTimeLeft(45)
    setVelocity(5.0)
    setIsPumping(false)
    setFeedback(null)
    setIsGameOver(false)
    setIsVictory(false)
    
    // Increment key to force fresh scene graph reload
    setGameKey((prev) => prev + 1)
    setIsPlaying(true)
  }

  const handleUpdateStats = (stats: { score: number; distance: number; combo: number; velocity: number; timeLeft: number }) => {
    setScore(stats.score)
    setDistance(stats.distance)
    setCombo(stats.combo)
    setVelocity(stats.velocity)
    setTimeLeft(stats.timeLeft)
  }

  const handleGameOver = (finalScore: number) => {
    setIsPlaying(false)
    setIsGameOver(true)
    
    if (finalScore > highScore) {
      setIsVictory(true)
      setHighScore(finalScore)
      localStorage.setItem('gym_press_momentum_highscore', finalScore.toString())
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: '80vh', padding: 20 }}>
      {/* Header */}
      <header className="runHeader" style={{ marginBottom: 0 }}>
        <button type="button" className="iconButton" onClick={onBack} aria-label="Go back">
          ←
        </button>
        <div className="runHeaderContent">
          <div className="heroBadge">Chrome Sphere Lab</div>
          <h1 className="runPageTitle textGradient">Chrome Sphere Momentum</h1>
        </div>
      </header>

      {/* Main Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, flex: 1 }} className="gameResponsiveGrid">
        
        {/* Left Side: 3D Side Scrolling Canvas Container */}
        <div 
          id="game-canvas-container"
          style={{ 
            position: 'relative', 
            border: '1px solid var(--border-2)', 
            background: '#020207', 
            minHeight: 460, 
            borderRadius: 'var(--radius-lg)', 
            overflow: 'hidden',
            touchAction: 'none'
          }}
        >
          {/* Active 3D Render Canvas */}
          <GameCanvas 
            key={gameKey}
            isPlaying={isPlaying}
            isGameOver={isGameOver}
            onUpdateStats={handleUpdateStats}
            onFeedback={triggerFeedback}
            onGameOver={handleGameOver}
          />

          {/* Speed / Pump hud gauge overlays */}
          {isPlaying && (
            <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 15, background: 'rgba(0,0,0,0.85)', padding: '8px 16px', borderRadius: 4, border: '1px solid var(--border-2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.08em' }}>VELOCITY</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', fontFamily: 'monospace', color: velocity > 12 ? '#34d399' : '#ffffff' }}>
                {Math.floor(velocity * 4)} km/h
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: isPumping ? '#34d399' : '#1e293b', boxShadow: isPumping ? '0 0 8px #34d399' : 'none' }} />
                <span style={{ fontSize: 9, color: isPumping ? '#34d399' : 'var(--muted)' }}>PUMP ACTIVE</span>
              </div>
            </div>
          )}

          {/* Local CSS Animations */}
          <style>{`
            @keyframes bounce-pop {
              0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
              50% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
              75% { transform: translate(-50%, -50%) scale(0.95); opacity: 1; }
              100% { transform: translate(-50%, -50%) scale(1.0); opacity: 1; }
            }
            @keyframes victory-confetti {
              0% { transform: translateY(-50px) rotate(0deg); opacity: 1; }
              100% { transform: translateY(600px) rotate(720deg); opacity: 0; }
            }
          `}</style>

          {/* Landing / Collision Feedback */}
          {feedback && (
            <div style={{
              position: 'absolute',
              top: '40%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: feedback.color,
              fontSize: 24,
              fontFamily: "'Share Tech Mono', monospace",
              fontWeight: 900,
              textShadow: `0 0 16px ${feedback.color}`,
              pointerEvents: 'none',
              zIndex: 20,
              animation: 'bounce-pop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) both'
            }}>
              {feedback.text}
            </div>
          )}

          {/* Victory Celebration Confetti */}
          {isGameOver && isVictory && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 25, pointerEvents: 'none', overflow: 'hidden' }}>
              {Array.from({ length: 24 }).map((_, idx) => {
                const emojis = ['🎉', '🏆', '💪', '🔥', '🏁']
                const emoji = emojis[idx % emojis.length]
                const left = Math.random() * 100
                const delay = Math.random() * 3
                const duration = 2.5 + Math.random() * 2
                return (
                  <span
                    key={idx}
                    style={{
                      position: 'absolute',
                      left: `${left}%`,
                      top: -40,
                      fontSize: 24,
                      animation: `victory-confetti ${duration}s linear ${delay}s infinite`,
                      zIndex: 26
                    }}
                  >
                    {emoji}
                  </span>
                )
              })}
            </div>
          )}

          {/* Start Screen Overlay */}
          {!isPlaying && (
            <div style={{ 
              position: 'absolute', 
              inset: 0, 
              background: 'rgba(5, 5, 10, 0.9)', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: 24,
              textAlign: 'center',
              zIndex: 30
            }}>
              {isGameOver ? (
                <>
                  <div className="pt-cell" style={{ '--element-color': isVictory ? '#34d399' : 'var(--accent)', padding: 20, maxWidth: 360, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' } as React.CSSProperties}>
                    <div className="pt-header">
                      <span className="pt-number">100</span>
                      <span className="pt-group">{isVictory ? 'NEW RECORD' : 'SESSION OVER'}</span>
                    </div>
                    <div className="pt-symbol" style={{ fontSize: 40, margin: '8px 0', color: isVictory ? '#34d399' : 'inherit' }}>{isVictory ? 'Hs' : 'Gp'}</div>
                    <div className="pt-footer">
                      <div className="pt-name" style={{ fontSize: 13, color: isVictory ? '#34d399' : 'var(--accent)', fontWeight: 800 }}>
                        {isVictory ? '🏆 NEW HIGH SCORE! 🏆' : 'CHALLENGE FINISHED'}
                      </div>
                      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', marginTop: 12 }}>
                        <div>
                          <div style={{ fontSize: 9, color: 'var(--muted)' }}>DISTANCE</div>
                          <div style={{ fontSize: 20, fontWeight: 800 }}>{distance}m</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: 'var(--muted)' }}>SCORE</div>
                          <div style={{ fontSize: 20, fontWeight: 800 }}>{score}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button className="button" onClick={resetGame} style={{ marginTop: 24, padding: '12px 32px' }}>
                    Ride Again (Space)
                  </button>
                </>
              ) : (
                <>
                  <h2 style={{ fontFamily: "'Share Tech Mono', monospace", marginBottom: 12 }}>CHROME SPHERE RIDER</h2>
                  <p style={{ maxWidth: 450, color: 'var(--muted)', fontSize: 12, lineHeight: 1.5, marginBottom: 20 }}>
                    Roll a giant reflecting chrome sphere down hilly slopes! Tap or press Spacebar to pump downhills to build speed momentum. Release to jump off hill crests, and press in mid-air to dive down quickly!
                  </p>
                  
                  <div style={{ width: '100%', maxWidth: 440, margin: '0 auto 24px', textAlign: 'left' }}>
                    <div style={{ border: '1px solid var(--border-2)', padding: 12, borderRadius: 4, background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ fontSize: 10, fontWeight: 'bold', color: 'var(--accent)', textTransform: 'uppercase' }}>SINGLE BUTTON ACTION (SPACEBAR OR TAP SCREEN)</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                        • **ON HILL CRESTS**: Tap/Release to **JUMP** for massive distance!<br/>
                        • **GOING DOWNHILL**: Hold/Press to **PUMP** and gain speed momentum!<br/>
                        • **IN MID-AIR**: Hold/Press to **DIVE PUMP** down onto downhill landing slopes!
                      </div>
                    </div>
                  </div>

                  <button className="button" onClick={resetGame} style={{ padding: '12px 36px', fontWeight: 'bold' }}>
                    Begin Ride
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Info Column (Periodic HUD) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Main Game Element HUD Card */}
          <div className="pt-cell" style={{ '--element-color': 'var(--accent)', flex: 1, minHeight: 220 } as React.CSSProperties}>
            <div className="pt-header">
              <span className="pt-number">100</span>
              <span className="pt-group">FERMIUM • MOMENTUM LAB</span>
            </div>
            
            {/* Combo Display */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '6px 0' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Landing Multiplier</div>
              <div style={{ 
                fontSize: 48, 
                fontWeight: 900, 
                color: combo > 1 ? 'var(--accent)' : 'var(--text)',
                textShadow: combo > 1 ? '0 0 16px var(--accent)' : 'none',
                transition: 'all 0.1s ease-out'
              }}>
                x{combo}
              </div>
            </div>

            <div className="pt-footer">
              <div className="pt-name" style={{ fontSize: 13 }}>Gym Press</div>
              <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', marginTop: 12, borderTop: '1px dotted var(--border-2)', paddingTop: 10 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--muted)' }}>Distance</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{distance}m</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--muted)' }}>Time Left</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: timeLeft < 10 ? '#ef4444' : 'var(--text)' }}>{timeLeft}s</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--muted)' }}>Score</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{score}</div>
                </div>
              </div>
            </div>
          </div>

          {/* High Score & Controls Box */}
          <div className="pt-cell" style={{ '--element-color': 'var(--border)', minHeight: 180 } as React.CSSProperties}>
            <div className="pt-header">
              <span className="pt-number">HI</span>
              <span className="pt-group">RECORD STATUS</span>
            </div>
            
            <div style={{ padding: '8px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Current High Score</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', margin: '4px 0' }}>{highScore}</div>
            </div>

            <div className="pt-footer" style={{ borderTop: '1px dotted var(--border-2)', paddingTop: 10 }}>
              <div className="hint" style={{ fontSize: 10, textAlign: 'center' }}>TOUCH & RIDE</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  type="button" 
                  className="button" 
                  style={{ 
                    flex: 1, 
                    padding: '14px 0', 
                    fontSize: 12, 
                    fontWeight: 'bold', 
                    background: isPumping ? 'var(--accent)' : 'rgba(255,255,255,0.03)', 
                    border: '1px solid var(--border-2)',
                    color: isPumping ? '#000000' : 'var(--text)',
                    boxShadow: isPumping ? '0 0 16px var(--accent)' : 'none',
                    transition: 'all 0.1s ease'
                  }}
                  onTouchStart={() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); setIsPumping(true); }}
                  onTouchEnd={() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })); setIsPumping(false); }}
                  onMouseDown={() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); setIsPumping(true); }}
                  onMouseUp={() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })); setIsPumping(false); }}
                >
                  {isPumping ? '⚡ PUMPING ⚡' : 'HOLD TO PUMP / TAP TO JUMP'}
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}
