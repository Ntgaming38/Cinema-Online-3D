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
  viewMode?: "wide" | "audience";
  currentUserId?: string;
  selectedSeat?: string;
  occupiedSeats: Record<string, SeatOccupant>;
  isPlaying: boolean;
  theme?: string;
  recentReactions?: Array<{ id: string; emoji: string; userName: string; timestamp: number }>;
  onSelectSeat?: (seatLabel: string) => void;
  quality?: "low" | "medium" | "high";
  laserFlash?: boolean;
  overlayElement?: HTMLDivElement | null;
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

      {/* Actual Occupant OR Ambient Voxel Viewer */}
      {occupant ? (
        <>
          <VoxelViewer shirtColor={isMySeat && !occupant.appearance?.shirtColor ? "#06b6d4" : shirtHex(occupant.appearance?.shirtColor)} />
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

// The video player is an HTML layer that sits over the 3D screen. Keep the
// audience camera fixed so its perspective always matches that layer: looking
// toward the screen cannot shift or skew the projected picture.
function CameraRig({ viewMode, selectedSeat, overlayElement }: { viewMode: "wide" | "audience"; selectedSeat?: string; overlayElement?: HTMLDivElement | null }) {
  const { camera, gl } = useThree();
  const targetPosition = useRef(new THREE.Vector3());
  const basePosition = useRef(new THREE.Vector3(0, 5.2, 11.6));
  const targetLookAt = useRef(new THREE.Vector3());
  const currentLookAt = useRef(new THREE.Vector3(0, 2, -0.4));
  const zoomTarget = useRef(0.68);
  const zoomCurrent = useRef(0.68);
  const seatPose = useMemo(() => {
    const label = selectedSeat || "F8";
    const row = Math.max(0, "ABCDEF".indexOf(label[0] || "F"));
    const col = Math.max(0, Number(label.slice(1)) - 1);
    const half = col % 8;
    const x = col < 8 ? -6.2 + half * 0.78 : 0.74 + half * 0.78;
    const z = -1.2 + row * 0.92;
    return { x, y: row * 0.16, z };
  }, [selectedSeat]);
  useEffect(() => {
    const defaultZoom = viewMode === "wide" ? 0.68 : 1;
    zoomTarget.current = defaultZoom;
    zoomCurrent.current = defaultZoom;
    if (viewMode === "audience") {
      // Place the POV just behind the selected seat and aim slightly below
      // the screen center. This keeps the picture aligned with the wall while
      // leaving the stage performers visible beneath it.
      targetPosition.current.set(seatPose.x, seatPose.y + 1.72, seatPose.z + 3.2);
      targetLookAt.current.set(0, 2.35, -5.22);
    } else {
      // Back-of-house wide view: include the screen and all six audience rows.
      targetPosition.current.set(0, 7.6, 16.8);
      targetLookAt.current.set(0, 2.1, -0.6);
    }
  }, [camera, viewMode, seatPose]);
  useEffect(() => {
    const frame = overlayElement?.parentElement ?? gl.domElement.parentElement;
    if (!frame) return;
    let previousPinchDistance = 0;
    const clampZoom = (value: number) => Math.max(0.45, Math.min(1.7, value));
    const distance = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomTarget.current = clampZoom(zoomTarget.current * (event.deltaY < 0 ? 0.9 : 1.11));
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
    const k = 1 - Math.exp(-3.2 * delta);
    basePosition.current.lerp(targetPosition.current, k);
    currentLookAt.current.lerp(targetLookAt.current, k);
    zoomCurrent.current += (zoomTarget.current - zoomCurrent.current) * (1 - Math.exp(-5 * delta));
    camera.position.copy(currentLookAt.current).addScaledVector(basePosition.current.clone().sub(currentLookAt.current), zoomCurrent.current);
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

export function TheaterScene({
  viewMode = "wide",
  currentUserId,
  selectedSeat,
  occupiedSeats,
  isPlaying,
  theme = "main",
  recentReactions = [],
  onSelectSeat,
  quality = "high",
  laserFlash = false
  , overlayElement
}: TheaterSceneProps) {
  const isSky = theme === "sky";
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
        const occupant = occupiedSeats[label];

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
          />
        );
      }
    }
    return list;
  }, [selectedSeat, occupiedSeats, onSelectSeat]);

  return (
    <Canvas
      camera={{ position: [0, 5.2, 11.6], fov: 46 }}
      dpr={quality === "low" ? 0.75 : quality === "medium" ? 1 : 1.5}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={[isSky ? "#0a1233" : "#080612"]} />
      <CameraRig viewMode={viewMode} selectedSeat={selectedSeat} overlayElement={overlayElement} />
      {isSky && <Stars radius={70} depth={35} count={2600} factor={3.2} saturation={0} fade speed={0.6} />}

      {/* Lighting */}
      <ambientLight intensity={isPlaying ? 0.35 : 0.75} />
      <pointLight position={[0, 4.5, -4]} intensity={isPlaying ? 45 : 25} color="#c084fc" distance={20} />
      <pointLight position={[-6, 3, 0]} intensity={18} color="#f59e0b" distance={12} />
      <pointLight position={[6, 3, 0]} intensity={18} color="#f59e0b" distance={12} />
      {laserFlash && <><pointLight position={[-5, 6.4, -2]} color="#22d3ee" intensity={34} distance={16} /><pointLight position={[5, 6.4, -2]} color="#e879f9" intensity={34} distance={16} /></>}

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
              <meshBasicMaterial color="#c49a38" />
            </mesh>
            <mesh position={[-0.43, rowY + 0.02, aisleZ]}>
              <boxGeometry args={[0.035, 0.03, 0.9]} />
              <meshBasicMaterial color="#f4d477" />
            </mesh>
            <mesh position={[0.43, rowY + 0.02, aisleZ]}>
              <boxGeometry args={[0.035, 0.03, 0.9]} />
              <meshBasicMaterial color="#f4d477" />
            </mesh>
            {/* Glowing step bar across the aisle at each tier lip */}
            <mesh position={[0, rowY + 0.028, aisleZ + 0.42]}>
              <boxGeometry args={[0.68, 0.028, 0.09]} />
              <meshBasicMaterial color="#f4d477" />
            </mesh>
          </group>
        );
      })}

      {/* Rear wall and wall-mounted cinema screen. The player is aligned with
          this fixed frame by the locked audience camera above. */}
      <mesh position={[0, 3.35, -5.78]}>
        <boxGeometry args={[14, 7.6, 0.35]} />
        <meshStandardMaterial color="#100c1d" roughness={0.92} />
      </mesh>
      {/* A compact wall-mounted bezel: four solid 3D rails sit around the
          projection plane. This makes the screen read as hardware attached to
          the back wall rather than a floating HTML rectangle. */}
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
