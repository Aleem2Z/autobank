import { EventEmitter } from "node:events";
import type { Store } from "./types";
import type { Room, RoomEvent } from "@/lib/game/types";

export class MemoryStore implements Store {
  private rooms = new Map<string, Room>();
  private bus = new EventEmitter();

  constructor() {
    this.bus.setMaxListeners(0);
  }

  async getRoom(code: string): Promise<Room | null> {
    return this.rooms.get(code) ?? null;
  }

  async saveRoom(room: Room): Promise<void> {
    this.rooms.set(room.code, room);
  }

  async publish(code: string, event: RoomEvent): Promise<void> {
    this.bus.emit(code, event);
  }

  subscribe(code: string, fn: (e: RoomEvent) => void): () => void {
    this.bus.on(code, fn);
    return () => this.bus.off(code, fn);
  }
}
