"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { signOut } from "next-auth/react";
import { HATS, PLAYER_COLORS, NAME_MAX_LENGTH } from "@/shared/constants";
import type { PublicRoomInfo } from "@/shared/types";
import { connectSocket, emitAck } from "@/game/net/socket";
import { useLobbyStore } from "@/game/store/lobbyStore";
import { useSessionStore } from "@/game/store/sessionStore";
import { soundManager } from "@/game/audio/SoundManager";
import { Bean } from "@/components/ui/Bean";
import { Button } from "@/components/ui/Button";
import { AuthModal } from "@/components/auth/AuthModal";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuthSession } from "@/lib/useAuthSession";

type JoinData = { code: string; playerId: string; resumeToken: string };

export function HomeScreen() {
  const router = useRouter();
  const session = useSessionStore();
  const { user, refresh } = useAuthSession();
  const setJoined = useLobbyStore((s) => s.setJoined);
  const [joinCode, setJoinCode] = useState("");
  const [publicRooms, setPublicRooms] = useState<PublicRoomInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  const displayName = session.name || user?.name || "";

  const refreshRooms = useCallback(async () => {
    try {
      const socket = await connectSocket(displayName || "Guest");
      const res = await emitAck<{ rooms: PublicRoomInfo[] }>(socket, "room:list");
      if (res.ok && res.data) setPublicRooms(res.data.rooms);
    } catch {
      // server unreachable — the browse list stays empty
    }
  }, [displayName]);

  useEffect(() => {
    const timer = setTimeout(() => void refreshRooms(), 400);
    return () => clearTimeout(timer);
  }, [refreshRooms]);

  const requireName = (): string | null => {
    const name = displayName.trim();
    if (!name) {
      setError("Pick a name first, crewmate.");
      return null;
    }
    return name;
  };

  const createGame = async () => {
    const name = requireName();
    if (!name) return;
    setBusy("create");
    setError(null);
    soundManager.unlock();
    try {
      const socket = await connectSocket(name);
      const res = await emitAck<JoinData>(socket, "room:create", {
        name,
        color: session.color,
        hat: session.hat,
        isPublic,
      });
      if (!res.ok || !res.data) throw new Error(res.error ?? "Could not create the room");
      setJoined(res.data);
      router.push("/play");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the game server");
    } finally {
      setBusy(null);
    }
  };

  const joinGame = async (code: string) => {
    const name = requireName();
    if (!name) return;
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6) {
      setError("Room codes are 6 letters.");
      return;
    }
    setBusy("join");
    setError(null);
    soundManager.unlock();
    try {
      const socket = await connectSocket(name);
      const res = await emitAck<JoinData>(socket, "room:join", {
        code: clean,
        name,
        color: session.color,
        hat: session.hat,
      });
      if (!res.ok || !res.data) throw new Error(res.error ?? "Could not join the room");
      setJoined(res.data);
      router.push("/play");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the game server");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="starfield starfield-animated bg-space-950 relative min-h-dvh overflow-x-hidden">
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 py-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Bean color={session.color} hat={session.hat} size={40} />
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              CREW<span className="text-accent-400">FALL</span>
            </h1>
          </div>
          <nav className="flex items-center gap-2" aria-label="Site">
            <Link
              href="/leaderboard"
              className="text-space-400 hover:text-accent-400 px-2 py-1 text-sm font-semibold"
            >
              Leaderboard
            </Link>
            {user ? (
              <>
                <Link
                  href="/profile"
                  className="text-space-400 hover:text-accent-400 px-2 py-1 text-sm font-semibold"
                >
                  {user.name ?? "Profile"}
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void signOut({ redirect: false }).then(() => refresh())}
                >
                  Sign out
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setAuthOpen(true)}>
                Sign in
              </Button>
            )}
            <ThemeToggle />
          </nav>
        </header>

        <div className="mt-10 grid flex-1 gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col gap-6"
            aria-label="Play"
          >
            <div>
              <h2 className="text-4xl font-black leading-tight text-white sm:text-5xl">
                Someone on this ship
                <br />
                <span className="text-danger-500">is not who they say.</span>
              </h2>
              <p className="text-space-400 mt-3 max-w-lg text-lg">
                Finish your tasks. Watch your back. Vote out the impostors before the HSS Helion
                falls. 4–15 players, right in the browser.
              </p>
            </div>

            <div className="bg-space-800/80 border-space-600 rounded-2xl border p-5 backdrop-blur">
              <label className="flex flex-col gap-1">
                <span className="text-space-400 text-sm font-semibold">Your name</span>
                <input
                  value={displayName}
                  onChange={(e) => session.setName(e.target.value.slice(0, NAME_MAX_LENGTH))}
                  placeholder="e.g. SusMuffin"
                  maxLength={NAME_MAX_LENGTH}
                  className="bg-space-900 border-space-600 focus:border-accent-400 rounded-xl border px-4 py-3 text-lg text-white outline-none"
                  aria-label="Player name"
                />
              </label>

              <CosmeticRow />

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  size="lg"
                  onClick={() => void createGame()}
                  disabled={busy !== null}
                  className="flex-1"
                >
                  {busy === "create" ? "Creating…" : "Create game"}
                </Button>
                <label className="text-space-400 flex items-center justify-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="accent-accent-500 h-4 w-4"
                  />
                  Public room
                </label>
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="ROOM CODE"
                  className="bg-space-900 border-space-600 focus:border-accent-400 w-full flex-1 rounded-xl border px-4 py-3 text-center font-mono text-lg tracking-[0.3em] text-white outline-none uppercase"
                  aria-label="Room code"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void joinGame(joinCode);
                  }}
                />
                <Button
                  variant="ghost"
                  onClick={() => void joinGame(joinCode)}
                  disabled={busy !== null}
                >
                  {busy === "join" ? "Joining…" : "Join"}
                </Button>
              </div>

              {error && (
                <p role="alert" className="text-danger-500 mt-3 text-sm font-bold">
                  {error}
                </p>
              )}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="flex flex-col gap-4"
            aria-label="Public games"
          >
            <div className="bg-space-800/80 border-space-600 flex-1 rounded-2xl border p-5 backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Public games</h3>
                <Button variant="ghost" size="sm" onClick={() => void refreshRooms()}>
                  Refresh
                </Button>
              </div>
              {publicRooms.length === 0 ? (
                <p className="text-space-400 py-8 text-center text-sm">
                  No public rooms right now.
                  <br />
                  Create one and invite your friends!
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {publicRooms.map((room) => (
                    <li key={room.code}>
                      <button
                        className="bg-space-900/70 border-space-600 hover:border-accent-400 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer disabled:opacity-50"
                        onClick={() => void joinGame(room.code)}
                        disabled={room.inGame || room.players >= room.maxPlayers}
                      >
                        <span>
                          <span className="block font-bold text-white">
                            {room.hostName}&apos;s ship
                          </span>
                          <span className="text-space-400 text-xs font-mono">{room.code}</span>
                        </span>
                        <span className="text-space-400 text-sm font-semibold">
                          {room.inGame ? "In game" : `${room.players}/${room.maxPlayers}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-space-800/60 border-space-600 rounded-2xl border p-4 text-sm">
              <h4 className="mb-1 font-bold text-white">How to play</h4>
              <p className="text-space-400">
                Crewmates win by finishing every task or ejecting all impostors. Impostors win by
                killing, sabotaging, and lying their way to the majority. Move with WASD, act with
                E, and trust no one.
              </p>
            </div>
          </motion.section>
        </div>

        <footer className="text-space-400 mt-8 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span>
            Crewfall — open-source social deduction. Original art, no affiliation with Among Us.
          </span>
          <span>Best played with 6–10 friends.</span>
        </footer>
      </div>
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthed={() => void refresh()}
      />
    </main>
  );
}

function CosmeticRow() {
  const session = useSessionStore();
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div>
        <span className="text-space-400 text-sm font-semibold">Suit color</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Suit color">
          {PLAYER_COLORS.map((c) => (
            <button
              key={c.id}
              role="radio"
              aria-checked={session.color === c.id}
              aria-label={c.name}
              onClick={() => session.setColor(c.id)}
              className={`h-8 w-8 rounded-full border-2 transition-transform cursor-pointer hover:scale-110 ${
                session.color === c.id ? "border-white scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      </div>
      <div>
        <span className="text-space-400 text-sm font-semibold">Hat</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Hat">
          {HATS.map((h) => (
            <button
              key={h.id}
              role="radio"
              aria-checked={session.hat === h.id}
              aria-label={h.name}
              title={h.name}
              onClick={() => session.setHat(h.id)}
              className={`bg-space-900 rounded-xl border p-1 transition-colors cursor-pointer ${
                session.hat === h.id ? "border-accent-400" : "border-space-600"
              }`}
            >
              <Bean color={session.color} hat={h.id} size={30} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
