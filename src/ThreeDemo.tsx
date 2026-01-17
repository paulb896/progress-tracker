import React from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment'
import type { Group } from 'three'

const DragOrbitCamera = () => {
  const { camera, gl } = useThree()

  const isDraggingRef = React.useRef(false)
  const lastRef = React.useRef<{ x: number; y: number } | null>(null)

  const thetaRef = React.useRef(0)
  const phiRef = React.useRef(0.32)

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

    const radius = 3.1
    const targetY = 0.55
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

  React.useEffect(() => {
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

const LiftedWeight = () => {
  const groupRef = React.useRef<Group | null>(null)

  useFrame((state) => {
    const g = groupRef.current
    if (!g) return
    const t = state.clock.getElapsedTime()
    const lift = 0.55 + Math.max(0, Math.sin(t * 1.25)) * 0.45
    g.position.y = lift
    g.rotation.set(0, 0, 0)
  })

  return (
    <group ref={groupRef}>
      {/* Bar */}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 1.7, 16]} />
        <meshPhysicalMaterial
          color="#c7c9d1"
          roughness={0.22}
          metalness={1}
          clearcoat={0.35}
          clearcoatRoughness={0.18}
          envMapIntensity={1.15}
        />
      </mesh>

      {/* Plates */}
      <mesh position={[0.74, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.18, 24]} />
        <meshStandardMaterial color="#1f2937" roughness={0.86} metalness={0.08} envMapIntensity={0.25} />
      </mesh>
      <mesh position={[-0.74, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.18, 24]} />
        <meshStandardMaterial color="#111827" roughness={0.88} metalness={0.06} envMapIntensity={0.25} />
      </mesh>

      {/* Inner plates (accent) */}
      <mesh position={[0.58, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.1, 20]} />
        <meshPhysicalMaterial
          color="#646cff"
          roughness={0.38}
          metalness={0.35}
          clearcoat={0.25}
          clearcoatRoughness={0.2}
          envMapIntensity={0.8}
        />
      </mesh>
      <mesh position={[-0.58, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.1, 20]} />
        <meshPhysicalMaterial
          color="#646cff"
          roughness={0.38}
          metalness={0.35}
          clearcoat={0.25}
          clearcoatRoughness={0.2}
          envMapIntensity={0.8}
        />
      </mesh>
    </group>
  )
}

export const ThreeDemo = () => {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [2.8, 1.2, 2.4], fov: 50 }}
      onCreated={({ gl }) => {
        gl.shadowMap.enabled = true
        gl.shadowMap.type = THREE.PCFSoftShadowMap
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.08
        gl.outputColorSpace = THREE.SRGBColorSpace
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

      <DragOrbitCamera />

      <group position={[0, 0, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} receiveShadow>
          <planeGeometry args={[8, 8]} />
          <meshStandardMaterial color="#465566" roughness={0.95} metalness={0.02} envMapIntensity={0.2} />
        </mesh>
        <LiftedWeight />
      </group>
    </Canvas>
  )
}
