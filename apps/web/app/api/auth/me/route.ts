import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest, signAuthToken, AUTH_COOKIE_NAME } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ user: null });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
        _count: {
          select: {
            roomsOwned: true,
            memberships: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        ...user,
        isGuest: !user.username
      }
    });
  } catch (err: unknown) {
    console.error("Auth me error:", err);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(40).optional(),
  avatarUrl: z.string().url().max(500).optional().or(z.literal(""))
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await getCurrentUserFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Thông tin không hợp lệ." }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: session.userId },
      data: {
        ...(parsed.data.displayName ? { displayName: parsed.data.displayName } : {}),
        ...(parsed.data.avatarUrl !== undefined ? { avatarUrl: parsed.data.avatarUrl } : {})
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true
      }
    });

    const tokenPayload = {
      userId: updated.id,
      username: updated.username,
      displayName: updated.displayName,
      avatarUrl: updated.avatarUrl,
      isGuest: !updated.username
    };

    const token = signAuthToken(tokenPayload);
    const res = NextResponse.json({ user: { ...updated, isGuest: !updated.username }, token });
    res.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/"
    });
    return res;
  } catch (err: unknown) {
    console.error("Update profile error:", err);
    return NextResponse.json({ error: "Lỗi cập nhật hồ sơ." }, { status: 500 });
  }
}
