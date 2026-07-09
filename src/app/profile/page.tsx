"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bean } from "@/components/ui/Bean";
import { Button } from "@/components/ui/Button";
import { useAuthSession } from "@/lib/useAuthSession";

interface ProfileData {
  name: string;
  email: string;
  profile: { displayName: string; bio: string; favoriteColor: string; equippedHat: string } | null;
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    crewWins: number;
    impostorWins: number;
    kills: number;
    timesKilled: number;
    tasksCompleted: number;
    bodiesReported: number;
    sabotagesFixed: number;
  } | null;
}

interface MatchRow {
  id: string;
  endedAt: string;
  winner: "CREW" | "IMPOSTORS";
  reason: string;
  myRole: string;
  won: boolean;
  kills: number;
  tasksCompleted: number;
  players: Array<{ displayName: string; color: string; role: string }>;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuthSession();
  const [data, setData] = useState<ProfileData | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [friends, setFriends] = useState<Array<{ friendshipId: string; user: { id: string; name: string } }>>([]);
  const [pending, setPending] = useState<Array<{ friendshipId: string; user: { id: string; name: string }; incoming: boolean }>>([]);
  const [friendEmail, setFriendEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [profileRes, matchesRes, friendsRes] = await Promise.all([
      fetch("/api/profile"),
      fetch("/api/matches"),
      fetch("/api/friends"),
    ]);
    if (profileRes.ok) setData((await profileRes.json()) as ProfileData);
    if (matchesRes.ok) setMatches(((await matchesRes.json()) as { matches: MatchRow[] }).matches);
    if (friendsRes.ok) {
      const f = (await friendsRes.json()) as { friends: typeof friends; pending: typeof pending };
      setFriends(f.friends);
      setPending(f.pending);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
    if (user) void load();
  }, [user, loading, router, load]);

  const addFriend = async () => {
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: friendEmail }),
    });
    const body = (await res.json()) as { error?: string };
    setMessage(res.ok ? "Friend request sent!" : (body.error ?? "Could not send request"));
    setFriendEmail("");
    void load();
  };

  const respond = async (friendshipId: string, action: "accept" | "decline" | "remove") => {
    await fetch("/api/friends", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ friendshipId, action }),
    });
    void load();
  };

  if (loading || !user) {
    return (
      <main className="bg-space-950 flex min-h-dvh items-center justify-center">
        <p className="text-space-400">Loading…</p>
      </main>
    );
  }

  const stats = data?.stats;
  const winRate = stats && stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;

  return (
    <main className="starfield bg-space-950 min-h-dvh">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-black text-white">Profile</h1>
          <Link href="/" className="text-accent-400 font-bold hover:underline">
            ← Home
          </Link>
        </header>

        <div className="grid gap-4 md:grid-cols-[280px_1fr]">
          <section className="bg-space-800/80 border-space-600 rounded-2xl border p-5 text-center backdrop-blur">
            <Bean
              color={data?.profile?.favoriteColor ?? "red"}
              hat={data?.profile?.equippedHat ?? "none"}
              size={96}
              className="mx-auto"
            />
            <h2 className="mt-2 text-xl font-black text-white">{data?.name ?? user.name}</h2>
            <p className="text-space-400 text-sm">{data?.profile?.bio || "No bio yet."}</p>
            {stats && (
              <div className="mt-4 grid grid-cols-2 gap-2 text-left text-sm">
                <Stat label="Games" value={stats.gamesPlayed} />
                <Stat label="Win rate" value={`${winRate}%`} />
                <Stat label="Crew wins" value={stats.crewWins} />
                <Stat label="Impostor wins" value={stats.impostorWins} />
                <Stat label="Kills" value={stats.kills} />
                <Stat label="Tasks done" value={stats.tasksCompleted} />
                <Stat label="Bodies found" value={stats.bodiesReported} />
                <Stat label="Sabotages fixed" value={stats.sabotagesFixed} />
              </div>
            )}
          </section>

          <div className="flex flex-col gap-4">
            <section className="bg-space-800/80 border-space-600 rounded-2xl border p-5 backdrop-blur">
              <h3 className="mb-3 text-lg font-bold text-white">Friends</h3>
              <div className="mb-3 flex gap-2">
                <input
                  value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)}
                  placeholder="friend@example.com"
                  type="email"
                  className="bg-space-900 border-space-600 focus:border-accent-400 flex-1 rounded-lg border px-3 py-2 text-sm text-white outline-none"
                  aria-label="Friend email"
                />
                <Button size="sm" onClick={() => void addFriend()}>
                  Add
                </Button>
              </div>
              {message && <p className="text-accent-400 mb-2 text-xs font-bold">{message}</p>}
              {pending.filter((p) => p.incoming).map((p) => (
                <div key={p.friendshipId} className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-space-200">{p.user.name} wants to be friends</span>
                  <span className="flex gap-1">
                    <Button size="sm" onClick={() => void respond(p.friendshipId, "accept")}>
                      Accept
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void respond(p.friendshipId, "decline")}>
                      Decline
                    </Button>
                  </span>
                </div>
              ))}
              {friends.length === 0 && pending.length === 0 ? (
                <p className="text-space-400 text-sm">No friends yet — add someone by email.</p>
              ) : (
                <ul className="space-y-1">
                  {friends.map((f) => (
                    <li key={f.friendshipId} className="flex items-center justify-between text-sm">
                      <span className="font-bold text-white">{f.user.name}</span>
                      <button
                        onClick={() => void respond(f.friendshipId, "remove")}
                        className="text-space-400 hover:text-danger-500 text-xs cursor-pointer"
                      >
                        remove
                      </button>
                    </li>
                  ))}
                  {pending.filter((p) => !p.incoming).map((p) => (
                    <li key={p.friendshipId} className="text-space-400 text-sm">
                      {p.user.name} <span className="text-xs">(pending)</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-space-800/80 border-space-600 rounded-2xl border p-5 backdrop-blur">
              <h3 className="mb-3 text-lg font-bold text-white">Match history</h3>
              {matches.length === 0 ? (
                <p className="text-space-400 text-sm">No matches recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {matches.map((m) => (
                    <li
                      key={m.id}
                      className="bg-space-900/70 border-space-600 flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm"
                    >
                      <span>
                        <span className={`font-black ${m.won ? "text-mint-400" : "text-danger-500"}`}>
                          {m.won ? "WIN" : "LOSS"}
                        </span>
                        <span className="text-space-400"> as </span>
                        <span className={m.myRole === "impostor" ? "text-danger-500 font-bold" : "text-accent-400 font-bold"}>
                          {m.myRole}
                        </span>
                        <span className="text-space-400 block text-xs">
                          {new Date(m.endedAt).toLocaleString()} · {m.players.length} players
                        </span>
                      </span>
                      <span className="text-space-400 text-right text-xs">
                        {m.kills > 0 && <span className="block">{m.kills} kills</span>}
                        {m.tasksCompleted > 0 && <span className="block">{m.tasksCompleted} tasks</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-space-900/70 rounded-lg px-3 py-2">
      <p className="text-space-400 text-xs">{label}</p>
      <p className="font-black text-white">{value}</p>
    </div>
  );
}
