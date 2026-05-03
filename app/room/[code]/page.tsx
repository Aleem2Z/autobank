import { notFound } from "next/navigation";
import { isValidCode } from "@/lib/game/codes";
import RoomClient from "./RoomClient";

export default async function RoomPage(ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const upper = code.toUpperCase();
  if (!isValidCode(upper)) notFound();
  return <RoomClient code={upper} />;
}
