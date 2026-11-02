import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "tcg-cinema-secret-key-prod-2026-tidb";

const app = express();
const allowedOrigins = (process.env.WEB_ORIGIN || "http://localhost:3000,http://localhost:3001").split(",");
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.get("/health", async (_req, res) => {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {}
  res.json({
    ok: true,
    service: "tcg-cinema-realtime",
    database: dbOk ? "connected" : "error",
    time: new Date().toISOString()
  });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
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

      // Broadcast presence (unique users count)
      const uniqueCount = usersMap.size;
      const membersList = Array.from(usersMap.entries()).map(([uId, rec]) => ({
        userId: uId,
        displayName: rec.displayName,
        avatarUrl: rec.avatarUrl,
        role: rec.role,
        seatLabel: rec.seatLabel
      }));

      io.to(code).emit("room:presence", {
        count: uniqueCount,
        members: membersList
      });

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
    const code = cleanCode(payload?.roomCode) || meta?.roomCode;
    if (!code) return;

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
  }) => {
    const meta = socketMeta.get(socket.id);
    const code = cleanCode(payload?.roomCode) || meta?.roomCode;
    if (!code) return;

    try {
      // Permission check: Room Owner or Moderator or room.allowMemberControl
      const usersMap = roomUsers.get(code);
      const userRecord = usersMap?.get(user.userId);
      const room = await prisma.room.findUnique({
        where: { code },
        select: { id: true, ownerId: true, allowMemberControl: true }
      });

      if (!room) return;

      const isOwner = room.ownerId === user.userId;
      const isMod = userRecord?.role === "MODERATOR";
      const canControl = isOwner || isMod || room.allowMemberControl;

      if (!canControl) {
        return socket.emit("app:error", { message: "Chỉ Chủ phòng hoặc Quản trị viên mới có quyền điều khiển video." });
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
        if (payload.sourceUrl) {
          newSourceUrl = payload.sourceUrl.trim();
          newVideoTitle = payload.videoTitle?.trim() || "Video rạp chiếu";
          newPosition = 0;
          newIsPlaying = true;

          // Update video in TiDB
          await prisma.video.upsert({
            where: { roomId: room.id },
            create: {
              roomId: room.id,
              sourceUrl: newSourceUrl,
              title: newVideoTitle
            },
            update: {
              sourceUrl: newSourceUrl,
              title: newVideoTitle
            }
          });
        }
      }

      const updatedState: PlaybackMemory = {
        isPlaying: newIsPlaying,
        positionSec: newPosition,
        playbackRate: 1,
        sourceUrl: newSourceUrl,
        videoTitle: newVideoTitle,
        updatedAt: Date.now()
      };

      roomPlaybacks.set(code, updatedState);

      // Broadcast to all sockets in the room
      io.to(code).emit("playback:state", {
        ...updatedState,
        allowMemberControl: room.allowMemberControl
      });

      // Persist to TiDB
      await prisma.playbackState.upsert({
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
    } catch (err) {
      console.error("playback:command error:", err);
    }
  });

  socket.on("reaction:send", async (payload: { roomCode?: string; emoji?: string }) => {
    const meta = socketMeta.get(socket.id);
    const code = cleanCode(payload?.roomCode) || meta?.roomCode;
    if (!code) return;

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
    const code = cleanCode(payload?.roomCode) || meta?.roomCode;
    if (!code || !payload.seatLabel) return;

    const label = payload.seatLabel.trim().toUpperCase();
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
    const membersList = Array.from(usersMap.entries()).map(([uId, r]) => ({
      userId: uId,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
      role: r.role,
      seatLabel: r.seatLabel
    }));

    io.to(code).emit("room:presence", {
      count: usersMap.size,
      members: membersList
    });
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
      const membersList = Array.from(usersMap.entries()).map(([uId, r]) => ({
        userId: uId,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        role: r.role,
        seatLabel: r.seatLabel
      }));

      io.to(code).emit("room:presence", {
        count: uniqueCount,
        members: membersList
      });
    }
  }
});

const port = Number(process.env.REALTIME_PORT || 4001);
httpServer.listen(port, "0.0.0.0", () => {
  console.log(`TCG Cinema Realtime Server listening on :${port}`);
});
