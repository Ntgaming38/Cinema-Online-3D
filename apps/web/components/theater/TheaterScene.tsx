"use client";

import React, { Suspense, useEffect, useRef, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox, Stars, Text } from "@react-three/drei";
import * as THREE from "three";

export interface StagePerformerInfo {
  userId: string;
  displayName: string;
  gender?: string;
  appearance?: { shirtColor?: string; hairStyle?: string; accessory?: string };
  startedAt: number;
}

export type EmoteKind = "jump" | "dance" | "wave" | "clap";

export interface ActiveEmote {
  kind: EmoteKind;
  startedAt: number;
}

export interface SeatOccupant {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  gender?: string;
  appearance?: { shirtColor?: string; hairStyle?: string; accessory?: string };
}

export type CameraViewMode = "wide" | "audience" | "panorama" | "reverse" | "focus";

export interface TheaterSceneProps {
  viewMode?: CameraViewMode;
  selectedSeat?: string;
  occupiedSeats: Record<string, SeatOccupant>;
  isPlaying: boolean;
  theme?: string;
  recentReactions?: Array<{ id: string; emoji: string; userName: string; timestamp: number }>;
  onSelectSeat?: (seatLabel: string) => void;
  quality?: "low" | "medium" | "high";
  overlayElement?: HTMLDivElement | null;
  disco?: boolean;
  activeEmotes?: Record<string, ActiveEmote>;
  stagePerformers?: StagePerformerInfo[];
  fireworksBursts?: Array<{ id: number; at: number }>;
}

// Wardrobe shirt colors are stored by Vietnamese name; the 3D viewer needs hex.
const SHIRT_HEX: Record<string, string> = {
  "Đen": "#1f2430", "Xám": "#6b7280", "Trắng": "#f8fafc", "Vàng": "#eab308",
  "Đỏ": "#dc2626", "Tím": "#9333ea", "Cam": "#f97316", "Xanh lá": "#16a34a",
  "Xanh dương": "#2563eb", "Hồng": "#ec4899", "Nâu": "#92400e",
};

export function shirtHex(color?: string, fallback = "#a855f7"): string {
  if (!color) return fallback;
  if (color.startsWith("#")) return color;
  return SHIRT_HEX[color] || fallback;
}

// Palette used to give each viewer a distinct (deterministic) hair color.
const HAIR_HEX = ["#2a1a10", "#0f0f14", "#4a2c14", "#7a4a21", "#b08954", "#d9a441", "#9aa1ac", "#b91c1c", "#274690", "#5b21b6"];

// ---------- Character hair styles (voxel-chibi) ----------
// Head local space: face looks toward -Z, head sphere radius ~0.205.
function HairMesh({ style, color, female }: { style?: string; color: string; female?: boolean }) {
  const s = style || (female ? "Tóc dài" : "Tóc ngắn");
  if (s === "Đầu hói") return null;
  const mat = <meshStandardMaterial color={color} roughness={0.9} />;
  const cap = (
    <mesh position={[0, 0.11, 0.01]} rotation={[0.3, 0, 0]}>
      <sphereGeometry args={[0.208, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      {mat}
    </mesh>
  );
  switch (s) {
    case "Tóc dài":
    case "Tóc dài thẳng":
      return (
        <group>
          {cap}
          <RoundedBox position={[0, -0.08, 0.14]} args={[0.3, 0.44, 0.11]} radius={0.05} smoothness={2}>{mat}</RoundedBox>
        </group>
      );
    case "Tóc dài xoăn":
      return (
        <group>
          {cap}
          <RoundedBox position={[0, -0.08, 0.14]} args={[0.3, 0.44, 0.11]} radius={0.05} smoothness={2}>{mat}</RoundedBox>
          {[-0.12, 0, 0.12].map((x) => (
            <mesh key={x} position={[x, -0.26, 0.14]}><sphereGeometry args={[0.075, 8, 8]} />{mat}</mesh>
          ))}
        </group>
      );
    case "Tóc búi":
      return (<group>{cap}<mesh position={[0, 0.3, 0.02]}><sphereGeometry args={[0.09, 10, 8]} />{mat}</mesh></group>);
    case "Tóc 2 bím":
      return (
        <group>
          {cap}
          <mesh position={[-0.2, 0.02, 0.04]}><sphereGeometry args={[0.075, 10, 8]} />{mat}</mesh>
          <mesh position={[0.2, 0.02, 0.04]}><sphereGeometry args={[0.075, 10, 8]} />{mat}</mesh>
          <mesh position={[-0.2, -0.14, 0.05]}><sphereGeometry args={[0.06, 8, 8]} />{mat}</mesh>
          <mesh position={[0.2, -0.14, 0.05]}><sphereGeometry args={[0.06, 8, 8]} />{mat}</mesh>
        </group>
      );
    case "Tóc bím lệch":
      return (
        <group>
          {cap}
          <mesh position={[0.2, -0.05, 0.05]}><sphereGeometry args={[0.08, 10, 8]} />{mat}</mesh>
          <mesh position={[0.2, -0.2, 0.06]}><sphereGeometry args={[0.06, 8, 8]} />{mat}</mesh>
        </group>
      );
    case "Tóc bob":
      return (
        <group>
          {cap}
          <RoundedBox position={[0, -0.02, 0.1]} args={[0.34, 0.3, 0.12]} radius={0.06} smoothness={2}>{mat}</RoundedBox>
        </group>
      );
    case "Tóc mohawk":
      return (<group>{cap}<mesh position={[0, 0.24, 0]}><boxGeometry args={[0.07, 0.1, 0.34]} />{mat}</mesh></group>);
    case "Tóc xoăn":
      return (
        <group>
          {cap}
          {[-0.12, 0, 0.12].map((x) => (<mesh key={x} position={[x, 0.19, -0.02]}><sphereGeometry args={[0.06, 8, 8]} />{mat}</mesh>))}
        </group>
      );
    case "Tóc đuôi ngựa":
      return (
        <group>
          {cap}
          <mesh position={[0, 0.22, 0.16]}><sphereGeometry args={[0.08, 10, 8]} />{mat}</mesh>
          <mesh position={[0, 0.1, 0.2]}><cylinderGeometry args={[0.035, 0.05, 0.18, 8]} />{mat}</mesh>
        </group>
      );
    default:
      // Tóc ngắn / undercut / tém / chỏm / vuốt / mái: neat cap
      return <group>{cap}</group>;
  }
}

// ---------- Character accessories (glasses, hats, headsets, ...) ----------
function AccessoryMesh({ name }: { name?: string }) {
  if (!name || name === "Không") return null;
  const dark = <meshStandardMaterial color="#111827" roughness={0.35} metalness={0.4} />;
  switch (name) {
    case "Kính":
    case "Kính 3D": {
      const lens = <meshStandardMaterial color={name === "Kính 3D" ? "#0f172a" : "#dbeafe"} roughness={0.25} metalness={0.3} transparent opacity={name === "Kính 3D" ? 0.95 : 0.5} />;
      return (
        <group>
          <mesh position={[-0.075, 0.02, -0.212]}><boxGeometry args={[0.085, 0.06, 0.02]} />{lens}</mesh>
          <mesh position={[0.075, 0.02, -0.212]}><boxGeometry args={[0.085, 0.06, 0.02]} />{lens}</mesh>
          <mesh position={[0, 0.035, -0.212]}><boxGeometry args={[0.05, 0.015, 0.015]} />{dark}</mesh>
        </group>
      );
    }
    case "Kính râm":
      return (
        <group>
          <mesh position={[-0.075, 0.02, -0.215]}><boxGeometry args={[0.09, 0.065, 0.02]} /><meshStandardMaterial color="#020617" roughness={0.2} /></mesh>
          <mesh position={[0.075, 0.02, -0.215]}><boxGeometry args={[0.09, 0.065, 0.02]} /><meshStandardMaterial color="#020617" roughness={0.2} /></mesh>
          <mesh position={[0, 0.035, -0.215]}><boxGeometry args={[0.05, 0.015, 0.015]} />{dark}</mesh>
        </group>
      );
    case "Tai nghe":
      return (
        <group>
          <mesh position={[0, 0.1, 0]}><torusGeometry args={[0.215, 0.022, 8, 20, Math.PI]} /><meshStandardMaterial color="#1f2937" roughness={0.5} /></mesh>
          <mesh position={[-0.215, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.055, 0.055, 0.05, 12]} /><meshStandardMaterial color="#111827" roughness={0.4} /></mesh>
          <mesh position={[0.215, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.055, 0.055, 0.05, 12]} /><meshStandardMaterial color="#111827" roughness={0.4} /></mesh>
        </group>
      );
    case "Mũ":
    case "Mũ len":
      return (
        <group>
          <mesh position={[0, 0.17, 0]}><cylinderGeometry args={[0.235, 0.235, 0.025, 20]} /><meshStandardMaterial color={name === "Mũ len" ? "#be123c" : "#7f1d1d"} roughness={0.75} /></mesh>
          <mesh position={[0, 0.27, 0]}>
            {name === "Mũ len" ? <sphereGeometry args={[0.215, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /> : <cylinderGeometry args={[0.14, 0.155, 0.18, 20]} />}
            <meshStandardMaterial color={name === "Mũ len" ? "#be123c" : "#991b1b"} roughness={0.75} />
          </mesh>
          {name === "Mũ len" && <mesh position={[0, 0.4, 0]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#fecdd3" roughness={0.9} /></mesh>}
        </group>
      );
    case "Mũ lưỡi trai":
      return (
        <group>
          <mesh position={[0, 0.18, 0]}><cylinderGeometry args={[0.15, 0.16, 0.16, 20]} /><meshStandardMaterial color="#1d4ed8" roughness={0.7} /></mesh>
          <mesh position={[0, 0.26, 0]}><sphereGeometry args={[0.15, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#1d4ed8" roughness={0.7} /></mesh>
          <mesh position={[0, 0.165, -0.24]}><boxGeometry args={[0.24, 0.015, 0.13]} /><meshStandardMaterial color="#1e40af" roughness={0.7} /></mesh>
        </group>
      );
    case "Mũ bảo hiểm":
      return <mesh position={[0, 0.12, 0]}><sphereGeometry args={[0.235, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.3} /></mesh>;
    case "Mũ hoa":
      return (
        <group>
          <mesh position={[0, 0.17, 0]}><cylinderGeometry args={[0.24, 0.24, 0.03, 20]} /><meshStandardMaterial color="#fde68a" roughness={0.8} /></mesh>
          {["#f472b6", "#a78bfa", "#f87171", "#4ade80", "#38bdf8"].map((c, i) => (
            <mesh key={c} position={[Math.sin((i / 5) * Math.PI * 2) * 0.2, 0.2, Math.cos((i / 5) * Math.PI * 2) * 0.2]}>
              <sphereGeometry args={[0.045, 8, 8]} /><meshStandardMaterial color={c} roughness={0.6} />
            </mesh>
          ))}
        </group>
      );
    case "Mũ phù thủy":
      return (
        <group>
          <mesh position={[0, 0.18, 0]}><cylinderGeometry args={[0.26, 0.26, 0.025, 20]} /><meshStandardMaterial color="#4c1d95" roughness={0.8} /></mesh>
          <mesh position={[0, 0.4, 0]} rotation={[0, 0, 0.12]}><coneGeometry args={[0.15, 0.42, 12]} /><meshStandardMaterial color="#5b21b6" roughness={0.8} /></mesh>
        </group>
      );
    case "Mũ tai mèo":
    case "Tai mèo":
    case "Băng đô tai mèo": {
      const ears = (
        <>
          <mesh position={[-0.13, 0.26, 0]} rotation={[0, 0, 0.35]}><coneGeometry args={[0.06, 0.14, 6]} /><meshStandardMaterial color="#1f2937" roughness={0.8} /></mesh>
          <mesh position={[0.13, 0.26, 0]} rotation={[0, 0, -0.35]}><coneGeometry args={[0.06, 0.14, 6]} /><meshStandardMaterial color="#1f2937" roughness={0.8} /></mesh>
          <mesh position={[-0.13, 0.26, -0.02]} rotation={[0, 0, 0.35]}><coneGeometry args={[0.03, 0.08, 6]} /><meshStandardMaterial color="#f9a8d4" roughness={0.8} /></mesh>
          <mesh position={[0.13, 0.26, -0.02]} rotation={[0, 0, -0.35]}><coneGeometry args={[0.03, 0.08, 6]} /><meshStandardMaterial color="#f9a8d4" roughness={0.8} /></mesh>
        </>
      );
      return name === "Băng đô tai mèo" ? (
        <group>
          {ears}
          <mesh position={[0, 0.2, 0]} rotation={[0.4, 0, 0]}><torusGeometry args={[0.2, 0.028, 6, 18, Math.PI]} /><meshStandardMaterial color="#ec4899" roughness={0.7} /></mesh>
        </group>
      ) : <group>{ears}</group>;
    }
    case "Sừng quỷ":
      return (
        <group>
          <mesh position={[-0.17, 0.27, 0]} rotation={[0, 0, 0.5]}><coneGeometry args={[0.035, 0.12, 6]} /><meshStandardMaterial color="#d6d3d1" roughness={0.6} /></mesh>
          <mesh position={[0.17, 0.27, 0]} rotation={[0, 0, -0.5]}><coneGeometry args={[0.035, 0.12, 6]} /><meshStandardMaterial color="#d6d3d1" roughness={0.6} /></mesh>
        </group>
      );
    case "Vương miện":
      return (
        <group position={[0, 0.21, 0]}>
          <mesh><cylinderGeometry args={[0.185, 0.2, 0.06, 16]} /><meshStandardMaterial color="#facc15" metalness={0.75} roughness={0.3} /></mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[Math.sin((i / 5) * Math.PI * 2) * 0.185, 0.07, Math.cos((i / 5) * Math.PI * 2) * 0.185]}>
              <coneGeometry args={[0.032, 0.1, 6]} /><meshStandardMaterial color="#fde047" metalness={0.75} roughness={0.3} />
            </mesh>
          ))}
        </group>
      );
    case "Halo":
      return <mesh position={[0, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.12, 0.018, 8, 24]} /><meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={1.6} /></mesh>;
    case "Nơ":
      return (
        <group position={[0.13, 0.24, -0.06]} rotation={[0, 0.4, 0]}>
          <mesh position={[-0.04, 0, 0]} rotation={[0, 0, 0.5]}><coneGeometry args={[0.035, 0.08, 6]} /><meshStandardMaterial color="#f472b6" roughness={0.7} /></mesh>
          <mesh position={[0.04, 0, 0]} rotation={[0, 0, -0.5]}><coneGeometry args={[0.035, 0.08, 6]} /><meshStandardMaterial color="#f472b6" roughness={0.7} /></mesh>
          <mesh><sphereGeometry args={[0.025, 8, 8]} /><meshStandardMaterial color="#ec4899" roughness={0.7} /></mesh>
        </group>
      );
    case "Bông tai":
      return (
        <group>
          <mesh position={[-0.2, 0.05, 0]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#f9a8d4" roughness={0.8} /></mesh>
          <mesh position={[0.2, 0.05, 0]}><sphereGeometry args={[0.05, 8, 8]} /><meshStandardMaterial color="#f9a8d4" roughness={0.8} /></mesh>
        </group>
      );
    case "Mặt nạ":
      return <mesh position={[0, 0.0, -0.215]}><boxGeometry args={[0.3, 0.24, 0.03]} /><meshStandardMaterial color="#312e81" roughness={0.5} metalness={0.4} /></mesh>;
    case "Băng đô":
      return <mesh position={[0, 0.2, 0]} rotation={[0.4, 0, 0]}><torusGeometry args={[0.2, 0.026, 6, 18, Math.PI]} /><meshStandardMaterial color="#a855f7" roughness={0.7} /></mesh>;
    default:
      return null;
  }
}

function VoxelViewer({
  shirtColor,
  hairColor = "#2a1a10",
  hairStyle,
  accessory,
  gender,
  isPlaying = false,
  isReacting = false,
  seed = 0,
  isFirstPerson = false,
  emote,
}: {
  shirtColor: string;
  hairColor?: string;
  hairStyle?: string;
  accessory?: string;
  gender?: string;
  isPlaying?: boolean;
  isReacting?: boolean;
  seed?: number;
  isFirstPerson?: boolean;
  emote?: ActiveEmote;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (isFirstPerson) return;
    const t = state.clock.elapsedTime + seed;
    // Emote performance (room:emote): while one is active it overrides the
    // idle/reaction pose. Durations: jump 1.2s, clap 2s, wave 2.4s, dance 3s.
    const emoteElapsed = emote ? (Date.now() - emote.startedAt) / 1000 : Infinity;
    const emoteDuration = emote?.kind === "dance" ? 3 : emote?.kind === "wave" ? 2.4 : emote?.kind === "clap" ? 2 : 1.2;
    const emoteActive = Boolean(emote) && emoteElapsed >= 0 && emoteElapsed < emoteDuration;
    // Breathing & subtle body bobbing (+ the jump arc while jumping)
    if (groupRef.current) {
      const jumpOffset = emoteActive && emote?.kind === "jump"
        ? Math.abs(Math.sin((emoteElapsed / emoteDuration) * Math.PI * 2)) * 0.22
        : 0;
      groupRef.current.position.y = 0.45 + Math.sin(t * 1.8) * 0.007 + jumpOffset;
      groupRef.current.rotation.z = emoteActive && emote?.kind === "dance" ? Math.sin(t * 6) * 0.09 : 0;
    }
    if (emoteActive && headRef.current && leftArmRef.current && rightArmRef.current) {
      if (emote?.kind === "dance") {
        leftArmRef.current.rotation.x = -0.7 + Math.sin(t * 7) * 0.55;
        rightArmRef.current.rotation.x = -0.7 + Math.cos(t * 7) * 0.55;
        leftArmRef.current.rotation.z = 0;
        rightArmRef.current.rotation.z = 0;
        headRef.current.rotation.z = Math.sin(t * 7) * 0.12;
        headRef.current.rotation.x = Math.abs(Math.sin(t * 7)) * 0.12;
      } else if (emote?.kind === "wave") {
        rightArmRef.current.rotation.x = -2.7;
        rightArmRef.current.rotation.z = Math.sin(t * 11) * 0.45;
        leftArmRef.current.rotation.x = Math.sin(t * 1.4) * 0.03;
        leftArmRef.current.rotation.z = 0;
      } else if (emote?.kind === "clap") {
        leftArmRef.current.rotation.x = -1.25;
        rightArmRef.current.rotation.x = -1.25;
        leftArmRef.current.rotation.z = 0.28 + Math.sin(t * 12) * 0.16;
        rightArmRef.current.rotation.z = -0.28 - Math.sin(t * 12) * 0.16;
      } else {
        // jump: both arms up
        leftArmRef.current.rotation.x = -2.9;
        rightArmRef.current.rotation.x = -2.9;
        leftArmRef.current.rotation.z = 0;
        rightArmRef.current.rotation.z = 0;
      }
      return;
    }
    // Head animation: reacts or gently nods with movie rhythm
    if (headRef.current) {
      if (!isReacting) headRef.current.rotation.z = 0;
      if (isReacting) {
        headRef.current.rotation.x = Math.sin(t * 8) * 0.14;
        headRef.current.rotation.z = Math.cos(t * 6) * 0.09;
      } else if (isPlaying) {
        headRef.current.rotation.x = Math.sin(t * 2.2) * 0.035;
        headRef.current.rotation.y = Math.sin(t * 1.2) * 0.04;
      } else {
        headRef.current.rotation.x = Math.sin(t * 0.8) * 0.015;
        headRef.current.rotation.y = Math.sin(t * 0.5) * 0.02;
      }
    }
    // Arms cheering or clapping during reaction
    if (leftArmRef.current && rightArmRef.current) {
      if (isReacting) {
        leftArmRef.current.rotation.x = -1.1 + Math.sin(t * 10) * 0.35;
        rightArmRef.current.rotation.x = -1.1 + Math.cos(t * 10) * 0.35;
      } else {
        leftArmRef.current.rotation.x = Math.sin(t * 1.4) * 0.03;
        rightArmRef.current.rotation.x = Math.sin(t * 1.4) * 0.03;
        leftArmRef.current.rotation.z = 0;
        rightArmRef.current.rotation.z = 0;
      }
    }
  });

  // In first-person audience view (camera at head level looking forward),
  // hide head and chest to prevent any field-of-view clipping while keeping
  // lower legs and popcorn tub visible if looking down!
  if (isFirstPerson) {
    return (
      <group position={[0, 0.45, 0]}>
        {gender === "female" ? (
          <mesh position={[0, 0.17, 0.3]}>
            <cylinderGeometry args={[0.14, 0.29, 0.36, 12]} />
            <meshStandardMaterial color={shirtColor} roughness={0.7} />
          </mesh>
        ) : (
          <>
            <RoundedBox position={[-0.11, 0.08, 0.34]} args={[0.14, 0.17, 0.66]} radius={0.06} smoothness={3}>
              <meshStandardMaterial color="#252638" roughness={0.85} />
            </RoundedBox>
            <RoundedBox position={[0.11, 0.08, 0.34]} args={[0.14, 0.17, 0.66]} radius={0.06} smoothness={3}>
              <meshStandardMaterial color="#252638" roughness={0.85} />
            </RoundedBox>
          </>
        )}
        <group position={[0, 0.22, 0.3]}>
          <mesh rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.05, 0.14, 12]} />
            <meshStandardMaterial color="#ef4444" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.07, 0]}>
            <sphereGeometry args={[0.065, 8, 8]} />
            <meshStandardMaterial color="#fef08a" roughness={0.9} />
          </mesh>
        </group>
      </group>
    );
  }

  return (
    <group ref={groupRef} position={[0, 0.45, 0]}>
      {/* Torso */}
      <RoundedBox position={[0, 0.35, 0]} args={[0.42, 0.44, 0.3]} radius={0.08} smoothness={3}>
        <meshStandardMaterial color={shirtColor} roughness={0.7} />
      </RoundedBox>
      {/* Legs (pants) or a skirt for female avatars */}
      {gender === "female" ? (
        <mesh position={[0, 0.17, 0.3]}>
          <cylinderGeometry args={[0.14, 0.29, 0.36, 12]} />
          <meshStandardMaterial color={shirtColor} roughness={0.7} />
        </mesh>
      ) : (
        <>
          <RoundedBox position={[-0.11, 0.08, 0.34]} args={[0.14, 0.17, 0.66]} radius={0.06} smoothness={3}>
            <meshStandardMaterial color="#252638" roughness={0.85} />
          </RoundedBox>
          <RoundedBox position={[0.11, 0.08, 0.34]} args={[0.14, 0.17, 0.66]} radius={0.06} smoothness={3}>
            <meshStandardMaterial color="#252638" roughness={0.85} />
          </RoundedBox>
        </>
      )}
      {/* Shoes */}
      <RoundedBox position={[-0.11, 0.08, 0.69]} args={[0.15, 0.13, 0.25]} radius={0.05} smoothness={3}>
        <meshStandardMaterial color="#11111a" roughness={0.75} />
      </RoundedBox>
      <RoundedBox position={[0.11, 0.08, 0.69]} args={[0.15, 0.13, 0.25]} radius={0.05} smoothness={3}>
        <meshStandardMaterial color="#11111a" roughness={0.75} />
      </RoundedBox>

      {/* Big round chibi head with animated pivot */}
      <group ref={headRef} position={[0, 0.79, 0.02]}>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.205, 20, 16]} />
          <meshStandardMaterial color="#ffd9b3" roughness={0.8} />
        </mesh>
        <HairMesh style={hairStyle} color={hairColor} female={gender === "female"} />
        {/* Eyes */}
        <mesh position={[-0.075, 0.01, -0.205]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color="#211a21" roughness={0.5} />
        </mesh>
        <mesh position={[0.075, 0.01, -0.205]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color="#211a21" roughness={0.5} />
        </mesh>
        {/* Eye shine */}
        <mesh position={[-0.068, 0.02, -0.228]}><sphereGeometry args={[0.008, 6, 6]} /><meshStandardMaterial color="#ffffff" /></mesh>
        <mesh position={[0.082, 0.02, -0.228]}><sphereGeometry args={[0.008, 6, 6]} /><meshStandardMaterial color="#ffffff" /></mesh>
        {/* Blush */}
        <mesh position={[-0.125, -0.045, -0.175]}><sphereGeometry args={[0.028, 8, 8]} /><meshStandardMaterial color="#f9a8d4" transparent opacity={0.55} roughness={0.9} /></mesh>
        <mesh position={[0.125, -0.045, -0.175]}><sphereGeometry args={[0.028, 8, 8]} /><meshStandardMaterial color="#f9a8d4" transparent opacity={0.55} roughness={0.9} /></mesh>
        {/* Nose */}
        <mesh position={[0, -0.05, -0.22]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color="#e7a12d" roughness={0.7} />
        </mesh>
        {/* Smile */}
        <mesh position={[0, -0.09, -0.2]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.03, 0.008, 6, 12, Math.PI]} />
          <meshStandardMaterial color="#9a3412" roughness={0.6} />
        </mesh>
        {/* Hat / glasses / headset — rides with the head */}
        <AccessoryMesh name={accessory} />
      </group>

      {/* Arms & Hands with cheering capabilities */}
      <group ref={leftArmRef} position={[-0.25, 0.35, 0.03]}>
        <RoundedBox position={[0, -0.04, 0]} args={[0.1, 0.18, 0.25]} radius={0.045} smoothness={3}>
          <meshStandardMaterial color={shirtColor} roughness={0.7} />
        </RoundedBox>
      </group>
      <group ref={rightArmRef} position={[0.25, 0.35, 0.03]}>
        <RoundedBox position={[0, -0.04, 0]} args={[0.1, 0.18, 0.25]} radius={0.045} smoothness={3}>
          <meshStandardMaterial color={shirtColor} roughness={0.7} />
        </RoundedBox>
      </group>

      {/* Mini Popcorn Tub in viewer's lap */}
      <group position={[0, 0.22, 0.3]}>
        <mesh rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.05, 0.14, 12]} />
          <meshStandardMaterial color="#ef4444" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.07, 0]}>
          <sphereGeometry args={[0.065, 8, 8]} />
          <meshStandardMaterial color="#fef08a" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

// One standing viewer in the same rounded style as the seated audience —
// big round head, bowl hair cap, pastel shirt, dark pants. Faces the
// audience (+Z). Arms pivot at the shoulders; pose sets their angles.
function StandingViewer({ shirt, pose }: { shirt: string; pose: [number, number] }) {
  return (
    <group>
      <RoundedBox position={[-0.1, 0.045, 0.02]} args={[0.15, 0.09, 0.24]} radius={0.03} smoothness={2}>
        <meshStandardMaterial color="#11111a" roughness={0.75} />
      </RoundedBox>
      <RoundedBox position={[0.1, 0.045, 0.02]} args={[0.15, 0.09, 0.24]} radius={0.03} smoothness={2}>
        <meshStandardMaterial color="#11111a" roughness={0.75} />
      </RoundedBox>
      <RoundedBox position={[-0.1, 0.34, 0]} args={[0.14, 0.5, 0.16]} radius={0.04} smoothness={2}>
        <meshStandardMaterial color="#1e293b" roughness={0.85} />
      </RoundedBox>
      <RoundedBox position={[0.1, 0.34, 0]} args={[0.14, 0.5, 0.16]} radius={0.04} smoothness={2}>
        <meshStandardMaterial color="#1e293b" roughness={0.85} />
      </RoundedBox>
      <RoundedBox position={[0, 0.84, 0]} args={[0.44, 0.5, 0.28]} radius={0.08} smoothness={3}>
        <meshStandardMaterial color={shirt} roughness={0.7} />
      </RoundedBox>
      <group position={[-0.27, 1.05, 0]} rotation={[0, 0, pose[0]]}>
        <RoundedBox position={[0, -0.17, 0]} args={[0.1, 0.42, 0.1]} radius={0.04} smoothness={2}>
          <meshStandardMaterial color={shirt} roughness={0.7} />
        </RoundedBox>
        <mesh position={[0, -0.4, 0]}>
          <sphereGeometry args={[0.055, 10, 8]} />
          <meshStandardMaterial color="#ffd9b3" roughness={0.8} />
        </mesh>
      </group>
      <group position={[0.27, 1.05, 0]} rotation={[0, 0, pose[1]]}>
        <RoundedBox position={[0, -0.17, 0]} args={[0.1, 0.42, 0.1]} radius={0.04} smoothness={2}>
          <meshStandardMaterial color={shirt} roughness={0.7} />
        </RoundedBox>
        <mesh position={[0, -0.4, 0]}>
          <sphereGeometry args={[0.055, 10, 8]} />
          <meshStandardMaterial color="#ffd9b3" roughness={0.8} />
        </mesh>
      </group>
      <mesh position={[0, 1.3, 0]}>
        <sphereGeometry args={[0.205, 20, 16]} />
        <meshStandardMaterial color="#ffd9b3" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.41, -0.01]} rotation={[-0.3, 0, 0]}>
        <sphereGeometry args={[0.208, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#2a1a10" roughness={0.9} />
      </mesh>
    </group>
  );
}

// Three viewers standing on glowing stage spots, gently bouncing and
// cheering — the way the stage looks on choigivui, where audience avatars
// hop up and dance in a row in front of the screen.
function StagePerformers() {
  const figureRefs = useRef<Array<THREE.Group | null>>([]);
  const ringRefs = useRef<Array<THREE.Mesh | null>>([]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    figureRefs.current.forEach((g, i) => {
      if (!g) return;
      g.position.y = Math.abs(Math.sin(t * 2.4 + i * 1.4)) * 0.055;
      g.rotation.z = Math.sin(t * 2.4 + i * 1.4) * 0.045;
    });
    ringRefs.current.forEach((r) => {
      if (r) r.rotation.z += delta * 0.8;
    });
  });

  // A tight center-stage row, like the choigivui photo: wider spacing hides
  // the side figures behind the seat blocks from this fixed camera.
  const spots: Array<{ x: number; ring: string; fill: string; shirt: string; pose: [number, number] }> = [
    { x: -1.35, ring: "#a3e635", fill: "#3f6212", shirt: "#c4b5fd", pose: [2.6, -2.6] },
    { x: 0, ring: "#f472b6", fill: "#831843", shirt: "#6ee7b7", pose: [2.8, -0.5] },
    { x: 1.35, ring: "#22d3ee", fill: "#164e63", shirt: "#86efac", pose: [1.9, -2.9] },
  ];

  return (
    <group position={[0, 0.4, -2.3]}>
      {/* Low riser platform: lifts the trio clear of the seat stack so all
          three read from the back-of-house camera, not just the center one */}
      <mesh position={[0, -0.175, 0]}>
        <boxGeometry args={[4.6, 0.35, 1.15]} />
        <meshStandardMaterial color="#17102a" roughness={0.85} />
      </mesh>
      <mesh position={[0, -0.02, 0.58]}>
        <boxGeometry args={[4.6, 0.045, 0.05]} />
        <meshBasicMaterial color="#7c3aed" />
      </mesh>
      {spots.map((s, i) => (
        <group key={s.x} position={[s.x, 0, 0]}>
          <mesh
            ref={(m) => {
              ringRefs.current[i] = m;
            }}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.02, 0]}
          >
            <ringGeometry args={[0.55, 0.75, 32]} />
            <meshBasicMaterial color={s.ring} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <circleGeometry args={[0.55, 32]} />
            <meshBasicMaterial color={s.fill} transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>
          <group
            ref={(g) => {
              figureRefs.current[i] = g;
            }}
            scale={0.92}
          >
            <StandingViewer shirt={s.shirt} pose={s.pose} />
          </group>
        </group>
      ))}
    </group>
  );
}


// Live stage: real room members performing on the five stage spots while
// their 30-second turn runs (server-driven via stage:update). Replaces the
// ambient trio whenever at least one performer is up.
const STAGE_SPOT_X = [-2.6, -1.3, 0, 1.3, 2.6];
const STAGE_RING_COLORS = ["#a3e635", "#f472b6", "#22d3ee", "#fbbf24", "#c084fc"];
const STAGE_POSES: Array<[number, number]> = [[2.6, -2.6], [2.8, -0.5], [1.9, -2.9], [2.4, -2.2], [2.9, -1.2]];

function LiveStagePerformers({ performers }: { performers: StagePerformerInfo[] }) {
  const figureRefs = useRef<Array<THREE.Group | null>>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    figureRefs.current.forEach((g, i) => {
      if (!g) return;
      g.position.y = Math.abs(Math.sin(t * 3 + i * 1.3)) * 0.07;
      g.rotation.z = Math.sin(t * 3 + i * 1.3) * 0.06;
    });
  });

  return (
    <group position={[0, 0.4, -2.3]}>
      <mesh position={[0, -0.175, 0]}>
        <boxGeometry args={[7.4, 0.35, 1.15]} />
        <meshStandardMaterial color="#17102a" roughness={0.85} />
      </mesh>
      <mesh position={[0, -0.02, 0.58]}>
        <boxGeometry args={[7.4, 0.045, 0.05]} />
        <meshBasicMaterial color="#7c3aed" />
      </mesh>
      {performers.slice(0, 5).map((p, i) => (
        <group key={p.userId} position={[STAGE_SPOT_X[i], 0, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <ringGeometry args={[0.55, 0.75, 32]} />
            <meshBasicMaterial color={STAGE_RING_COLORS[i]} side={THREE.DoubleSide} />
          </mesh>
          <group
            ref={(g) => {
              figureRefs.current[i] = g;
            }}
            scale={0.92}
          >
            <StandingViewer shirt={shirtHex(p.appearance?.shirtColor, STAGE_RING_COLORS[i])} pose={STAGE_POSES[i]} />
          </group>
          <Suspense fallback={null}>
            <Text
              position={[0, 1.66, 0.1]}
              fontSize={p.displayName.length > 8 ? 0.075 : 0.095}
              color="#fde68a"
              anchorX="center"
              anchorY="middle"
            >
              {p.displayName}
            </Text>
          </Suspense>
        </group>
      ))}
    </group>
  );
}

// One fireworks burst: ~90 particles launched from above the stage,
// integrated analytically each frame (position = v*t - g*t²/2), fading
// out over 2 seconds. Geometry is built imperatively to stay independent
// of the R3F version's attribute JSX API.
function FireworksBurst({ burstId, at }: { burstId: number; at: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const data = useMemo(() => {
    const count = 90;
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = ["#f472b6", "#22d3ee", "#a3e635", "#fbbf24", "#c084fc", "#ffffff"].map((c) => new THREE.Color(c));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 1.7 + Math.random() * 1.6;
      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      velocities[i * 3 + 1] = Math.cos(phi) * speed * 0.9 + 0.7;
      velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
      const color = palette[i % palette.length];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return { geo, velocities, count };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burstId]);

  useFrame(() => {
    const points = pointsRef.current;
    if (!points) return;
    const t = (Date.now() - at) / 1000;
    if (t < 0 || t > 2) {
      points.visible = false;
      return;
    }
    points.visible = true;
    const pos = points.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < data.count; i++) {
      pos.setXYZ(
        i,
        data.velocities[i * 3] * t,
        data.velocities[i * 3 + 1] * t - 1.35 * t * t,
        data.velocities[i * 3 + 2] * t
      );
    }
    pos.needsUpdate = true;
    (points.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - t / 2);
  });

  return (
    <points ref={pointsRef} position={[0, 5.6, -3.1]} geometry={data.geo}>
      <pointsMaterial size={0.085} vertexColors transparent depthWrite={false} />
    </points>
  );
}

// Small low-poly heart floating between two adjacent occupied seats —
// the "couple seat" marker. Built from geometry (no emoji glyph needed).
function CoupleHeart() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.position.y = Math.sin(t * 2) * 0.03;
    ref.current.rotation.y = Math.sin(t * 1.3) * 0.3;
  });
  return (
    <group ref={ref}>
      <mesh position={[-0.05, 0.03, 0]}>
        <sphereGeometry args={[0.055, 10, 8]} />
        <meshBasicMaterial color="#f472b6" />
      </mesh>
      <mesh position={[0.05, 0.03, 0]}>
        <sphereGeometry args={[0.055, 10, 8]} />
        <meshBasicMaterial color="#f472b6" />
      </mesh>
      <mesh position={[0, -0.05, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.078, 0.13, 4]} />
        <meshBasicMaterial color="#f472b6" />
      </mesh>
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
  isPlaying?: boolean;
  isReacting?: boolean;
  seed?: number;
  isFirstPerson?: boolean;
  emote?: ActiveEmote;
  coupleHeart?: boolean;
}

function CinemaSeat({
  x,
  y,
  z,
  label,
  isMySeat,
  occupant,
  dummyViewerColor,
  onSelect,
  isPlaying = false,
  isReacting = false,
  seed = 0,
  isFirstPerson = false,
  emote,
  coupleHeart = false,
}: CinemaSeatProps) {
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
      <mesh position={[0, 0.1, 0.04]}>
        <cylinderGeometry args={[0.075, 0.1, 0.2, 10]} />
        <meshStandardMaterial color="#27232a" metalness={0.65} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.035, 0.04]}>
        <cylinderGeometry args={[0.22, 0.22, 0.05, 12]} />
        <meshStandardMaterial color="#27232a" metalness={0.6} roughness={0.4} />
      </mesh>
      {isMySeat && (
        <mesh position={[0, 0.072, 0.04]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.43, 32]} />
          <meshBasicMaterial color="#22d3ee" toneMapped={false} />
        </mesh>
      )}
      <RoundedBox position={[0, 0.28, 0]} args={[0.68, 0.24, 0.58]} radius={0.09} smoothness={4}>
        <meshStandardMaterial color={cushionColor} roughness={0.65} />
      </RoundedBox>

      {/* Seat Backrest */}
      <RoundedBox position={[0, 0.68, -0.22]} rotation={[-0.08, 0, 0]} args={[0.68, 0.68, 0.16]} radius={0.1} smoothness={4}>
        <meshStandardMaterial color={backrestColor} roughness={0.65} />
      </RoundedBox>

      {/* Left Armrest */}
      <mesh position={[-0.38, 0.18, 0]}>
        <cylinderGeometry args={[0.025, 0.035, 0.27, 8]} />
        <meshStandardMaterial color={armrestColor} metalness={0.45} roughness={0.35} />
      </mesh>
      {/* Right Armrest */}
      <mesh position={[0.38, 0.18, 0]}>
        <cylinderGeometry args={[0.025, 0.035, 0.27, 8]} />
        <meshStandardMaterial color={armrestColor} metalness={0.45} roughness={0.35} />
      </mesh>
      <RoundedBox position={[-0.38, 0.36, 0.02]} args={[0.12, 0.12, 0.58]} radius={0.055} smoothness={4}>
        <meshStandardMaterial color={armrestColor} metalness={0.25} roughness={0.38} />
      </RoundedBox>
      <RoundedBox position={[0.38, 0.36, 0.02]} args={[0.12, 0.12, 0.58]} radius={0.055} smoothness={4}>
        <meshStandardMaterial color={armrestColor} metalness={0.25} roughness={0.38} />
      </RoundedBox>

      {/* Seat Number Tag — SafeText: if the troika font CDN is slow/blocked,
          only this label hides; the seat and the rest of the scene still render. */}
      <Suspense fallback={null}>
        <Text
          position={[0, 0.85, -0.14]}
          fontSize={0.12}
          color={isMySeat ? "#ffffff" : "#fbcfe8"}
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      </Suspense>

      {/* Couple marker: this seat and its right neighbour are both taken */}
      {coupleHeart && (
        <group position={[0.42, 1.3, 0.12]}>
          <CoupleHeart />
        </group>
      )}

      {/* Actual Occupant OR Ambient Voxel Viewer */}
      {occupant ? (
        <>
          <VoxelViewer
            shirtColor={isMySeat && !occupant.appearance?.shirtColor ? "#06b6d4" : shirtHex(occupant.appearance?.shirtColor)}
            hairColor={HAIR_HEX[seed % HAIR_HEX.length]}
            hairStyle={occupant.appearance?.hairStyle}
            accessory={occupant.appearance?.accessory}
            gender={occupant.gender}
            isPlaying={isPlaying}
            isReacting={isReacting}
            seed={seed}
            isFirstPerson={isFirstPerson}
            emote={emote}
          />
          {!isFirstPerson && (
            <group position={[0, 0.8, 0.175]}>
              <Suspense fallback={null}>
                <Text
                  fontSize={occupant.displayName.length > 8 ? 0.075 : 0.095}
                  maxWidth={0.34}
                  textAlign="center"
                  color={isMySeat ? "#ffd94d" : "#ffffff"}
                  anchorX="center"
                  anchorY="middle"
                  outlineWidth={0.006}
                  outlineColor="#1a0b2e"
                >
                  {isMySeat ? `★ ${occupant.displayName}` : occupant.displayName}
                </Text>
              </Suspense>
            </group>
          )}
        </>
      ) : dummyViewerColor ? (
        <VoxelViewer shirtColor={dummyViewerColor} isPlaying={isPlaying} seed={seed} />
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
      <Suspense fallback={null}>
        <Text fontSize={0.65} anchorX="center" anchorY="middle">
          {emoji}
        </Text>
      </Suspense>
    </group>
  );
}

// Camera rig supporting wide hall overview and authentic first-person audience view
// directly from the character's head looking at the center of the cinema screen.
function CameraRig({ viewMode, selectedSeat, overlayElement }: { viewMode: CameraViewMode; selectedSeat?: string; overlayElement?: HTMLDivElement | null }) {
  const { camera, gl } = useThree();
  const targetPosition = useRef(new THREE.Vector3());
  const basePosition = useRef(new THREE.Vector3(0, 6.8, 15.5));
  const targetLookAt = useRef(new THREE.Vector3());
  const currentLookAt = useRef(new THREE.Vector3(0, 3.8, -5.22));
  const zoomTarget = useRef(1);
  const zoomCurrent = useRef(1);

  const seatPose = useMemo(() => {
    // Default to D8 (middle row, center aisle) if no seat is selected
    const label = selectedSeat || "D8";
    const row = Math.max(0, "ABCDEF".indexOf(label[0] || "D"));
    const col = Math.max(0, Number(label.slice(1)) - 1);
    const half = col % 8;
    const x = col < 8 ? -6.2 + half * 0.78 : 0.74 + half * 0.78;
    const z = -1.2 + row * 0.92;
    return { x, y: row * 0.16, z };
  }, [selectedSeat]);

  useEffect(() => {
    if (viewMode === "audience") {
      // First-person perspective directly from the head/eyes of the character in the seat
      // looking straight ahead at the center of the cinema screen (y=3.8, z=-5.22)
      targetPosition.current.set(seatPose.x, seatPose.y + 1.25, seatPose.z - 0.12);
      targetLookAt.current.set(0, 3.8, -5.22);
      zoomTarget.current = 1.0;
      zoomCurrent.current = 1.0;
    } else if (viewMode === "panorama") {
      // High, pulled-back vantage: the whole hall — screen, stage and all
      // seat rows — in a single frame.
      targetPosition.current.set(0, 7.9, 16.9);
      targetLookAt.current.set(0, 1.8, -5.22);
      zoomTarget.current = 1.0;
      zoomCurrent.current = 1.0;
    } else if (viewMode === "reverse") {
      // From just in front of the screen, looking back at the audience
      // (the video overlay hides itself: the screen is behind the camera).
      targetPosition.current.set(0, 3.4, -4.2);
      targetLookAt.current.set(0, 1.0, 3.0);
      zoomTarget.current = 1.0;
      zoomCurrent.current = 1.0;
    } else if (viewMode === "focus") {
      // Straight at the screen from mid-hall: the picture fills the frame.
      targetPosition.current.set(0, 3.9, 4.6);
      targetLookAt.current.set(0, 3.8, -5.22);
      zoomTarget.current = 1.0;
      zoomCurrent.current = 1.0;
    } else {
      // Wide cinematic overview of the grand cinema hall
      targetPosition.current.set(0, 6.8, 15.5);
      targetLookAt.current.set(0, 2.4, -0.6);
      zoomTarget.current = 0.85;
      zoomCurrent.current = 0.85;
    }
  }, [camera, viewMode, seatPose]);

  useEffect(() => {
    const frame = overlayElement?.parentElement ?? gl.domElement.parentElement;
    if (!frame) return;
    let previousPinchDistance = 0;
    // Zoom is clamped so the camera can never leave the auditorium:
    // at zoom 1.15 the wide camera already sits near the back wall (z≈17.9 < 18.5).
    const clampZoom = (value: number) => Math.max(0.45, Math.min(1.15, value));
    const distance = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomTarget.current = clampZoom(zoomTarget.current * (event.deltaY < 0 ? 0.92 : 1.08));
    };
    const onTouchStart = (event: TouchEvent) => {
      previousPinchDistance = event.touches.length >= 2 ? distance(event.touches) : 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length < 2) { previousPinchDistance = 0; return; }
      event.preventDefault();
      const nextDistance = distance(event.touches);
      if (previousPinchDistance > 0 && nextDistance > 0) zoomTarget.current = clampZoom(zoomTarget.current / (nextDistance / previousPinchDistance));
      previousPinchDistance = nextDistance;
    };
    const onTouchEnd = (event: TouchEvent) => {
      previousPinchDistance = event.touches.length >= 2 ? distance(event.touches) : 0;
    };
    frame.addEventListener("wheel", onWheel, { passive: false });
    frame.addEventListener("touchstart", onTouchStart, { passive: true });
    frame.addEventListener("touchmove", onTouchMove, { passive: false });
    frame.addEventListener("touchend", onTouchEnd, { passive: true });
    frame.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      frame.removeEventListener("wheel", onWheel);
      frame.removeEventListener("touchstart", onTouchStart);
      frame.removeEventListener("touchmove", onTouchMove);
      frame.removeEventListener("touchend", onTouchEnd);
      frame.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [gl, overlayElement]);

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-4.5 * delta);
    basePosition.current.lerp(targetPosition.current, k);
    currentLookAt.current.lerp(targetLookAt.current, k);
    zoomCurrent.current += (zoomTarget.current - zoomCurrent.current) * (1 - Math.exp(-6 * delta));

    if (viewMode === "audience") {
      // In audience first-person view, camera directly tracks head position
      camera.position.copy(basePosition.current);
    } else {
      camera.position.copy(currentLookAt.current).addScaledVector(basePosition.current.clone().sub(currentLookAt.current), zoomCurrent.current);
    }
    // Hard boundary clamp: walls x=±9.6, back wall z=18.5, ceiling y=9.5, screen wall z=-5.78
    camera.position.x = Math.max(-9.3, Math.min(9.3, camera.position.x));
    camera.position.y = Math.max(0.4, Math.min(9.3, camera.position.y));
    camera.position.z = Math.max(-5.6, Math.min(18.2, camera.position.z));
    camera.lookAt(currentLookAt.current);
    if (overlayElement) {
      const corners = [
        new THREE.Vector3(-4.905, 6.55, -5.22), new THREE.Vector3(4.905, 6.55, -5.22),
        new THREE.Vector3(4.905, 1.05, -5.22), new THREE.Vector3(-4.905, 1.05, -5.22),
      ];
      const projected = corners.map((point) => point.project(camera));
      const visible = projected.every((point) => point.z < 1 && point.z > -1);
      if (visible) {
        // CSS transform coordinates are local to the frame containing both
        // the canvas and overlay. Including viewport offsets here moves the
        // projected video away from its 3D screen (especially in POV mode).
        const canvasRect = gl.domElement.getBoundingClientRect();
        const frameRect = overlayElement.parentElement?.getBoundingClientRect() ?? canvasRect;
        const p = projected.map((point) => ({
          x: canvasRect.left + (point.x + 1) * canvasRect.width / 2 - frameRect.left,
          y: canvasRect.top + (1 - point.y) * canvasRect.height / 2 - frameRect.top,
        }));
        const w = 1280, h = 720;
        const src = [[0,0],[w,0],[w,h],[0,h]];
        const a: number[][] = [];
        for (let i=0;i<4;i++) { const [x,y]=src[i]; const {x:u,y:v}=p[i]; a.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]); }
        for(let i=0;i<8;i++){ let pivot=i; for(let j=i+1;j<8;j++) if(Math.abs(a[j][i])>Math.abs(a[pivot][i])) pivot=j; [a[i],a[pivot]]=[a[pivot],a[i]]; const d=a[i][i]; if (Math.abs(d) < 1e-10) { overlayElement.style.visibility="hidden"; return; } for(let k=i;k<9;k++) a[i][k]/=d; for(let j=0;j<8;j++) if(j!==i){const f=a[j][i];for(let k=i;k<9;k++)a[j][k]-=f*a[i][k];} }
        const [h0,h1,h2,h3,h4,h5,h6,h7]=a.map(row=>row[8]);
        overlayElement.style.width=`${w}px`; overlayElement.style.height=`${h}px`; overlayElement.style.left="0"; overlayElement.style.top="0"; overlayElement.style.transformOrigin="0 0"; overlayElement.style.transform=`matrix3d(${h0},${h3},0,${h6},${h1},${h4},0,${h7},0,0,1,0,${h2},${h5},0,1)`; overlayElement.style.visibility="visible";
      } else overlayElement.style.visibility="hidden";
    }
  });
  return null;
}

// Grand enclosed cinema room with acoustic walls, side wall sconces,
// projection booth window, ceiling beams, and auditorium carpet.
function CinemaEnclosure({ theme, isPlaying }: { theme: string; isPlaying: boolean }) {
  const isSky = theme === "sky";
  const isCyberpunk = theme === "cyberpunk";
  const isSunset = theme === "sunset";

  const wallColor = isSky ? "#091326" : isCyberpunk ? "#040913" : isSunset ? "#1d0b06" : "#110b1e";
  const sconceGlow = isSky ? "#38bdf8" : isCyberpunk ? "#06b6d4" : isSunset ? "#f97316" : "#f59e0b";
  const ceilingColor = isSky ? "#060d1c" : isCyberpunk ? "#02060e" : isSunset ? "#140603" : "#0c0817";
  const carpetColor = isSky ? "#081022" : isCyberpunk ? "#030812" : isSunset ? "#180904" : "#0d0916";

  const sconceZs = [-3.5, 1.2, 5.8, 10.5, 15.2];

  return (
    <group>
      {/* 1. Entire Auditorium Floor Carpet */}
      <mesh position={[0, -0.15, 6.2]}>
        <boxGeometry args={[19.6, 0.12, 24.8]} />
        <meshStandardMaterial color={carpetColor} roughness={0.92} />
      </mesh>

      {/* 2. Left Enclosing Wall */}
      <mesh position={[-9.6, 4.6, 6.2]}>
        <boxGeometry args={[0.3, 10.0, 24.8]} />
        <meshStandardMaterial color={wallColor} roughness={0.88} />
      </mesh>

      {/* Left Wall Acoustic Trim Panels & Warm Cinema Sconces */}
      {sconceZs.map((z, idx) => (
        <group key={`left-trim-${idx}`} position={[-9.42, 4.6, z]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.08, 8.5, 1.8]} />
            <meshStandardMaterial color={isCyberpunk ? "#081626" : isSunset ? "#2a120a" : "#19112a"} roughness={0.8} />
          </mesh>
          <mesh position={[0.08, -0.8, 0]}>
            <boxGeometry args={[0.08, 0.65, 0.18]} />
            <meshStandardMaterial color="#2d2538" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0.12, -0.8, 0]}>
            <boxGeometry args={[0.06, 0.42, 0.14]} />
            <meshStandardMaterial color={sconceGlow} emissive={sconceGlow} emissiveIntensity={isPlaying ? 1.4 : 2.8} />
          </mesh>
          <pointLight position={[0.4, -0.8, 0]} intensity={isPlaying ? 4 : 10} color={sconceGlow} distance={7} />
        </group>
      ))}

      {/* 3. Right Enclosing Wall */}
      <mesh position={[9.6, 4.6, 6.2]}>
        <boxGeometry args={[0.3, 10.0, 24.8]} />
        <meshStandardMaterial color={wallColor} roughness={0.88} />
      </mesh>

      {/* Right Wall Acoustic Trim Panels & Warm Cinema Sconces */}
      {sconceZs.map((z, idx) => (
        <group key={`right-trim-${idx}`} position={[9.42, 4.6, z]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.08, 8.5, 1.8]} />
            <meshStandardMaterial color={isCyberpunk ? "#081626" : isSunset ? "#2a120a" : "#19112a"} roughness={0.8} />
          </mesh>
          <mesh position={[-0.08, -0.8, 0]}>
            <boxGeometry args={[0.08, 0.65, 0.18]} />
            <meshStandardMaterial color="#2d2538" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[-0.12, -0.8, 0]}>
            <boxGeometry args={[0.06, 0.42, 0.14]} />
            <meshStandardMaterial color={sconceGlow} emissive={sconceGlow} emissiveIntensity={isPlaying ? 1.4 : 2.8} />
          </mesh>
          <pointLight position={[-0.4, -0.8, 0]} intensity={isPlaying ? 4 : 10} color={sconceGlow} distance={7} />
        </group>
      ))}

      {/* 4. Back Wall Behind Audience */}
      <mesh position={[0, 4.6, 18.5]}>
        <boxGeometry args={[19.6, 10.0, 0.3]} />
        <meshStandardMaterial color={wallColor} roughness={0.88} />
      </mesh>

      {/* Projection Booth Window on Back Wall */}
      <group position={[0, 6.2, 18.32]}>
        <mesh>
          <boxGeometry args={[2.8, 1.4, 0.16]} />
          <meshStandardMaterial color="#0c0914" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0, -0.09]}>
          <planeGeometry args={[2.4, 1.0]} />
          <meshBasicMaterial color={isCyberpunk ? "#06b6d4" : isSky ? "#38bdf8" : "#e0e7ff"} />
        </mesh>
        <pointLight position={[0, 0, -0.4]} intensity={isPlaying ? 24 : 12} color="#e0e7ff" distance={16} />
      </group>

      {/* 5. Cinema Ceiling */}
      {isSky ? (
        // For Sky Theme: Roof perimeter with open skylight to view the 2,600 stars above
        <group position={[0, 9.5, 6.2]}>
          <mesh position={[-7.2, 0, 0]}><boxGeometry args={[5.2, 0.25, 24.8]} /><meshStandardMaterial color={ceilingColor} roughness={0.9} /></mesh>
          <mesh position={[7.2, 0, 0]}><boxGeometry args={[5.2, 0.25, 24.8]} /><meshStandardMaterial color={ceilingColor} roughness={0.9} /></mesh>
          <mesh position={[0, 0, -10.0]}><boxGeometry args={[9.4, 0.25, 5.0]} /><meshStandardMaterial color={ceilingColor} roughness={0.9} /></mesh>
          <mesh position={[0, 0, 10.0]}><boxGeometry args={[9.4, 0.25, 5.0]} /><meshStandardMaterial color={ceilingColor} roughness={0.9} /></mesh>
        </group>
      ) : (
        // Full enclosed cinema coffer ceiling
        <group position={[0, 9.5, 6.2]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[19.6, 0.25, 24.8]} />
            <meshStandardMaterial color={ceilingColor} roughness={0.9} />
          </mesh>
          {/* Architectural Ceiling Beams */}
          {[-8, -2, 4, 10, 16].map((bz) => (
            <mesh key={`beam-${bz}`} position={[0, -0.2, bz - 6.2]}>
              <boxGeometry args={[19.4, 0.35, 0.6]} />
              <meshStandardMaterial color={isCyberpunk ? "#061222" : isSunset ? "#240e06" : "#170f26"} roughness={0.8} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

const DISCO_COLORS = ["#f472b6", "#22d3ee", "#a3e635", "#c084fc", "#fbbf24", "#fb7185", "#34d399", "#60a5fa"];
const DISCO_BPM = 137;

// Disco mode: spinning mirror ball, eight sweeping laser beams, wall spot
// cones and two flash lights alternating on the beat (137 BPM). Rendered
// only while disco is on; room geometry here: walls x=±9.6, ceiling y=9.5.
function DiscoRig() {
  const spinRef = useRef<THREE.Group>(null);
  const ballRef = useRef<THREE.Mesh>(null);
  const beamRefs = useRef<Array<THREE.Group | null>>([]);
  const flashL = useRef<THREE.PointLight>(null);
  const flashR = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (spinRef.current) spinRef.current.rotation.y = -t * 0.55;
    if (ballRef.current) ballRef.current.rotation.y = t * 0.8;
    beamRefs.current.forEach((g, i) => {
      if (g) g.rotation.x = 0.95 + Math.sin(t * 1.4 + i * 1.7) * 0.38;
    });
    const beat = t * (DISCO_BPM / 60);
    if (flashL.current) flashL.current.intensity = 3 + 34 * Math.pow(1 - (beat % 1), 2);
    if (flashR.current) flashR.current.intensity = 3 + 34 * Math.pow(1 - ((beat + 0.5) % 1), 2);
  });

  return (
    <group>
      {/* Mirror ball on its mount rod under the ceiling */}
      <mesh position={[0, 8.95, -0.6]}>
        <cylinderGeometry args={[0.03, 0.03, 1.1, 6]} />
        <meshStandardMaterial color="#17131f" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh ref={ballRef} position={[0, 8.05, -0.6]}>
        <sphereGeometry args={[0.36, 24, 18]} />
        <meshStandardMaterial color="#d7daea" metalness={0.85} roughness={0.3} emissive="#23233a" flatShading />
      </mesh>

      {/* Laser beams sweeping from the ball */}
      <group ref={spinRef} position={[0, 8.05, -0.6]}>
        {DISCO_COLORS.map((color, i) => (
          <group key={color} rotation={[0, (i * Math.PI) / 4, 0]}>
            <group ref={(g) => { beamRefs.current[i] = g; }}>
              <mesh position={[0, 0, 6.5]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.2, 0.02, 13, 6, 1, true]} />
                <meshBasicMaterial color={color} transparent opacity={0.32} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
              </mesh>
            </group>
          </group>
        ))}
      </group>

      {/* Wall spotlight cones */}
      {([-1, 1] as const).map((side) =>
        [-4, -0.5, 3].map((z, i) => (
          <group key={`${side}-${z}`} position={[side * 9.3, 5.6, z]}>
            <group rotation={[0, side * -Math.PI / 2, 0]}>
              <group rotation={[0.55, 0, 0]}>
                <mesh position={[0, 0, 4.5]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[1.6, 0.12, 9, 12, 1, true]} />
                  <meshBasicMaterial color={DISCO_COLORS[(i + (side > 0 ? 3 : 0)) % DISCO_COLORS.length]} transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
                </mesh>
              </group>
            </group>
          </group>
        ))
      )}

      {/* Beat flashes */}
      <pointLight ref={flashL} position={[-4.5, 5.4, 0.5]} color="#ff2fb3" distance={20} />
      <pointLight ref={flashR} position={[4.5, 5.4, 0.5]} color="#22d3ee" distance={20} />
    </group>
  );
}

export function TheaterScene({
  viewMode = "wide",
  selectedSeat,
  occupiedSeats,
  isPlaying,
  theme = "main",
  recentReactions = [],
  onSelectSeat,
  quality = "high",
  overlayElement,
  disco = false,
  activeEmotes,
  stagePerformers,
  fireworksBursts
}: TheaterSceneProps) {
  const isSky = theme === "sky";
  const isCyberpunk = theme === "cyberpunk";
  const isSunset = theme === "sunset";

  const bgColor = isSky ? "#0a1233" : isCyberpunk ? "#020712" : isSunset ? "#1a0804" : "#080612";
  const ambientLightColor = isSky ? "#93c5fd" : isCyberpunk ? "#06b6d4" : isSunset ? "#fdba74" : "#ffffff";
  const mainPointColor = isSky ? "#38bdf8" : isCyberpunk ? "#06b6d4" : isSunset ? "#f97316" : "#c084fc";
  const sidePointColor = isSky ? "#60a5fa" : isCyberpunk ? "#f43f5e" : isSunset ? "#fbbf24" : "#f59e0b";
  const stageNeon1 = isSky ? "#38bdf8" : isCyberpunk ? "#06b6d4" : isSunset ? "#fb923c" : "#c084fc";
  const stageNeon2 = isSky ? "#1d4ed8" : isCyberpunk ? "#ec4899" : isSunset ? "#ea580c" : "#7c3aed";
  const aisleAccentColor = isSky ? "#38bdf8" : isCyberpunk ? "#06b6d4" : isSunset ? "#f59e0b" : "#c49a38";
  const aisleAccentColor2 = isSky ? "#7dd3fc" : isCyberpunk ? "#67e8f9" : isSunset ? "#fed7aa" : "#f4d477";
  const curtainColor = isSky ? "#1e293b" : isCyberpunk ? "#0f172a" : isSunset ? "#451a03" : "#3b0764";

  const rowLabels = ["A", "B", "C", "D", "E", "F"];
  const seatsPerRow = 16;
  const seats = useMemo(() => {
    const list: React.ReactNode[] = [];
    for (let row = 0; row < rowLabels.length; row++) {
      const stepY = row * 0.16;
      const stepZ = -1.2 + row * 0.92;

      for (let col = 0; col < seatsPerRow; col++) {
        // Divide into left block and right block with a center illuminated aisle
        const isLeft = col < seatsPerRow / 2;
        const seatInBlock = col % (seatsPerRow / 2);
        const x = isLeft ? -6.2 + seatInBlock * 0.78 : 0.74 + seatInBlock * 0.78;
        const label = `${rowLabels[row]}${col + 1}`;

        const isMySeat = selectedSeat === label;
        const isFirstPerson = isMySeat && viewMode === "audience";
        const occupant = occupiedSeats[label];
        const isReacting = Boolean(
          occupant && recentReactions.some((r) => r.userName === occupant.displayName && Date.now() - r.timestamp < 3500)
        );
        const seed = row * 16 + col;

        list.push(
          <CinemaSeat
            key={label}
            x={x}
            y={stepY}
            z={stepZ}
            label={label}
            isMySeat={isMySeat}
            occupant={occupant}
            onSelect={(l) => onSelectSeat?.(l)}
            isPlaying={isPlaying}
            isReacting={isReacting}
            seed={seed}
            isFirstPerson={isFirstPerson}
            emote={occupant ? activeEmotes?.[occupant.userId] : undefined}
            coupleHeart={Boolean(
              occupant &&
              col + 1 < seatsPerRow &&
              (col + 1) % (seatsPerRow / 2) !== 0 &&
              occupiedSeats[`${rowLabels[row]}${col + 2}`]
            )}
          />
        );
      }
    }
    return list;
  }, [selectedSeat, occupiedSeats, onSelectSeat, isPlaying, recentReactions, viewMode, activeEmotes]);

  return (
    <Canvas
      camera={{ position: [0, 6.8, 15.5], fov: 46 }}
      dpr={quality === "low" ? 0.75 : quality === "medium" ? 1 : 1.5}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={[bgColor]} />
      <CameraRig viewMode={viewMode} selectedSeat={selectedSeat} overlayElement={overlayElement} />
      <CinemaEnclosure theme={theme} isPlaying={isPlaying} />
      {isSky && <Stars radius={70} depth={35} count={2600} factor={3.2} saturation={0} fade speed={0.6} />}
      {isCyberpunk && <Stars radius={60} depth={20} count={1400} factor={4} saturation={1} fade speed={1.2} />}
      {isSunset && <Stars radius={80} depth={30} count={800} factor={2} saturation={0.8} fade speed={0.4} />}

      {/* Lighting */}
      <ambientLight intensity={isPlaying ? 0.35 : 0.75} color={ambientLightColor} />
      <pointLight position={[0, 4.5, -4]} intensity={isPlaying ? 45 : 25} color={mainPointColor} distance={20} />
      <pointLight position={[-6, 3, 0]} intensity={18} color={sidePointColor} distance={12} />
      <pointLight position={[6, 3, 0]} intensity={18} color={sidePointColor} distance={12} />
      {/* Stage Floor */}
      <mesh position={[0, -0.05, -3.4]}>
        <boxGeometry args={[14, 0.2, 3.2]} />
        <meshStandardMaterial color={isCyberpunk ? "#061320" : "#130e20"} roughness={0.8} />
      </mesh>
      {/* Neon strip along the stage front edge */}
      <mesh position={[0, 0.075, -1.8]}>
        <boxGeometry args={[13.8, 0.05, 0.07]} />
        <meshBasicMaterial color={stageNeon1} />
      </mesh>
      <mesh position={[0, -0.03, -1.79]}>
        <boxGeometry args={[13.8, 0.06, 0.05]} />
        <meshBasicMaterial color={stageNeon2} />
      </mesh>

      {/* Live performers replace the ambient trio while anyone is on stage */}
      {stagePerformers && stagePerformers.length > 0 ? (
        <LiveStagePerformers performers={stagePerformers} />
      ) : (
        <StagePerformers />
      )}

      {/* Fireworks bursts celebrating finished performances */}
      {(fireworksBursts || []).map((b) => (
        <FireworksBurst key={b.id} burstId={b.id} at={b.at} />
      ))}

      {/* Stepped auditorium tiers and illuminated center aisle */}
      {rowLabels.map((_, row) => {
        const rowY = row * 0.16;
        const rowZ = -1.2 + row * 0.92;
        const aisleZ = rowZ + 0.46;

        return (
          <group key={`tier-${row}`}>
            <mesh position={[0, rowY - 0.1, aisleZ]}>
              <boxGeometry args={[14, 0.2, 0.92]} />
              <meshStandardMaterial color="#0b0816" roughness={0.9} />
            </mesh>
            <mesh position={[0, rowY + 0.012, aisleZ]}>
              <boxGeometry args={[0.82, 0.024, 0.9]} />
              <meshBasicMaterial color={aisleAccentColor} />
            </mesh>
            <mesh position={[-0.43, rowY + 0.02, aisleZ]}>
              <boxGeometry args={[0.035, 0.03, 0.9]} />
              <meshBasicMaterial color={aisleAccentColor2} />
            </mesh>
            <mesh position={[0.43, rowY + 0.02, aisleZ]}>
              <boxGeometry args={[0.035, 0.03, 0.9]} />
              <meshBasicMaterial color={aisleAccentColor2} />
            </mesh>
            {/* Glowing step bar across the aisle at each tier lip */}
            <mesh position={[0, rowY + 0.028, aisleZ + 0.42]}>
              <boxGeometry args={[0.68, 0.028, 0.09]} />
              <meshBasicMaterial color={aisleAccentColor2} />
            </mesh>
          </group>
        );
      })}

      {/* Rear wall and wall-mounted cinema screen. */}
      <mesh position={[0, 3.35, -5.78]}>
        <boxGeometry args={[14, 7.6, 0.35]} />
        <meshStandardMaterial color="#100c1d" roughness={0.92} />
      </mesh>
      <mesh position={[0, 3.8, -5.42]}>
        <boxGeometry args={[10.42, 6.12, 0.42]} />
        <meshStandardMaterial color="#090710" metalness={0.48} roughness={0.42} />
      </mesh>
      <mesh position={[0, 6.77, -5.185]}>
        <boxGeometry args={[10.32, 0.16, 0.12]} />
        <meshStandardMaterial color="#08090d" metalness={0.48} roughness={0.42} emissive="#020204" emissiveIntensity={0.08} />
      </mesh>
      <mesh position={[0, 0.83, -5.185]}>
        <boxGeometry args={[10.32, 0.16, 0.12]} />
        <meshStandardMaterial color="#08090d" metalness={0.48} roughness={0.42} emissive="#020204" emissiveIntensity={0.08} />
      </mesh>
      <mesh position={[-5.08, 3.8, -5.185]}>
        <boxGeometry args={[0.16, 5.78, 0.12]} />
        <meshStandardMaterial color="#08090d" metalness={0.48} roughness={0.42} emissive="#020204" emissiveIntensity={0.08} />
      </mesh>
      <mesh position={[5.08, 3.8, -5.185]}>
        <boxGeometry args={[0.16, 5.78, 0.12]} />
        <meshStandardMaterial color="#08090d" metalness={0.48} roughness={0.42} emissive="#020204" emissiveIntensity={0.08} />
      </mesh>

      {/* Inner screen surface (16:9) */}
      <mesh position={[0, 3.8, -5.22]}>
        <planeGeometry args={[9.81, 5.5]} />
        <meshBasicMaterial color={isPlaying ? "#0a0a18" : "#05050e"} />
      </mesh>
      {/* Screen glow spill onto the stage */}
      <pointLight position={[0, 3.4, -3.6]} intensity={isPlaying ? 30 : 14} color="#a5b4fc" distance={11} />

      {/* Left Stage Curtain */}
      <mesh position={[-5.95, 3.8, -4.9]}>
        <boxGeometry args={[1.4, 7.0, 0.8]} />
        <meshStandardMaterial color={curtainColor} roughness={0.9} />
      </mesh>

      {/* Right Stage Curtain */}
      <mesh position={[5.95, 3.8, -4.9]}>
        <boxGeometry args={[1.4, 7.0, 0.8]} />
        <meshStandardMaterial color={curtainColor} roughness={0.9} />
      </mesh>

      {/* Warm uplights at the curtain bases */}
      <mesh position={[-5.95, 0.16, -4.35]}>
        <boxGeometry args={[0.55, 0.32, 0.28]} />
        <meshStandardMaterial color="#f59e0b" emissive="#fb923c" emissiveIntensity={2.2} />
      </mesh>
      <mesh position={[5.95, 0.16, -4.35]}>
        <boxGeometry args={[0.55, 0.32, 0.28]} />
        <meshStandardMaterial color="#f59e0b" emissive="#fb923c" emissiveIntensity={2.2} />
      </mesh>
      <pointLight position={[-5.9, 0.6, -4.1]} intensity={7} color="#fb923c" distance={5} />
      <pointLight position={[5.9, 0.6, -4.1]} intensity={7} color="#fb923c" distance={5} />

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

      {disco && <DiscoRig />}

      {/* Fixed camera (back-center view, like the reference mockup) so the HTML
          video overlay stays glued to the 3D screen at every viewport size. */}
    </Canvas>
  );
}
