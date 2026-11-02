import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const createRoomSchema = z.object({
  name: z.string().trim().min(3).max(100),
  displayName: z.string().trim().min(2).max(40).default("Khách"),
  description: z.string().trim().max(500).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
  maxMembers: z.number().int().min(2).max(500).default(100),
  video: z.object({
    title: z.string().trim().min(1).max(200),
    sourceUrl: z.string().url().max(2000).refine(v => ["http:", "https:"].includes(new URL(v).protocol), "Chỉ hỗ trợ URL HTTP(S).")
  }).optional()
});

function makeCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export async function GET() {
  try {
    const rooms = await prisma.room.findMany({
      where: { visibility: "PUBLIC", status: { in: ["WAITING", "PLAYING", "PAUSED"] } },
      select: {
        code: true, name: true, description: true, status: true,
        maxMembers: true, createdAt: true,
        owner: { select: { displayName: true } },
        video: { select: { title: true, posterUrl: true } },
        _count: { select: { members: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    return NextResponse.json({ rooms });
  } catch {
    return NextResponse.json({ error: "Không thể tải danh sách phòng." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = createRoomSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Dữ liệu phòng không hợp lệ.", details: parsed.error.flatten() }, { status: 400 });
    const data = parsed.data;
    const user = await prisma.user.create({ data: { displayName: data.displayName } });
    let code = makeCode();
    for (let i = 0; i < 5; i++) {
      if (!await prisma.room.findUnique({ where: { code } })) break;
      code = makeCode();
    }
    const room = await prisma.room.create({
      data: {
        code, name: data.name, description: data.description,
        visibility: data.visibility, maxMembers: data.maxMembers,
        ownerId: user.id,
        members: { create: { userId: user.id, role: "OWNER" } },
        playback: { create: { isPlaying: false, positionSec: 0 } },
        ...(data.video ? { video: { create: data.video } } : {})
      },
      select: { id: true, code: true, name: true, visibility: true, maxMembers: true, createdAt: true }
    });
    return NextResponse.json({ room, user: { id: user.id, displayName: user.displayName } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Không thể tạo phòng. Hãy kiểm tra kết nối database." }, { status: 503 });
  }
}
