import React, { useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ContactShadows, PerspectiveCamera, MeshReflectorMaterial, OrbitControls } from '@react-three/drei'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment'
// @ts-ignore
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib'
import { EffectComposer, Bloom, Vignette, Noise, ToneMapping as EffectToneMapping, ChromaticAberration, BrightnessContrast, SSAO } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

// Reuse texture hooks from ThreeDemo
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

const Plate = ({ position, color = '#111', width, radius }: { position: [number, number, number], color?: string, width: number, radius: number, label?: string }) => {
  const noiseMap = useNoiseMap()
  
  return (
    <group position={position}>
      {/* Main Body */}
      <mesh receiveShadow castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[radius, radius, width, 64]} />
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
        <cylinderGeometry args={[0.026, 0.026, width + 0.001, 32]} />
        <meshStandardMaterial color="#ddd" roughness={0.3} metalness={0.9} />
      </mesh>
      {/* Label (Simple text approximation if needed, omitted for now for simplicity) */}
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
      <mesh position={[0, 0.04, 0]} rotation={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.01, 0.04, 0.01]} />
        <meshStandardMaterial color="#aaa" />
      </mesh>
    </group>
  )
}

// Available plates in lbs
const AVAILABLE_PLATES = [
  { weight: 45, color: '#e63946', radius: 0.225, width: 0.06 }, // Red
  { weight: 35, color: '#1d3557', radius: 0.18, width: 0.05 },  // Blue
  { weight: 25, color: '#eab308', radius: 0.14, width: 0.045 }, // Yellow
  { weight: 10, color: '#2a9d8f', radius: 0.11, width: 0.035 }, // Green
  { weight: 5, color: '#f8f9fa', radius: 0.09, width: 0.025 },  // White
  { weight: 2.5, color: '#457b9d', radius: 0.08, width: 0.02 }, // Steel Blue
]

const calculatePlates = (targetWeight: number, barWeight = 45) => {
  const oneSideWeight = Math.max(0, (targetWeight - barWeight) / 2)
  let remaining = oneSideWeight
  const plates: typeof AVAILABLE_PLATES = []

  // Simple greedy algorithm
  for (const plate of AVAILABLE_PLATES) {
    while (remaining >= plate.weight) {
      plates.push(plate)
      remaining -= plate.weight
    }
  }
  
  return { plates, remainder: remaining * 2 } // remainder total
}

const LoadedBar = ({ targetWeight }: { targetWeight: number }) => {
  const knurlMap = useKnurlingMap()
  const noiseMap = useNoiseMap()
  
  const { plates } = useMemo(() => calculatePlates(targetWeight), [targetWeight])

  return (
    <group position={[0, 0.5, 0]}>
      {/* --- BAR SHAFT --- */}
      <mesh receiveShadow castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.014, 0.014, 1.31, 32]} />
        <meshPhysicalMaterial color="#aaa" roughness={0.6} metalness={0.6} map={noiseMap} />
      </mesh>

      {/* Knurling */}
      <mesh receiveShadow castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0141, 0.0141, 0.12, 32]} />
        <meshStandardMaterial color="#bbb" roughness={0.7} metalness={0.5} normalMap={knurlMap} />
      </mesh>
      <mesh receiveShadow castShadow rotation={[0, 0, Math.PI / 2]} position={[-0.4, 0, 0]}>
        <cylinderGeometry args={[0.0141, 0.0141, 0.40, 32]} />
        <meshStandardMaterial color="#bbb" roughness={0.7} metalness={0.5} normalMap={knurlMap} />
      </mesh>
      <mesh receiveShadow castShadow rotation={[0, 0, Math.PI / 2]} position={[0.4, 0, 0]}>
        <cylinderGeometry args={[0.0141, 0.0141, 0.40, 32]} />
        <meshStandardMaterial color="#bbb" roughness={0.7} metalness={0.5} normalMap={knurlMap} />
      </mesh>

      {/* --- SLEEVES --- */}
      {/* Left Sleeve */}
      <group position={[-0.86, 0, 0]}>
        <mesh receiveShadow castShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, 0.415, 32]} />
          <meshPhysicalMaterial color="#ffffff" roughness={0.15} metalness={1.0} />
        </mesh>
        <mesh position={[-0.21, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <circleGeometry args={[0.025, 32]} />
          <meshStandardMaterial color="#ddd" roughness={0.4} metalness={0.8} />
        </mesh>
      </group>

      {/* Right Sleeve */}
      <group position={[0.86, 0, 0]}>
        <mesh receiveShadow castShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, 0.415, 32]} />
          <meshPhysicalMaterial color="#ffffff" roughness={0.15} metalness={1.0} />
        </mesh>
        <mesh position={[0.21, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[0.025, 32]} />
          <meshStandardMaterial color="#ddd" roughness={0.4} metalness={0.8} />
        </mesh>
      </group>

      {/* --- PLATES --- */}
      {/* Iterate through calculated plates and stack them */}
      {plates.map((plate, index) => {
        // Calculate offset based on previous plates width
        let offset = 0.02 // Gap from inner sleeve shoulder
        for (let i = 0; i < index; i++) {
          offset += plates[i].width + 0.002 // small gap between plates
        }
        offset += plate.width / 2

        // Sleeve starts at 0.655 from center (1.31/2)
        const sleeveStart = 0.655
        const posRight = sleeveStart + offset
        const posLeft = -sleeveStart - offset

        return (
          <group key={index}>
            <Plate position={[posLeft, 0, 0]} color={plate.color} width={plate.width} radius={plate.radius} />
            <Plate position={[posRight, 0, 0]} color={plate.color} width={plate.width} radius={plate.radius} />
          </group>
        )
      })}

      {/* Collars */}
      {(() => {
        let offset = 0.02
        for (const p of plates) offset += p.width + 0.002
        // Collar after last plate
        const collarWidth = 0.05
        const posRight = 0.655 + offset + collarWidth / 2
        const posLeft = -0.655 - offset - collarWidth / 2
        return (
          <>
            <Collar position={[posLeft, 0, 0]} />
            <Collar position={[posRight, 0, 0]} />
          </>
        )
      })()}
    </group>
  )
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

export const PlateCalculatorScene = ({ targetWeight }: { targetWeight: number }) => {
  if (typeof navigator !== 'undefined' && navigator.webdriver) {
    return null
  }
  return (
    <div style={{ width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden', background: 'radial-gradient(circle at 50% 50%, var(--surface-3) 0%, var(--surface) 100%)' }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: false, alpha: true, depth: true }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true
          gl.shadowMap.type = THREE.PCFSoftShadowMap
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.0
          gl.outputColorSpace = THREE.SRGBColorSpace
          RectAreaLightUniformsLib.init()
        }}
      >
        <PerspectiveCamera makeDefault position={[0, 1.2, 2.5]} fov={40} />
        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2} enablePan={false} />

        <StudioEnvironment />
        <ambientLight intensity={0.4} />
        <rectAreaLight width={5} height={5} color="#ffffff" intensity={4.0} position={[2, 4, 3]} onUpdate={(self) => self.lookAt(0, 0, 0)} />
        <spotLight position={[5, 8, 5]} angle={0.5} penumbra={0.5} intensity={8.0} castShadow shadow-bias={-0.0001} />
        <rectAreaLight width={8} height={2} color="#e0f2fe" intensity={3.0} position={[-3, 0, 4]} onUpdate={(self) => self.lookAt(0, 0, 0)} />
        <spotLight position={[-5, 5, -2]} intensity={10.0} angle={0.5} penumbra={1} color="#2dd4bf" />

        <group position={[0, -0.5, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
            <planeGeometry args={[20, 20]} />
            <MeshReflectorMaterial
              blur={[300, 100]}
              resolution={1024}
              mixBlur={1}
              mixStrength={10}
              roughness={1}
              depthScale={1.2}
              minDepthThreshold={0.4}
              maxDepthThreshold={1.4}
              color="#1c1c21"
              metalness={0.4}
              mirror={0}
            />
          </mesh>
          <ContactShadows resolution={1024} scale={20} blur={1.5} opacity={0.5} far={10} color="#000000" />
          
          <LoadedBar targetWeight={targetWeight} />
        </group>

        <EffectComposer multisampling={8}>
          <SSAO radius={0.4} intensity={20} luminanceInfluence={0.5} color={new THREE.Color('black')} />
          <Bloom luminanceThreshold={1.1} mipmapBlur intensity={0.5} radius={0.3} />
          <ChromaticAberration offset={new THREE.Vector2(0.0005, 0.0005)} radialModulation={false} modulationOffset={0} />
          <Noise opacity={0.05} blendFunction={BlendFunction.OVERLAY} />
          <Vignette eskil={false} offset={0.1} darkness={0.6} />
          <BrightnessContrast brightness={0} contrast={0.1} />
          <EffectToneMapping />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
