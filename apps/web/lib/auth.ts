import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// Production MUST provide a strong JWT_SECRET; the shared literal is a dev-only fallback.
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required in production");
}
const JWT_SECRET = process.env.JWT_SECRET || "tcg-cinema-secret-key-prod-2026-tidb";
export const AUTH_COOKIE_NAME = "cinema_token";

export interface AuthTokenPayload {
  userId: string;
  username?: string | null;
  displayName: string;
  avatarUrl?: string | null;
  isGuest: boolean;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function getCurrentUserFromRequest(requestOrCookies?: Request | Headers): Promise<AuthTokenPayload | null> {
  try {
    let token: string | undefined;

    if (requestOrCookies instanceof Request) {
      const authHeader = requestOrCookies.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      } else {
        const cookieHeader = requestOrCookies.headers.get("cookie") || "";
        const match = cookieHeader.match(new RegExp(`${AUTH_COOKIE_NAME}=([^;]+)`));
        if (match) token = match[1];
      }
    } else {
      const cookieStore = await cookies();
      token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    }

    if (!token) return null;
    return verifyAuthToken(token);
  } catch {
    return null;
  }
}
