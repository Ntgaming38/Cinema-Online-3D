import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const cleanCode = code.toUpperCase();

    const room = await prisma.room.findUnique({
      where: { code: cleanCode },
      select: { id: true }
    });

    if (!room) {
      return NextResponse.json({ error: "Phòng không tồn tại." }, { status: 404 });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { roomId: room.id },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    // Return in chronological order
    const formatted = messages.reverse().map(m => ({
      id: m.id,
      userId: m.userId,
      user: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
      message: m.content,
      createdAt: m.createdAt.toISOString()
    }));

    return NextResponse.json({ messages: formatted });
  } catch (err) {
    console.error("Get chat messages error:", err);
    return NextResponse.json({ error: "Lỗi tải lịch sử chat." }, { status: 500 });
  }
}
