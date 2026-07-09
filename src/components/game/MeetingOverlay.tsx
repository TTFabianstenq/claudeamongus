"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { colorHex } from "@/shared/constants";
import { emitAck, getSocket } from "@/game/net/socket";
import { useGameStore } from "@/game/store/gameStore";
import { useLobbyStore } from "@/game/store/lobbyStore";
import { soundManager } from "@/game/audio/SoundManager";
import { Bean } from "@/components/ui/Bean";
import { ChatPanel } from "@/components/lobby/ChatPanel";

export function MeetingOverlay() {
  const meeting = useGameStore((s) => s.meeting);
  const playersMeta = useGameStore((s) => s.playersMeta);
  const amDead = useGameStore((s) => s.amDead);
  const settings = useGameStore((s) => s.settings);
  const myPlayerId = useLobbyStore((s) => s.myPlayerId);
  const lobby = useLobbyStore((s) => s.lobby);
  const [selected, setSelected] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 300);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (meeting?.stage === "voting") {
      setSelected(null);
      setVoted(false);
    }
  }, [meeting?.stage]);

  const alivePlayers = useMemo(() => {
    if (!lobby) return [];
    // players present in the lobby list; the meeting UI shows everyone,
    // dead players greyed out (their metadata lives in playersMeta)
    return lobby.players.map((p) => p.id);
  }, [lobby]);

  if (!meeting) return null;

  const secondsLeft = Math.max(0, Math.ceil((meeting.endsAt - now) / 1000));
  const caller = playersMeta[meeting.calledBy];
  const iVoted = voted || meeting.voted.includes(myPlayerId ?? "");

  const castVote = async (targetId: string | "skip") => {
    if (amDead || iVoted || meeting.stage !== "voting") return;
    const socket = getSocket();
    if (!socket) return;
    const res = await emitAck(socket, "meeting:vote", { targetId });
    if (res.ok) {
      setVoted(true);
      soundManager.play("vote");
    }
  };

  if (meeting.stage === "eject") {
    return <EjectScreen />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Emergency meeting"
    >
      <motion.div
        initial={{ scale: 0.85, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 240 }}
        className="bg-space-800 border-space-600 flex h-[min(92dvh,720px)] w-full max-w-4xl flex-col rounded-3xl border-2 shadow-2xl"
      >
        <div className="border-space-600 flex items-center justify-between border-b px-5 py-3">
          <div>
            <h2 className="text-xl font-black text-white sm:text-2xl">
              {meeting.reportedBody ? "DEAD BODY REPORTED" : "EMERGENCY MEETING"}
            </h2>
            <p className="text-space-400 text-sm">
              {meeting.stage === "reveal" &&
                (meeting.reportedBody
                  ? `${caller?.name ?? "Someone"} found ${playersMeta[meeting.reportedBody]?.name ?? "a body"}.`
                  : `${caller?.name ?? "Someone"} hit the button.`)}
              {meeting.stage === "discussion" && "Discuss. Who is acting sus?"}
              {meeting.stage === "voting" && (amDead ? "Ghosts watch. The living vote." : iVoted ? "Vote locked in." : "Cast your vote.")}
              {meeting.stage === "results" && "The votes are in…"}
            </p>
          </div>
          <div
            className={`rounded-2xl px-4 py-2 text-center font-mono text-2xl font-black ${
              secondsLeft <= 10 ? "text-danger-500" : "text-accent-400"
            }`}
            aria-live="polite"
          >
            {secondsLeft}s
            <p className="text-space-400 text-[10px] font-sans font-bold uppercase tracking-wider">
              {meeting.stage}
            </p>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 sm:flex-row">
          <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {alivePlayers.map((id) => {
              const meta = playersMeta[id];
              if (!meta) return null;
              const reveal = meeting.reveal?.find((r) => r.targetId === id);
              const hasVoted = meeting.voted.includes(id);
              const isSelectable = meeting.stage === "voting" && !amDead && !iVoted && id !== myPlayerId;
              // grey out ghosts: any player not in the current voted-capable set
              return (
                <button
                  key={id}
                  disabled={!isSelectable}
                  onClick={() => setSelected(selected === id ? null : id)}
                  className={`bg-space-900/80 relative flex items-center gap-2 rounded-xl border-2 p-2 text-left transition-colors ${
                    selected === id ? "border-danger-500" : "border-space-600"
                  } ${isSelectable ? "hover:border-accent-400 cursor-pointer" : "cursor-default"}`}
                  aria-pressed={selected === id}
                  aria-label={`Vote ${meta.name}`}
                >
                  <Bean color={meta.color} hat={meta.hat} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">
                      {meta.name}
                      {id === myPlayerId && <span className="text-accent-400"> (you)</span>}
                    </p>
                    {meeting.stage === "voting" && hasVoted && (
                      <p className="text-mint-400 text-xs font-bold">voted ✓</p>
                    )}
                    {meeting.stage === "results" && reveal && (
                      <div className="flex flex-wrap items-center gap-1" aria-label={`${reveal.count} votes`}>
                        {settings.anonymousVotes
                          ? Array.from({ length: reveal.count }).map((_, i) => (
                              <span key={i} className="bg-space-400 h-3 w-3 rounded-full" />
                            ))
                          : reveal.voters.map((vid) => (
                              <span
                                key={vid}
                                className="h-3 w-3 rounded-full border border-black/40"
                                style={{ backgroundColor: colorHex(playersMeta[vid]?.color ?? "red") }}
                                title={playersMeta[vid]?.name}
                              />
                            ))}
                      </div>
                    )}
                  </div>
                  {meeting.reportedBody === id && (
                    <span className="text-danger-500 absolute right-2 top-1 text-lg" title="Reported body">
                      ✝
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-72">
            <div className="min-h-0 flex-1">
              <ChatPanel
                channelLabel={amDead ? "Ghost chat" : "Discussion"}
                channels={amDead ? ["meeting", "ghost"] : ["meeting"]}
                compact
              />
            </div>
            {meeting.stage === "voting" && !amDead && !iVoted && (
              <div className="flex gap-2">
                <button
                  onClick={() => void castVote("skip")}
                  className="bg-space-700 border-space-600 text-space-200 hover:border-accent-400 flex-1 rounded-xl border px-3 py-2.5 text-sm font-black transition-colors cursor-pointer"
                >
                  Skip vote
                </button>
                <button
                  onClick={() => selected && void castVote(selected)}
                  disabled={!selected}
                  className="bg-danger-500 flex-1 rounded-xl px-3 py-2.5 text-sm font-black text-white transition-all hover:brightness-110 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  Confirm vote
                </button>
              </div>
            )}
            {meeting.stage === "results" && (
              <ResultsSummary />
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ResultsSummary() {
  const meeting = useGameStore((s) => s.meeting);
  const playersMeta = useGameStore((s) => s.playersMeta);
  if (!meeting?.reveal) return null;
  const skips = meeting.reveal.find((r) => r.targetId === "skip");
  return (
    <div className="bg-space-900/80 border-space-600 rounded-xl border p-3 text-sm">
      {skips && (
        <p className="text-space-200">
          <span className="font-bold">Skipped:</span> {skips.count}
        </p>
      )}
      <p className="text-space-200 mt-1 font-bold">
        {meeting.tieOrSkip
          ? "No one will be ejected."
          : `${playersMeta[meeting.ejected ?? ""]?.name ?? "Someone"} will be ejected.`}
      </p>
    </div>
  );
}

/** Full-screen ejection cinematic. */
function EjectScreen() {
  const meeting = useGameStore((s) => s.meeting);
  const playersMeta = useGameStore((s) => s.playersMeta);
  const settings = useGameStore((s) => s.settings);
  if (!meeting) return null;

  const ejected = meeting.ejected ? playersMeta[meeting.ejected] : null;
  let text: string;
  if (!ejected) {
    text = "No one was ejected. (Skipped or tied)";
  } else if (settings.confirmEjects) {
    text =
      meeting.ejectedRole === "impostor"
        ? `${ejected.name} was an Impostor.`
        : `${ejected.name} was not an Impostor.`;
  } else {
    text = `${ejected.name} was ejected.`;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-30 overflow-hidden bg-black"
      role="status"
      aria-live="assertive"
    >
      <div className="starfield absolute inset-0 opacity-60" />
      <AnimatePresence>
        {ejected && (
          <motion.div
            initial={{ x: "-20vw", y: "40vh", rotate: 0 }}
            animate={{ x: "115vw", y: "34vh", rotate: 720 }}
            transition={{ duration: 4.6, ease: "linear" }}
            className="absolute"
          >
            <Bean color={ejected.color} hat={ejected.hat} size={72} />
          </motion.div>
        )}
      </AnimatePresence>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 1 }}
        className="absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2 px-4 text-center text-2xl font-black tracking-wide text-white sm:text-4xl"
      >
        {text}
      </motion.p>
      {meeting.ejected && settings.confirmEjects && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.4 }}
          className="text-space-400 absolute left-1/2 top-[62%] -translate-x-1/2 text-sm font-bold"
        >
          {/* remaining impostors hint comes from the playerEjected event via confirm ejects */}
        </motion.p>
      )}
    </motion.div>
  );
}
