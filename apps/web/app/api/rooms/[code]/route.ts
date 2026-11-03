import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest, hashPassword } from "@/lib/auth";

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
      include: {
        owner: {
          select: { id: true, displayName: true, avatarUrl: true }
        },
        video: true,
        playback: true,
        members: {
          where: { leftAt: null },
          include: {
            user: { select: { id: true, displayName: true, avatarUrl: true } }
          }
        }
      }
    });

    if (!room) {
      return NextResponse.json({ error: "Phòng chiếu không tồn tại." }, { status: 404 });
    }

    const session = await getCurrentUserFromRequest(request);
    const isOwner = session?.userId === room.ownerId;
    const isMember = room.members.some((m: { userId: string }) => m.userId === session?.userId);
    const isPasswordProtected = Boolean(room.passwordHash);

    // Private rooms: non-members only learn that the room exists and is locked.
    // Video/playback/member data is withheld until they are owner/member
    // (membership is granted by the verify-password route after a correct password).
    const canAccessContent = room.visibility !== "PRIVATE" || !isPasswordProtected || isOwner || isMember;

    return NextResponse.json({
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
        description: room.description,
        visibility: room.visibility,
        status: room.status,
        maxMembers: room.maxMembers,
        allowMemberControl: room.allowMemberControl,
        isPasswordProtected,
        isOwner,
        isMember,
        owner: room.owner,
        video: canAccessContent ? room.video : null,
        playback: canAccessContent ? room.playback : null,
        activeMemberCount: canAccessContent ? room.members.length : 0,
        createdAt: room.createdAt
      }
    });
  } catch (err) {
    console.error("Get room error:", err);
    return NextResponse.json({ error: "Lỗi khi lấy thông tin phòng." }, { status: 500 });
  }
}

const updateRoomSchema = z.object({
  name: z.string().trim().min(3).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  allowMemberControl: z.boolean().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  password: z.string().min(4).max(100).optional().or(z.literal("")),
  status: z.enum(["WAITING", "PLAYING", "PAUSED", "ENDED"]).optional()
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const cleanCode = code.toUpperCase();
    const session = await getCurrentUserFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
    }

    const room = await prisma.room.findUnique({
      where: { code: cleanCode },
      include: {
        members: { where: { userId: session.userId } }
      }
    });

    if (!room) {
      return NextResponse.json({ error: "Phòng không tồn tại." }, { status: 404 });
    }

    const isOwner = room.ownerId === session.userId;
    const isMod = room.members.some((m: { role: string }) => m.role === "MODERATOR");

    if (!isOwner && !isMod) {
      return NextResponse.json({ error: "Bạn không có quyền chỉnh sửa phòng này." }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateRoomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dữ liệu cập nhật không hợp lệ.", details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.allowMemberControl !== undefined) updateData.allowMemberControl = data.allowMemberControl;
    if (data.status !== undefined) updateData.status = data.status;

    if (isOwner && data.visibility !== undefined) {
      updateData.visibility = data.visibility;
      if (data.visibility === "PRIVATE" && data.password) {
        updateData.passwordHash = await hashPassword(data.password);
      } else if (data.visibility === "PUBLIC") {
        updateData.passwordHash = null;
      }
    }

    const updated = await prisma.room.update({
      where: { code: cleanCode },
      data: updateData,
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        visibility: true,
        allowMemberControl: true,
        status: true,
        updatedAt: true
      }
    });

    return NextResponse.json({ success: true, room: updated });
  } catch (err) {
    console.error("Update room error:", err);
    return NextResponse.json({ error: "Lỗi cập nhật phòng." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const cleanCode = code.toUpperCase();
    const session = await getCurrentUserFromRequest(request);

    if (!session) {
      return NextResponse.json({ error: "Bạn chưa đăng nhập." }, { status: 401 });
    }

    const room = await prisma.room.findUnique({ where: { code: cleanCode } });
    if (!room) {
      return NextResponse.json({ error: "Phòng không tồn tại." }, { status: 404 });
    }

    if (room.ownerId !== session.userId) {
      return NextResponse.json({ error: "Chỉ chủ phòng mới có quyền xóa hoặc đóng phòng." }, { status: 403 });
    }

    // Cascade delete room
    await prisma.room.delete({ where: { code: cleanCode } });

    return NextResponse.json({ success: true, message: "Phòng đã được xóa thành công." });
  } catch (err) {
    console.error("Delete room error:", err);
    return NextResponse.json({ error: "Lỗi xóa phòng." }, { status: 500 });
  }
}
