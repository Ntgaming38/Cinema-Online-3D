import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signAuthToken, AUTH_COOKIE_NAME, getCurrentUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

const guestSchema = z.object({
  displayName: z.string().trim().min(2, "Tên phải từ 2 ký tự trở lên").max(40, "Tên tối đa 40 ký tự").optional(),
  avatarUrl: z.string().url().max(500).optional().or(z.literal(""))
});

export async function POST(request: NextRequest) {
  try {
    const existingSession = await getCurrentUserFromRequest(request);
    const body = await request.json().catch(() => ({}));
    const parsed = guestSchema.safeParse(body);
    const data = parsed.success ? parsed.data : {};

    let user;
    if (existingSession) {
      user = await prisma.user.findUnique({ where: { id: existingSession.userId } });
    }

    if (!user) {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const name = data.displayName || `Khách_${randomNum}`;
      const avatar = data.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`;

      user = await prisma.user.create({
        data: {
          displayName: name,
          avatarUrl: avatar
        }
      });
    } else if (data.displayName || data.avatarUrl) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(data.displayName ? { displayName: data.displayName } : {}),
          ...(data.avatarUrl ? { avatarUrl: data.avatarUrl } : {})
        }
      });
    }

    const tokenPayload = {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isGuest: !user.username
    };

    const token = signAuthToken(tokenPayload);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isGuest: !user.username
      },
      token
    });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/"
    });

    return response;
  } catch (err: unknown) {
    console.error("Guest session error:", err);
    return NextResponse.json({ error: "Lỗi khởi tạo phiên người dùng." }, { status: 500 });
  }
}
