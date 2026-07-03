import React, { useMemo, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Html, Environment, ContactShadows, Decal } from '@react-three/drei'
import * as THREE from 'three'
import type { RoutineCompletion } from '../completions/types'
import { EXERCISE_PRESETS, type MuscleGroup } from '../exercises/presets'

const VERSION_LABEL = "v4.0"

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

// --- Procedural geometry helpers ---

/** Create a LatheGeometry from a profile of [radius, height] pairs. 
 *  Optionally scale X/Z independently for non-circular cross-sections. */
const createLatheBodyPart = (
  profile: [number, number][],
  segments: number = 48,
  scaleX: number = 1,
  scaleZ: number = 1
): THREE.LatheGeometry => {
  const points = profile.map(([r, y]) => new THREE.Vector2(r, y))
  const geo = new THREE.LatheGeometry(points, segments)
  // Apply non-uniform scale baked into vertices for elliptical cross-section
  if (scaleX !== 1 || scaleZ !== 1) {
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const angle = Math.atan2(z, x)
      const r = Math.sqrt(x * x + z * z)
      pos.setX(i, Math.cos(angle) * r * scaleX)
      pos.setZ(i, Math.sin(angle) * r * scaleZ)
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
  }
  return geo
}

const BODY_MAT_PROPS = { color: '#2a2a2a', roughness: 0.55, metalness: 0.05 } as const

const HumanModel = ({ completions }: { completions: RoutineCompletion[] }) => {
  const geo = useMemo(() => {
    // --- TORSO: Sculpted ribcage → waist → hip profile ---
    // Profile: [radius, height] from bottom (pelvis) to top (collar)
    const torsoProfile: [number, number][] = [
      [0.00, -0.42],  // Bottom point (crotch closure)
      [0.10, -0.40],  // Lower pelvis
      [0.145, -0.34], // Hip widest
      [0.14, -0.28],  // Hip
      [0.125, -0.20], // Upper hip / iliac crest
      [0.105, -0.12], // Waist narrowest
      [0.110, -0.04], // Lower ribs start
      [0.125, 0.04],  // Ribs expanding
      [0.145, 0.12],  // Mid ribcage
      [0.155, 0.20],  // Upper chest widest (nipple line)
      [0.150, 0.28],  // Upper chest
      [0.135, 0.34],  // Clavicle area
      [0.10, 0.38],   // Shoulder base narrowing
      [0.065, 0.42],  // Neck base
      [0.00, 0.44],   // Top closure
    ]
    const torso = createLatheBodyPart(torsoProfile, 64, 1.0, 0.72)

    // --- PELVIS / HIPS: Wider, flatter shape ---
    const pelvisProfile: [number, number][] = [
      [0.00, -0.10],
      [0.13, -0.08],
      [0.155, -0.04],
      [0.16, 0.00],
      [0.155, 0.04],
      [0.13, 0.07],
      [0.00, 0.09],
    ]
    const pelvis = createLatheBodyPart(pelvisProfile, 48, 1.0, 0.78)

    // --- HEAD: Clean smooth mannequin head ---
    const headProfile: [number, number][] = [
      [0.00, -0.09],  // Chin
      [0.040, -0.075],
      [0.065, -0.05],
      [0.082, -0.02],
      [0.092, 0.01],
      [0.096, 0.04],
      [0.098, 0.07],  // Widest
      [0.096, 0.10],
      [0.090, 0.13],
      [0.080, 0.16],
      [0.065, 0.185],
      [0.042, 0.205],
      [0.00, 0.215],  // Top
    ]
    // Slightly narrower side-to-side, slightly deeper front-to-back
    const head = createLatheBodyPart(headProfile, 48, 0.86, 1.0)

    // --- NECK: Anatomical cylinder with SCM taper ---
    const neckProfile: [number, number][] = [
      [0.00, -0.08],
      [0.052, -0.07],
      [0.055, -0.04],
      [0.050, 0.00],
      [0.046, 0.04],
      [0.043, 0.07],
      [0.00, 0.08],
    ]
    const neck = createLatheBodyPart(neckProfile, 32, 1.0, 0.88)

    // --- UPPER ARM: Subtle muscle belly ---
    const upperArmProfile: [number, number][] = [
      [0.00, -0.155],
      [0.042, -0.14],
      [0.052, -0.10],
      [0.058, -0.04], // Belly of bicep/tricep
      [0.060, 0.00],  // Thickest at mid
      [0.058, 0.04],
      [0.053, 0.08],
      [0.048, 0.12],  // Deltoid insertion taper
      [0.044, 0.14],
      [0.00, 0.155],
    ]
    const upperArm = createLatheBodyPart(upperArmProfile, 32, 1.0, 0.92)

    // --- FOREARM: Tapered with brachioradialis bulge ---
    const forearmProfile: [number, number][] = [
      [0.00, -0.135],
      [0.028, -0.12],  // Wrist
      [0.032, -0.08],
      [0.036, -0.04],
      [0.041, 0.00],
      [0.047, 0.04],   // Brachioradialis belly
      [0.050, 0.08],   // Near elbow - thickest
      [0.048, 0.10],
      [0.044, 0.12],
      [0.00, 0.135],
    ]
    const forearm = createLatheBodyPart(forearmProfile, 28, 1.0, 0.88)

    // --- HAND: Simplified anatomical ---
    const hand = new THREE.BoxGeometry(0.06, 0.10, 0.03, 4, 4, 2)
    // Round the hand vertices slightly
    const handPos = hand.attributes.position
    for (let i = 0; i < handPos.count; i++) {
      const x = handPos.getX(i)
      const y = handPos.getY(i)
      const z = handPos.getZ(i)
      // Taper toward fingers (top)
      const taper = y > 0 ? 1.0 - y * 0.6 : 1.0
      handPos.setX(i, x * taper)
      handPos.setZ(i, z * taper)
      // Round palm curvature
      if (z > 0) handPos.setZ(i, z * 0.8)
    }
    handPos.needsUpdate = true
    hand.computeVertexNormals()

    // --- THIGH: Anatomical quad/hamstring taper ---
    const thighProfile: [number, number][] = [
      [0.00, -0.23],
      [0.052, -0.21],  // Above knee - narrower
      [0.062, -0.16],
      [0.072, -0.10],
      [0.080, -0.04],  // Mid thigh - thick
      [0.084, 0.02],   // Upper thigh - thickest
      [0.082, 0.08],
      [0.076, 0.14],
      [0.065, 0.19],   // Gluteal fold
      [0.050, 0.22],
      [0.00, 0.24],
    ]
    const thigh = createLatheBodyPart(thighProfile, 40, 1.0, 0.88)

    // --- KNEE: Bony joint ---
    const kneeProfile: [number, number][] = [
      [0.00, -0.045],
      [0.050, -0.04],
      [0.056, -0.02],
      [0.058, 0.00],   // Widest - patella
      [0.056, 0.02],
      [0.050, 0.04],
      [0.00, 0.045],
    ]
    const knee = createLatheBodyPart(kneeProfile, 32, 1.0, 0.82)

    // --- CALF: Gastrocnemius bulge ---
    const calfProfile: [number, number][] = [
      [0.00, -0.19],
      [0.032, -0.17],  // Ankle
      [0.035, -0.14],
      [0.036, -0.10],  // Lower calf
      [0.040, -0.04],
      [0.050, 0.02],   // Gastrocnemius belly
      [0.055, 0.06],   // Peak calf
      [0.052, 0.10],
      [0.046, 0.14],   // Below knee
      [0.042, 0.17],
      [0.00, 0.19],
    ]
    const calf = createLatheBodyPart(calfProfile, 32, 1.0, 0.85)

    // --- FOOT: Block with anatomical taper ---
    const foot = new THREE.BoxGeometry(0.08, 0.05, 0.22, 4, 2, 6)
    const footPos = foot.attributes.position
    for (let i = 0; i < footPos.count; i++) {
      const z = footPos.getZ(i)
      const y = footPos.getY(i)
      // Taper toward toes
      if (z > 0.05) {
        const t = (z - 0.05) / 0.06
        footPos.setX(i, footPos.getX(i) * (1.0 - t * 0.3))
        footPos.setY(i, y * (1.0 - t * 0.3))
      }
      // Arch on bottom
      if (y < -0.01) {
        const arch = Math.sin((z + 0.11) / 0.22 * Math.PI) * 0.012
        footPos.setY(i, y + arch)
      }
    }
    footPos.needsUpdate = true
    foot.computeVertexNormals()

    // --- SHOULDER CAP (Deltoid) ---
    const shoulderProfile: [number, number][] = [
      [0.00, -0.06],
      [0.055, -0.05],
      [0.072, -0.02],
      [0.076, 0.01],   // Widest - lateral deltoid
      [0.070, 0.04],
      [0.055, 0.06],
      [0.00, 0.07],
    ]
    const shoulder = createLatheBodyPart(shoulderProfile, 28, 1.1, 0.9)

    return {
      torso, pelvis, head, neck,
      upperArm, forearm, hand,
      shoulder,
      thigh, knee, calf, foot,
    }
  }, [])

  // COORDINATE SYSTEM (v4.0 - 8-head proportions)
  // Total height: ~1.78m, centered at ground
  // HEAD top: 1.78m, center 1.68m
  // NECK: 1.52-1.60m
  // SHOULDERS: 1.52m
  // TORSO: 0.86-1.52m (center ~1.19m)
  // PELVIS: 0.80-0.96m
  // HIP JOINT: 0.86m
  // KNEE: 0.46m
  // ANKLE: 0.08m
  // GROUND: 0.0m

  return (
    <group position={[0, -0.90, 0]}>
        {/* --- HEAD --- */}
        <group position={[0, 1.68, 0]}>
          <mesh geometry={geo.head} castShadow receiveShadow>
            <meshStandardMaterial {...BODY_MAT_PROPS} />
          </mesh>
        </group>

        {/* --- NECK --- */}
        <group position={[0, 1.55, 0.005]}>
          <mesh geometry={geo.neck} castShadow receiveShadow>
            <meshStandardMaterial {...BODY_MAT_PROPS} />
          </mesh>
        </group>

        {/* --- TORSO --- */}
        <group position={[0, 1.19, 0]}>
          <mesh geometry={geo.torso} position={[0, 0, -0.015]} rotation={[0.015, 0, 0]} castShadow receiveShadow>
            <meshStandardMaterial {...BODY_MAT_PROPS} />

            {/* Shoulders - Decals on torso */}
            <MuscleDecal muscle="Shoulders" completions={completions} position={[-0.22, 0.32, -0.02]} rotation={[0, 0, 0.35]} scale={[0.14, 0.16, 0.22]} mask="capsule" />
            <MuscleDecal muscle="Shoulders" completions={completions} position={[0.22, 0.32, -0.02]} rotation={[0, 0, -0.35]} scale={[0.14, 0.16, 0.22]} mask="capsule" />

            {/* Chest (Pecs) */}
            <MuscleDecal muscle="Chest" completions={completions} position={[-0.08, 0.18, 0.12]} rotation={[0.05, 0.08, 0.03]} scale={[0.18, 0.18, 0.18]} flipX={true} mask="pec" />
            <MuscleDecal muscle="Chest" completions={completions} position={[0.08, 0.18, 0.12]} rotation={[0.05, -0.08, -0.03]} scale={[0.18, 0.18, 0.18]} mask="pec" />

            {/* Abs - 3 rows of 2 */}
            {[0.04, -0.04, -0.12].map((y, i) => (
              <React.Fragment key={i}>
                <MuscleDecal muscle="Core" completions={completions} position={[-0.035, y, 0.115]} rotation={[0, 0, 0]} scale={[0.055, 0.06, 0.08]} mask="roundedRect" />
                <MuscleDecal muscle="Core" completions={completions} position={[0.035, y, 0.115]} rotation={[0, 0, 0]} scale={[0.055, 0.06, 0.08]} mask="roundedRect" />
              </React.Fragment>
            ))}

            {/* Obliques */}
            <MuscleDecal muscle="Core" completions={completions} position={[-0.12, -0.06, 0.05]} rotation={[0, 0.7, 0.08]} scale={[0.10, 0.26, 0.16]} mask="trapezoid" />
            <MuscleDecal muscle="Core" completions={completions} position={[0.12, -0.06, 0.05]} rotation={[0, -0.7, -0.08]} scale={[0.10, 0.26, 0.16]} mask="trapezoid" />

            {/* Traps */}
            <MuscleDecal muscle="Back" completions={completions} position={[0, 0.36, -0.11]} rotation={[0.1, Math.PI, 0]} scale={[0.28, 0.14, 0.16]} mask="kite" />

            {/* Lats */}
            <MuscleDecal muscle="Back" completions={completions} position={[-0.18, 0.10, -0.08]} rotation={[0, Math.PI + 0.3, 0]} scale={[0.16, 0.28, 0.16]} mask="trapezoid" />
            <MuscleDecal muscle="Back" completions={completions} position={[0.18, 0.10, -0.08]} rotation={[0, Math.PI - 0.3, 0]} scale={[0.16, 0.28, 0.16]} mask="trapezoid" />

            {/* Lower Back / Erectors */}
            <MuscleDecal muscle="Back" completions={completions} position={[0, -0.10, -0.10]} rotation={[0, Math.PI, 0]} scale={[0.16, 0.20, 0.16]} mask="kite" />
          </mesh>
        </group>

        {/* --- PELVIS --- */}
        <group position={[0, 0.86, 0.005]}>
          <mesh geometry={geo.pelvis} castShadow receiveShadow>
            <meshStandardMaterial {...BODY_MAT_PROPS} />
            {/* Glutes */}
            <MuscleDecal muscle="Glutes" completions={completions} position={[-0.07, 0.01, -0.10]} rotation={[0, Math.PI, -0.08]} scale={[0.14, 0.16, 0.16]} mask="capsule" />
            <MuscleDecal muscle="Glutes" completions={completions} position={[0.07, 0.01, -0.10]} rotation={[0, Math.PI, 0.08]} scale={[0.14, 0.16, 0.16]} mask="capsule" />
          </mesh>
        </group>

        {/* --- SHOULDER CAPS (Deltoids) --- */}
        {[-1, 1].map((side) => (
          <group key={`shoulder-${side}`} position={[side * 0.185, 1.50, -0.005]}>
            <mesh geometry={geo.shoulder} rotation={[0, 0, side * 0.15]} castShadow receiveShadow>
              <meshStandardMaterial {...BODY_MAT_PROPS} />
              <MuscleDecal muscle="Shoulders" completions={completions} position={[side * 0.04, 0.01, 0.04]} rotation={[0, side * 0.4, 0]} scale={[0.12, 0.12, 0.14]} mask="capsule" />
            </mesh>
          </group>
        ))}

        {/* --- ARMS --- */}
        {[-1, 1].map((side) => (
          <group key={`arm-${side}`} position={[side * 0.235, 1.48, -0.005]}>
            {/* Upper Arm */}
            <group position={[side * 0.02, -0.18, 0]} rotation={[0, 0, side * 0.04]}>
              <mesh geometry={geo.upperArm} castShadow receiveShadow>
                <meshStandardMaterial {...BODY_MAT_PROPS} />
                <MuscleDecal muscle="Biceps" completions={completions} position={[0, 0.0, 0.055]} rotation={[0, 0, 0]} scale={[0.08, 0.22, 0.12]} mask="capsule" />
                <MuscleDecal muscle="Triceps" completions={completions} position={[0, 0.01, -0.055]} rotation={[0, Math.PI, 0]} scale={[0.09, 0.24, 0.12]} mask="capsule" />
              </mesh>

              {/* Forearm */}
              <group position={[0, -0.33, 0]} rotation={[0, 0, side * 0.03]}>
                <mesh geometry={geo.forearm} castShadow receiveShadow>
                  <meshStandardMaterial {...BODY_MAT_PROPS} />
                </mesh>

                {/* Hand */}
                <mesh geometry={geo.hand} position={[0, -0.19, 0]} castShadow receiveShadow>
                  <meshStandardMaterial {...BODY_MAT_PROPS} />
                </mesh>
              </group>
            </group>
          </group>
        ))}

        {/* --- LEGS --- */}
        {[-1, 1].map((side) => (
          <group key={`leg-${side}`} position={[side * 0.10, 0.86, 0]}>
            {/* Thigh */}
            <group position={[0, -0.26, 0]}>
              <mesh geometry={geo.thigh} rotation={[0, 0, side * 0.02]} castShadow receiveShadow>
                <meshStandardMaterial {...BODY_MAT_PROPS} />
                {/* Rectus Femoris */}
                <MuscleDecal muscle="Quads" completions={completions} position={[0, 0.02, 0.08]} rotation={[0, 0, 0]} scale={[0.08, 0.34, 0.16]} mask="capsule" />
                {/* Vastus Lateralis */}
                <MuscleDecal muscle="Quads" completions={completions} position={[side * 0.07, 0.04, 0.04]} rotation={[0, side * 0.5, 0]} scale={[0.10, 0.30, 0.16]} mask="trapezoid" />
                {/* Vastus Medialis */}
                <MuscleDecal muscle="Quads" completions={completions} position={[side * -0.04, -0.10, 0.07]} rotation={[0, side * -0.25, 0]} scale={[0.07, 0.12, 0.10]} mask="teardrop" />
                {/* Hamstrings */}
                <MuscleDecal muscle="Hamstrings" completions={completions} position={[0, 0.0, -0.08]} rotation={[0, Math.PI, 0]} scale={[0.14, 0.32, 0.16]} mask="capsule" />
              </mesh>
            </group>

            {/* Knee */}
            <group position={[0, -0.52, 0.01]}>
              <mesh geometry={geo.knee} castShadow receiveShadow>
                <meshStandardMaterial {...BODY_MAT_PROPS} />
              </mesh>
            </group>

            {/* Calf */}
            <group position={[0, -0.74, -0.005]}>
              <mesh geometry={geo.calf} rotation={[0.03, 0, side * 0.02]} castShadow receiveShadow>
                <meshStandardMaterial {...BODY_MAT_PROPS} />
                <MuscleDecal muscle="Calves" completions={completions} position={[side * 0.02, 0.06, -0.055]} rotation={[0, Math.PI, 0]} scale={[0.06, 0.16, 0.08]} mask="capsule" />
                <MuscleDecal muscle="Calves" completions={completions} position={[side * -0.02, 0.06, -0.055]} rotation={[0, Math.PI, 0]} scale={[0.06, 0.16, 0.08]} mask="capsule" />
              </mesh>
            </group>

            {/* Foot */}
            <group position={[0, -0.94, 0.04]}>
              <mesh geometry={geo.foot} castShadow receiveShadow>
                <meshStandardMaterial {...BODY_MAT_PROPS} />
              </mesh>
            </group>
          </group>
        ))}
    </group>
  )
}

const MuscleSuggestions = ({ completions }: { completions: RoutineCompletion[] }) => {
  const [expanded, setExpanded] = useState(false)
  const freshMuscles: string[] = []
  const muscleGroups: MuscleGroup[] = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core']

  for (const muscle of muscleGroups) {
    const { level } = getFreshness(muscle, completions)
    if (level === 'fresh') {
      freshMuscles.push(muscle)
    }
  }

  // Collapsed: just a small legend strip at the bottom
  if (!expanded) {
    return (
      <div
        onClick={() => setExpanded(true)}
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          background: 'var(--surface-glass)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid var(--border-2)',
          color: 'var(--text)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', gap: 4 }}>
          {['#4ade80', '#facc15', '#fb923c', '#ef4444'].map(c => (
            <div key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
          ))}
        </div>
        <span style={{ opacity: 0.7 }}>Recovery ▸</span>
      </div>
    )
  }

  return (
    <div style={{
      position: 'absolute',
      top: 12,
      right: 12,
      background: 'var(--surface-glass)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      padding: '14px 16px',
      borderRadius: 10,
      border: '1px solid var(--border-2)',
      color: 'var(--text)',
      maxWidth: 220,
      maxHeight: 'calc(100% - 24px)',
      overflowY: 'auto',
      zIndex: 10,
      boxShadow: 'var(--shadow-lg)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15, borderBottom: 'none', paddingBottom: 0 }}>Recovery Status</h3>
        <button
          onClick={() => setExpanded(false)}
          style={{
            background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer',
            fontSize: 18, lineHeight: 1, padding: '0 2px',
          }}
        >×</button>
      </div>
      
      <div style={{ display: 'grid', gap: 5, marginBottom: 14 }}>
        {([['#4ade80', 'Fresh'], ['#facc15', 'Recovering'], ['#fb923c', 'Fatigued'], ['#ef4444', 'Very Fatigued']] as const).map(([c, label]) => (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: c, flexShrink: 0 }} />
            <span style={{ fontSize: 12 }}>{label}</span>
          </div>
        ))}
      </div>

      <h4 style={{ margin: '0 0 6px 0', fontSize: 13, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>Fresh Muscles</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {freshMuscles.length > 0 ? (
          freshMuscles.map(m => (
            <span key={m} style={{ 
              fontSize: 10, 
              fontWeight: 700,
              background: 'color-mix(in srgb, var(--accent) 12%, transparent)', 
              color: 'var(--accent)', 
              padding: '4px 8px', 
              borderRadius: 6,
              border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
              textTransform: 'uppercase',
              letterSpacing: '0.02em'
            }}>
              {m}
            </span>
          ))
        ) : (
          <span style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>No fully fresh muscles yet!</span>
        )}
      </div>
    </div>
  )
}

export const MuscleHeatmap = ({ completions }: { completions: RoutineCompletion[] }) => {
  if (typeof navigator !== 'undefined' && navigator.webdriver) {
    return null
  }
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const attr = document.documentElement.getAttribute('data-theme')
    if (attr === 'light' || attr === 'dark') return attr
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          const val = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | null
          if (val === 'light' || val === 'dark') {
            setTheme(val)
          }
        }
      })
    })

    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [])

  return (
    <div style={{ 
      width: '100%', 
      height: 600, 
      position: 'relative', 
      background: 'var(--surface-sunken)', 
      borderRadius: 16, 
      overflow: 'hidden',
      boxShadow: 'var(--shadow)',
      border: '1px solid var(--border)'
    }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          const r = gl as unknown as Record<string, unknown>
          if ('physicallyCorrectLights' in r) (r as any).physicallyCorrectLights = true
          if ('toneMapping' in r) (r as any).toneMapping = THREE.ACESFilmicToneMapping
          if ('toneMappingExposure' in r) (r as any).toneMappingExposure = 1.15
          if ('outputColorSpace' in r) (r as any).outputColorSpace = THREE.SRGBColorSpace
        }}
        camera={{ position: [0, 0.25, 3.2], fov: 42, near: 0.1, far: 30 }}
      >
        <ambientLight intensity={theme === 'light' ? 0.6 : 0.30} />
        <directionalLight
          position={[3.5, 4.5, 3.0]}
          intensity={2.2}
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
        <directionalLight position={[-3.0, 2.0, 2.0]} intensity={0.8} color="#b7d7ff" />
        <directionalLight position={[0.0, 2.5, -3.5]} intensity={0.6} color="#ffd1b8" />
        {/* Rim light for edge definition */}
        <directionalLight position={[-2.0, 1.5, -2.5]} intensity={0.4} color="#8888ff" />
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
          target={[0, 0.15, 0]}
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
