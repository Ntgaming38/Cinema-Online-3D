import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest, hashPassword, signAuthToken, AUTH_COOKIE_NAME } from "@/lib/auth";

export const runtime = "nodejs";

const createRoomSchema = z.object({
  name: z.string().trim().min(3, "Tên phòng từ 3 ký tự trở lên").max(100, "Tên phòng tối đa 100 ký tự"),
  description: z.string().trim().max(500).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
  password: z.string().min(4, "Mật khẩu phòng tối thiểu 4 ký tự").max(100).optional().or(z.literal("")),
  maxMembers: z.number().int().min(2, "Tối thiểu 2 người").max(500, "Tối đa 500 người").default(50),
  allowMemberControl: z.boolean().default(false),
  video: z.object({
    title: z.string().trim().min(1).max(200).default("Video mở màn"),
    sourceUrl: z.string().trim().min(5).max(2000)
  }).optional()
});

function generateUniqueCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 7; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function GET() {
  try {
    const rooms = await prisma.room.findMany({
      where: {
        visibility: "PUBLIC",
        status: { in: ["WAITING", "PLAYING", "PAUSED"] }
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        status: true,
        visibility: true,
        maxMembers: true,
        allowMemberControl: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true
          }
        },
        video: {
          select: {
            title: true,
            sourceUrl: true,
            posterUrl: true
          }
        },
        _count: {
          select: {
            members: {
              where: { leftAt: null }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 60
    });

    return NextResponse.json({ rooms });
  } catch (err) {
    console.error("Fetch rooms error:", err);
    return NextResponse.json({ error: "Không thể tải danh sách phòng." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    let session = await getCurrentUserFromRequest(request);
    let user;
    let needsCookie = false;
    let newAuthToken = "";

    if (session) {
      user = await prisma.user.findUnique({ where: { id: session.userId } });
    }

    if (!user) {
      // Create guest user if not logged in
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const guestName = `Khách_${randomNum}`;
      user = await prisma.user.create({
        data: {
          displayName: guestName,
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${guestName}`
        }
      });

      const tokenPayload = {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isGuest: true
      };
      newAuthToken = signAuthToken(tokenPayload);
      needsCookie = true;
    }

    // 2. Validate input
    const body = await request.json();
    const parsed = createRoomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dữ liệu phòng không hợp lệ.", details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    // 3. Collision-free Room Code
    let code = generateUniqueCode();
    for (let i = 0; i < 8; i++) {
      const exists = await prisma.room.findUnique({ where: { code } });
      if (!exists) break;
      code = generateUniqueCode();
    }

    let passwordHash: string | null = null;
    if (data.visibility === "PRIVATE" && data.password && data.password.trim().length > 0) {
      passwordHash = await hashPassword(data.password.trim());
    }

    // 4. Create Room Transaction
    const room = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const createdRoom = await tx.room.create({
        data: {
          code,
          name: data.name,
          description: data.description,
          visibility: data.visibility,
          passwordHash,
          maxMembers: data.maxMembers,
          allowMemberControl: data.allowMemberControl,
          status: "WAITING",
          ownerId: user.id,
          members: {
            create: {
              userId: user.id,
              role: "OWNER"
            }
          },
          playback: {
            create: {
              isPlaying: false,
              positionSec: 0,
              sourceUrl: data.video?.sourceUrl || null,
              videoTitle: data.video?.title || null
            }
          },
          ...(data.video && data.video.sourceUrl ? {
            video: {
              create: {
                title: data.video.title,
                sourceUrl: data.video.sourceUrl
              }
            }
          } : {})
        },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          visibility: true,
          maxMembers: true,
          allowMemberControl: true,
          createdAt: true
        }
      });

      return createdRoom;
    });

    const response = NextResponse.json({
      success: true,
      room,
      user: {
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl
      }
    }, { status: 201 });

    if (needsCookie && newAuthToken) {
      response.cookies.set(AUTH_COOKIE_NAME, newAuthToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60,
        path: "/"
      });
    }

    return response;
  } catch (err: unknown) {
    console.error("Create room error:", err);
    return NextResponse.json({ error: "Không thể tạo phòng. Hãy thử lại." }, { status: 500 });
  }
}
