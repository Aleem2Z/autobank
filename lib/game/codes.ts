const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, no O

export function generateRoomCode(): string {
  let s = "";
  for (let i = 0; i < 4; i++) {
    s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  }
  return s;
}

export function isValidCode(s: string): boolean {
  return /^[A-HJ-NP-Z]{4}$/.test(s);
}
