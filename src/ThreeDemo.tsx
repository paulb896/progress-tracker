import React from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'

const SpinningBox = () => {
  const meshRef = React.useRef<Mesh | null>(null)

  useFrame((_state, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    mesh.rotation.x += delta * 0.6
    mesh.rotation.y += delta * 0.8
  })

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#f97316" roughness={0.4} metalness={0.1} />
    </mesh>
  )
}

export const ThreeDemo = () => {
  return (
    <Canvas camera={{ position: [0, 0, 3], fov: 50 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 2, 2]} intensity={1.2} />
      <SpinningBox />
    </Canvas>
  )
}
