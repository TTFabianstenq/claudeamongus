import type { MatchSummary } from "@/server/engine/GameRoom";
import { databaseConfigured, getPrisma } from "./prisma";

/**
 * Writes a finished match and updates aggregate stats for every
 * authenticated participant. Guests appear in match history by display
 * name only. A missing DATABASE_URL degrades gracefully to a no-op so the
 * realtime server can run standalone.
 */
export async function persistMatch(summary: MatchSummary): Promise<void> {
  if (!databaseConfigured()) return;
  const prisma = getPrisma();

  await prisma.match.create({
    data: {
      roomCode: summary.code,
      mapId: summary.mapId,
      winner: summary.winners === "crew" ? "CREW" : "IMPOSTORS",
      reason: summary.reason,
      settings: JSON.parse(JSON.stringify(summary.settings)),
      startedAt: summary.startedAt,
      endedAt: summary.endedAt,
      players: {
        create: summary.players.map((p) => ({
          userId: p.userId,
          displayName: p.displayName,
          color: p.color,
          role: p.role,
          won: p.won,
          died: p.died,
          kills: p.kills,
          tasksCompleted: p.tasksCompleted,
          bodiesReported: p.bodiesReported,
        })),
      },
    },
  });

  for (const p of summary.players) {
    if (!p.userId) continue;
    const isImpostor = p.role === "impostor";
    await prisma.stats.upsert({
      where: { userId: p.userId },
      create: {
        userId: p.userId,
        gamesPlayed: 1,
        gamesWon: p.won ? 1 : 0,
        crewGames: isImpostor ? 0 : 1,
        crewWins: !isImpostor && p.won ? 1 : 0,
        impostorGames: isImpostor ? 1 : 0,
        impostorWins: isImpostor && p.won ? 1 : 0,
        kills: p.kills,
        timesKilled: p.died && !isImpostor ? 1 : 0,
        tasksCompleted: p.tasksCompleted,
        bodiesReported: p.bodiesReported,
        emergenciesCalled: p.emergenciesCalled,
        sabotagesFixed: p.sabotagesFixed,
      },
      update: {
        gamesPlayed: { increment: 1 },
        gamesWon: { increment: p.won ? 1 : 0 },
        crewGames: { increment: isImpostor ? 0 : 1 },
        crewWins: { increment: !isImpostor && p.won ? 1 : 0 },
        impostorGames: { increment: isImpostor ? 1 : 0 },
        impostorWins: { increment: isImpostor && p.won ? 1 : 0 },
        kills: { increment: p.kills },
        timesKilled: { increment: p.died && !isImpostor ? 1 : 0 },
        tasksCompleted: { increment: p.tasksCompleted },
        bodiesReported: { increment: p.bodiesReported },
        emergenciesCalled: { increment: p.emergenciesCalled },
        sabotagesFixed: { increment: p.sabotagesFixed },
      },
    });
  }
}
