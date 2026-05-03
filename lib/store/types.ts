import type { Room, RoomEvent } from "@/lib/game/types";

export interface Store {
  getRoom(code: string): Promise<Room | null>;
  saveRoom(room: Room): Promise<void>;
  publish(code: string, event: RoomEvent): Promise<void>;
  subscribe(code: string, fn: (e: RoomEvent) => void): () => void;
}
