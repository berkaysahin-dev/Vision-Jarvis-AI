import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';
import type { JarvisStatus } from '../hooks/useJarvis';

interface OrbProps {
  status: JarvisStatus;
  audioLevel: number;
}

// Futuristic status color palette
const statusColors: Record<JarvisStatus, {
  primary: THREE.Color;
  secondary: THREE.Color;
  accent: THREE.Color;
  glow: THREE.Color;
}> = {
  idle: {
    primary: new THREE.Color('#1a1a2e'),
    secondary: new THREE.Color('#00f0ff'),
    accent: new THREE.Color('#4361ee'),
    glow: new THREE.Color('#0f3460'),
  },
  listening: {
    primary: new THREE.Color('#007aff'),
    secondary: new THREE.Color('#00f0ff'),
    accent: new THREE.Color('#5ac8fa'),
    glow: new THREE.Color('#0040dd'),
  },
  processing: {
    primary: new THREE.Color('#30d158'),
    secondary: new THREE.Color('#00ff88'),
    accent: new THREE.Color('#64d2ff'),
    glow: new THREE.Color('#1b5e20'),
  },
  speaking: {
    primary: new THREE.Color('#ff9500'),
    secondary: new THREE.Color('#ff2d55'),
    accent: new THREE.Color('#ffd60a'),
    glow: new THREE.Color('#ff3b30'),
  },
  error: {
    primary: new THREE.Color('#ff3b30'),
    secondary: new THREE.Color('#ff453a'),
    accent: new THREE.Color('#ff9f0a'),
    glow: new THREE.Color('#8b0000'),
  },
};

// 1. Concentric Gyroscope & FUI Rings with Orbiting Photon Satellites
function GyroscopeRings({ status, audioLevel }: { status: JarvisStatus; audioLevel: number }) {
  const ring1Ref = useRef<THREE.Group>(null);
  const ring2Ref = useRef<THREE.Group>(null);
  const ring3Ref = useRef<THREE.Group>(null);
  const satellite1Ref = useRef<THREE.Mesh>(null);
  const satellite2Ref = useRef<THREE.Mesh>(null);
  const satellite3Ref = useRef<THREE.Mesh>(null);

  const colors = statusColors[status] || statusColors.idle;

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const speedMult = status === 'listening' ? 1.8 + audioLevel * 3 : status === 'processing' ? 2.5 : status === 'speaking' ? 1.4 + audioLevel * 2 : 0.8;

    // Ring 1 (X-Y Gimbal Tilt)
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x += delta * 0.4 * speedMult;
      ring1Ref.current.rotation.y += delta * 0.6 * speedMult;
      ring1Ref.current.rotation.z = Math.sin(t * 0.5) * 0.2;
    }

    // Ring 2 (Counter-pitch & Roll)
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x -= delta * 0.5 * speedMult;
      ring2Ref.current.rotation.z += delta * 0.7 * speedMult;
      ring2Ref.current.rotation.y = Math.cos(t * 0.4) * 0.25;
    }

    // Ring 3 (Equatorial Horizon Spin)
    if (ring3Ref.current) {
      ring3Ref.current.rotation.z -= delta * 0.3 * speedMult;
      ring3Ref.current.rotation.x = Math.sin(t * 0.3) * 0.15;
    }

    // Satellite Beads Orbiting on the Rings
    if (satellite1Ref.current) {
      const angle = t * 1.5 * speedMult;
      satellite1Ref.current.position.set(Math.cos(angle) * 1.55, Math.sin(angle) * 1.55, 0);
    }
    if (satellite2Ref.current) {
      const angle = -t * 1.8 * speedMult;
      satellite2Ref.current.position.set(Math.cos(angle) * 1.35, Math.sin(angle) * 1.35, 0);
    }
    if (satellite3Ref.current) {
      const angle = t * 2.2 * speedMult + Math.PI;
      satellite3Ref.current.position.set(Math.cos(angle) * 1.75, Math.sin(angle) * 1.75, 0);
    }
  });

  return (
    <group>
      {/* Outer Gyro Ring 1 */}
      <group ref={ring1Ref} rotation={[Math.PI / 4, Math.PI / 6, 0]}>
        <mesh>
          <torusGeometry args={[1.55, 0.008, 16, 100]} />
          <meshBasicMaterial color={colors.secondary} transparent opacity={0.65} blending={THREE.AdditiveBlending} />
        </mesh>
        {/* Orbiting Photon Satellite 1 */}
        <mesh ref={satellite1Ref}>
          <sphereGeometry args={[0.04, 16, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>

      {/* Mid Gyro Ring 2 */}
      <group ref={ring2Ref} rotation={[-Math.PI / 3, 0, Math.PI / 5]}>
        <mesh>
          <torusGeometry args={[1.35, 0.007, 16, 100]} />
          <meshBasicMaterial color={colors.accent} transparent opacity={0.55} blending={THREE.AdditiveBlending} />
        </mesh>
        {/* Orbiting Photon Satellite 2 */}
        <mesh ref={satellite2Ref}>
          <sphereGeometry args={[0.035, 16, 16]} />
          <meshBasicMaterial color={colors.secondary} transparent opacity={0.9} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>

      {/* Outer Horizon Ring 3 */}
      <group ref={ring3Ref} rotation={[Math.PI / 2.5, 0, 0]}>
        <mesh>
          <torusGeometry args={[1.75, 0.006, 16, 120]} />
          <meshBasicMaterial color={colors.secondary} transparent opacity={0.4} blending={THREE.AdditiveBlending} />
        </mesh>
        {/* Orbiting Photon Satellite 3 */}
        <mesh ref={satellite3Ref}>
          <sphereGeometry args={[0.03, 16, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.85} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
    </group>
  );
}

// 2. 360-Degree Radial Audio Reactive Equalizer Bars
function RadialEqualizer({ status, audioLevel }: { status: JarvisStatus; audioLevel: number }) {
  const barsCount = 64;
  const barsRef = useRef<THREE.InstancedMesh>(null);
  const colors = statusColors[status] || statusColors.idle;

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    if (!barsRef.current) return;
    const t = state.clock.getElapsedTime();
    const isVoiceActive = status === 'listening' || status === 'speaking';
    const basePulse = Math.sin(t * 3) * 0.05 + 0.1;

    for (let i = 0; i < barsCount; i++) {
      const angle = (i / barsCount) * Math.PI * 2;
      const radius = 1.25;

      // Audio frequency wave calculation
      const wave = Math.sin(angle * 6 + t * 4) * Math.cos(angle * 3 - t * 2);
      const audioImpact = isVoiceActive ? audioLevel * (0.4 + Math.abs(wave) * 0.8) : 0;
      const length = Math.max(0.04, basePulse + audioImpact + (status === 'processing' ? Math.sin(i + t * 6) * 0.08 : 0));

      const posX = Math.cos(angle) * (radius + length / 2);
      const posY = Math.sin(angle) * (radius + length / 2);

      dummy.position.set(posX, posY, 0);
      dummy.rotation.z = angle + Math.PI / 2;
      dummy.scale.set(1, length * 8, 1);
      dummy.updateMatrix();

      barsRef.current.setMatrixAt(i, dummy.matrix);
    }
    barsRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group rotation={[Math.PI / 6, 0, 0]}>
      <instancedMesh ref={barsRef} args={[undefined, undefined, barsCount]}>
        <boxGeometry args={[0.015, 0.04, 0.015]} />
        <meshBasicMaterial color={colors.secondary} transparent opacity={0.7} blending={THREE.AdditiveBlending} />
      </instancedMesh>
    </group>
  );
}

// 3. Swirling Quantum Nebula Particle Cloud
function QuantumParticleSwarm({ status, audioLevel }: { status: JarvisStatus; audioLevel: number }) {
  const count = 1200;
  const pointsRef = useRef<THREE.Points>(null);
  const colors = statusColors[status] || statusColors.idle;

  const [positions, initialPositions] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const initial = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Golden Spiral / Fibonacci Sphere Distribution
      const phi = Math.acos(1 - 2 * (i + 0.5) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const radius = 1.1 + Math.random() * 1.4;

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      initial[i * 3] = x;
      initial[i * 3 + 1] = y;
      initial[i * 3 + 2] = z;
    }
    return [pos, initial];
  }, [count]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const t = state.clock.getElapsedTime();
    const posAttr = pointsRef.current.geometry.attributes.position;
    const posArr = posAttr.array as Float32Array;

    const speed = status === 'processing' ? 1.8 : status === 'listening' ? 1.2 + audioLevel * 2 : 0.6;
    pointsRef.current.rotation.y += delta * 0.15 * speed;
    pointsRef.current.rotation.x = Math.sin(t * 0.2) * 0.1;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const ix = initialPositions[idx];
      const iy = initialPositions[idx + 1];
      const iz = initialPositions[idx + 2];

      const wave = Math.sin(t * 2 + ix * 3 + iy * 3) * (0.05 + audioLevel * 0.25);
      const expand = 1 + wave + (status === 'processing' ? Math.sin(t * 5 + i) * 0.08 : 0);

      posArr[idx] = ix * expand;
      posArr[idx + 1] = iy * expand;
      posArr[idx + 2] = iz * expand;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.022}
        color={colors.secondary}
        transparent
        opacity={0.65}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// 4. Main Morphing Liquid Plasma Core
export function Orb({ status, audioLevel }: OrbProps) {
  const materialRef = useRef<any>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Mesh>(null);

  const colors = statusColors[status] || statusColors.idle;

  useFrame((state, _delta) => {
    const t = state.clock.getElapsedTime();

    if (materialRef.current) {
      materialRef.current.color.lerp(colors.primary, 0.08);

      let targetDistort = 0.35;
      let targetSpeed = 2.0;
      let scale = 1.0;

      if (status === 'listening') {
        targetDistort = 0.55 + audioLevel * 1.8;
        targetSpeed = 4.5 + audioLevel * 6;
        scale = 1.05 + audioLevel * 0.35;
      } else if (status === 'processing') {
        targetDistort = 0.85;
        targetSpeed = 8.0;
        scale = 1.0 + Math.sin(t * 8) * 0.08;
      } else if (status === 'speaking') {
        targetDistort = 0.45 + audioLevel * 1.2;
        targetSpeed = 3.5 + audioLevel * 5;
        scale = 1.04 + audioLevel * 0.25;
      } else if (status === 'error') {
        targetDistort = 0.2;
        targetSpeed = 9.0;
        scale = 0.95;
      }

      materialRef.current.distort = THREE.MathUtils.lerp(materialRef.current.distort, targetDistort, 0.1);
      materialRef.current.speed = THREE.MathUtils.lerp(materialRef.current.speed, targetSpeed, 0.1);

      if (meshRef.current) {
        meshRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);
        meshRef.current.rotation.y = t * 0.25;
        meshRef.current.rotation.z = t * 0.15;
      }
    }

    if (auraRef.current) {
      const auraScale = 1.25 + (status === 'listening' || status === 'speaking' ? audioLevel * 0.4 : Math.sin(t * 2) * 0.04);
      auraRef.current.scale.lerp(new THREE.Vector3(auraScale, auraScale, auraScale), 0.1);
    }
  });

  return (
    <group>
      {/* Outer Gyroscope Rings (Dribbble FUI Motion) */}
      <GyroscopeRings status={status} audioLevel={audioLevel} />

      {/* 360-Degree Radial Equalizer Spectrum */}
      <RadialEqualizer status={status} audioLevel={audioLevel} />

      {/* Quantum Swirling Particle Swarm */}
      <QuantumParticleSwarm status={status} audioLevel={audioLevel} />

      {/* Outer Volumetric Atmosphere / Fresnel Aura */}
      <Sphere ref={auraRef} args={[1.15, 64, 64]}>
        <meshBasicMaterial
          color={colors.glow}
          transparent={true}
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </Sphere>

      {/* Central Morphing Liquid Energy Core */}
      <Sphere ref={meshRef} args={[0.9, 128, 128]}>
        <MeshDistortMaterial
          ref={materialRef}
          color={colors.primary}
          envMapIntensity={1.5}
          clearcoat={1}
          clearcoatRoughness={0.08}
          metalness={0.85}
          roughness={0.15}
          distort={0.35}
          speed={2.5}
          transparent={true}
          opacity={0.92}
        />
      </Sphere>

      {/* Inner Radiant Pulsing Core Light */}
      <Sphere args={[0.55, 32, 32]}>
        <meshBasicMaterial
          color="#ffffff"
          transparent={true}
          opacity={0.55}
          blending={THREE.AdditiveBlending}
        />
      </Sphere>
    </group>
  );
}
