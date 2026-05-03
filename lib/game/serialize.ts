import type { Room } from "./types";

/**
 * Wire-safe view of a Room. Strips `passcodeHash` so it never reaches a
 * connected client over SSE, GETs, or any other channel. Use for every
 * publish() and JSON response.
 */
export function publicRoom(room: Room): Room {
  const { passcodeHash: _ignored, ...rest } = room;
  void _ignored;
  return rest as Room;
}
