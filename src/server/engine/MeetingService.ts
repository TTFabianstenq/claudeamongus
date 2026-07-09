import { EJECT_SECONDS, MEETING_REVEAL_SECONDS } from "@/shared/constants";
import type { MeetingState, RoomSettings, VoteRevealEntry } from "@/shared/types";
import type { ServerPlayer } from "./ServerPlayer";

export type VoteResult = { ok: true } | { ok: false; error: string };

/**
 * Meeting state machine: reveal -> discussion -> voting -> results -> eject.
 * The GameRoom advances it by calling `tick(now)` and reacts to the returned
 * transitions. All vote validation happens here.
 */
export class MeetingService {
  state: MeetingState | null = null;
  private votes = new Map<string, string>(); // voterId -> targetId | "skip"

  start(calledBy: string, reportedBody: string | null, now: number): MeetingState {
    this.votes.clear();
    this.state = {
      stage: "reveal",
      calledBy,
      reportedBody,
      endsAt: now + MEETING_REVEAL_SECONDS * 1000,
      voted: [],
      reveal: null,
      ejected: null,
      ejectedRole: null,
      tieOrSkip: false,
    };
    return this.state;
  }

  get active(): boolean {
    return this.state !== null && this.state.stage !== "eject";
  }

  castVote(voter: ServerPlayer, targetId: string, players: ServerPlayer[]): VoteResult {
    if (!this.state || this.state.stage !== "voting") {
      return { ok: false, error: "Voting is not open" };
    }
    if (!voter.alive) return { ok: false, error: "Ghosts cannot vote" };
    if (this.votes.has(voter.id)) return { ok: false, error: "Already voted" };
    if (targetId !== "skip") {
      const target = players.find((p) => p.id === targetId);
      if (!target || !target.alive) return { ok: false, error: "Invalid vote target" };
    }
    this.votes.set(voter.id, targetId);
    this.state.voted = [...this.votes.keys()];
    return { ok: true };
  }

  allVotesIn(players: ServerPlayer[]): boolean {
    const alive = players.filter((p) => p.alive && p.connected);
    return alive.length > 0 && alive.every((p) => this.votes.has(p.id));
  }

  /**
   * Advances stage timers. Returns the transition that occurred this tick so
   * the room can broadcast / apply side effects.
   */
  tick(
    now: number,
    players: ServerPlayer[],
    settings: RoomSettings,
  ): "none" | "discussion" | "voting" | "results" | "eject" | "done" {
    const s = this.state;
    if (!s) return "none";

    if (s.stage === "voting" && this.allVotesIn(players) && now < s.endsAt) {
      s.endsAt = now; // everyone voted — fast-forward
    }
    if (now < s.endsAt) return "none";

    switch (s.stage) {
      case "reveal":
        if (settings.discussionTime > 0) {
          s.stage = "discussion";
          s.endsAt = now + settings.discussionTime * 1000;
          return "discussion";
        }
        s.stage = "voting";
        s.endsAt = now + settings.votingTime * 1000;
        return "voting";
      case "discussion":
        s.stage = "voting";
        s.endsAt = now + settings.votingTime * 1000;
        return "voting";
      case "voting":
        this.tally(players, settings);
        s.stage = "results";
        s.endsAt = now + MEETING_REVEAL_SECONDS * 1000;
        return "results";
      case "results":
        s.stage = "eject";
        s.endsAt = now + EJECT_SECONDS * 1000;
        return "eject";
      case "eject":
        this.state = null;
        return "done";
      default:
        return "none";
    }
  }

  private tally(players: ServerPlayer[], settings: RoomSettings): void {
    const s = this.state;
    if (!s) return;
    const counts = new Map<string, string[]>(); // targetId -> voterIds
    for (const [voter, target] of this.votes) {
      const list = counts.get(target) ?? [];
      list.push(voter);
      counts.set(target, list);
    }
    const reveal: VoteRevealEntry[] = [...counts.entries()]
      .map(([targetId, voters]) => ({
        targetId: targetId as VoteRevealEntry["targetId"],
        voters: settings.anonymousVotes ? [] : voters,
        count: voters.length,
      }))
      .sort((a, b) => b.count - a.count);
    s.reveal = reveal;

    const top = reveal[0];
    const second = reveal[1];
    if (!top || top.targetId === "skip" || (second && second.count === top.count)) {
      s.tieOrSkip = true;
      s.ejected = null;
      s.ejectedRole = null;
      return;
    }
    const target = players.find((p) => p.id === top.targetId);
    if (!target) {
      s.tieOrSkip = true;
      return;
    }
    s.ejected = target.id;
    s.ejectedRole = settings.confirmEjects ? target.role : null;
  }
}
