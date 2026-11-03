import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/auth";

type ChatMessageWithUser = {
  id: string;
  userId: string;
  content: string;
  createdAt: Date;
  user: {
    displayName: string;
    avatarUrl: string | null;
  };
};

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const cleanCode = code.toUpperCase();

    const room = await prisma.room.findUnique({
      where: { code: cleanCode },
      select: { id: true, visibility: true, passwordHash: true, ownerId: true }
    });

    if (!room) {
      return NextResponse.json({ error: "Phòng không tồn tại." }, { status: 404 });
    }

    // Private rooms: chat history is members-only (password verified -> membership granted).
    if (room.visibility === "PRIVATE" && room.passwordHash) {
      const session = await getCurrentUserFromRequest(request);
      if (!session) {
        return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
      }
      if (session.userId !== room.ownerId) {
        const membership = await prisma.roomMember.findUnique({
          where: { roomId_userId: { roomId: room.id, userId: session.userId } },
          select: { id: true, leftAt: true }
        });
        if (!membership) {
          return NextResponse.json({ error: "Phòng riêng tư: bạn chưa có quyền xem lịch sử chat." }, { status: 403 });
        }
      }
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
    const formatted = (messages as ChatMessageWithUser[]).reverse().map((m) => ({
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
