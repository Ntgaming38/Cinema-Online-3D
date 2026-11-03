import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
// Production MUST provide a strong JWT_SECRET; the shared literal is a dev-only fallback.
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required in production");
}
const JWT_SECRET = process.env.JWT_SECRET || "tcg-cinema-secret-key-prod-2026-tidb";

const app = express();
// WEB_ORIGIN: comma-separated list of allowed web origins.
// A single "*" entry allows any origin (the request origin is reflected back,
// which stays compatible with credentials: true). Use "*" only when the public
// web origin is not known in advance; prefer an explicit origin list otherwise.
const allowedOrigins = (process.env.WEB_ORIGIN || "http://localhost:3000,http://localhost:3001")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const allowAllOrigins = allowedOrigins.includes("*");
function corsOrigin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
  if (!origin || allowAllOrigins || allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    callback(null, false);
  }
}
app.use(cors({ origin: corsOrigin, credentials: true }));

app.get("/health", async (_req, res) => {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {}
  res.json({
    ok: true,
    service: "cinema-online-3d-realtime",
    database: dbOk ? "connected" : "error",
    time: new Date().toISOString()
  });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
    credentials: true
  },
  maxHttpBufferSize: 1e6
});

interface AuthUser {
  userId: string;
  username?: string | null;
  displayName: string;
  avatarUrl?: string | null;
  isGuest: boolean;
}

interface RoomUserRecord {
  displayName: string;
  avatarUrl: string;
  role: "OWNER" | "MODERATOR" | "MEMBER";
  sockets: Set<string>;
  seatLabel?: string;
}

interface PlaybackMemory {
  isPlaying: boolean;
  positionSec: number;
  playbackRate: number;
  sourceUrl?: string;
  videoTitle?: string;
  updatedAt: number;
}

// Memory stores
// roomCode -> Map(userId -> RoomUserRecord)
const roomUsers = new Map<string, Map<string, RoomUserRecord>>();
// roomCode -> PlaybackMemory
const roomPlaybacks = new Map<string, PlaybackMemory>();
// socketId -> { userId: string; roomCode?: string }
const socketMeta = new Map<string, { userId: string; roomCode?: string }>();

// Rate limit helper: returns false if rate limit exceeded
function checkRateLimit(store: Map<string, number[]>, key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (store.get(key) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= limit) return false;
  timestamps.push(now);
  store.set(key, timestamps);
  return true;
}

const chatRateLimits = new Map<string, number[]>();
const reactionRateLimits = new Map<string, number[]>();

// ==================== MISSION / EXP / LEADERBOARD ====================
const MISSION_DEFS: Record<string, { label: string; exp: number; target: number }> = {
  daily_checkin: { label: "Chào buổi sáng", exp: 5, target: 1 },
  chat_5: { label: "Trò chuyện sôi nổi", exp: 10, target: 5 },
  video_approved: { label: "Gửi video hay", exp: 15, target: 1 },
  watch_30min: { label: "Ngồi xem cùng nhau", exp: 10, target: 30 },
  support: { label: "Ủng hộ rạp", exp: 20, target: 1 },
  invite: { label: "Chia sẻ rạp", exp: 15, target: 1 },
};

function getLevel(exp: number): number {
  return Math.floor(exp / 100) + 1;
}

// roomCode -> Map(userId -> { shirtColor?, hairStyle?, accessory? })
const roomAppearance = new Map<string, Map<string, { shirtColor?: string; hairStyle?: string; accessory?: string }>>();
// roomCode -> Map(userId -> { chatCount, lastCheckinDate, watchHeartbeatAt, watchMinutes })
const roomMissionStats = new Map<string, Map<string, { chatCount: number; lastCheckinDate: string; watchHeartbeatAt: number; watchMinutes: number }>>();
// roomCode -> { skipVotes: Set<string> }
const roomSkipVotes = new Map<string, { skipVotes: Set<string> }>();
// roomCode -> video queue items (memory mirror of DB)
const roomVideoQueue = new Map<string, Array<{
  id: string;
  title: string;
  sourceUrl: string;
  type: string;
  status: string;
  addedBy: string;
  addedByName: string;
  createdAt: number;
}>>();
// roomCode -> projected image info
const roomProjectedImage = new Map<string, { url: string; setBy: string; setByName: string; setAt: number } | null>();
const roomDisco = new Map<string, boolean>();

async function ensureMission(userId: string, roomId: string, missionKey: string) {
  const def = MISSION_DEFS[missionKey];
  if (!def) return null;
  let mp = await prisma.missionProgress.findUnique({
    where: { userId_roomId_missionKey: { userId, roomId, missionKey } },
  });
  if (!mp) {
    mp = await prisma.missionProgress.create({
      data: { userId, roomId, missionKey, progress: 0, target: def.target, completed: false, claimed: false, expReward: def.exp },
    });
  }
  return mp;
}

// NOTE: all mission helpers take the room's DATABASE id (MissionProgress.roomId is a FK to Room.id),
// never the public room code. Use resolveRoomDbId(code) at call sites that only know the code.
async function updateMissionProgress(userId: string, roomDbId: string, missionKey: string, increment = 1) {
  const mp = await ensureMission(userId, roomDbId, missionKey);
  if (!mp || mp.claimed) return null;
  const def = MISSION_DEFS[missionKey];
  const newProgress = Math.min(mp.progress + increment, def.target);
  const completed = mp.completed || newProgress >= def.target;
  const justCompleted = completed && !mp.completed;
  await prisma.missionProgress.update({
    where: { id: mp.id },
    data: { progress: newProgress, completed, updatedAt: new Date() },
  });
  return { missionKey, progress: newProgress, target: def.target, completed, claimed: mp.claimed, justCompleted };
}

async function getMissionsState(userId: string, roomDbId: string) {
  const rows = await prisma.missionProgress.findMany({ where: { userId, roomId: roomDbId } });
  return Object.entries(MISSION_DEFS).map(([key, def]) => {
    const row = rows.find(r => r.missionKey === key);
    return {
      key,
      label: def.label,
      exp: def.exp,
      progress: row?.progress ?? 0,
      target: def.target,
      completed: row?.completed ?? false,
      claimed: row?.claimed ?? false,
    };
  });
}

async function emitMissionsToSocket(socket: Socket, userId: string, roomDbId: string) {
  try {
    socket.emit("missions:state", { missions: await getMissionsState(userId, roomDbId) });
  } catch {}
}

async function emitMissionsToUser(roomCode: string, userId: string, roomDbId: string) {
  const rec = roomUsers.get(roomCode)?.get(userId);
  if (!rec) return;
  try {
    const missions = await getMissionsState(userId, roomDbId);
    for (const sid of rec.sockets) io.to(sid).emit("missions:state", { missions });
  } catch {}
}

async function resolveRoomDbId(code: string): Promise<string | null> {
  const room = await prisma.room.findUnique({ where: { code }, select: { id: true } });
  return room?.id ?? null;
}

async function claimMissionReward(userId: string, roomId: string, missionKey: string) {
  const mp = await prisma.missionProgress.findUnique({
    where: { userId_roomId_missionKey: { userId, roomId, missionKey } },
  });
  if (!mp || mp.completed !== true || mp.claimed === true) return null;
  const def = MISSION_DEFS[missionKey];
  await prisma.user.update({ where: { id: userId }, data: { exp: { increment: def.exp } } });
  await prisma.missionProgress.update({ where: { id: mp.id }, data: { claimed: true } });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, exp: true, displayName: true } });
  return { missionKey, exp: def.exp, level: getLevel(user!.exp), user };
}

async function getRoomLeaderboard(roomCode: string, tab: "level" | "support") {
  const room = await prisma.room.findUnique({ where: { code: roomCode }, select: { id: true } });
  if (!room) return [];
  const members = await prisma.roomMember.findMany({
    where: { roomId: room.id, leftAt: null },
    select: { userId: true, role: true, user: { select: { id: true, displayName: true, avatarUrl: true, exp: true, totalDonated: true, shirtColor: true, hairStyle: true, accessory: true } } },
  });
  const list = members.map(m => ({
    userId: m.userId,
    displayName: m.user.displayName,
    avatarUrl: m.user.avatarUrl,
    role: m.role,
    exp: m.user.exp,
    level: getLevel(m.user.exp),
    totalDonated: m.user.totalDonated,
    shirtColor: m.user.shirtColor,
    hairStyle: m.user.hairStyle,
    accessory: m.user.accessory,
  }));
  if (tab === "level") list.sort((a, b) => b.exp - a.exp);
  else list.sort((a, b) => b.totalDonated - a.totalDonated);
  return list.slice(0, 50);
}

function broadcastPresence(code: string) {
  const usersMap = roomUsers.get(code);
  if (!usersMap) return;
  const appMap = roomAppearance.get(code);
  const membersList = Array.from(usersMap.entries()).map(([uId, rec]) => ({
    userId: uId,
    displayName: rec.displayName,
    avatarUrl: rec.avatarUrl,
    role: rec.role,
    seatLabel: rec.seatLabel,
    appearance: appMap?.get(uId),
  }));
  io.to(code).emit("room:presence", { count: usersMap.size, members: membersList });
}

async function loadRoomQueue(code: string, roomDbId: string) {
  const items = await prisma.videoQueueItem.findMany({
    where: { roomId: roomDbId },
    include: { addedBy: { select: { displayName: true } } },
    orderBy: { createdAt: "asc" },
  });
  const queue = items.map(i => ({
    id: i.id,
    title: i.title,
    sourceUrl: i.sourceUrl,
    type: i.type,
    status: i.status,
    addedBy: i.addedById,
    addedByName: i.addedBy.displayName,
    createdAt: i.createdAt.getTime(),
  }));
  roomVideoQueue.set(code, queue);
  return queue;
}

// Switch the whole room to a queue item: marks it PLAYING, previous PLAYING -> PLAYED,
// updates playback memory + DB, and broadcasts playback:state + queue state to everyone.
async function startQueueItem(code: string, roomDbId: string, item: { id: string; title: string; sourceUrl: string }, byName?: string) {
  await prisma.videoQueueItem.updateMany({
    where: { roomId: roomDbId, status: "PLAYING", NOT: { id: item.id } },
    data: { status: "PLAYED" },
  });
  await prisma.videoQueueItem.update({ where: { id: item.id }, data: { status: "PLAYING" } });

  const queue = (roomVideoQueue.get(code) || []).map(i =>
    i.id === item.id ? { ...i, status: "PLAYING" } : i.status === "PLAYING" ? { ...i, status: "PLAYED" } : i
  );
  roomVideoQueue.set(code, queue);

  const updatedState: PlaybackMemory = {
    isPlaying: true,
    positionSec: 0,
    playbackRate: 1,
    sourceUrl: item.sourceUrl,
    videoTitle: item.title,
    updatedAt: Date.now(),
  };
  roomPlaybacks.set(code, updatedState);
  await prisma.playbackState.upsert({
    where: { roomId: roomDbId },
    create: { roomId: roomDbId, isPlaying: true, positionSec: 0, sourceUrl: item.sourceUrl, videoTitle: item.title },
    update: { isPlaying: true, positionSec: 0, sourceUrl: item.sourceUrl, videoTitle: item.title },
  }).catch(() => {});

  io.to(code).emit("playback:state", { ...updatedState });
  io.to(code).emit("video:queue:update", { queue });
  io.to(code).emit("chat:message", {
    id: "sys_" + Date.now(),
    userId: "system",
    user: "Hệ thống",
    message: `Đang phát: ${item.title}${byName ? ` (${byName})` : ""}.`,
    createdAt: new Date().toISOString(),
  });
}

function cleanCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().toUpperCase();
  return /^[A-Z0-9_-]{3,12}$/.test(clean) ? clean : null;
}

// Middleware: Authenticate Socket Connection via JWT
io.use((socket: Socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace("Bearer ", "");
  if (!token) {
    // If no token, assign guest identity
    const guestId = "guest_" + socket.id.slice(0, 8);
    const guestUser: AuthUser = {
      userId: guestId,
      displayName: `Khách_${socket.id.slice(0, 4)}`,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${guestId}`,
      isGuest: true
    };
    (socket as any).user = guestUser;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    (socket as any).user = decoded;
    next();
  } catch (err) {
    // Fallback to guest rather than killing connection immediately
    const guestId = "guest_" + socket.id.slice(0, 8);
    (socket as any).user = {
      userId: guestId,
      displayName: `Khách_${socket.id.slice(0, 4)}`,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${guestId}`,
      isGuest: true
    };
    next();
  }
});

io.on("connection", (socket: Socket) => {
  const user: AuthUser = (socket as any).user;
  socketMeta.set(socket.id, { userId: user.userId });

  socket.on("room:join", async (payload: { roomCode?: string; password?: string }) => {
    const code = cleanCode(payload?.roomCode);
    if (!code) {
      return socket.emit("app:error", { message: "Mã phòng không hợp lệ." });
    }

    try {
      // 1. Verify room exists in TiDB
      const room = await prisma.room.findUnique({
        where: { code },
        include: {
          video: true,
          playback: true,
          members: { where: { userId: user.userId } }
        }
      });

      if (!room) {
        return socket.emit("app:error", { message: "Phòng chiếu không tồn tại hoặc đã bị xóa." });
      }

      if (room.status === "ENDED") {
        return socket.emit("app:error", { message: "Phòng chiếu này đã kết thúc." });
      }

      // Private rooms: owner and existing members enter freely; everyone else must
      // present the room password here (server-side check, not a client flag).
      const isRoomOwner = room.ownerId === user.userId;
      const isExistingMember = room.members.length > 0;
      if (room.visibility === "PRIVATE" && room.passwordHash && !isRoomOwner && !isExistingMember) {
        const provided = typeof payload?.password === "string" ? payload.password : "";
        const ok = provided ? await bcrypt.compare(provided, room.passwordHash).catch(() => false) : false;
        if (!ok) {
          socket.emit("room:password-required", { roomCode: code });
          return socket.emit("app:error", { message: "Phòng riêng tư: cần nhập đúng mật khẩu phòng để vào xem." });
        }
        // Correct password: grant membership so the REST APIs (detail/chat) also allow access.
        await prisma.roomMember.upsert({
          where: { roomId_userId: { roomId: room.id, userId: user.userId } },
          create: { roomId: room.id, userId: user.userId, role: "MEMBER", joinedAt: new Date(), leftAt: null },
          update: { leftAt: null },
        }).catch(() => {});
      }

      // 2. Capacity Check
      let usersMap = roomUsers.get(code);
      if (!usersMap) {
        usersMap = new Map();
        roomUsers.set(code, usersMap);
      }

      const isAlreadyInRoom = usersMap.has(user.userId);
      if (!isAlreadyInRoom && usersMap.size >= room.maxMembers) {
        return socket.emit("app:error", { message: `Phòng đã đạt giới hạn tối đa ${room.maxMembers} người.` });
      }

      // 3. Clean up previous room if user was in one on this socket
      const prevMeta = socketMeta.get(socket.id);
      if (prevMeta?.roomCode && prevMeta.roomCode !== code) {
        leaveRoom(socket, prevMeta.roomCode);
      }

      // 4. Determine user role in room
      let role: "OWNER" | "MODERATOR" | "MEMBER" = "MEMBER";
      if (room.ownerId === user.userId) {
        role = "OWNER";
      } else if (room.members.length > 0) {
        role = room.members[0].role as any;
      }

      // Join socket room
      socket.join(code);
      socketMeta.set(socket.id, { userId: user.userId, roomCode: code });

      // Add to usersMap
      let userRecord = usersMap.get(user.userId);
      if (!userRecord) {
        userRecord = {
          displayName: user.displayName,
          avatarUrl: user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.userId}`,
          role,
          sockets: new Set()
        };
        usersMap.set(user.userId, userRecord);

        // Update/create RoomMember in TiDB
        try {
          await prisma.roomMember.upsert({
            where: { roomId_userId: { roomId: room.id, userId: user.userId } },
            create: {
              roomId: room.id,
              userId: user.userId,
              role: role,
              joinedAt: new Date(),
              leftAt: null
            },
            update: {
              leftAt: null
            }
          });
        } catch {}
      }
      userRecord.sockets.add(socket.id);

      // 5. Initialize or fetch PlaybackState
      let currentPlayback = roomPlaybacks.get(code);
      if (!currentPlayback) {
        if (room.playback) {
          currentPlayback = {
            isPlaying: room.playback.isPlaying,
            positionSec: room.playback.positionSec,
            playbackRate: room.playback.playbackRate,
            sourceUrl: room.playback.sourceUrl || room.video?.sourceUrl,
            videoTitle: room.playback.videoTitle || room.video?.title || "Chưa có tiêu đề",
            updatedAt: room.playback.updatedAt.getTime()
          };
        } else {
          currentPlayback = {
            isPlaying: false,
            positionSec: 0,
            playbackRate: 1,
            sourceUrl: room.video?.sourceUrl || "",
            videoTitle: room.video?.title || "Chưa có tiêu đề",
            updatedAt: Date.now()
          };
        }
        roomPlaybacks.set(code, currentPlayback);
      }

      // Emit current playback state to the newly joined socket
      // Calculate adjusted position if video is actively playing
      let adjustedPosition = currentPlayback.positionSec;
      if (currentPlayback.isPlaying) {
        const elapsedSec = (Date.now() - currentPlayback.updatedAt) / 1000;
        adjustedPosition += elapsedSec * currentPlayback.playbackRate;
      }

      socket.emit("playback:state", {
        isPlaying: currentPlayback.isPlaying,
        positionSec: adjustedPosition,
        playbackRate: currentPlayback.playbackRate,
        sourceUrl: currentPlayback.sourceUrl,
        videoTitle: currentPlayback.videoTitle,
        updatedAt: currentPlayback.updatedAt,
        allowMemberControl: room.allowMemberControl,
        userRole: role
      });

      // Seed the user's saved appearance (shirt/hair/accessory) so presence carries it
      if (!user.isGuest) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.userId },
            select: { shirtColor: true, hairStyle: true, accessory: true },
          });
          if (dbUser && (dbUser.shirtColor || dbUser.hairStyle || dbUser.accessory)) {
            let appMap = roomAppearance.get(code);
            if (!appMap) { appMap = new Map(); roomAppearance.set(code, appMap); }
            if (!appMap.has(user.userId)) {
              appMap.set(user.userId, {
                shirtColor: dbUser.shirtColor || undefined,
                hairStyle: dbUser.hairStyle || undefined,
                accessory: dbUser.accessory || undefined,
              });
            }
          }
        } catch {}
      }

      // Broadcast presence (unique users count, incl. appearance)
      broadcastPresence(code);

      // Initial feature states for the joining socket: missions, queue, leaderboard, theme, projected image
      await emitMissionsToSocket(socket, user.userId, room.id);
      try {
        const queue = await loadRoomQueue(code, room.id);
        socket.emit("video:queue:update", { queue });
      } catch {}
      try {
        const list = await getRoomLeaderboard(code, "level");
        socket.emit("leaderboard:update", { tab: "level", list });
      } catch {}
      if (room.theme) socket.emit("room:theme:changed", { theme: room.theme });
      const projected = roomProjectedImage.get(code);
      if (projected) socket.emit("image:projected", { url: projected.url, setBy: projected.setBy, setByName: projected.setByName });
      if (roomDisco.get(code)) socket.emit("room:disco:changed", { disco: true });

      // Announce arrival if first tab for this user
      if (userRecord.sockets.size === 1) {
        socket.to(code).emit("chat:message", {
          id: "sys_" + Date.now(),
          userId: "system",
          user: "Hệ thống",
          message: `${user.displayName} đã vào phòng rạp chiếu.`,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("room:join error:", err);
      socket.emit("app:error", { message: "Không thể tham gia phòng lúc này." });
    }
  });

  socket.on("room:leave", () => {
    const meta = socketMeta.get(socket.id);
    if (meta?.roomCode) {
      leaveRoom(socket, meta.roomCode);
    }
  });

  socket.on("chat:send", async (payload: { roomCode?: string; message?: string }) => {
    const meta = socketMeta.get(socket.id);
    const code = meta?.roomCode;
    const payloadCode = payload?.roomCode === undefined ? code : cleanCode(payload.roomCode);
    if (!code || payloadCode !== code) return socket.emit("app:error", { message: "Bạn chưa tham gia phòng này." });

    // Rate limiting: 5 messages per 5s
    if (!checkRateLimit(chatRateLimits, user.userId, 5, 5000)) {
      return socket.emit("app:error", { message: "Bạn đang gửi tin nhắn quá nhanh. Vui lòng chờ vài giây." });
    }

    const message = typeof payload.message === "string" ? payload.message.trim().slice(0, 500) : "";
    if (!message) return;

    const chatItem = {
      id: "msg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      userId: user.userId,
      user: user.displayName,
      avatarUrl: user.avatarUrl,
      message,
      createdAt: new Date().toISOString()
    };

    io.to(code).emit("chat:message", chatItem);

    // Save to TiDB asynchronously
    try {
      const room = await prisma.room.findUnique({ where: { code }, select: { id: true } });
      if (room) {
        await prisma.chatMessage.create({
          data: {
            roomId: room.id,
            userId: user.userId,
            content: message
          }
        });
        // Mission "Trò chuyện sôi nổi": +1 progress per message (capped at target)
        const res = await updateMissionProgress(user.userId, room.id, "chat_5", 1);
        if (res) await emitMissionsToSocket(socket, user.userId, room.id);
      }
    } catch (e) {
      console.error("Save chat error:", e);
    }
  });

  socket.on("playback:command", async (payload: {
    roomCode?: string;
    action?: "play" | "pause" | "seek" | "changeVideo";
    positionSec?: number;
    sourceUrl?: string;
    videoTitle?: string;
  }, acknowledge?: (result: { success: boolean; error?: string }) => void) => {
    const respond = (success: boolean, error?: string) => {
      if (acknowledge) {
        acknowledge({ success, ...(error ? { error } : {}) });
      } else if (error) {
        socket.emit("app:error", { message: error });
      }
    };
    const meta = socketMeta.get(socket.id);
    const code = meta?.roomCode;
    const payloadCode = payload?.roomCode === undefined ? code : cleanCode(payload.roomCode);
    if (!code || payloadCode !== code) {
      respond(false, "Bạn chưa tham gia phòng này.");
      return;
    }

    try {
      // Permission check: Room Owner or Moderator or room.allowMemberControl
      const usersMap = roomUsers.get(code);
      const userRecord = usersMap?.get(user.userId);
      const room = await prisma.room.findUnique({
        where: { code },
        select: { id: true, ownerId: true, allowMemberControl: true }
      });

      if (!room) {
        respond(false, "Phòng chiếu không tồn tại.");
        return;
      }

      const isOwner = room.ownerId === user.userId;
      const isMod = userRecord?.role === "MODERATOR";
      const canControl = isOwner || isMod || room.allowMemberControl;

      if (!canControl) {
        respond(false, "Chỉ Chủ phòng hoặc Quản trị viên mới có quyền điều khiển video.");
        return;
      }

      if (!["play", "pause", "seek", "changeVideo"].includes(payload.action || "")) {
        respond(false, "Lệnh phát video không hợp lệ.");
        return;
      }

      const prev = roomPlaybacks.get(code) || {
        isPlaying: false,
        positionSec: 0,
        playbackRate: 1,
        updatedAt: Date.now()
      };

      let newPosition = prev.positionSec;
      let newIsPlaying = prev.isPlaying;
      let newSourceUrl = prev.sourceUrl;
      let newVideoTitle = prev.videoTitle;

      if (payload.action === "play") {
        newIsPlaying = true;
        if (Number.isFinite(payload.positionSec)) {
          newPosition = Math.max(0, payload.positionSec!);
        }
      } else if (payload.action === "pause") {
        newIsPlaying = false;
        if (Number.isFinite(payload.positionSec)) {
          newPosition = Math.max(0, payload.positionSec!);
        }
      } else if (payload.action === "seek") {
        if (Number.isFinite(payload.positionSec)) {
          newPosition = Math.max(0, payload.positionSec!);
        }
      } else if (payload.action === "changeVideo") {
        if (typeof payload.sourceUrl !== "string" || !payload.sourceUrl.trim()) {
          respond(false, "Vui lòng nhập link video.");
          return;
        }
        newSourceUrl = payload.sourceUrl.trim();
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(newSourceUrl);
        } catch {
          respond(false, "Link video không hợp lệ.");
          return;
        }
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          respond(false, "Link video phải sử dụng HTTP hoặc HTTPS.");
          return;
        }
        if (newSourceUrl.length > 2000) {
          respond(false, "Link video vượt quá giới hạn cho phép.");
          return;
        }
        newVideoTitle = payload.videoTitle?.trim() || "Video rạp chiếu";
        newPosition = 0;
        newIsPlaying = true;
      }

      const updatedState: PlaybackMemory = {
        isPlaying: newIsPlaying,
        positionSec: newPosition,
        playbackRate: 1,
        sourceUrl: newSourceUrl,
        videoTitle: newVideoTitle,
        updatedAt: Date.now()
      };

      const playbackWrite = prisma.playbackState.upsert({
        where: { roomId: room.id },
        create: {
          roomId: room.id,
          isPlaying: updatedState.isPlaying,
          positionSec: updatedState.positionSec,
          sourceUrl: updatedState.sourceUrl,
          videoTitle: updatedState.videoTitle
        },
        update: {
          isPlaying: updatedState.isPlaying,
          positionSec: updatedState.positionSec,
          sourceUrl: updatedState.sourceUrl,
          videoTitle: updatedState.videoTitle
        }
      });

      if (payload.action === "changeVideo") {
        await prisma.$transaction([
          prisma.video.upsert({
            where: { roomId: room.id },
            create: {
              roomId: room.id,
              sourceUrl: updatedState.sourceUrl!,
              title: updatedState.videoTitle || "Video rạp chiếu"
            },
            update: {
              sourceUrl: updatedState.sourceUrl!,
              title: updatedState.videoTitle || "Video rạp chiếu"
            }
          }),
          playbackWrite
        ]);
      } else {
        await playbackWrite;
      }

      roomPlaybacks.set(code, updatedState);
      io.to(code).emit("playback:state", {
        ...updatedState,
        allowMemberControl: room.allowMemberControl
      });
      respond(true);
    } catch (err) {
      console.error("playback:command error:", err);
      respond(false, "Không thể lưu thay đổi video. Vui lòng thử lại.");
    }
  });

  socket.on("reaction:send", async (payload: { roomCode?: string; emoji?: string }) => {
    const meta = socketMeta.get(socket.id);
    const code = meta?.roomCode;
    const payloadCode = payload?.roomCode === undefined ? code : cleanCode(payload.roomCode);
    if (!code || payloadCode !== code) return socket.emit("app:error", { message: "Bạn chưa tham gia phòng này." });

    // Rate limiting: 3 reactions per second
    if (!checkRateLimit(reactionRateLimits, user.userId, 3, 1000)) {
      return;
    }

    const allowed = ["❤️", "👍", "🔥", "👏", "😂", "🎉", "🍿", "🎬", "🚀", "😱"];
    if (payload.emoji && allowed.includes(payload.emoji)) {
      const reactionData = {
        id: "rx_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        emoji: payload.emoji,
        userId: user.userId,
        userName: user.displayName
      };

      io.to(code).emit("reaction:new", reactionData);

      // Async save to TiDB
      try {
        const room = await prisma.room.findUnique({ where: { code }, select: { id: true } });
        if (room) {
          await prisma.reaction.create({
            data: {
              roomId: room.id,
              userId: user.userId,
              emoji: payload.emoji
            }
          });
        }
      } catch {}
    }
  });

  socket.on("seat:select", async (payload: { roomCode?: string; seatLabel?: string }) => {
    const meta = socketMeta.get(socket.id);
    const code = meta?.roomCode;
    const payloadCode = payload?.roomCode === undefined ? code : cleanCode(payload.roomCode);
    if (!code || payloadCode !== code || !payload.seatLabel) {
      return socket.emit("app:error", { message: "Bạn chưa tham gia phòng này." });
    }

    const label = payload.seatLabel.trim().toUpperCase();
    if (!/^[A-F](?:[1-9]|1[0-6])$/.test(label)) {
      return socket.emit("app:error", { message: "Vị trí ghế không hợp lệ." });
    }
    const usersMap = roomUsers.get(code);
    if (!usersMap) return;

    // Check if seat is taken by someone else
    for (const [otherId, rec] of usersMap.entries()) {
      if (otherId !== user.userId && rec.seatLabel === label) {
        return socket.emit("app:error", { message: `Ghế ${label} đã có người ngồi.` });
      }
    }

    const rec = usersMap.get(user.userId);
    if (rec) {
      rec.seatLabel = label;
    }

    // Persist seat in TiDB
    try {
      const room = await prisma.room.findUnique({ where: { code }, select: { id: true } });
      if (room) {
        await prisma.roomMember.updateMany({
          where: { roomId: room.id, userId: user.userId },
          data: { seatLabel: label }
        });
      }
    } catch {}

    // Broadcast updated presence & seats
    broadcastPresence(code);
  });

  // ==================== MISSION: CHECKIN ====================
  socket.on("checkin:daily", async () => {
    const code = socketMeta.get(socket.id)?.roomCode;
    const userId = user.userId;
    if (!code) return socket.emit("app:error", { message: "Chưa vào phòng." });
    const today = new Date().toISOString().slice(0, 10);
    const statsMap = roomMissionStats.get(code) || new Map();
    const st = statsMap.get(userId);
    if (st && st.lastCheckinDate === today) {
      return socket.emit("app:error", { message: "Hôm nay đã điểm danh rồi." });
    }
    statsMap.set(userId, { ...(st || { chatCount: 0, lastCheckinDate: "", watchHeartbeatAt: 0, watchMinutes: 0 }), lastCheckinDate: today });
    roomMissionStats.set(code, statsMap);
    const roomDbId = await resolveRoomDbId(code);
    if (roomDbId) {
      await updateMissionProgress(userId, roomDbId, "daily_checkin", 1);
      await emitMissionsToSocket(socket, userId, roomDbId);
      socket.emit("app:notice", { message: "Điểm danh thành công! Mở panel Nhiệm vụ để nhận EXP." });
    }
  });

  // ==================== MISSION: INVITE (share room link) ====================
  socket.on("mission:invite", async () => {
    const code = socketMeta.get(socket.id)?.roomCode;
    const userId = user.userId;
    if (!code) return;
    const roomDbId = await resolveRoomDbId(code);
    if (!roomDbId) return;
    await updateMissionProgress(userId, roomDbId, "invite", 1);
    await emitMissionsToSocket(socket, userId, roomDbId);
  });

  // ==================== MISSION: CLAIM REWARD ====================
  socket.on("mission:claim", async ({ missionKey }: { missionKey: string }) => {
    const code = socketMeta.get(socket.id)?.roomCode;
    const userId = user.userId;
    if (!code) return;
    const roomDbId = await resolveRoomDbId(code);
    if (!roomDbId) return;
    const reward = await claimMissionReward(userId, roomDbId, missionKey);
    if (reward) {
      socket.emit("mission:claimed", reward);
      await emitMissionsToSocket(socket, userId, roomDbId);
      io.to(code).emit("chat:message", {
        id: "sys_" + Date.now(),
        userId: "system",
        user: "Hệ thống",
        message: `${reward.user?.displayName ?? "Người dùng"} hoàn thành nhiệm vụ "${MISSION_DEFS[reward.missionKey].label}" và nhận ${reward.exp} EXP!`,
        createdAt: new Date().toISOString(),
      });
      const lb = await getRoomLeaderboard(code, "level");
      io.to(code).emit("leaderboard:update", { tab: "level", list: lb });
    }
  });

  // ==================== LEADERBOARD ====================
  socket.on("leaderboard:get", async ({ tab }: { tab: "level" | "support" }) => {
    const code = socketMeta.get(socket.id)?.roomCode;
    if (!code) return;
    const list = await getRoomLeaderboard(code, tab);
    socket.emit("leaderboard:update", { tab, list });
  });

  // ==================== VIDEO QUEUE ====================
  socket.on("video:queue", async ({ title, sourceUrl, type, durationMin, hasSubtitle, note }: any) => {
    const code = socketMeta.get(socket.id)?.roomCode;
    const userId = user.userId;
    if (!code) return;
    const room = await prisma.room.findUnique({ where: { code }, select: { id: true } });
    if (!room) return socket.emit("app:error", { message: "Phòng không tồn tại." });
    const cleanUrl = typeof sourceUrl === "string" ? sourceUrl.trim() : "";
    if (!/^https?:\/\//i.test(cleanUrl) || cleanUrl.length > 2000) {
      return socket.emit("app:error", { message: "Link video không hợp lệ (phải là http/https, tối đa 2000 ký tự)." });
    }
    const item = await prisma.videoQueueItem.create({
      data: {
        roomId: room.id,
        addedById: userId,
        title: String(title || "Video").slice(0, 200),
        sourceUrl: cleanUrl,
        type: String(type || "Khác"),
        durationMin: durationMin || null,
        hasSubtitle: hasSubtitle || null,
        note: note || null,
        status: "PENDING",
      },
      include: { addedBy: { select: { displayName: true } } },
    });
    const queueItem = {
      id: item.id,
      title: item.title,
      sourceUrl: item.sourceUrl,
      type: item.type,
      status: item.status,
      addedBy: item.addedById,
      addedByName: item.addedBy.displayName,
      createdAt: item.createdAt.getTime(),
    };
    const q = roomVideoQueue.get(code) || [];
    q.push(queueItem);
    roomVideoQueue.set(code, q);
    io.to(code).emit("video:queue:update", { queue: q });
    // Mission "Gửi video hay" is credited on APPROVAL (see video:approve), not on submission.
  });

  socket.on("video:approve", async ({ itemId, action }: { itemId: string; action: "approve" | "reject" }) => {
    const code = socketMeta.get(socket.id)?.roomCode;
    const userId = user.userId;
    if (!code) return;
    const room = await prisma.room.findUnique({ where: { code }, select: { id: true, ownerId: true, allowMemberControl: true } });
    if (!room) return;
    const member = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId: room.id, userId } }, select: { role: true } });
    const isOwner = room.ownerId === userId;
    const isMod = member?.role === "MODERATOR" || member?.role === "OWNER";
    if (!isOwner && !isMod && !room.allowMemberControl) {
      return socket.emit("app:error", { message: "Chủ phòng/quản trị viên mới được duyệt video." });
    }
    // The item must belong to THIS room — never moderate another room's queue by id.
    const existing = await prisma.videoQueueItem.findUnique({ where: { id: itemId }, select: { roomId: true, status: true } });
    if (!existing || existing.roomId !== room.id) {
      return socket.emit("app:error", { message: "Video không thuộc phòng này." });
    }
    const newStatus = action === "approve" ? "APPROVED" : "REJECTED";
    const updated = await prisma.videoQueueItem.update({
      where: { id: itemId },
      data: { status: newStatus, approvedById: userId, approvedAt: new Date() },
      include: { addedBy: { select: { displayName: true } } },
    });
    const q = (roomVideoQueue.get(code) || []).map(i => (i.id === itemId ? { ...i, status: newStatus } : i));
    roomVideoQueue.set(code, q);
    io.to(code).emit("video:queue:update", { queue: q });
    io.to(code).emit("chat:message", {
      id: "sys_" + Date.now(),
      userId: "system",
      user: "Hệ thống",
      message: `Video "${updated.title}" đã được ${action === "approve" ? "DUYỆT" : "TỪ CHỐI"}.`,
      createdAt: new Date().toISOString(),
    });
    // Mission "Gửi video hay": credit the SUBMITTER when their video gets approved.
    if (action === "approve" && existing.status !== "APPROVED") {
      await updateMissionProgress(updated.addedById, room.id, "video_approved", 1);
      await emitMissionsToUser(code, updated.addedById, room.id);
    }
  });

  socket.on("video:play", async ({ itemId }: { itemId: string }) => {
    const code = socketMeta.get(socket.id)?.roomCode;
    const userId = user.userId;
    if (!code) return;
    const room = await prisma.room.findUnique({ where: { code }, select: { id: true, ownerId: true, allowMemberControl: true } });
    if (!room) return;
    const member = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId: room.id, userId } }, select: { role: true } });
    const isOwner = room.ownerId === userId;
    const isMod = member?.role === "MODERATOR" || member?.role === "OWNER";
    if (!isOwner && !isMod && !room.allowMemberControl) {
      return socket.emit("app:error", { message: "Chủ phòng/quản trị viên mới được phát video." });
    }
    const item = await prisma.videoQueueItem.findUnique({ where: { id: itemId }, include: { addedBy: { select: { displayName: true } } } });
    if (!item || item.roomId !== room.id) return socket.emit("app:error", { message: "Video không thuộc phòng này." });
    if (item.status !== "APPROVED") return socket.emit("app:error", { message: "Video chưa được duyệt." });
    await startQueueItem(code, room.id, item, item.addedBy.displayName);
  });

  // ==================== VOTE SKIP (35%) ====================
  socket.on("vote:skip", async () => {
    const code = socketMeta.get(socket.id)?.roomCode;
    const userId = user.userId;
    if (!code) return;
    const usersMap = roomUsers.get(code);
    if (!usersMap) return;
    const totalViewers = usersMap.size;
    if (totalViewers === 0) return;
    const votes = roomSkipVotes.get(code) || { skipVotes: new Set() };
    votes.skipVotes.add(userId);
    roomSkipVotes.set(code, votes);
    const ratio = votes.skipVotes.size / totalViewers;
    io.to(code).emit("vote:skip:update", { votes: votes.skipVotes.size, total: totalViewers, ratio });
    if (ratio >= 0.35) {
      // Threshold reached: actually switch playback to the next APPROVED item.
      roomSkipVotes.set(code, { skipVotes: new Set() });
      io.to(code).emit("vote:skip:update", { votes: 0, total: totalViewers, ratio: 0 });
      const roomDbId = await resolveRoomDbId(code);
      if (!roomDbId) return;
      let q = roomVideoQueue.get(code) || [];
      if (!q.some(i => i.status === "APPROVED")) q = await loadRoomQueue(code, roomDbId);
      const next = q.find(i => i.status === "APPROVED");
      if (next) {
        io.to(code).emit("vote:skip:result", { next });
        const full = await prisma.videoQueueItem.findUnique({ where: { id: next.id }, include: { addedBy: { select: { displayName: true } } } });
        if (full && full.roomId === roomDbId) await startQueueItem(code, roomDbId, full, full.addedBy.displayName);
      } else {
        io.to(code).emit("chat:message", {
          id: "sys_" + Date.now(),
          userId: "system",
          user: "Hệ thống",
          message: "Đã đủ 35% phiếu bỏ qua, nhưng hàng chờ chưa có video nào được duyệt.",
          createdAt: new Date().toISOString(),
        });
      }
    }
  });

  // ==================== CHARACTER / APPEARANCE ====================
  socket.on("character:update", ({ shirtColor, hairStyle, accessory }: { shirtColor?: string; hairStyle?: string; accessory?: string }) => {
    const code = socketMeta.get(socket.id)?.roomCode;
    const userId = user.userId;
    if (!code) return;
    // Validate against the wardrobe lists (Vietnamese names) or a hex color.
    const SHIRTS = ["Đen", "Xám", "Trắng", "Vàng", "Đỏ", "Tím", "Cam", "Xanh lá", "Xanh dương", "Hồng", "Nâu"];
    const HAIRS = ["Tóc ngắn", "Tóc dài", "Tóc búi", "Tóc xoăn", "Tóc vuốt", "Tóc mái", "Tóc 2 bím", "Tóc dài thẳng", "Tóc tém", "Tóc chỏm", "Tóc undercut", "Đầu hói", "Tóc bob", "Tóc dài xoăn", "Tóc mohawk", "Tóc đuôi ngựa", "Tóc bím lệch"];
    const ACCS = ["Kính", "Mũ", "Tai nghe", "Vương miện", "Nơ", "Kính râm", "Mũ len", "Mũ lưỡi trai", "Mũ bảo hiểm", "Mũ hoa", "Mũ phù thủy", "Mũ tai mèo", "Tai mèo", "Sừng quỷ", "Halo", "Bông tai", "Mặt nạ", "Băng đô"];
    const clean = {
      shirtColor: shirtColor && (SHIRTS.includes(shirtColor) || /^#[0-9a-fA-F]{6}$/.test(shirtColor)) ? shirtColor : undefined,
      hairStyle: hairStyle && HAIRS.includes(hairStyle) ? hairStyle : undefined,
      accessory: accessory && ACCS.includes(accessory) ? accessory : undefined,
    };
    let appMap = roomAppearance.get(code);
    if (!appMap) { appMap = new Map(); roomAppearance.set(code, appMap); }
    appMap.set(userId, { ...(appMap.get(userId) || {}), ...clean });
    roomAppearance.set(code, appMap);
    prisma.user.update({ where: { id: userId }, data: clean }).catch(() => {});
    const rec = roomUsers.get(code)?.get(userId);
    io.to(code).emit("character:updated", { userId, ...appMap.get(userId), displayName: rec?.displayName, avatarUrl: rec?.avatarUrl });
    broadcastPresence(code);
  });

  // ==================== DONATION ====================
  socket.on("donation", async ({ amount, message }: { amount: number; message?: string }) => {
    const code = socketMeta.get(socket.id)?.roomCode;
    const userId = user.userId;
    if (!code) return;
    if (!Number.isFinite(amount)) return socket.emit("app:error", { message: "Số tiền ủng hộ không hợp lệ." });
    const amt = Math.max(1000, Math.min(10000000, Math.floor(amount)));
    const room = await prisma.room.findUnique({ where: { code }, select: { id: true } });
    if (!room) return;
    const donation = await prisma.donation.create({
      data: { roomId: room.id, userId, amount: amt, message },
      include: { user: { select: { displayName: true } } },
    });
    // Donating builds the user's balance (used later for private rooms at 1.000đ/hour) and totalDonated.
    await prisma.user.update({ where: { id: userId }, data: { balance: { increment: amt }, totalDonated: { increment: amt } } });
    const userData = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true, totalDonated: true } });
    io.to(code).emit("donation:received", { amount: amt, message, userId, displayName: donation.user.displayName, balance: userData?.balance, totalDonated: userData?.totalDonated });
    io.to(code).emit("chat:message", {
      id: "sys_" + Date.now(),
      userId: "system",
      user: "Hệ thống",
      message: `${donation.user.displayName} đã ủng hộ ${amt.toLocaleString()}đ cho rạp! ❤️`,
      createdAt: new Date().toISOString(),
    });
    await updateMissionProgress(userId, room.id, "support", 1);
    await emitMissionsToSocket(socket, userId, room.id);
    const lb = await getRoomLeaderboard(code, "support");
    io.to(code).emit("leaderboard:update", { tab: "support", list: lb });
  });

  // ==================== ROOM THEME (SKY ROOM) ====================
  socket.on("room:theme", async ({ theme }: { theme: string }) => {
    const code = socketMeta.get(socket.id)?.roomCode;
    const userId = user.userId;
    if (!code) return;
    if (theme !== "sky" && theme !== "main") return socket.emit("app:error", { message: "Theme không hợp lệ." });
    const room = await prisma.room.findUnique({ where: { code }, select: { id: true, ownerId: true } });
    if (!room) return;
    const member = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId: room.id, userId } }, select: { role: true } });
    const canChangeTheme = room.ownerId === userId || member?.role === "MODERATOR" || member?.role === "OWNER";
    if (!canChangeTheme) return socket.emit("app:error", { message: "Chủ phòng/quản trị viên mới được đổi rạp." });
    await prisma.room.update({ where: { code }, data: { theme } });
    io.to(code).emit("room:theme:changed", { theme });
    io.to(code).emit("chat:message", {
      id: "sys_" + Date.now(),
      userId: "system",
      user: "Hệ thống",
      message: theme === "sky" ? "Rạp chuyển sang Rạp Trời 🌌" : "Về rạp chính.",
      createdAt: new Date().toISOString(),
    });
  });

  // ==================== DISCO MODE (LASER + FLASH) ====================
  socket.on("room:disco", async ({ disco }: { disco: boolean }) => {
    const code = socketMeta.get(socket.id)?.roomCode;
    const userId = user.userId;
    if (!code) return;
    const room = await prisma.room.findUnique({ where: { code }, select: { id: true, ownerId: true } });
    if (!room) return;
    const member = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId: room.id, userId } }, select: { role: true } });
    const canToggleDisco = room.ownerId === userId || member?.role === "MODERATOR" || member?.role === "OWNER";
    if (!canToggleDisco) return socket.emit("app:error", { message: "Chủ phòng/quản trị viên mới được bật/tắt disco." });
    roomDisco.set(code, !!disco);
    io.to(code).emit("room:disco:changed", { disco: !!disco });
    io.to(code).emit("chat:message", {
      id: "sys_" + Date.now(),
      userId: "system",
      user: "Hệ thống",
      message: disco ? "Chế độ Disco BẬT 🪩 — laser & flash theo nhịp 137 BPM!" : "Chế độ Disco TẮT.",
      createdAt: new Date().toISOString(),
    });
  });

  // ==================== IMAGE PROJECTION ====================
  socket.on("image:project", ({ url }: { url: string }) => {
    const code = socketMeta.get(socket.id)?.roomCode;
    const userId = user.userId;
    if (!code) return;
    if (typeof url !== "string" || !/^https?:\/\//i.test(url.trim()) || url.length > 2000) {
      return socket.emit("app:error", { message: "Link ảnh không hợp lệ (phải là http/https)." });
    }
    const rec = roomUsers.get(code)?.get(userId);
    roomProjectedImage.set(code, { url, setBy: userId, setByName: rec?.displayName || "Người dùng", setAt: Date.now() });
    io.to(code).emit("image:projected", { url, setBy: userId, setByName: rec?.displayName || "Người dùng" });
  });

  socket.on("image:unproject", () => {
    const code = socketMeta.get(socket.id)?.roomCode;
    if (!code) return;
    roomProjectedImage.set(code, null);
    io.to(code).emit("image:unprojected");
  });

  // ==================== WATCH HEARTBEAT (client sends 1 per minute) ====================
  socket.on("heartbeat:watch", async () => {
    const code = socketMeta.get(socket.id)?.roomCode;
    const userId = user.userId;
    if (!code) return;
    const statsMap = roomMissionStats.get(code) || new Map();
    const st = statsMap.get(userId) || { chatCount: 0, lastCheckinDate: "", watchHeartbeatAt: 0, watchMinutes: 0 };
    const minutes = Math.min(30, (st.watchMinutes || 0) + 1);
    statsMap.set(userId, { ...st, watchHeartbeatAt: Date.now(), watchMinutes: minutes });
    roomMissionStats.set(code, statsMap);
    // Mission "Ngồi xem cùng nhau": progress = minutes watched today in this room (target 30).
    if (minutes <= 30) {
      const roomDbId = await resolveRoomDbId(code);
      if (roomDbId) {
        await updateMissionProgress(userId, roomDbId, "watch_30min", 1);
        if (minutes === 30 || minutes % 5 === 0) await emitMissionsToSocket(socket, userId, roomDbId);
      }
    }
  });

  socket.on("disconnect", () => {
    const meta = socketMeta.get(socket.id);
    if (meta?.roomCode) {
      leaveRoom(socket, meta.roomCode);
    }
    socketMeta.delete(socket.id);
  });

  function leaveRoom(s: Socket, code: string) {
    const usersMap = roomUsers.get(code);
    if (!usersMap) {
      s.leave(code);
      return;
    }

    const rec = usersMap.get(user.userId);
    if (rec) {
      rec.sockets.delete(s.id);
      if (rec.sockets.size === 0) {
        usersMap.delete(user.userId);

        // Notify room that user left
        s.to(code).emit("chat:message", {
          id: "sys_" + Date.now(),
          userId: "system",
          user: "Hệ thống",
          message: `${user.displayName} đã rời phòng chiếu.`,
          createdAt: new Date().toISOString()
        });

        // Update leftAt in TiDB
        prisma.room.findUnique({ where: { code }, select: { id: true } }).then(room => {
          if (room) {
            prisma.roomMember.updateMany({
              where: { roomId: room.id, userId: user.userId },
              data: { leftAt: new Date(), seatLabel: null }
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    }

    s.leave(code);
    const meta = socketMeta.get(s.id);
    if (meta) {
      delete meta.roomCode;
    }

    const uniqueCount = usersMap.size;
    if (uniqueCount === 0) {
      // Room empty in memory
      roomUsers.delete(code);
    } else {
      broadcastPresence(code);
    }
  }
});

// Port resolution: on Botkeep the assigned public port arrives as SERVER_PORT
// (or PORT) and must win; locally REALTIME_PORT keeps working as before.
const port = Number(process.env.SERVER_PORT || process.env.PORT || process.env.REALTIME_PORT || 4001);
httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Cinema Online 3D Realtime Server listening on :${port}`);
});
