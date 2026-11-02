import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { comparePassword, signAuthToken, AUTH_COOKIE_NAME } from "@/lib/auth";

export const runtime = "nodejs";

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1)
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Vui lòng nhập tên đăng nhập và mật khẩu." }, { status: 400 });
    }

    const { username, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() }
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "Tên đăng nhập hoặc mật khẩu không chính xác." }, { status: 401 });
    }

    const match = await comparePassword(password, user.passwordHash);
    if (!match) {
      return NextResponse.json({ error: "Tên đăng nhập hoặc mật khẩu không chính xác." }, { status: 401 });
    }

    const tokenPayload = {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isGuest: false
    };

    const token = signAuthToken(tokenPayload);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl
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
    console.error("Login error:", err);
    return NextResponse.json({ error: "Lỗi đăng nhập." }, { status: 500 });
  }
}
