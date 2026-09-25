import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { JarvisStatus } from '../hooks/useJarvis';

interface OrbProps {
  status: JarvisStatus;
  audioLevel: number;
}

// High-Luminance Futuristic Status Color Palette (Zero Dark/Black Surfaces)
const statusColors: Record<JarvisStatus, {
  primary: THREE.Color;
  secondary: THREE.Color;
  accent: THREE.Color;
  glow: THREE.Color;
}> = {
  idle: {
    primary: new THREE.Color('#00c8ff'),
    secondary: new THREE.Color('#00f0ff'),
    accent: new THREE.Color('#3a86ff'),
    glow: new THREE.Color('#0066ff'),
  },
  listening: {
    primary: new THREE.Color('#00a8ff'),
    secondary: new THREE.Color('#00f7ff'),
    accent: new THREE.Color('#72efdd'),
    glow: new THREE.Color('#0077ff'),
  },
  processing: {
    primary: new THREE.Color('#00f59b'),
    secondary: new THREE.Color('#38ef7d'),
    accent: new THREE.Color('#00f0ff'),
    glow: new THREE.Color('#10b981'),
  },
  speaking: {
    primary: new THREE.Color('#ff9e00'),
    secondary: new THREE.Color('#ff4d6d'),
    accent: new THREE.Color('#ffd166'),
    glow: new THREE.Color('#ff5400'),
  },
  error: {
    primary: new THREE.Color('#ff3b30'),
    secondary: new THREE.Color('#ff6b6b'),
    accent: new THREE.Color('#ffa502'),
    glow: new THREE.Color('#d90429'),
  },
};

// Custom GLSL Holographic Energy & Fresnel Plasma Shader
const HOLO_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uAudioLevel;
  uniform float uDistort;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  varying float vDisplacement;

  // Smooth 3D harmonic wave interference for high-tech acoustic displacement
  float waveField(vec3 p, float t) {
    float w1 = sin(p.x * 4.5 + t * 2.8) * cos(p.y * 4.5 - t * 2.2);
    float w2 = sin(p.z * 5.5 - t * 3.1) * cos(p.x * 3.5 + t * 1.9);
    float w3 = sin((p.x + p.y + p.z) * 3.2 + t * 4.0);
    return (w1 + w2 + w3) * 0.333;
  }

  void main() {
    vUv = uv;
    float disp = waveField(position, uTime) * (uDistort + uAudioLevel * 0.45);
    vDisplacement = disp;

    vec3 displacedPosition = position + normal * disp;
    vec4 mvPosition = modelViewMatrix * vec4(displacedPosition, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewPosition = -mvPosition.xyz;
    vWorldPos = displacedPosition;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const HOLO_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uAudioLevel;
  uniform vec3 uColorPrimary;
  uniform vec3 uColorSecondary;
  uniform vec3 uColorAccent;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  varying float vDisplacement;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // 1. Crisp Sci-Fi Fresnel Rim Lighting (transparent center, luminous neon rim)
    float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 2.2);

    // 2. Holographic Latitude & Longitude Energy Grid Scanlines
    float latLines = smoothstep(0.92, 0.99, abs(sin(vWorldPos.y * 22.0 - uTime * 3.5)));
    float lonLines = smoothstep(0.94, 0.99, abs(sin(atan(vWorldPos.z, vWorldPos.x) * 16.0 + uTime * 1.5)));
    float holoGrid = (latLines * 0.45 + lonLines * 0.35);

    // 3. Dynamic Plasma Energy Veins reactive to voice / audio
    float plasma = 0.5 + 0.5 * sin(vWorldPos.x * 6.0 + vWorldPos.y * 6.0 - uTime * 3.0 + vDisplacement * 10.0);
    vec3 baseColor = mix(uColorPrimary, uColorSecondary, plasma);
    baseColor = mix(baseColor, uColorAccent, fresnel * 0.7 + holoGrid * 0.5);

    // 4. Audio-reactive core brilliance
    float energyBoost = 1.0 + uAudioLevel * 1.4 + abs(vDisplacement) * 2.5;
    vec3 finalColor = baseColor * energyBoost + vec3(0.85, 0.97, 1.0) * (fresnel * 0.45 + holoGrid * 0.35);

    // Holographic alpha: crystal clear in center (0.22) so inner geodesic core shines through, intense on rim (0.92)
    float alpha = clamp(0.18 + fresnel * 0.72 + holoGrid * 0.35 + uAudioLevel * 0.25, 0.18, 0.95);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

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
    const speedMult = status === 'listening' ? 1.8 + audioLevel * 3 : status === 'processing' ? 2.5 : status === 'speaking' ? 1.4 + audioLevel * 2 : 0.85;

    if (ring1Ref.current) {
      ring1Ref.current.rotation.x += delta * 0.4 * speedMult;
      ring1Ref.current.rotation.y += delta * 0.6 * speedMult;
      ring1Ref.current.rotation.z = Math.sin(t * 0.5) * 0.2;
    }

    if (ring2Ref.current) {
      ring2Ref.current.rotation.x -= delta * 0.5 * speedMult;
      ring2Ref.current.rotation.z += delta * 0.7 * speedMult;
      ring2Ref.current.rotation.y = Math.cos(t * 0.4) * 0.25;
    }

    if (ring3Ref.current) {
      ring3Ref.current.rotation.z -= delta * 0.3 * speedMult;
      ring3Ref.current.rotation.x = Math.sin(t * 0.3) * 0.15;
    }

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
          <torusGeometry args={[1.55, 0.008, 16, 120]} />
          <meshBasicMaterial color={colors.secondary} transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh ref={satellite1Ref}>
          <sphereGeometry args={[0.042, 16, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>

      {/* Mid Gyro Ring 2 */}
      <group ref={ring2Ref} rotation={[-Math.PI / 3, 0, Math.PI / 5]}>
        <mesh>
          <torusGeometry args={[1.35, 0.007, 16, 120]} />
          <meshBasicMaterial color={colors.accent} transparent opacity={0.65} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh ref={satellite2Ref}>
          <sphereGeometry args={[0.036, 16, 16]} />
          <meshBasicMaterial color={colors.secondary} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>

      {/* Outer Horizon Ring 3 */}
      <group ref={ring3Ref} rotation={[Math.PI / 2.5, 0, 0]}>
        <mesh>
          <torusGeometry args={[1.75, 0.006, 16, 120]} />
          <meshBasicMaterial color={colors.secondary} transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh ref={satellite3Ref}>
          <sphereGeometry args={[0.032, 16, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
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
      const radius = 1.22;

      const wave = Math.sin(angle * 6 + t * 4) * Math.cos(angle * 3 - t * 2);
      const audioImpact = isVoiceActive ? audioLevel * (0.45 + Math.abs(wave) * 0.85) : 0;
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
        <meshBasicMaterial color={colors.secondary} transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} />
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
      const phi = Math.acos(1 - 2 * (i + 0.5) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const radius = 1.05 + Math.random() * 1.45;

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
        opacity={0.7}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// 4. Holographic Geodesic Arc Reactor & Neural Core (Replaces the dark water-like sphere)
export function Orb({ status, audioLevel }: OrbProps) {
  const holoMeshRef = useRef<THREE.Mesh>(null);
  const shaderMatRef = useRef<THREE.ShaderMaterial>(null);
  const innerLatticeRef = useRef<THREE.Mesh>(null);
  const outerLatticeRef = useRef<THREE.Mesh>(null);
  const coreNucleusRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Mesh>(null);

  const colors = statusColors[status] || statusColors.idle;

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAudioLevel: { value: 0 },
      uDistort: { value: 0.06 },
      uColorPrimary: { value: new THREE.Color('#00c8ff') },
      uColorSecondary: { value: new THREE.Color('#00f0ff') },
      uColorAccent: { value: new THREE.Color('#3a86ff') },
    }),
    []
  );

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    let targetDistort = 0.05;
    let scale = 1.0;
    let rotSpeed = 0.35;

    if (status === 'listening') {
      targetDistort = 0.09 + audioLevel * 0.22;
      scale = 1.04 + audioLevel * 0.28;
      rotSpeed = 0.85 + audioLevel * 1.5;
    } else if (status === 'processing') {
      targetDistort = 0.14;
      scale = 1.02 + Math.sin(t * 7) * 0.06;
      rotSpeed = 1.6;
    } else if (status === 'speaking') {
      targetDistort = 0.08 + audioLevel * 0.2;
      scale = 1.03 + audioLevel * 0.24;
      rotSpeed = 0.75 + audioLevel * 1.2;
    } else if (status === 'error') {
      targetDistort = 0.12;
      scale = 0.96 + Math.sin(t * 12) * 0.03;
      rotSpeed = 1.2;
    }

    if (shaderMatRef.current) {
      shaderMatRef.current.uniforms.uTime.value = t;
      shaderMatRef.current.uniforms.uAudioLevel.value = THREE.MathUtils.lerp(
        shaderMatRef.current.uniforms.uAudioLevel.value,
        audioLevel,
        0.2
      );
      shaderMatRef.current.uniforms.uDistort.value = THREE.MathUtils.lerp(
        shaderMatRef.current.uniforms.uDistort.value,
        targetDistort,
        0.12
      );
      shaderMatRef.current.uniforms.uColorPrimary.value.lerp(colors.primary, 0.08);
      shaderMatRef.current.uniforms.uColorSecondary.value.lerp(colors.secondary, 0.08);
      shaderMatRef.current.uniforms.uColorAccent.value.lerp(colors.accent, 0.08);
    }

    if (holoMeshRef.current) {
      holoMeshRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.12);
      holoMeshRef.current.rotation.y += delta * rotSpeed * 0.6;
      holoMeshRef.current.rotation.z = Math.sin(t * 0.4) * 0.15;
    }

    // Counter-rotating Geodesic Neural Cages
    if (innerLatticeRef.current) {
      innerLatticeRef.current.rotation.x -= delta * rotSpeed * 1.1;
      innerLatticeRef.current.rotation.y += delta * rotSpeed * 0.9;
      const latticeScale = 0.96 + audioLevel * 0.2 + Math.sin(t * 3) * 0.03;
      innerLatticeRef.current.scale.setScalar(latticeScale);
    }

    if (outerLatticeRef.current) {
      outerLatticeRef.current.rotation.x += delta * rotSpeed * 0.55;
      outerLatticeRef.current.rotation.z -= delta * rotSpeed * 0.75;
      const outerScale = 1.0 + audioLevel * 0.15;
      outerLatticeRef.current.scale.setScalar(outerScale);
    }

    // Pulsing Singularity Nucleus
    if (coreNucleusRef.current) {
      const corePulse = 1.0 + Math.sin(t * 4) * 0.08 + audioLevel * 0.45;
      coreNucleusRef.current.scale.setScalar(corePulse);
    }

    // Outer Atmospheric Corona
    if (auraRef.current) {
      const auraScale = 1.18 + (status === 'listening' || status === 'speaking' ? audioLevel * 0.35 : Math.sin(t * 2) * 0.04);
      auraRef.current.scale.lerp(new THREE.Vector3(auraScale, auraScale, auraScale), 0.1);
    }
  });

  return (
    <group>
      {/* 1. Outer Gyroscope FUI Rings */}
      <GyroscopeRings status={status} audioLevel={audioLevel} />

      {/* 2. 360-Degree Radial Equalizer Spectrum */}
      <RadialEqualizer status={status} audioLevel={audioLevel} />

      {/* 3. Quantum Swirling Particle Swarm */}
      <QuantumParticleSwarm status={status} audioLevel={audioLevel} />

      {/* 4. Outer Volumetric Corona Halo */}
      <mesh ref={auraRef}>
        <sphereGeometry args={[1.08, 48, 48]} />
        <meshBasicMaterial
          color={colors.glow}
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* 5. Outer Geodesic Neural Wireframe Cage */}
      <mesh ref={outerLatticeRef}>
        <icosahedronGeometry args={[0.92, 2]} />
        <meshBasicMaterial
          color={colors.secondary}
          wireframe
          transparent
          opacity={0.28}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* 6. Custom GLSL Holographic Fresnel Energy Shell (Crystal clear center + glowing rim & scanlines) */}
      <mesh ref={holoMeshRef}>
        <sphereGeometry args={[0.82, 64, 64]} />
        <shaderMaterial
          ref={shaderMatRef}
          vertexShader={HOLO_VERTEX_SHADER}
          fragmentShader={HOLO_FRAGMENT_SHADER}
          uniforms={uniforms}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* 7. Inner Counter-Rotating Geodesic Arc Lattice */}
      <mesh ref={innerLatticeRef}>
        <icosahedronGeometry args={[0.62, 1]} />
        <meshBasicMaterial
          color="#ffffff"
          wireframe
          transparent
          opacity={0.48}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* 8. Inner Plasma Energy Halo */}
      <mesh>
        <sphereGeometry args={[0.46, 32, 32]} />
        <meshBasicMaterial
          color={colors.secondary}
          transparent
          opacity={0.38}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* 9. Radiant White-Hot Singularity Core Nucleus */}
      <mesh ref={coreNucleusRef}>
        <sphereGeometry args={[0.26, 32, 32]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.92}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
