import { NextResponse } from "next/server";
import { auth } from "@/server/auth/auth";
import { databaseConfigured, getPrisma } from "@/server/persistence/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!databaseConfigured()) {
    return NextResponse.json({ matches: [] });
  }
  const prisma = getPrisma();
  const rows = await prisma.matchPlayer.findMany({
    where: { userId: session.user.id },
    orderBy: { match: { endedAt: "desc" } },
    take: 25,
    include: {
      match: { include: { players: { select: { displayName: true, color: true, role: true } } } },
    },
  });
  return NextResponse.json({
    matches: rows.map((row) => ({
      id: row.match.id,
      mapId: row.match.mapId,
      endedAt: row.match.endedAt,
      winner: row.match.winner,
      reason: row.match.reason,
      myRole: row.role,
      won: row.won,
      died: row.died,
      kills: row.kills,
      tasksCompleted: row.tasksCompleted,
      players: row.match.players,
    })),
  });
}
