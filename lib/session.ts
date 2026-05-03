import { cookies } from "next/headers";
import crypto from "node:crypto";

const COOKIE = "autobank-session";
const ADMIN_CLAIM_COOKIE = "autobank-admin-claim";
const SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-me-in-prod";

export interface Session {
  roomCode: string;
  playerId: string;
}

export interface AdminClaim {
  roomCode: string;
  /** Unix ms — claims expire so a stale cookie can't promote a future joiner. */
  exp: number;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

function encode<T>(value: T): string {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode<T>(token: string): T | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (sign(payload) !== sig) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

export function encodeSession(s: Session): string {
  return encode(s);
}

export function decodeSession(token: string): Session | null {
  return decode<Session>(token);
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

/**
 * The "admin claim" is a short-lived signed cookie set when a user creates
 * a room. The next /join request from that browser is allowed to claim
 * admin status for that specific room code. After 10 minutes, or after
 * the claim is consumed, the cookie is cleared.
 */
const ADMIN_CLAIM_MAX_AGE_SECONDS = 10 * 60;

export async function setAdminClaimCookie(roomCode: string) {
  const c = await cookies();
  const claim: AdminClaim = {
    roomCode,
    exp: Date.now() + ADMIN_CLAIM_MAX_AGE_SECONDS * 1000,
  };
  c.set(ADMIN_CLAIM_COOKIE, encode(claim), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_CLAIM_MAX_AGE_SECONDS,
  });
}

export async function getAdminClaim(): Promise<AdminClaim | null> {
  const c = await cookies();
  const v = c.get(ADMIN_CLAIM_COOKIE)?.value;
  if (!v) return null;
  const claim = decode<AdminClaim>(v);
  if (!claim) return null;
  if (claim.exp < Date.now()) return null;
  return claim;
}

export async function clearAdminClaim() {
  const c = await cookies();
  c.delete(ADMIN_CLAIM_COOKIE);
}

export function hashPasscode(p: string): string {
  return crypto.createHash("sha256").update(p).digest("hex");
}
