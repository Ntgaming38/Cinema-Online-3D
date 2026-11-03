"use client";

import React, { Suspense, useEffect, useRef, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox, Stars, Text } from "@react-three/drei";
import * as THREE from "three";

export interface SeatOccupant {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  appearance?: { shirtColor?: string; hairStyle?: string; accessory?: string };
}

export interface TheaterSceneProps {
  currentUserId?: string;
  selectedSeat?: string;
  occupiedSeats: Record<string, SeatOccupant>;
  isPlaying: boolean;
  theme?: string;
  recentReactions?: Array<{ id: string; emoji: string; userName: string; timestamp: number }>;
  onSelectSeat?: (seatLabel: string) => void;
  /** Camera preset: panorama (high, whole room), wide (whole auditorium),
   *  stage (close to the stage/screen), pov (from the viewer's own seat). */
  viewMode?: ViewMode;
  /** The HTML video overlay element; the scene projects the 3D screen's
   *  corners onto it every frame so the video stays glued to the screen. */
  screenOverlayRef?: React.RefObject<HTMLDivElement | null>;
  /** Disco mode: mirror ball, sweeping laser beams and beat-synced flashes. */
  disco?: boolean;
  /** Render quality as device pixel ratio cap: 1 = smooth, 1.5 = sharp, 2 = ultra. */
  quality?: number;
}

export type ViewMode = "panorama" | "wide" | "stage" | "pov";

// The 3D cinema screen plane (must match the screen meshes in the scene).
// The HTML video overlay is glued onto this plane by projecting its four
// corners through the camera every frame — exact at any frame size and any
// camera angle, unlike fixed CSS percentages.
const SCREEN = { cx: 0, cy: 3.8, cz: -5.22, w: 9.81, h: 5.5 } as const;
// Fixed layout size of the overlay element while projected; the perspective
// transform scales it onto the screen quad.
const OVERLAY_W = 1280;
const OVERLAY_H = 720;

// Seat label ("C9") → world position of that seat (same layout math as the
// seat generator below: rows A–F, 16 seats in two blocks of 8).
export function seatWorldPos(label: string): { x: number; y: number; z: number } | null {
  const m = /^([A-F])(\d{1,2})$/.exec((label || "").trim().toUpperCase());
  if (!m) return null;
  const row = m[1].charCodeAt(0) - 65;
  const col = parseInt(m[2], 10) - 1;
  if (col < 0 || col > 15) return null;
  const isLeft = col < 8;
  const seatInBlock = col % 8;
  const x = isLeft ? -6.2 + seatInBlock * 0.78 : 0.74 + seatInBlock * 0.78;
  return { x, y: row * 0.16, z: -1.2 + row * 0.92 };
}

type Pt = { x: number; y: number };

// Homography mapping the overlay's local corners onto the projected screen
// quad, returned as a CSS matrix3d() array (column-major). Solves the 8x8
// system with Gauss-Jordan elimination; null when degenerate.
function homographyMatrix3d(src: Pt[], dst: Pt[]): number[] | null {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: X, y: Y } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  }
  for (let col = 0, row = 0; col < 8 && row < 8; col++, row++) {
    let piv = row;
    for (let r = row + 1; r < 8; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-10) return null;
    if (piv !== row) {
      [A[row], A[piv]] = [A[piv], A[row]];
      [b[row], b[piv]] = [b[piv], b[row]];
    }
    for (let r = 0; r < 8; r++) {
      if (r === row) continue;
      const f = A[r][col] / A[row][col];
      if (f === 0) continue;
      for (let c = col; c < 8; c++) A[r][c] -= f * A[row][c];
      b[r] -= f * b[row];
    }
  }
  const h = A.map((rowArr, i) => b[i] / rowArr[i]);
  const [h11, h12, h13, h21, h22, h23, h31, h32] = h;
  return [h11, h21, 0, h31, h12, h22, 0, h32, 0, 0, 1, 0, h13, h23, 0, 1];
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

function VoxelViewer({ shirtColor, hairColor = "#2a1a10" }: { shirtColor: string; hairColor?: string }) {
  return (
    <group position={[0, 0.45, 0]}>
      <RoundedBox position={[0, 0.35, 0]} args={[0.42, 0.44, 0.3]} radius={0.08} smoothness={3}>
        <meshStandardMaterial color={shirtColor} roughness={0.7} />
      </RoundedBox>
      <RoundedBox position={[-0.11, 0.08, 0.34]} args={[0.14, 0.17, 0.66]} radius={0.06} smoothness={3}>
        <meshStandardMaterial color="#252638" roughness={0.85} />
      </RoundedBox>
      <RoundedBox position={[0.11, 0.08, 0.34]} args={[0.14, 0.17, 0.66]} radius={0.06} smoothness={3}>
        <meshStandardMaterial color="#252638" roughness={0.85} />
      </RoundedBox>
      <RoundedBox position={[-0.11, 0.08, 0.69]} args={[0.15, 0.13, 0.25]} radius={0.05} smoothness={3}>
        <meshStandardMaterial color="#11111a" roughness={0.75} />
      </RoundedBox>
      <RoundedBox position={[0.11, 0.08, 0.69]} args={[0.15, 0.13, 0.25]} radius={0.05} smoothness={3}>
        <meshStandardMaterial color="#11111a" roughness={0.75} />
      </RoundedBox>
      {/* Big round chibi head sitting right on the torso, choigivui-style:
          head diameter roughly equals the torso width, peach skin, and a
          dark-brown bowl hair cap tipped toward the back of the head. */}
      <mesh position={[0, 0.79, 0.02]}>
        <sphereGeometry args={[0.205, 20, 16]} />
        <meshStandardMaterial color="#ffd9b3" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.9, 0.03]} rotation={[0.3, 0, 0]}>
        <sphereGeometry args={[0.208, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={hairColor} roughness={0.9} />
      </mesh>
      <mesh position={[-0.075, 0.8, -0.185]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#211a21" roughness={0.5} />
      </mesh>
      <mesh position={[0.075, 0.8, -0.185]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#211a21" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.74, -0.2]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#e7a12d" roughness={0.7} />
      </mesh>
      <RoundedBox position={[-0.25, 0.31, 0.03]} args={[0.1, 0.18, 0.25]} radius={0.045} smoothness={3}>
        <meshStandardMaterial color={shirtColor} roughness={0.7} />
      </RoundedBox>
      <RoundedBox position={[0.25, 0.31, 0.03]} args={[0.1, 0.18, 0.25]} radius={0.045} smoothness={3}>
        <meshStandardMaterial color={shirtColor} roughness={0.7} />
      </RoundedBox>
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
      <mesh position={[0, 0.1, 0.04]}>
        <cylinderGeometry args={[0.075, 0.1, 0.2, 10]} />
        <meshStandardMaterial color="#27232a" metalness={0.65} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.035, 0.04]}>
        <cylinderGeometry args={[0.22, 0.22, 0.05, 12]} />
        <meshStandardMaterial color="#27232a" metalness={0.6} roughness={0.4} />
      </mesh>
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

      {/* Actual Occupant OR Ambient Voxel Viewer */}
      {occupant ? (
        <>
          <VoxelViewer shirtColor={isMySeat && !occupant.appearance?.shirtColor ? "#06b6d4" : shirtHex(occupant.appearance?.shirtColor)} />
          <group position={[0, 1.62, 0]}>
            <Suspense fallback={null}>
              <Text
                fontSize={0.16}
                color={isMySeat ? "#67e8f9" : "#e9d5ff"}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.03}
                outlineColor="#090714"
              >
                {isMySeat ? `★ ${occupant.displayName} (Bạn)` : occupant.displayName}
              </Text>
            </Suspense>
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
      <Suspense fallback={null}>
        <Text fontSize={0.65} anchorX="center" anchorY="middle">
          {emoji}
        </Text>
      </Suspense>
    </group>
  );
}

// Fixed cinematic framing: from the back of the auditorium, tilted slightly up so
// screen, stage/presenter, and seat rows all share ONE frame (like the mockup).
// The camera never moves, and the room CSS keeps the stage frame at a constant
// ~1.27 aspect (letterboxed), so the HTML video overlay stays glued to the 3D
// screen at every window size, desktop or phone.
// Camera presets. "wide" is pulled back and raised versus the original
// framing so EVERY row — seat bases and the floor in front of the nearest
// row included — stays inside the frame, while the screen still spans ~62%
// of the frame width. "panorama" is the high overview (choigivui-style),
// "stage" sits close in front of the stage, "pov" is computed from a seat.
const CAM_PRESETS: Record<Exclude<ViewMode, "pov">, { pos: THREE.Vector3; tgt: THREE.Vector3 }> = {
  panorama: { pos: new THREE.Vector3(0, 9.8, 13.5), tgt: new THREE.Vector3(0, 1.2, -1.2) },
  wide: { pos: new THREE.Vector3(0, 5.2, 11.6), tgt: new THREE.Vector3(0, 2.0, -0.4) },
  stage: { pos: new THREE.Vector3(0, 2.4, 2.6), tgt: new THREE.Vector3(0, 3.6, -5.2) },
};

function CameraRig({ viewMode, selectedSeat }: { viewMode: ViewMode; selectedSeat?: string }) {
  const camera = useThree((s) => s.camera);
  const lookTarget = useRef(new THREE.Vector3().copy(CAM_PRESETS.wide.tgt));
  const initialized = useRef(false);
  const tmpPos = useRef(new THREE.Vector3());
  const tmpTgt = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    let pos: THREE.Vector3 = CAM_PRESETS.wide.pos;
    let tgt: THREE.Vector3 = CAM_PRESETS.wide.tgt;
    if (viewMode === "pov") {
      // Audience view: sit in the viewer's own seat (fallback: F9, back row
      // by the aisle) at head height, looking at the screen centre.
      const seat = (selectedSeat ? seatWorldPos(selectedSeat) : null) || seatWorldPos("F9")!;
      pos = tmpPos.current.set(seat.x, seat.y + 1.66, seat.z + 0.75);
      tgt = tmpTgt.current.set(0, 3.5, SCREEN.cz);
    } else if (viewMode !== "wide") {
      pos = CAM_PRESETS[viewMode].pos;
      tgt = CAM_PRESETS[viewMode].tgt;
    }
    if (!initialized.current) {
      camera.position.copy(pos);
      lookTarget.current.copy(tgt);
      initialized.current = true;
    } else {
      const k = 1 - Math.exp(-3.2 * Math.min(dt, 0.05));
      camera.position.lerp(pos, k);
      lookTarget.current.lerp(tgt, k);
    }
    camera.lookAt(lookTarget.current);
  });
  return null;
}

// Projects the 3D screen's corners through the camera every frame and warps
// the HTML video overlay onto them with a CSS perspective transform, so the
// video is ALWAYS exactly on the screen — any window size, any camera view,
// even mid-transition between views.
function ScreenTracker({ overlayRef }: { overlayRef?: React.RefObject<HTMLDivElement | null> }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const scratch = useRef({
    corner: new THREE.Vector3(),
    view: new THREE.Vector3(),
    src: [
      { x: 0, y: 0 },
      { x: OVERLAY_W, y: 0 },
      { x: OVERLAY_W, y: OVERLAY_H },
      { x: 0, y: OVERLAY_H },
    ] as Pt[],
  });

  useFrame(() => {
    const el = overlayRef?.current;
    if (!el) return;
    const hw = SCREEN.w / 2;
    const hh = SCREEN.h / 2;
    const world: Array<[number, number, number]> = [
      [SCREEN.cx - hw, SCREEN.cy + hh, SCREEN.cz],
      [SCREEN.cx + hw, SCREEN.cy + hh, SCREEN.cz],
      [SCREEN.cx + hw, SCREEN.cy - hh, SCREEN.cz],
      [SCREEN.cx - hw, SCREEN.cy - hh, SCREEN.cz],
    ];
    const dst: Pt[] = [];
    for (const [x, y, z] of world) {
      const c = scratch.current.corner.set(x, y, z);
      // Behind (or too close to) the camera → the quad is meaningless; hide.
      scratch.current.view.copy(c).applyMatrix4(camera.matrixWorldInverse);
      if (scratch.current.view.z > -0.1) {
        el.style.visibility = "hidden";
        return;
      }
      c.project(camera);
      if (c.z > 1) {
        el.style.visibility = "hidden";
        return;
      }
      dst.push({ x: (c.x * 0.5 + 0.5) * size.width, y: (0.5 - c.y * 0.5) * size.height });
    }
    const m = homographyMatrix3d(scratch.current.src, dst);
    if (!m) {
      el.style.visibility = "hidden";
      return;
    }
    el.style.visibility = "visible";
    el.style.transform = `matrix3d(${m.join(",")})`;
    if (el.dataset.projected !== "1") el.dataset.projected = "1";
  });
  return null;
}

// Applies the user's sharpness choice (device pixel ratio cap) live.
function QualityRig({ quality }: { quality: number }) {
  const setDpr = useThree((s) => s.setDpr);
  useEffect(() => {
    setDpr(quality);
  }, [quality, setDpr]);
  return null;
}

// Side walls with gold trim and spotlight fixtures, plus the truss bar the
// disco ball hangs from. Very dark in normal mode (depth at the room's
// edges); the disco rig brings them to life.
function RoomShell() {
  const stripZ = [-5.4, -3.1, -0.8, 1.5, 3.8];
  const spotZ = [-4, -0.5, 3];
  return (
    <group>
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <mesh position={[side * 7.7, 4.3, -0.5]}>
            <boxGeometry args={[0.3, 8.6, 15]} />
            <meshStandardMaterial color="#0b0817" roughness={0.95} />
          </mesh>
          {stripZ.map((z) => (
            <mesh key={z} position={[side * 7.52, 4.3, z]}>
              <boxGeometry args={[0.06, 8.6, 0.07]} />
              <meshStandardMaterial color="#8a6d1f" metalness={0.8} roughness={0.35} emissive="#2a1f05" />
            </mesh>
          ))}
          {spotZ.map((z) => (
            <mesh key={z} position={[side * 7.45, 5.6, z]} rotation={[0, 0, side * 0.7]}>
              <cylinderGeometry args={[0.09, 0.14, 0.34, 10]} />
              <meshStandardMaterial color="#17131f" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 8.2, -0.6]}>
        <boxGeometry args={[15.4, 0.18, 0.3]} />
        <meshStandardMaterial color="#17131f" metalness={0.6} roughness={0.45} />
      </mesh>
    </group>
  );
}

const DISCO_COLORS = ["#f472b6", "#22d3ee", "#a3e635", "#c084fc", "#fbbf24", "#fb7185", "#34d399", "#60a5fa"];
const DISCO_BPM = 137;

// Disco mode: spinning mirror ball, eight sweeping laser beams, wall spot
// cones and two flash lights alternating on the beat (137 BPM, like the
// reference site). Rendered only while disco is on.
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
      {/* Mirror ball on its mount rod under the truss */}
      <mesh position={[0, 7.9, -0.6]}>
        <cylinderGeometry args={[0.03, 0.03, 0.6, 6]} />
        <meshStandardMaterial color="#17131f" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh ref={ballRef} position={[0, 7.35, -0.6]}>
        <sphereGeometry args={[0.36, 24, 18]} />
        <meshStandardMaterial color="#d7daea" metalness={0.85} roughness={0.3} emissive="#23233a" flatShading />
      </mesh>

      {/* Laser beams sweeping from the ball */}
      <group ref={spinRef} position={[0, 7.35, -0.6]}>
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
          <group key={`${side}-${z}`} position={[side * 7.45, 5.6, z]}>
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
  currentUserId,
  selectedSeat,
  occupiedSeats,
  isPlaying,
  theme = "main",
  recentReactions = [],
  onSelectSeat,
  viewMode = "wide",
  screenOverlayRef,
  disco = false,
  quality = 1.5
}: TheaterSceneProps) {
  const isSky = theme === "sky";
  // Ambient crowd wears soft pastel shirts, like the choigivui audience
  const viewerColors = [
    "#a7f3d0", "#bfdbfe", "#ddd6fe", "#fbcfe8", "#fef3c7",
    "#fef08a", "#bbf7d0", "#fed7aa", "#c7d2fe", "#f5d0fe",
    "#a5f3fc", "#e7e5e4", "#fecdd3", "#d9f99d"
  ];

  const rowLabels = ["A", "B", "C", "D", "E", "F"];
  const seatsPerRow = 16;
  const seats = useMemo(() => {
    const list: React.ReactNode[] = [];
    let colorIdx = 0;

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
      camera={{ position: [0, 5.2, 11.6], fov: 46 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={[isSky ? "#0a1233" : "#080612"]} />
      <CameraRig viewMode={viewMode} selectedSeat={selectedSeat} />
      <ScreenTracker overlayRef={screenOverlayRef} />
      <QualityRig quality={quality} />
      {isSky && <Stars radius={70} depth={35} count={2600} factor={3.2} saturation={0} fade speed={0.6} />}

      {/* Lighting */}
      <ambientLight intensity={disco ? 0.22 : isPlaying ? 0.35 : 0.75} />
      <pointLight position={[0, 4.5, -4]} intensity={isPlaying ? 45 : 25} color="#c084fc" distance={20} />
      <pointLight position={[-6, 3, 0]} intensity={18} color="#f59e0b" distance={12} />
      <pointLight position={[6, 3, 0]} intensity={18} color="#f59e0b" distance={12} />

      {/* Room walls, spot fixtures, disco truss */}
      <RoomShell />
      {disco && <DiscoRig />}

      {/* Stage Floor */}
      <mesh position={[0, -0.05, -3.4]}>
        <boxGeometry args={[14, 0.2, 3.2]} />
        <meshStandardMaterial color="#130e20" roughness={0.8} />
      </mesh>
      {/* Purple neon strip along the stage front edge, like the mockup */}
      <mesh position={[0, 0.075, -1.8]}>
        <boxGeometry args={[13.8, 0.05, 0.07]} />
        <meshBasicMaterial color="#c084fc" />
      </mesh>
      <mesh position={[0, -0.03, -1.79]}>
        <boxGeometry args={[13.8, 0.06, 0.05]} />
        <meshBasicMaterial color="#7c3aed" />
      </mesh>

      {/* Three viewers dancing on stage spots, choigivui-style */}
      <StagePerformers />

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
              <meshBasicMaterial color="#7c3aed" />
            </mesh>
            <mesh position={[-0.43, rowY + 0.02, aisleZ]}>
              <boxGeometry args={[0.035, 0.03, 0.9]} />
              <meshBasicMaterial color="#c084fc" />
            </mesh>
            <mesh position={[0.43, rowY + 0.02, aisleZ]}>
              <boxGeometry args={[0.035, 0.03, 0.9]} />
              <meshBasicMaterial color="#c084fc" />
            </mesh>
            {/* Glowing step bar across the aisle at each tier lip */}
            <mesh position={[0, rowY + 0.028, aisleZ + 0.42]}>
              <boxGeometry args={[0.68, 0.028, 0.09]} />
              <meshBasicMaterial color="#e9d5ff" />
            </mesh>
          </group>
        );
      })}

      {/* Cinema Screen Frame Backing */}
      <mesh position={[0, 3.8, -5.4]}>
        <boxGeometry args={[11.3, 6.4, 0.3]} />
        <meshStandardMaterial color="#0c0916" roughness={0.6} />
      </mesh>

      {/* Inner screen surface (16:9) — the HTML video player overlays exactly here */}
      <mesh position={[0, 3.8, -5.22]}>
        <planeGeometry args={[9.81, 5.5]} />
        <meshBasicMaterial color={isPlaying ? "#0a0a18" : "#05050e"} />
      </mesh>
      {/* Screen glow spill onto the stage */}
      <pointLight position={[0, 3.4, -3.6]} intensity={isPlaying ? 30 : 14} color="#a5b4fc" distance={11} />

      {/* Left Stage Velvet Curtain */}
      <mesh position={[-5.95, 3.8, -4.9]}>
        <boxGeometry args={[1.4, 7.0, 0.8]} />
        <meshStandardMaterial color="#3b0764" roughness={0.9} />
      </mesh>

      {/* Right Stage Velvet Curtain */}
      <mesh position={[5.95, 3.8, -4.9]}>
        <boxGeometry args={[1.4, 7.0, 0.8]} />
        <meshStandardMaterial color="#3b0764" roughness={0.9} />
      </mesh>

      {/* Warm uplights at the curtain bases, like the mockup */}
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

      {/* Fixed camera (back-center view, like the reference mockup) so the HTML
          video overlay stays glued to the 3D screen at every viewport size. */}
    </Canvas>
  );
}
