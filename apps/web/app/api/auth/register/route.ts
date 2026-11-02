import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, signAuthToken, AUTH_COOKIE_NAME } from "@/lib/auth";

export const runtime = "nodejs";

const registerSchema = z.object({
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_.-]+$/, "Tên đăng nhập chỉ chứa chữ cái, số, dấu gạch hoặc chấm"),
  password: z.string().min(6, "Mật khẩu phải từ 6 ký tự trở lên").max(100),
  displayName: z.string().trim().min(2).max(40),
  avatarUrl: z.string().url().max(500).optional().or(z.literal(""))
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Thông tin không hợp lệ.", details: parsed.error.flatten() }, { status: 400 });
    }

    const { username, password, displayName, avatarUrl } = parsed.data;

    // Check if username exists
    const existing = await prisma.user.findUnique({
      where: { username: username.toLowerCase() }
    });

    if (existing) {
      return NextResponse.json({ error: "Tên đăng nhập đã được sử dụng." }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        passwordHash,
        displayName: displayName || username,
        avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`
      }
    });

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
    }, { status: 201 });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/"
    });

    return response;
  } catch (err: unknown) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Lỗi đăng ký tài khoản." }, { status: 500 });
  }
}
