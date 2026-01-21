import React, { useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Environment, ContactShadows, PerspectiveCamera, MeshReflectorMaterial } from '@react-three/drei'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment'
// @ts-ignore
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib'
import { EffectComposer, Bloom, Vignette, Noise, ToneMapping as EffectToneMapping, DepthOfField, ChromaticAberration, BrightnessContrast, SSAO } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import type { Group } from 'three'

// --- ASSETS / TEXTURES (Procedural) ---

const useKnurlingMap = () => {
  return React.useMemo(() => {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    ctx.fillStyle = '#808080'
    ctx.fillRect(0, 0, size, size)

    ctx.strokeStyle = '#c0c0c0'
    ctx.lineWidth = 2

    for (let i = -size; i < size * 2; i += 10) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i - size, size)
      ctx.stroke()
    }

    for (let i = -size; i < size * 2; i += 10) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i + size, size)
      ctx.stroke()
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(4, 1)
    tex.anisotropy = 16
    return tex
  }, [])
}

const useNoiseMap = () => {
  return React.useMemo(() => {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const imageData = ctx.createImageData(size, size)
    const data = imageData.data

    for (let i = 0; i < data.length; i += 4) {
      const val = 100 + Math.random() * 50
      data[i] = val
      data[i + 1] = val
      data[i + 2] = val
      data[i + 3] = 255
    }

    ctx.putImageData(imageData, 0, 0)

    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(2, 2)
    return tex
  }, [])
}

const useRadialMap = () => {
  return React.useMemo(() => {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const cx = size / 2
    const cy = size / 2

    for (let i = 0; i < 3000; i++) {
      const radius = Math.random() * (size / 2)
      const angle = Math.random() * Math.PI * 2

      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.random() * 0.1})`
      ctx.beginPath()
      ctx.arc(cx, cy, radius, angle, angle + 0.1 + Math.random() * 0.5)
      ctx.stroke()
    }

    const tex = new THREE.CanvasTexture(canvas)
    return tex
  }, [])
}

// --- COMPONENTS ---

// 20kg Plate
const Plate = ({
  position,
  color = '#111',
  noiseMap
}: {
  position: [number, number, number]
  color?: string
  label?: string
  envMap?: THREE.Texture
  noiseMap?: THREE.Texture
}) => {
  return (
    <group position={position}>
      {/* Main Rubber Body */}
      <mesh receiveShadow castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.225, 0.225, 0.06, 64]} />
        <meshStandardMaterial
          color={color}
          roughness={0.9}
          metalness={0.1}
          map={noiseMap}
          bumpMap={noiseMap}
          bumpScale={0.002}
        />
      </mesh>

      {/* Inner Metal Ring */}
      <mesh receiveShadow castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.026, 0.026, 0.061, 32]} />
        <meshStandardMaterial color="#ddd" roughness={0.3} metalness={0.9} />
      </mesh>

      {/* Label (Simulated) */}
      <mesh position={[0, 0.15, 0.031]} rotation={[0, 0, 0]}>
        <planeGeometry args={[0.1, 0.05]} />
        <meshBasicMaterial color="#fff" transparent opacity={0.6} alphaTest={0.5} side={THREE.DoubleSide} visible={false}>
          {/* Text rendering would go here, skipping for perf/simplicity */}
        </meshBasicMaterial>
      </mesh>

      {/* Ridge details */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.18, 0.005, 16, 64]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </group>
  )
}

const Collar = ({ position }: { position: [number, number, number] }) => {
  return (
    <group position={position}>
      <mesh receiveShadow castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 0.05, 32]} />
        <meshStandardMaterial color="#888" roughness={0.4} metalness={0.8} />
      </mesh>
      {/* Tightening key */}
      <mesh position={[0, 0.04, 0]} rotation={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.01, 0.04, 0.01]} />
        <meshStandardMaterial color="#aaa" />
      </mesh>
    </group>
  )
}

const LiftedWeight = ({ onRepComplete: _ }: { onRepComplete: () => void }) => {
  const knurlMap = useKnurlingMap()
  const radialMap = useRadialMap()
  const noiseMap = useNoiseMap()

  // Animation state
  const groupRef = React.useRef<Group>(null)

  useFrame((state) => {
    if (!groupRef.current) return

    // Simple bobbing animation
    const t = state.clock.getElapsedTime()
    const y = Math.sin(t * 2) * 0.1 + 0.1 // 0.1m amplitude

    // Detect "rep" (simplified)
    if (Math.sin(t * 2) > 0.99) {
      // Peak
    }

    groupRef.current.position.y = y
  })

  // Bar dimensions: 2.2m length, 28mm grip, 50mm sleeve
  // Grip section: 1.31m
  // Sleeve section: 0.415m each

  return (
    <group ref={groupRef}>
      {/* --- BAR SHAFT --- */}
      <mesh receiveShadow castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.014, 0.014, 1.31, 32]} />
        <meshPhysicalMaterial
          color="#aaa"
          roughness={0.6}
          metalness={0.6}
          map={noiseMap} // subtle imperfection
        />
      </mesh>

      {/* --- KNURLING MARKS (Visual only, usually separate meshes or textures) --- */}
      {/* Center Knurl (passive) */}
      <mesh receiveShadow castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0141, 0.0141, 0.12, 32]} />
        <meshStandardMaterial
          color="#bbb"
          roughness={0.7}
          metalness={0.5}
          normalMap={knurlMap}
          normalScale={new THREE.Vector2(1, 1)}
        />
      </mesh>

      {/* Hand Grip Knurls */}
      <mesh receiveShadow castShadow rotation={[0, 0, Math.PI / 2]} position={[-0.4, 0, 0]}>
        <cylinderGeometry args={[0.0141, 0.0141, 0.40, 32]} />
        <meshStandardMaterial
          color="#bbb"
          roughness={0.7}
          metalness={0.5}
          normalMap={knurlMap}
        />
      </mesh>
      <mesh receiveShadow castShadow rotation={[0, 0, Math.PI / 2]} position={[0.4, 0, 0]}>
        <cylinderGeometry args={[0.0141, 0.0141, 0.40, 32]} />
        <meshStandardMaterial
          color="#bbb"
          roughness={0.7}
          metalness={0.5}
          normalMap={knurlMap}
        />
      </mesh>

      {/* --- SLEEVES (Chrome) --- */}
      {/* Left Sleeve */}
      <group position={[-0.86, 0, 0]}>
        <mesh receiveShadow castShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, 0.415, 32]} />
          <meshPhysicalMaterial
            color="#ffffff"
            roughness={0.15}
            metalness={1.0}
            clearcoat={1.0}
            clearcoatRoughness={0.1}
            envMapIntensity={2.5}
          />
        </mesh>
        {/* End Cap */}
        <mesh position={[-0.21, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <circleGeometry args={[0.025, 32]} />
          <meshStandardMaterial
            color="#ddd"
            roughness={0.4}
            metalness={0.8}
            map={radialMap}
          />
        </mesh>
      </group>

      {/* Right Sleeve */}
      <group position={[0.86, 0, 0]}>
        <mesh receiveShadow castShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, 0.415, 32]} />
          <meshPhysicalMaterial
            color="#ffffff"
            roughness={0.15}
            metalness={1.0}
            clearcoat={1.0}
            clearcoatRoughness={0.1}
            envMapIntensity={2.5}
          />
        </mesh>
        <mesh position={[0.21, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[0.025, 32]} />
          <meshStandardMaterial
            color="#ddd"
            roughness={0.4}
            metalness={0.8}
            map={radialMap}
          />
        </mesh>
      </group>


      {/* --- PLATES (Loaded) --- */}
      {/* Left Side */}
      <Plate position={[-0.70, 0, 0]} color="#111" noiseMap={noiseMap} />
      <Plate position={[-0.77, 0, 0]} color="#111" noiseMap={noiseMap} />
      <Collar position={[-0.66, 0, 0]} />

      {/* Right Side */}
      <Plate position={[0.70, 0, 0]} color="#111" noiseMap={noiseMap} />
      <Plate position={[0.77, 0, 0]} color="#111" noiseMap={noiseMap} />
      <Collar position={[0.66, 0, 0]} />

    </group>
  )
}

const DragOrbitCamera = ({ isNarrow }: { isNarrow: boolean }) => {
  const { camera, gl } = useThree()
  const isDraggingRef = React.useRef(false)
  const previousMousePosition = React.useRef({ x: 0, y: 0 })

  // Spherical coordinates
  const thetaRef = React.useRef(Math.PI / 4) // Horizontal angle
  const phiRef = React.useRef(Math.PI / 3)   // Vertical angle (from y-axis up)

  useEffect(() => {
    const canvas = gl.domElement

    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true
      previousMousePosition.current = { x: e.clientX, y: e.clientY }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return

      const deltaX = e.clientX - previousMousePosition.current.x
      const deltaY = e.clientY - previousMousePosition.current.y

      previousMousePosition.current = { x: e.clientX, y: e.clientY }

      // Adjust sensitivity
      const sensitivity = 0.005
      thetaRef.current -= deltaX * sensitivity
      phiRef.current -= deltaY * sensitivity

      // Clamp vertical angle to avoid flipping
      const minPhi = 0.1
      const maxPhi = Math.PI - 0.1
      phiRef.current = Math.max(minPhi, Math.min(maxPhi, phiRef.current))
    }

    const onMouseUp = () => {
      isDraggingRef.current = false
    }

    // Touch support (basic)
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDraggingRef.current = true
        previousMousePosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || e.touches.length !== 1) return

      const touch = e.touches[0]
      const deltaX = touch.clientX - previousMousePosition.current.x
      const deltaY = touch.clientY - previousMousePosition.current.y
      previousMousePosition.current = { x: touch.clientX, y: touch.clientY }

      const sensitivity = 0.005
      thetaRef.current -= deltaX * sensitivity
      phiRef.current -= deltaY * sensitivity

      const minPhi = 0.1
      const maxPhi = Math.PI - 0.1
      phiRef.current = Math.max(minPhi, Math.min(maxPhi, phiRef.current))
    }
    const onTouchEnd = () => {
      isDraggingRef.current = false
    }

    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)

      canvas.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
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

    // Subtle breathing/handheld movement
    const time = _state.clock.getElapsedTime()
    const shakeAmount = 0.05 // Tiny drift
    const shakeX = Math.sin(time * 0.5) * shakeAmount * 0.5
    const shakeY = Math.cos(time * 0.3) * shakeAmount * 0.5
    const shakeZ = Math.sin(time * 0.2) * shakeAmount * 0.5

    const y = targetY + Math.sin(phi) * 1.0
    const planar = Math.cos(phi) * radius
    const x = targetX + Math.cos(theta) * planar
    const z = targetZ + Math.sin(theta) * planar

    camera.position.set(x + shakeX, y + shakeY, z + shakeZ)
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

export function ThreeDemo() {
  const [repCount, setRepCount] = useState(0)
  const isGif = window.location.hash === '#gif'

  // Use a simple media query check for "mobile" or "narrow" layout
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 720)

  useEffect(() => {
    const handleResize = () => {
      setIsNarrow(window.innerWidth < 720)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#000' }}>

      {/* Overlay UI */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 10,
        pointerEvents: 'none'
      }}>
        <h1 style={{
          margin: 0,
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#e2e8f0',
          letterSpacing: '-0.02em',
        }}>
          BARBELL <span style={{ color: '#38bdf8' }}>TRACKER</span>
        </h1>
        <div style={{
          marginTop: '6px',
          fontSize: '0.85rem',
          color: '#94a3b8',
          display: 'flex',
          gap: '12px'
        }}>
          <span>LIVE FEED</span>
          <span style={{ color: '#ef4444' }}>● REC</span>
        </div>
      </div>

      <div style={{
        position: 'absolute',
        bottom: '30px',
        right: '30px',
        zIndex: 10,
        textAlign: 'right',
        pointerEvents: 'none'
      }}>
        <div style={{
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: '#64748b',
          marginBottom: '4px'
        }}>
          Reps Completed
        </div>
        <div style={{
          fontSize: '2.2rem',
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          color: '#f8fafc',
          lineHeight: 1,
        }}>
          {repCount}
        </div>
      </div>

      <Canvas
        shadows
        dpr={isNarrow ? 1 : (isGif ? 1 : [1, 2])}
        gl={{
          preserveDrawingBuffer: isGif,
          antialias: false, // We use SMAA or just default AA from composer if needed, but false is often better with postprocessing to avoid double AA issues or simply rely on high resolution
          alpha: true,
          stencil: false,
          depth: true
        }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true
          gl.shadowMap.type = THREE.PCFSoftShadowMap
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.0
          gl.outputColorSpace = THREE.SRGBColorSpace

          // Initialize RectAreaLights
          RectAreaLightUniformsLib.init()

          if (isGif) {
            gl.setPixelRatio(1)
          }
        }}
      >
        <PerspectiveCamera makeDefault position={[2.8, 1.2, 2.4]} fov={45} />
        <DragOrbitCamera isNarrow={isNarrow} />

        {isNarrow ? (
          <>
            {/* --- MOBILE: CLASSIC LOOK --- */}
            <StudioEnvironment />
            <ambientLight intensity={0.2} />
            <hemisphereLight intensity={0.3} groundColor="#0b0b0c" color="#ffffff" />
            <rectAreaLight
              width={5}
              height={5}
              color="#ffffff"
              intensity={6.0}
              position={[2, 4, 3]}
              onUpdate={(self) => self.lookAt(0, 0, 0)}
            />
            <directionalLight
              position={[5, 8, 5]}
              intensity={1.0}
              castShadow
              shadow-bias={-0.0001}
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
              shadow-radius={4}
            />
            <rectAreaLight
              width={8}
              height={2}
              color="#e0f2fe"
              intensity={2.0}
              position={[-3, 0, 4]}
              onUpdate={(self) => self.lookAt(0, 0, 0)}
            />
            <spotLight position={[-5, 5, -2]} intensity={5.0} angle={0.5} penumbra={1} color="#2dd4bf" />

            <group position={[0, -0.9, 0]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} receiveShadow>
                <planeGeometry args={[15, 15]} />
                <shadowMaterial transparent opacity={0.35} color="#000000" />
              </mesh>
              <LiftedWeight onRepComplete={() => setRepCount(c => c + 1)} />
            </group>
          </>
        ) : (
          <>
            {/* --- DESKTOP: HYPER REAL --- */}
            <Environment preset="city" blur={0.8} />
            <ambientLight intensity={0.5} />
            <rectAreaLight
              width={5}
              height={5}
              color="#ffffff"
              intensity={4.0}
              position={[2, 4, 3]}
              onUpdate={(self) => self.lookAt(0, 0, 0)}
            />
            <spotLight
              position={[5, 8, 5]}
              angle={0.5}
              penumbra={0.5}
              intensity={10.0}
              castShadow
              shadow-bias={-0.0001}
              shadow-radius={4}
            />
            <rectAreaLight
              width={8}
              height={2}
              color="#e0f2fe"
              intensity={5.0}
              position={[-3, 0, 4]}
              onUpdate={(self) => self.lookAt(0, 0, 0)}
            />
            <spotLight position={[-5, 5, -2]} intensity={20.0} angle={0.5} penumbra={1} color="#2dd4bf" />

            <group position={[0, -0.2, 0]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
                <planeGeometry args={[50, 50]} />
                <MeshReflectorMaterial
                  blur={[300, 100]}
                  resolution={1024}
                  mixBlur={1}
                  mixStrength={40}
                  roughness={1}
                  depthScale={1.2}
                  minDepthThreshold={0.4}
                  maxDepthThreshold={1.4}
                  color="#101010"
                  metalness={0.5}
                  mirror={0}
                />
              </mesh>
              <ContactShadows
                resolution={1024}
                scale={20}
                blur={1.5}
                opacity={0.5}
                far={10}
                color="#000000"
              />
              <LiftedWeight onRepComplete={() => setRepCount(c => c + 1)} />
            </group>

            <EffectComposer multisampling={8}>
              <SSAO
                radius={0.4}
                intensity={30}
                luminanceInfluence={0.5}
                color={new THREE.Color('black')}
              />
              <DepthOfField
                target={[0, 0, 0]}
                focalLength={0.02}
                bokehScale={1.5}
                height={480}
              />
              <Bloom
                luminanceThreshold={1.1}
                mipmapBlur
                intensity={0.8}
                radius={0.3}
              />
              <ChromaticAberration
                offset={new THREE.Vector2(0.0005, 0.0005)}
                radialModulation={false}
                modulationOffset={0}
              />
              <Noise opacity={0.05} blendFunction={BlendFunction.OVERLAY} />
              <Vignette eskil={false} offset={0.1} darkness={0.6} />
              <BrightnessContrast brightness={0} contrast={0.15} />
              <EffectToneMapping />
            </EffectComposer>
          </>
        )}
      </Canvas>
    </div>
  )
}
