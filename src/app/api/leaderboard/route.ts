import { NextResponse } from "next/server";
import { databaseConfigured, getPrisma } from "@/server/persistence/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SORTS = {
  wins: { gamesWon: "desc" },
  kills: { kills: "desc" },
  tasks: { tasksCompleted: "desc" },
  games: { gamesPlayed: "desc" },
} as const;

export async function GET(request: Request): Promise<NextResponse> {
  if (!databaseConfigured()) {
    return NextResponse.json({ entries: [], disabled: true });
  }
  const url = new URL(request.url);
  const byParam = url.searchParams.get("by") ?? "wins";
  const by = (Object.keys(SORTS) as Array<keyof typeof SORTS>).includes(
    byParam as keyof typeof SORTS,
  )
    ? (byParam as keyof typeof SORTS)
    : "wins";

  const prisma = getPrisma();
  const rows = await prisma.stats.findMany({
    orderBy: SORTS[by],
    take: 50,
    include: { user: { select: { name: true, profile: { select: { favoriteColor: true } } } } },
  });

  return NextResponse.json({
    entries: rows.map((row, i) => ({
      rank: i + 1,
      name: row.user.name,
      color: row.user.profile?.favoriteColor ?? "red",
      gamesPlayed: row.gamesPlayed,
      gamesWon: row.gamesWon,
      kills: row.kills,
      tasksCompleted: row.tasksCompleted,
      impostorWins: row.impostorWins,
      crewWins: row.crewWins,
    })),
    disabled: false,
  });
}
