"use client";

import React, { useRef, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";

export interface SeatOccupant {
  userId: string;
  displayName: string;
  avatarUrl?: string;
}

export interface TheaterSceneProps {
  currentUserId?: string;
  selectedSeat?: string;
  occupiedSeats: Record<string, SeatOccupant>;
  isPlaying: boolean;
  recentReactions?: Array<{ id: string; emoji: string; userName: string; timestamp: number }>;
  onSelectSeat?: (seatLabel: string) => void;
}

// Stylized Voxel Viewer Character sitting in a seat
function VoxelViewer({ shirtColor, hairColor = "#1e1b29" }: { shirtColor: string; hairColor?: string }) {
  return (
    <group position={[0, 0.45, 0]}>
      {/* Torso / Shirt */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.42, 0.44, 0.28]} />
        <meshStandardMaterial color={shirtColor} roughness={0.7} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.72, 0.02]}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color="#fcd34d" roughness={0.8} />
      </mesh>
      {/* Hair */}
      <mesh position={[0, 0.84, 0.02]}>
        <boxGeometry args={[0.32, 0.12, 0.32]} />
        <meshStandardMaterial color={hairColor} roughness={0.9} />
      </mesh>
      {/* Left Arm on armrest */}
      <mesh position={[-0.26, 0.32, 0.08]}>
        <boxGeometry args={[0.1, 0.32, 0.14]} />
        <meshStandardMaterial color={shirtColor} roughness={0.7} />
      </mesh>
      {/* Right Arm on armrest */}
      <mesh position={[0.26, 0.32, 0.08]}>
        <boxGeometry args={[0.1, 0.32, 0.14]} />
        <meshStandardMaterial color={shirtColor} roughness={0.7} />
      </mesh>
    </group>
  );
}

// Presenter Avatar standing on stage on glowing hologram ring
function StagePresenter() {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((_state, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.8;
    }
  });

  return (
    <group position={[0, 0.05, -3.2]}>
      {/* Glowing Hologram Ring on floor */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.55, 0.75, 32]} />
        <meshBasicMaterial color="#c084fc" side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.55, 32]} />
        <meshBasicMaterial color="#581c87" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Presenter Character (Blue shirt, dark pants) */}
      <group position={[0, 0, 0]}>
        {/* Legs */}
        <mesh position={[-0.1, 0.38, 0]}>
          <boxGeometry args={[0.14, 0.65, 0.16]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <mesh position={[0.1, 0.38, 0]}>
          <boxGeometry args={[0.14, 0.65, 0.16]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        {/* Torso */}
        <mesh position={[0, 0.95, 0]}>
          <boxGeometry args={[0.42, 0.52, 0.24]} />
          <meshStandardMaterial color="#38bdf8" />
        </mesh>
        {/* Head */}
        <mesh position={[0, 1.38, 0]}>
          <boxGeometry args={[0.32, 0.32, 0.32]} />
          <meshStandardMaterial color="#fcd34d" />
        </mesh>
        {/* Hair */}
        <mesh position={[0, 1.52, 0]}>
          <boxGeometry args={[0.34, 0.12, 0.34]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
      </group>
    </group>
  );
}

interface CinemaSeatProps {
  x: number;
  y: number;
  z: number;
  label: string;
  isMySeat: boolean;
  occupant?: SeatOccupant;
  dummyViewerColor?: string;
  onSelect: (label: string) => void;
}

function CinemaSeat({ x, y, z, label, isMySeat, occupant, dummyViewerColor, onSelect }: CinemaSeatProps) {
  const [hovered, setHovered] = useState(false);

  // Red velvet cinema seats as seen in the reference image
  const cushionColor = isMySeat ? "#06b6d4" : hovered ? "#a855f7" : "#881337";
  const backrestColor = isMySeat ? "#0891b2" : hovered ? "#9333ea" : "#9f1239";
  const armrestColor = "#1c1917";

  return (
    <group
      position={[x, y, z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(label);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Seat Base Cushion */}
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[0.68, 0.24, 0.58]} />
        <meshStandardMaterial color={cushionColor} roughness={0.65} />
      </mesh>

      {/* Seat Backrest */}
      <mesh position={[0, 0.68, -0.22]}>
        <boxGeometry args={[0.68, 0.65, 0.14]} />
        <meshStandardMaterial color={backrestColor} roughness={0.65} />
      </mesh>

      {/* Left Armrest */}
      <mesh position={[-0.38, 0.36, 0]}>
        <boxGeometry args={[0.09, 0.42, 0.58]} />
        <meshStandardMaterial color={armrestColor} roughness={0.4} />
      </mesh>

      {/* Right Armrest */}
      <mesh position={[0.38, 0.36, 0]}>
        <boxGeometry args={[0.09, 0.42, 0.58]} />
        <meshStandardMaterial color={armrestColor} roughness={0.4} />
      </mesh>

      {/* Seat Number Tag */}
      <Text
        position={[0, 0.85, -0.14]}
        fontSize={0.12}
        color={isMySeat ? "#ffffff" : "#fbcfe8"}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>

      {/* Actual Occupant OR Ambient Voxel Viewer */}
      {occupant ? (
        <>
          <VoxelViewer shirtColor={isMySeat ? "#06b6d4" : "#a855f7"} />
          <group position={[0, 1.45, 0]}>
            <Text
              fontSize={0.2}
              color={isMySeat ? "#67e8f9" : "#e9d5ff"}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.03}
              outlineColor="#090714"
            >
              {isMySeat ? `★ ${occupant.displayName} (Bạn)` : occupant.displayName}
            </Text>
          </group>
        </>
      ) : dummyViewerColor ? (
        <VoxelViewer shirtColor={dummyViewerColor} />
      ) : null}
    </group>
  );
}

// Floating 3D Emoji Particle
function FloatingEmojiParticle({ emoji, x, z, startTime }: { emoji: string; x: number; z: number; startTime: number }) {
  const meshRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!meshRef.current) return;
    const elapsed = (Date.now() - startTime) / 1000;
    meshRef.current.position.y = 1.2 + elapsed * 1.5;
    meshRef.current.position.x = x + Math.sin(elapsed * 3) * 0.25;
    meshRef.current.scale.setScalar(Math.max(0, 1 - elapsed / 2.8));
  });

  return (
    <group ref={meshRef} position={[x, 1.2, z]}>
      <Text fontSize={0.65} anchorX="center" anchorY="middle">
        {emoji}
      </Text>
    </group>
  );
}

export function TheaterScene({
  currentUserId,
  selectedSeat,
  occupiedSeats,
  isPlaying,
  recentReactions = [],
  onSelectSeat
}: TheaterSceneProps) {
  // Preset vibrant shirt colors for audience atmosphere as shown in reference image
  const viewerColors = [
    "#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed",
    "#0891b2", "#ca8a04", "#475569", "#059669", "#be185d",
    "#3b82f6", "#eab308", "#10b981", "#6366f1"
  ];

  const rowLabels = ["A", "B", "C", "D", "E"];
  const seatsPerRow = 8; // 4 left, aisle, 4 right

  const seats = useMemo(() => {
    const list: React.ReactNode[] = [];
    let colorIdx = 0;

    for (let row = 0; row < rowLabels.length; row++) {
      const stepY = row * 0.22;
      const stepZ = -1.2 + row * 1.15;

      for (let col = 0; col < seatsPerRow; col++) {
        // Divide into left block and right block with a center illuminated aisle
        const isLeft = col < 4;
        const sideOffset = isLeft ? -0.55 : 0.55;
        const colPos = isLeft ? (col - 3.5) * 0.95 : (col - 3.5) * 0.95;
        const x = colPos + sideOffset;
        const label = `${rowLabels[row]}${col + 1}`;

        const isMySeat = selectedSeat === label;
        const occupant = occupiedSeats[label];

        // Fill ~60% of remaining seats with ambient viewers for rich cinema atmosphere
        const hasDummyViewer = !occupant && (row + col) % 3 !== 0;
        const dummyColor = hasDummyViewer ? viewerColors[(colorIdx++) % viewerColors.length] : undefined;

        list.push(
          <CinemaSeat
            key={label}
            x={x}
            y={stepY}
            z={stepZ}
            label={label}
            isMySeat={isMySeat}
            occupant={occupant}
            dummyViewerColor={dummyColor}
            onSelect={(l) => onSelectSeat?.(l)}
          />
        );
      }
    }
    return list;
  }, [selectedSeat, occupiedSeats, onSelectSeat]);

  return (
    <Canvas
      camera={{ position: [0, 4.2, 5.8], fov: 42 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={["#080612"]} />

      {/* Lighting */}
      <ambientLight intensity={isPlaying ? 0.35 : 0.75} />
      <pointLight position={[0, 4.5, -4]} intensity={isPlaying ? 45 : 25} color="#c084fc" distance={20} />
      <pointLight position={[-6, 3, 0]} intensity={18} color="#f59e0b" distance={12} />
      <pointLight position={[6, 3, 0]} intensity={18} color="#f59e0b" distance={12} />

      {/* Stage Floor */}
      <mesh position={[0, -0.05, -3.4]}>
        <boxGeometry args={[14, 0.2, 3.2]} />
        <meshStandardMaterial color="#130e20" roughness={0.8} />
      </mesh>

      {/* Presenter on Stage Hologram Ring */}
      <StagePresenter />

      {/* Tiered Auditorium Floor */}
      <mesh position={[0, 0.45, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 8]} />
        <meshStandardMaterial color="#0b0816" roughness={0.9} />
      </mesh>

      {/* Illuminated Neon Purple Center Aisle */}
      <mesh position={[0, 0.46, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, 7.8]} />
        <meshBasicMaterial color="#7c3aed" />
      </mesh>
      {/* Side Neon Edge Lines for the aisle */}
      <mesh position={[-0.45, 0.47, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.04, 7.8]} />
        <meshBasicMaterial color="#c084fc" />
      </mesh>
      <mesh position={[0.45, 0.47, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.04, 7.8]} />
        <meshBasicMaterial color="#c084fc" />
      </mesh>

      {/* Cinema Screen Frame Backing */}
      <mesh position={[0, 3.6, -5.2]}>
        <boxGeometry args={[12.2, 5.2, 0.3]} />
        <meshStandardMaterial color="#0c0916" roughness={0.6} />
      </mesh>

      {/* Left Stage Velvet Curtain */}
      <mesh position={[-6.2, 3.4, -4.8]}>
        <boxGeometry args={[1.4, 6.2, 0.8]} />
        <meshStandardMaterial color="#3b0764" roughness={0.9} />
      </mesh>

      {/* Right Stage Velvet Curtain */}
      <mesh position={[6.2, 3.4, -4.8]}>
        <boxGeometry args={[1.4, 6.2, 0.8]} />
        <meshStandardMaterial color="#3b0764" roughness={0.9} />
      </mesh>

      {/* Left Wall Sconce Light Fixture */}
      <mesh position={[-6.8, 2.8, -1.5]}>
        <boxGeometry args={[0.15, 0.9, 0.2]} />
        <meshStandardMaterial color="#d97706" emissive="#f59e0b" emissiveIntensity={1.8} />
      </mesh>

      {/* Right Wall Sconce Light Fixture */}
      <mesh position={[6.8, 2.8, -1.5]}>
        <boxGeometry args={[0.15, 0.9, 0.2]} />
        <meshStandardMaterial color="#d97706" emissive="#f59e0b" emissiveIntensity={1.8} />
      </mesh>

      {/* Auditorium Seats & Audience */}
      {seats}

      {/* Floating 3D Reactions */}
      {recentReactions.map((rx) => {
        const randX = Math.sin(rx.timestamp) * 2.8;
        const randZ = -0.5 + Math.cos(rx.timestamp) * 2;
        return (
          <FloatingEmojiParticle
            key={rx.id}
            emoji={rx.emoji}
            x={randX}
            z={randZ}
            startTime={rx.timestamp}
          />
        );
      })}

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={3.5}
        maxDistance={9.5}
        maxPolarAngle={1.42}
        minPolarAngle={0.55}
      />
    </Canvas>
  );
}
