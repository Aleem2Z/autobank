import crypto from "node:crypto";

// Crockford-style alphabet — uppercase letters and digits with the
// look-alike characters (I, O, 0, 1) stripped so a code can be read aloud
// at the table without confusion. 32 symbols × 8 positions = ~1.1T codes,
// which is enough entropy to make brute-force enumeration impractical now
// that the room code is the only credential a joiner needs.
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

export function generateRoomCode(): string {
  let s = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    s += ALPHA[crypto.randomInt(ALPHA.length)];
  }
  return s;
}

export function isValidCode(s: string): boolean {
  return /^[A-HJ-NP-Z2-9]{8}$/.test(s);
}

export const ROOM_CODE_LENGTH = CODE_LENGTH;
