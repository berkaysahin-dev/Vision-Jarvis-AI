import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';
import type { JarvisStatus } from '../hooks/useJarvis';

interface OrbProps {
  status: JarvisStatus;
  audioLevel: number;
}

const colors: Record<JarvisStatus, THREE.Color> = {
  idle: new THREE.Color('#2a2a35'),
  listening: new THREE.Color('#007aff'),
  processing: new THREE.Color('#34c759'),
  speaking: new THREE.Color('#ff9500'),
  error: new THREE.Color('#ff3b30'),
};

export function Orb({ status, audioLevel }: OrbProps) {
  const materialRef = useRef<any>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  const targetColor = colors[status] || colors.idle;

  useFrame((state, _delta) => {
    if (materialRef.current) {
      materialRef.current.color.lerp(targetColor, 0.1);
      
      // Dynamic distortion based on status and audio level
      let targetDistort = 0.3;
      let targetSpeed = 2;
      let scale = 1;

      if (status === 'listening') {
        targetDistort = 0.5 + audioLevel * 1.5;
        targetSpeed = 4 + audioLevel * 5;
        scale = 1 + audioLevel * 0.3;
      } else if (status === 'processing') {
        targetDistort = 0.8;
        targetSpeed = 8;
      } else if (status === 'speaking') {
        targetDistort = 0.4 + audioLevel * 0.8;
        targetSpeed = 3 + audioLevel * 4;
        scale = 1 + audioLevel * 0.2;
      } else if (status === 'error') {
        targetDistort = 0.1;
        targetSpeed = 10;
      }

      materialRef.current.distort = THREE.MathUtils.lerp(materialRef.current.distort, targetDistort, 0.1);
      materialRef.current.speed = THREE.MathUtils.lerp(materialRef.current.speed, targetSpeed, 0.1);
      
      if (meshRef.current) {
        meshRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);
        meshRef.current.rotation.y = state.clock.elapsedTime * 0.2;
        meshRef.current.rotation.z = state.clock.elapsedTime * 0.1;
      }
    }
  });

  return (
    <group>
      {/* Outer Glow / Volumetric Effect */}
      <Sphere args={[1.2, 64, 64]}>
        <meshBasicMaterial 
          color={targetColor} 
          transparent={true} 
          opacity={0.15} 
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </Sphere>

      {/* Main Energy Core */}
      <Sphere ref={meshRef} args={[1, 128, 128]}>
        <MeshDistortMaterial
          ref={materialRef}
          color={colors.idle}
          envMapIntensity={1}
          clearcoat={1}
          clearcoatRoughness={0.1}
          metalness={0.8}
          roughness={0.2}
          distort={0.3}
          speed={2}
          transparent={true}
          opacity={0.9}
        />
      </Sphere>

      {/* Inner Core Light */}
      <Sphere args={[0.7, 32, 32]}>
        <meshBasicMaterial 
          color="#ffffff" 
          transparent={true} 
          opacity={0.4} 
          blending={THREE.AdditiveBlending}
        />
      </Sphere>
    </group>
  );
}
