import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/lib/auth";

export const runtime = "nodejs";

const verifyPasswordSchema = z.object({
  password: z.string().min(1)
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const cleanCode = code.toUpperCase();

    const room = await prisma.room.findUnique({
      where: { code: cleanCode },
      select: { id: true, passwordHash: true, visibility: true }
    });

    if (!room) {
      return NextResponse.json({ error: "Phòng không tồn tại." }, { status: 404 });
    }

    if (room.visibility === "PUBLIC" || !room.passwordHash) {
      return NextResponse.json({ success: true, verified: true });
    }

    const body = await request.json();
    const parsed = verifyPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Vui lòng nhập mật khẩu phòng." }, { status: 400 });
    }

    const match = await comparePassword(parsed.data.password, room.passwordHash);
    if (!match) {
      return NextResponse.json({ error: "Mật khẩu phòng không chính xác." }, { status: 401 });
    }

    return NextResponse.json({ success: true, verified: true });
  } catch (err) {
    console.error("Verify room password error:", err);
    return NextResponse.json({ error: "Lỗi kiểm tra mật khẩu phòng." }, { status: 500 });
  }
}
