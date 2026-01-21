import React from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment'
import type { Group } from 'three'

const isScenarioGifMode = (): boolean => {
  try {
    return (window as any).__PROGRESS_TRACKER_SCENARIO_GIF__ === true
  } catch {
    return false
  }
}

const DragOrbitCamera = ({ isNarrow }: { isNarrow: boolean }) => {
  const { camera, gl } = useThree()

  const isDraggingRef = React.useRef(false)
  const lastRef = React.useRef<{ x: number; y: number } | null>(null)

  const thetaRef = React.useRef(0)
  const phiRef = React.useRef(0.32)

  React.useEffect(() => {
    if (isNarrow) {
      phiRef.current = 0.22
      thetaRef.current = 0
    }
  }, [isNarrow])

  React.useEffect(() => {
    const el = gl.domElement

    const onPointerDown = (ev: PointerEvent) => {
      isDraggingRef.current = true
      lastRef.current = { x: ev.clientX, y: ev.clientY }
      try {
        el.setPointerCapture(ev.pointerId)
      } catch {
        // ignore
      }
    }

    const onPointerMove = (ev: PointerEvent) => {
      if (!isDraggingRef.current || !lastRef.current) return
      const dx = ev.clientX - lastRef.current.x
      const dy = ev.clientY - lastRef.current.y
      lastRef.current = { x: ev.clientX, y: ev.clientY }

      const rotateSpeed = 0.006
      thetaRef.current -= dx * rotateSpeed
      phiRef.current -= dy * rotateSpeed

      const minPhi = 0.08
      const maxPhi = Math.PI / 2.05
      phiRef.current = Math.min(maxPhi, Math.max(minPhi, phiRef.current))
    }

    const endDrag = () => {
      isDraggingRef.current = false
      lastRef.current = null
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endDrag)
    el.addEventListener('pointercancel', endDrag)
    el.addEventListener('pointerleave', endDrag)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', endDrag)
      el.removeEventListener('pointercancel', endDrag)
      el.removeEventListener('pointerleave', endDrag)
    }
  }, [gl])

  useFrame((_state, delta) => {
    if (!isDraggingRef.current) {
      thetaRef.current += delta * 0.25
    }

    const radius = isNarrow ? 2.45 : 3.1
    const targetY = isNarrow ? -0.1 : 0.55
    const targetX = 0
    const targetZ = 0

    const theta = thetaRef.current
    const phi = phiRef.current

    const y = targetY + Math.sin(phi) * 1.0
    const planar = Math.cos(phi) * radius
    const x = targetX + Math.cos(theta) * planar
    const z = targetZ + Math.sin(theta) * planar

    camera.position.set(x, y, z)
    camera.lookAt(targetX, targetY, targetZ)
  })

  return null
}

const StudioEnvironment = () => {
  const { gl, scene } = useThree()

  React.useLayoutEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    pmrem.compileEquirectangularShader()

    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    // eslint-disable-next-line react-hooks/immutability
    scene.environment = env

    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])

  return null
}

const Plate = ({
  position,
  color,
  width,
  radius = 0.225, // Standard 450mm diameter for bumper plates
  texture = 'rubber', // 'rubber' | 'iron' | 'urethane'
}: {
  position: [number, number, number]
  color: string
  width: number
  radius?: number
  texture?: 'rubber' | 'iron' | 'urethane'
}) => {
  // We use extra segments for roundness
  const radialSegments = 48

  // Hub geometry (center ring) -> standard Olympic 50mm opening (0.025 radius)
  // We make the hub slightly wider physically to pop out
  const hubRadius = 0.07

  const materialProps =
    texture === 'rubber'
      ? {
          roughness: 0.7,
          metalness: 0.1,
          clearcoat: 0.1,
          clearcoatRoughness: 0.6,
        }
      : texture === 'urethane'
        ? {
            roughness: 0.2,
            metalness: 0.2,
            clearcoat: 1,
            clearcoatRoughness: 0.1,
          }
        : {
            // Iron
            roughness: 0.5,
            metalness: 0.6,
            clearcoat: 0.0,
          }

  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      {/* Main Plate Body */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, width, radialSegments]} />
        <meshPhysicalMaterial color={color} {...materialProps} envMapIntensity={1} />
      </mesh>

      {/* Central Hub (Steel Insert) */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[hubRadius, hubRadius, width + 0.002, 32]} />
        <meshPhysicalMaterial
          color="#666666"
          roughness={0.25}
          metalness={1.0}
          clearcoat={0.5}
          envMapIntensity={2.0}
        />
      </mesh>
    </group>
  )
}

const Collar = ({ position }: { position: [number, number, number] }) => {
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      {/* Clamp Body */}
      <mesh castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.05, 32]} />
        <meshPhysicalMaterial
          color="#1f2937"
          roughness={0.4}
          metalness={0.8}
          envMapIntensity={1.5}
        />
      </mesh>
      {/* Lever/Bolt detail */}
      <mesh position={[0.045, 0, 0]}>
        <boxGeometry args={[0.02, 0.03, 0.06]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
    </group>
  )
}

const LiftedWeight = () => {
  const groupRef = React.useRef<Group | null>(null)
  const { gl } = useThree()

  const isPressedRef = React.useRef(false)
  const pressAmountRef = React.useRef(0)

  React.useEffect(() => {
    const el = gl.domElement

    const onPointerDown = () => {
      isPressedRef.current = true
    }

    const onPointerUp = () => {
      isPressedRef.current = false
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    el.addEventListener('pointerleave', onPointerUp)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      el.removeEventListener('pointerleave', onPointerUp)
    }
  }, [gl])

  useFrame((state, delta) => {
    const g = groupRef.current
    if (!g) return
    const t = state.clock.getElapsedTime()

    // 4-second lifting cycle
    // 0.0 - 0.8: Lift (Explosive up)
    // 0.8 - 2.0: Pause at top
    // 2.0 - 3.2: Lower (Controlled eccentric)
    // 3.2 - 4.0: Pause at bottom
    const cycle = 4.0
    const pVal = t % cycle
    let liftFactor = 0

    if (pVal < 0.8) {
      // EaseOutCubic: 1 - pow(1 - x, 3)
      const x = pVal / 0.8
      liftFactor = 1 - Math.pow(1 - x, 3)
    } else if (pVal < 2.0) {
      liftFactor = 1
    } else if (pVal < 3.2) {
      // EaseInOutQuad for lowering
      const x = (pVal - 2.0) / 1.2
      const ease = x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
      liftFactor = 1 - ease
    } else {
      liftFactor = 0
    }

    const autoLift = 0.45 + liftFactor * 0.9

    const targetPress = isPressedRef.current ? 1 : 0
    const ease = 1 - Math.exp(-delta * 14)
    pressAmountRef.current += (targetPress - pressAmountRef.current) * ease

    g.position.y = autoLift + pressAmountRef.current * 0.35
    g.rotation.set(0, 0, 0)
  })

  // Bar dimensions
  const barLength = 2.2 // Standard Olympic bar
  const shaftRadius = 0.014 // 28mm diameter -> 14mm radius
  const sleeveRadius = 0.025 // 50mm diameter -> 25mm radius
  const sleeveLength = 0.415
  const shaftLength = barLength - 2 * sleeveLength

  // Calculated positions
  const sleeveOffset = shaftLength / 2 + sleeveLength / 2

  return (
    <group ref={groupRef}>
      {/* 
        --------------------
           BARBELL SHAFT
        --------------------
      */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[shaftRadius, shaftRadius, shaftLength, 32]} />
        <meshPhysicalMaterial
          color="#1a1a1a"
          roughness={0.12}
          metalness={1.0}
          clearcoat={0.5}
          clearcoatRoughness={0.1}
          envMapIntensity={3.0}
        />
      </mesh>

      {/* 
        --------------------
           SLEEVES (Ends)
        --------------------
      */}
      <mesh position={[sleeveOffset, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[sleeveRadius, sleeveRadius, sleeveLength, 32]} />
        <meshPhysicalMaterial
          color="#333333"
          roughness={0.2}
          metalness={1.0}
          envMapIntensity={2.5}
        />
      </mesh>
      <mesh position={[-sleeveOffset, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[sleeveRadius, sleeveRadius, sleeveLength, 32]} />
        <meshPhysicalMaterial
          color="#333333"
          roughness={0.2}
          metalness={1.0}
          envMapIntensity={2.5}
        />
      </mesh>

      {/* 
        --------------------
           SLEEVE STOPPERS (Collars built-in to bar)
        --------------------
      */}
      <mesh position={[shaftLength / 2 + 0.015, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.03, 32]} />
        <meshPhysicalMaterial color="#333333" metalness={1} roughness={0.25} envMapIntensity={2.0}/>
      </mesh>
      <mesh position={[-shaftLength / 2 - 0.015, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.03, 32]} />
        <meshPhysicalMaterial color="#333333" metalness={1} roughness={0.25} envMapIntensity={2.0}/>
      </mesh>

      {/* 
        --------------------
           PLATES (Right Side) - Start slightly inside from sleeve start
        --------------------
      */}
      {/* Heavy Inner Plate (Black) */}
      <Plate position={[0.78, 0, 0]} width={0.08} color="#111827" texture="rubber" />
      
      {/* Accent Outer Plate (Teal) */}
      <Plate position={[0.87, 0, 0]} width={0.05} color="#2dd4bf" texture="urethane" />

      {/* Collar Clamp */}
      <Collar position={[0.92, 0, 0]} />


      {/* 
        --------------------
           PLATES (Left Side)
        --------------------
      */}
      <Plate position={[-0.78, 0, 0]} width={0.08} color="#111827" texture="rubber" />
      <Plate position={[-0.87, 0, 0]} width={0.05} color="#2dd4bf" texture="urethane" />
      <Collar position={[-0.92, 0, 0]} />

    </group>
  )
}

export const ThreeDemo = () => {
  const isGif = isScenarioGifMode()
  const [isNarrow, setIsNarrow] = React.useState(() => {
    // Avoid layout shift by initializing with correct value if window exists
    if (typeof window !== 'undefined') {
      return window.innerWidth < 720
    }
    return false
  })

  React.useEffect(() => {
    const update = () => setIsNarrow(window.innerWidth < 720)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return (
    <Canvas
      shadows
      dpr={isGif ? 1 : [1, 2]}
      gl={{ preserveDrawingBuffer: isGif }}
      camera={{ position: [2.8, 1.2, 2.4], fov: 50 }}
      onCreated={({ gl }) => {
        gl.shadowMap.enabled = true
        gl.shadowMap.type = THREE.PCFSoftShadowMap
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.08
        gl.outputColorSpace = THREE.SRGBColorSpace

        // In headless capture we intentionally reduce work to avoid frames dropping/blanking.
        if (isGif) {
          gl.setPixelRatio(1)
        }
      }}
    >
      <StudioEnvironment />

      <ambientLight intensity={0.22} />
      <hemisphereLight intensity={0.55} groundColor="#0b0b0c" color="#f8fafc" />
      <directionalLight
        position={[3.8, 5.2, 2.8]}
        intensity={2.25}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={15}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
      />
      <directionalLight position={[-3.2, 2.8, -2.2]} intensity={0.6} />

      <DragOrbitCamera isNarrow={isNarrow} />

      <group position={[0, isNarrow ? -0.9 : -0.2, 0]}>
        {/* Invisible shadow catcher floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} receiveShadow>
          <planeGeometry args={[10, 10]} />
          <shadowMaterial transparent opacity={0.4} color="#000" />
        </mesh>
        <LiftedWeight />
      </group>
    </Canvas>
  )
}
