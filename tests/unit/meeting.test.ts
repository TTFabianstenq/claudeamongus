import { describe, expect, it } from "vitest";
import { MeetingService } from "@/server/engine/MeetingService";
import { ServerPlayer } from "@/server/engine/ServerPlayer";
import { DEFAULT_SETTINGS, type RoomSettings } from "@/shared/types";

function makePlayers(count: number): ServerPlayer[] {
  return Array.from({ length: count }, (_, i) => {
    const p = new ServerPlayer({
      id: `player-${i}`,
      resumeToken: `token-${i}`,
      socketId: `socket-${i}`,
      userId: null,
      name: `Player ${i}`,
      color: "red",
      hat: "none",
    });
    p.alive = true;
    return p;
  });
}

const settings: RoomSettings = { ...DEFAULT_SETTINGS, discussionTime: 15, votingTime: 60 };

describe("MeetingService", () => {
  it("walks reveal -> discussion -> voting -> results -> eject -> done", () => {
    const meeting = new MeetingService();
    const players = makePlayers(5);
    const t0 = 1_000_000;
    meeting.start("player-0", null, t0);
    expect(meeting.state?.stage).toBe("reveal");
    expect(meeting.tick(t0 + 1000, players, settings)).toBe("none");
    expect(meeting.tick(t0 + 7000, players, settings)).toBe("discussion");
    expect(meeting.tick(t0 + 7000 + 16_000, players, settings)).toBe("voting");
    expect(meeting.tick(t0 + 7000 + 16_000 + 61_000, players, settings)).toBe("results");
    const resultsAt = t0 + 7000 + 16_000 + 61_000;
    expect(meeting.tick(resultsAt + 7000, players, settings)).toBe("eject");
    expect(meeting.tick(resultsAt + 7000 + 6000, players, settings)).toBe("done");
    expect(meeting.state).toBeNull();
  });

  it("rejects invalid votes: ghosts, double votes, dead targets, wrong stage", () => {
    const meeting = new MeetingService();
    const players = makePlayers(4);
    meeting.start("player-0", null, 0);
    // still in reveal stage
    expect(meeting.castVote(players[0]!, "skip", players).ok).toBe(false);
    meeting.state!.stage = "voting";
    // dead voter
    players[1]!.alive = false;
    expect(meeting.castVote(players[1]!, "skip", players).ok).toBe(false);
    // dead target
    expect(meeting.castVote(players[0]!, "player-1", players).ok).toBe(false);
    // valid vote then duplicate
    expect(meeting.castVote(players[0]!, "player-2", players).ok).toBe(true);
    expect(meeting.castVote(players[0]!, "player-2", players).ok).toBe(false);
    // unknown target
    expect(meeting.castVote(players[2]!, "nobody", players).ok).toBe(false);
  });

  it("ejects the plurality target and reveals the role with confirmEjects", () => {
    const meeting = new MeetingService();
    const players = makePlayers(5);
    players[4]!.role = "impostor";
    meeting.start("player-0", null, 0);
    meeting.state!.stage = "voting";
    meeting.castVote(players[0]!, "player-4", players);
    meeting.castVote(players[1]!, "player-4", players);
    meeting.castVote(players[2]!, "player-4", players);
    meeting.castVote(players[3]!, "skip", players);
    meeting.castVote(players[4]!, "player-0", players);
    meeting.state!.endsAt = 0;
    meeting.tick(1, players, { ...settings, confirmEjects: true });
    expect(meeting.state?.ejected).toBe("player-4");
    expect(meeting.state?.ejectedRole).toBe("impostor");
    expect(meeting.state?.tieOrSkip).toBe(false);
  });

  it("does not eject on a tie", () => {
    const meeting = new MeetingService();
    const players = makePlayers(4);
    meeting.start("player-0", null, 0);
    meeting.state!.stage = "voting";
    meeting.castVote(players[0]!, "player-1", players);
    meeting.castVote(players[1]!, "player-0", players);
    meeting.castVote(players[2]!, "player-1", players);
    meeting.castVote(players[3]!, "player-0", players);
    meeting.state!.endsAt = 0;
    meeting.tick(1, players, settings);
    expect(meeting.state?.ejected).toBeNull();
    expect(meeting.state?.tieOrSkip).toBe(true);
  });

  it("does not eject when skip wins", () => {
    const meeting = new MeetingService();
    const players = makePlayers(4);
    meeting.start("player-0", null, 0);
    meeting.state!.stage = "voting";
    meeting.castVote(players[0]!, "skip", players);
    meeting.castVote(players[1]!, "skip", players);
    meeting.castVote(players[2]!, "skip", players);
    meeting.castVote(players[3]!, "player-0", players);
    meeting.state!.endsAt = 0;
    meeting.tick(1, players, settings);
    expect(meeting.state?.ejected).toBeNull();
    expect(meeting.state?.tieOrSkip).toBe(true);
  });

  it("hides voter identities when votes are anonymous", () => {
    const meeting = new MeetingService();
    const players = makePlayers(4);
    meeting.start("player-0", null, 0);
    meeting.state!.stage = "voting";
    meeting.castVote(players[0]!, "player-1", players);
    meeting.castVote(players[1]!, "player-1", players);
    meeting.castVote(players[2]!, "player-1", players);
    meeting.state!.endsAt = 0;
    meeting.tick(1, players, { ...settings, anonymousVotes: true });
    const entry = meeting.state?.reveal?.find((r) => r.targetId === "player-1");
    expect(entry?.count).toBe(3);
    expect(entry?.voters).toEqual([]);
  });

  it("fast-forwards voting when every living player has voted", () => {
    const meeting = new MeetingService();
    const players = makePlayers(3);
    meeting.start("player-0", null, 0);
    meeting.state!.stage = "voting";
    meeting.state!.endsAt = 100_000;
    for (const p of players) meeting.castVote(p, "skip", players);
    expect(meeting.tick(5_000, players, settings)).toBe("results");
  });

  it("skips discussion when discussionTime is zero", () => {
    const meeting = new MeetingService();
    const players = makePlayers(4);
    meeting.start("player-0", null, 0);
    expect(meeting.tick(7_000, players, { ...settings, discussionTime: 0 })).toBe("voting");
  });
});
