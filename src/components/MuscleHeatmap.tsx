import React, { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Html, RoundedBox, Sphere, Cylinder, Environment, ContactShadows, Decal } from '@react-three/drei'
import * as THREE from 'three'
import type { RoutineCompletion } from '../completions/types'
import { EXERCISE_PRESETS, type MuscleGroup } from '../exercises/presets'

const VERSION_LABEL = "v3.8"

// --- Atlas mask textures ---
type AtlasMaskKind = 'roundedRect' | 'capsule' | 'trapezoid' | 'kite' | 'pec' | 'teardrop'

let ATLAS_MASKS: Partial<Record<AtlasMaskKind, THREE.CanvasTexture>> = {}

const getAtlasMask = (kind: AtlasMaskKind): THREE.CanvasTexture => {
  const cached = ATLAS_MASKS[kind]
  if (cached) return cached

  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    const data = new Uint8Array([255])
    const t = new THREE.DataTexture(data, 1, 1, THREE.RedFormat, THREE.UnsignedByteType)
    t.needsUpdate = true
    return t as unknown as THREE.CanvasTexture
  }

  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = 'black'
  ctx.fillRect(0, 0, size, size)

  const pad = 32
  const x0 = pad
  const y0 = pad
  const x1 = size - pad
  const y1 = size - pad
  const w = x1 - x0
  const h = y1 - y0

  const beginShape = () => {
    ctx.beginPath()
    ctx.fillStyle = 'white'
  }

  const fillShape = () => {
    ctx.closePath()
    ctx.fill()
  }

  const rr = (x: number, y: number, ww: number, hh: number, r: number) => {
    const r2 = Math.min(r, ww / 2, hh / 2)
    ctx.moveTo(x + r2, y)
    ctx.lineTo(x + ww - r2, y)
    ctx.quadraticCurveTo(x + ww, y, x + ww, y + r2)
    ctx.lineTo(x + ww, y + hh - r2)
    ctx.quadraticCurveTo(x + ww, y + hh, x + ww - r2, y + hh)
    ctx.lineTo(x + r2, y + hh)
    ctx.quadraticCurveTo(x, y + hh, x, y + hh - r2)
    ctx.lineTo(x, y + r2)
    ctx.quadraticCurveTo(x, y, x + r2, y)
  }

  switch (kind) {
    case 'roundedRect':
      beginShape()
      rr(x0, y0, w, h, 48) // Sharper corners for abs
      fillShape()
      break
    case 'capsule':
      beginShape()
      rr(x0, y0, w, h, Math.min(w, h) / 2)
      fillShape()
      break
    case 'trapezoid':
      beginShape()
      ctx.moveTo(x0 + w * 0.1, y0)
      ctx.lineTo(x1 - w * 0.1, y0)
      ctx.lineTo(x1 - w * 0.2, y1)
      ctx.lineTo(x0 + w * 0.2, y1)
      fillShape()
      break
    case 'kite':
      beginShape()
      ctx.moveTo(x0 + w * 0.5, y0)
      ctx.lineTo(x1, y0 + h * 0.4)
      ctx.lineTo(x0 + w * 0.5, y1)
      ctx.lineTo(x0, y0 + h * 0.4)
      fillShape()
      break
    case 'pec':
      // D-Shape: Flat left (sternum), Flat top (clavicle), Curved bottom/right
      beginShape()
      ctx.moveTo(x0, y0) // Top-left
      ctx.lineTo(x1 - w * 0.1, y0 + h * 0.1) // Top-right (clavicle)
      ctx.quadraticCurveTo(x1, y1 * 0.5, x1, y1 - h * 0.2) // Outer curve
      ctx.quadraticCurveTo(x0 + w * 0.5, y1, x0, y1 - h * 0.1) // Bottom curve
      ctx.lineTo(x0, y0) // Close to sternum
      fillShape()
      break
    case 'teardrop':
      // Fuller teardrop for Vastus Medialis
      beginShape()
      ctx.moveTo(x0 + w * 0.5, y0) // Top tip
      ctx.quadraticCurveTo(x1, y0 + h * 0.4, x1, y1 - h * 0.3) // Right bulge
      ctx.quadraticCurveTo(x0 + w * 0.5, y1, x0, y1 - h * 0.3) // Bottom rounded
      ctx.quadraticCurveTo(x0, y0 + h * 0.4, x0 + w * 0.5, y0) // Left bulge
      fillShape()
      break
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.anisotropy = 16
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  ATLAS_MASKS[kind] = tex
  return tex
}

// --- Logic ---

type FreshnessLevel = 'fresh' | 'recovering' | 'fatigued' | 'very_fatigued'

const getFreshnessColor = (level: FreshnessLevel): string => {
  switch (level) {
    case 'fresh': return '#4ade80' // Green
    case 'recovering': return '#facc15' // Yellow
    case 'fatigued': return '#fb923c' // Orange
    case 'very_fatigued': return '#ef4444' // Red
  }
}

const getFreshness = (muscle: MuscleGroup, completions: RoutineCompletion[]): { level: FreshnessLevel, hoursSince: number | null } => {
  let lastWorkedAt: number | null = null
  if (!completions) return { level: 'fresh', hoursSince: null }

  for (const completion of completions) {
    if (!completion.exercises) continue
    const completionTime = new Date(completion.completedAt).getTime()
    for (const exercise of completion.exercises) {
        const preset = EXERCISE_PRESETS.find(p => p.name === exercise.name)
        if (preset?.muscles?.includes(muscle)) {
             if (lastWorkedAt === null || completionTime > lastWorkedAt) {
                 lastWorkedAt = completionTime
             }
        }
    }
  }

  if (lastWorkedAt === null) return { level: 'fresh', hoursSince: null }
  const hoursSince = (Date.now() - lastWorkedAt) / (1000 * 60 * 60)

  if (hoursSince < 24) return { level: 'very_fatigued', hoursSince }
  if (hoursSince < 48) return { level: 'fatigued', hoursSince }
  if (hoursSince < 72) return { level: 'recovering', hoursSince }
  return { level: 'fresh', hoursSince }
}

const useMuscleStatus = (muscle: MuscleGroup, completions: RoutineCompletion[]) => {
  const { level } = useMemo(() => getFreshness(muscle, completions), [muscle, completions])
  const color = getFreshnessColor(level)
  const [hovered, setHovered] = useState(false)
  return { color, hovered, setHovered }
}

// --- 3D Components ---

const mul3 = (v: [number, number, number], s: number): [number, number, number] => [v[0] * s, v[1] * s, v[2] * s]

type MuscleDecalProps = {
  muscle: MuscleGroup
  completions: RoutineCompletion[]
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  labelOffset?: [number, number, number]
  mask?: AtlasMaskKind
  flipX?: boolean
}

const MuscleDecal = ({ muscle, completions, position, rotation, scale, labelOffset = [0, 0.1, 0], mask = 'roundedRect', flipX = false }: MuscleDecalProps) => {
  const { color, hovered, setHovered } = useMuscleStatus(muscle, completions)
  const onOver = (e: any) => { e.stopPropagation(); setHovered(true) }
  const onOut = (e: any) => { e.stopPropagation(); setHovered(false) }
  const alphaMap = getAtlasMask(mask)

  // Flip texture if needed (for symmetric muscles like pecs)
  const finalScale = flipX ? [-scale[0], scale[1], scale[2]] as [number, number, number] : scale

  return (
    <>
      <Decal position={position} rotation={rotation} scale={mul3(finalScale, 1.05)} onPointerOver={onOver} onPointerOut={onOut}>
        <meshBasicMaterial
          color="#111111"
          transparent
          opacity={0.4}
          depthWrite={false}
          depthTest
          alphaMap={alphaMap}
          alphaTest={0.1}
          side={THREE.FrontSide}
          polygonOffset
          polygonOffsetFactor={-4}
        />
      </Decal>
      <Decal position={position} rotation={rotation} scale={finalScale} onPointerOver={onOver} onPointerOut={onOut}>
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.9} // Slight transparency to blend better
          roughness={0.9} // Matte
          metalness={0.1}
          emissive={hovered ? new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.2) : color}
          emissiveIntensity={hovered ? 0.3 : 0.15} // Reduced bloom
          depthWrite={false}
          depthTest
          alphaMap={alphaMap}
          alphaTest={0.2}
          side={THREE.FrontSide}
          polygonOffset
          polygonOffsetFactor={-5}
        />
      </Decal>
      {hovered && (
        <Html position={[position[0] + labelOffset[0], position[1] + labelOffset[1], position[2] + labelOffset[2]]} distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(0,0,0,0.9)', padding: '6px 10px', borderRadius: 6,
            color: 'white', fontSize: 14, fontWeight: 'bold', whiteSpace: 'nowrap',
            border: '1px solid #444', transform: 'translate3d(-50%, -100%, 0)', marginTop: -10, zIndex: 100
          }}>
            {muscle}
          </div>
        </Html>
      )}
    </>
  )
}

const HumanModel = ({ completions }: { completions: RoutineCompletion[] }) => {
  const geo = useMemo(() => ({
    upperArm: new THREE.CapsuleGeometry(0.055, 0.19, 16, 48),
    forearmCone: new THREE.CylinderGeometry(0.048, 0.032, 0.22, 24),
    elbowCap: new THREE.SphereGeometry(0.048, 24, 16),
    wristCap: new THREE.SphereGeometry(0.032, 24, 16),
    thigh: new THREE.CapsuleGeometry(0.075, 0.28, 16, 56),
    calf: new THREE.CapsuleGeometry(0.06, 0.22, 16, 56),
    torso: new THREE.CapsuleGeometry(0.158, 0.60, 22, 72),
  }), [])

  // COORDINATE SYSTEM AUDIT (v3.4)
  // Standard Height: ~1.75m
  // HEAD: Top at 1.83m, Center at 1.72m
  // NECK: Connection ~1.60m
  // SHOULDERS: Clavicle height ~1.52m
  // TORSO: Center 1.12m, Top 1.56m, Bottom 0.68m
  // ARMS: Shoulder Joint at 1.50m
  // HIPS: Center 0.86m (overlap torso bottom)
  // LEGS: Hip Joint 0.80m, Knee 0.45m, Ankle 0.08m

  return (
    <group position={[0, -0.9, 0]}>
        {/* --- HEAD --- */}
        <group position={[0, 1.72, 0]}>
           <Sphere args={[0.11, 40, 40]} position={[0, 0.085, -0.02]} scale={[1, 1.16, 1.12]}><meshStandardMaterial color="#333333" roughness={0.6} /></Sphere>
           <group position={[0, -0.15, -0.01]}>
               {/* Neck - slightly thicker base */}
               <Cylinder args={[0.06, 0.075, 0.15, 22]}><meshStandardMaterial color="#333333" roughness={0.6} /></Cylinder>
               {/* Traps Connection */}
               <Cylinder args={[0.015, 0.04, 0.12, 14]} position={[-0.04, -0.04, 0.02]} rotation={[0, 0, -0.4]}><meshStandardMaterial color="#333333" roughness={0.6} /></Cylinder>
               <Cylinder args={[0.015, 0.04, 0.12, 14]} position={[0.04, -0.04, 0.02]} rotation={[0, 0, 0.4]}><meshStandardMaterial color="#333333" roughness={0.6} /></Cylinder>
           </group>
        </group>

        {/* --- TORSO --- */}
        {/* Raised slightly to 1.12 to meet neck better */}
        <group position={[0, 1.12, 0]}>
            <mesh geometry={geo.torso} position={[0, 0.16, -0.025]} rotation={[0.02, 0, 0]} scale={[1.04, 1.0, 0.76]} castShadow receiveShadow>
              <meshStandardMaterial color="#333333" roughness={0.6} />
              
              // Shoulders - Moved UP to match 1.64m arms
              <MuscleDecal muscle="Shoulders" completions={completions} position={[-0.23, 0.42, -0.02]} rotation={[0, 0, 0.4]} scale={[0.16, 0.22, 0.25]} mask="capsule" />
              <MuscleDecal muscle="Shoulders" completions={completions} position={[0.23, 0.42, -0.02]} rotation={[0, 0, -0.4]} scale={[0.16, 0.22, 0.25]} mask="capsule" />

              {/* Chest (Pecs) - Moved UP with torso shift */}
              <MuscleDecal muscle="Chest" completions={completions} position={[-0.09, 0.22, 0.14]} rotation={[0.05, 0.1, 0.05]} scale={[0.22, 0.24, 0.2]} flipX={true} mask="pec" />
              <MuscleDecal muscle="Chest" completions={completions} position={[0.09, 0.22, 0.14]} rotation={[0.05, -0.1, -0.05]} scale={[0.22, 0.24, 0.2]} mask="pec" />

              {/* Abs - Shifted up */}
              {[0.10, 0.01, -0.08].map((y, i) => (
                <React.Fragment key={i}>
                  <MuscleDecal muscle="Core" completions={completions} position={[-0.04, y, 0.145]} rotation={[0, 0, 0]} scale={[0.065, 0.07, 0.1]} mask="roundedRect" />
                  <MuscleDecal muscle="Core" completions={completions} position={[0.04, y, 0.145]} rotation={[0, 0, 0]} scale={[0.065, 0.07, 0.1]} mask="roundedRect" />
                </React.Fragment>
              ))}
              
              {/* Obliques */}
              <MuscleDecal muscle="Core" completions={completions} position={[-0.14, -0.02, 0.06]} rotation={[0, 0.8, 0.1]} scale={[0.12, 0.32, 0.2]} mask="trapezoid" />
              <MuscleDecal muscle="Core" completions={completions} position={[0.14, -0.02, 0.06]} rotation={[0, -0.8, -0.1]} scale={[0.12, 0.32, 0.2]} mask="trapezoid" />

              {/* Traps - Upper Back Diamond */}
              <MuscleDecal muscle="Back" completions={completions} position={[0, 0.42, -0.14]} rotation={[0.1, Math.PI, 0]} scale={[0.34, 0.18, 0.2]} mask="kite" />
              
              {/* Lats */}
              <MuscleDecal muscle="Back" completions={completions} position={[-0.20, 0.15, -0.10]} rotation={[0, Math.PI + 0.3, 0]} scale={[0.20, 0.32, 0.2]} mask="trapezoid" />
              <MuscleDecal muscle="Back" completions={completions} position={[0.20, 0.15, -0.10]} rotation={[0, Math.PI - 0.3, 0]} scale={[0.20, 0.32, 0.2]} mask="trapezoid" />

              {/* Lower Back */}
              <MuscleDecal muscle="Back" completions={completions} position={[0, -0.08, -0.13]} rotation={[0, Math.PI, 0]} scale={[0.18, 0.22, 0.2]} mask="kite" />
            </mesh>
        </group>

        {/* --- HIPS --- */}
        {/* Raised to meet Torso (0.82 -> 0.86) */}
        <group position={[0, 0.86, 0]}>
           <RoundedBox args={[0.3, 0.13, 0.19]} radius={0.06} smoothness={10} position={[0, 0.055, 0]} castShadow receiveShadow>
              <meshStandardMaterial color="#333333" roughness={0.6} />
              {/* Glutes */}
              <MuscleDecal muscle="Glutes" completions={completions} position={[-0.09, 0.01, -0.12]} rotation={[0, Math.PI, -0.1]} scale={[0.16, 0.20, 0.2]} mask="trapezoid" />
              <MuscleDecal muscle="Glutes" completions={completions} position={[0.09, 0.01, -0.12]} rotation={[0, Math.PI, 0.1]} scale={[0.16, 0.20, 0.2]} mask="trapezoid" />
           </RoundedBox>
        </group>

        {/* --- ARMS --- */}
        {/* RAISED from 1.50 to 1.58 for proper shoulder alignment */}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.19, 1.71, 0.02]}>
              <group position={[side * 0.06, -0.22, 0]}>
                  {/* Upper Arm */}
                  <mesh geometry={geo.upperArm} position={[0, -0.02, 0]} rotation={[0, 0, side * 0.08]} castShadow receiveShadow>
                    <meshStandardMaterial color="#333333" roughness={0.6} />
                    <MuscleDecal muscle="Biceps" completions={completions} position={[0, 0.01, 0.06]} rotation={[0, 0, 0]} scale={[0.09, 0.24, 0.15]} mask="capsule" />
                    <MuscleDecal muscle="Triceps" completions={completions} position={[0, 0.01, -0.06]} rotation={[0, Math.PI, 0]} scale={[0.10, 0.26, 0.15]} mask="capsule" />
                  </mesh>
                  {/* Forearm - Realistic Tapered Shape */}
                  <group position={[0, -0.33, 0]} rotation={[0, 0, side * 0.06]}>
                     {/* Cone */}
                     <mesh geometry={geo.forearmCone} position={[0, 0.0, 0]} castShadow receiveShadow>
                       <meshStandardMaterial color="#333333" roughness={0.6} />
                       
                       {/* Brachioradialis (Top-Outer) - The "Popeye" muscle */}
                       <MuscleDecal muscle="Biceps" completions={completions} position={[side * 0.025, 0.04, 0.0]} rotation={[0, 0, side * -0.2]} scale={[0.08, 0.16, 0.15]} mask="capsule" />
                       
                       {/* Flexors (Inner Belly) */}
                       <MuscleDecal muscle="Biceps" completions={completions} position={[side * -0.015, -0.02, 0.035]} rotation={[0, side * 0.5, 0]} scale={[0.07, 0.14, 0.12]} mask="capsule" />

                       {/* Extensors (Outer-Back) - Mapped to Triceps for posterior chain visual */}
                       <MuscleDecal muscle="Triceps" completions={completions} position={[side * 0.02, -0.02, -0.03]} rotation={[0, side * 2.5, 0]} scale={[0.06, 0.16, 0.12]} mask="capsule" />
                     </mesh>
                     
                     {/* Elbow Cap */}
                     <mesh geometry={geo.elbowCap} position={[0, 0.11, 0]} castShadow receiveShadow>
                        <meshStandardMaterial color="#333333" roughness={0.6} />
                     </mesh>

                     {/* Wrist Cap */}
                     <mesh geometry={geo.wristCap} position={[0, -0.11, 0]} castShadow receiveShadow>
                        <meshStandardMaterial color="#333333" roughness={0.6} />
                     </mesh>

                     {/* Hand Block */}
                     <RoundedBox args={[0.07, 0.09, 0.04]} radius={0.02} smoothness={10} position={[0, -0.16, 0]} castShadow receiveShadow>
                        <meshStandardMaterial color="#333333" roughness={0.6} />
                     </RoundedBox>
                  </group>
              </group>
          </group>
        ))}

        {/* --- LEGS --- */}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.17, 0.92, 0]}> {/* Raised from 0.68 to 0.72 */}
              {/* Thigh */}
              <group position={[0, -0.25, 0]}>
                  <mesh geometry={geo.thigh} position={[0, -0.04, 0]} rotation={[0, 0, side * 0.03]} castShadow receiveShadow>
                    <meshStandardMaterial color="#333333" roughness={0.6} />
                    
                    {/* Quad Center (Rectus Femoris) - Thinner */}
                    <MuscleDecal muscle="Quads" completions={completions} position={[0, 0.02, 0.10]} rotation={[0, 0, 0]} scale={[0.09, 0.38, 0.2]} mask="capsule" />
                    {/* Quad Outer (Vastus Lateralis) - Large Sweep */}
                    <MuscleDecal muscle="Quads" completions={completions} position={[side * 0.08, 0.06, 0.05]} rotation={[0, side * 0.6, 0]} scale={[0.12, 0.34, 0.2]} mask="trapezoid" />
                    {/* Quad Inner (Vastus Medialis) - Higher Teardrop */}
                    <MuscleDecal muscle="Quads" completions={completions} position={[side * -0.05, -0.10, 0.08]} rotation={[0, side * -0.3, 0]} scale={[0.09, 0.14, 0.1]} mask="teardrop" />

                    {/* Hamstrings */}
                    <MuscleDecal muscle="Hamstrings" completions={completions} position={[0, 0.0, -0.10]} rotation={[0, Math.PI, 0]} scale={[0.16, 0.35, 0.2]} mask="capsule" />
                  </mesh>
              </group>

              <RoundedBox args={[0.11, 0.11, 0.11]} radius={0.04} smoothness={10} position={[0, -0.52, 0.02]} castShadow receiveShadow>
                  <meshStandardMaterial color="#333333" roughness={0.6} />
              </RoundedBox>

              {/* Lower Leg */}
              <group position={[0, -0.85, 0]}>
                  <mesh geometry={geo.calf} position={[0, 0.02, -0.01]} rotation={[0.04, 0, side * 0.03]} castShadow receiveShadow>
                    <meshStandardMaterial color="#333333" roughness={0.6} />
                    <MuscleDecal muscle="Calves" completions={completions} position={[side * 0.03, 0.08, -0.07]} rotation={[0, Math.PI, 0]} scale={[0.07, 0.18, 0.1]} mask="capsule" />
                    <MuscleDecal muscle="Calves" completions={completions} position={[side * -0.03, 0.08, -0.07]} rotation={[0, Math.PI, 0]} scale={[0.07, 0.18, 0.1]} mask="capsule" />
                  </mesh>
                  <RoundedBox args={[0.1, 0.06, 0.24]} radius={0.02} smoothness={10} position={[0, -0.28, 0.08]} castShadow receiveShadow>
                      <meshStandardMaterial color="#333333" roughness={0.6} />
                  </RoundedBox>
              </group>
          </group>
        ))}
    </group>
  )
}

const MuscleSuggestions = ({ completions }: { completions: RoutineCompletion[] }) => {
  const freshMuscles: string[] = []
  const muscleGroups: MuscleGroup[] = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core']

  for (const muscle of muscleGroups) {
    const { level } = getFreshness(muscle, completions)
    if (level === 'fresh') {
      freshMuscles.push(muscle)
    }
  }

  return (
    <div style={{
      position: 'absolute',
      top: 20,
      right: 20,
      background: 'rgba(0,0,0,0.8)',
      padding: 20,
      borderRadius: 12,
      border: '1px solid #333',
      color: 'white',
      maxWidth: 250,
      maxHeight: 'calc(100% - 40px)',
      overflowY: 'auto'
    }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: 18, borderBottom: '1px solid #444', paddingBottom: 8 }}>Recovery Status</h3>
      
      <div style={{ display: 'grid', gap: 8, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#4ade80' }}></div>
          <span style={{ fontSize: 14 }}>Fresh (Ready)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#facc15' }}></div>
          <span style={{ fontSize: 14 }}>Recovering</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fb923c' }}></div>
          <span style={{ fontSize: 14 }}>Fatigued</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }}></div>
          <span style={{ fontSize: 14 }}>Very Fatigued</span>
        </div>
      </div>

      <h4 style={{ margin: '0 0 8px 0', fontSize: 16, color: '#4ade80' }}>Fresh Muscles</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {freshMuscles.length > 0 ? (
          freshMuscles.map(m => (
            <span key={m} style={{ 
              fontSize: 12, 
              background: 'rgba(74, 222, 128, 0.15)', 
              color: '#4ade80', 
              padding: '4px 8px', 
              borderRadius: 4,
              border: '1px solid rgba(74, 222, 128, 0.3)'
            }}>
              {m}
            </span>
          ))
        ) : (
          <span style={{ fontSize: 14, color: '#888', fontStyle: 'italic' }}>No fully fresh muscles yet!</span>
        )}
      </div>
    </div>
  )
}

export const MuscleHeatmap = ({ completions }: { completions: RoutineCompletion[] }) => {
  return (
    <div style={{ 
      width: '100%', 
      height: 600, 
      position: 'relative', 
      background: '#1a1a1a', 
      borderRadius: 16, 
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      border: '1px solid #333'
    }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          const r = gl as unknown as Record<string, unknown>
          if ('physicallyCorrectLights' in r) (r as any).physicallyCorrectLights = true
          if ('toneMapping' in r) (r as any).toneMapping = THREE.ACESFilmicToneMapping
          if ('toneMappingExposure' in r) (r as any).toneMappingExposure = 1.15
          if ('outputColorSpace' in r) (r as any).outputColorSpace = THREE.SRGBColorSpace
        }}
        camera={{ position: [0, 0.85, 3.2], fov: 42, near: 0.1, far: 30 }}
      >
        <color attach="background" args={['#1a1a1a']} />
        
        <ambientLight intensity={0.28} />
        <directionalLight
          position={[3.5, 4.5, 3.0]}
          intensity={2.0}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={20}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={4}
          shadow-camera-bottom={-4}
        />
        <directionalLight position={[-3.0, 2.0, 2.0]} intensity={0.7} color="#b7d7ff" />
        <directionalLight position={[0.0, 2.5, -3.5]} intensity={0.55} color="#ffd1b8" />
        <Environment preset="studio" />

        <HumanModel completions={completions} />

        <ContactShadows
          position={[0, -0.92, 0]}
          opacity={0.5}
          blur={2.4}
          far={2.0}
          resolution={512}
          color="#000000"
        />
        
        <OrbitControls 
          enablePan={false} 
          minPolarAngle={Math.PI / 4} 
          maxPolarAngle={Math.PI / 1.8}
          minDistance={2}
          maxDistance={6}
          target={[0, 0.75, 0]}
        />
      </Canvas>
      
      <MuscleSuggestions completions={completions} />
      
      <div style={{ 
        position: 'absolute', 
        bottom: 20, 
        left: 20, 
        color: '#666', 
        fontSize: 12,
        pointerEvents: 'none'
      }}>
        Rotate to view • Hover for details • {VERSION_LABEL}
      </div>
    </div>
  )
}
