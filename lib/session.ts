import { cookies } from "next/headers";
import crypto from "node:crypto";

const COOKIE = "autobank-session";
const SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-me-in-prod";

export interface Session {
  roomCode: string;
  playerId: string;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function encodeSession(s: Session): string {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string): Session | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (sign(payload) !== sig) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
}

export async function setSessionCookie(s: Session) {
  const c = await cookies();
  c.set(COOKIE, encodeSession(s), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  const v = c.get(COOKIE)?.value;
  return v ? decodeSession(v) : null;
}

export async function clearSession() {
  const c = await cookies();
  c.delete(COOKIE);
}

export function hashPasscode(p: string): string {
  return crypto.createHash("sha256").update(p).digest("hex");
}
