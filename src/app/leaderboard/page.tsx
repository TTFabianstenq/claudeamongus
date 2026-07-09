"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { colorHex } from "@/shared/constants";
import { Bean } from "@/components/ui/Bean";

interface Entry {
  rank: number;
  name: string;
  color: string;
  gamesPlayed: number;
  gamesWon: number;
  kills: number;
  tasksCompleted: number;
  impostorWins: number;
  crewWins: number;
}

const SORTS = [
  { key: "wins", label: "Wins" },
  { key: "kills", label: "Kills" },
  { key: "tasks", label: "Tasks" },
  { key: "games", label: "Games" },
] as const;

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [by, setBy] = useState<string>("wins");
  const [disabled, setDisabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void fetch(`/api/leaderboard?by=${by}`)
      .then((res) => res.json())
      .then((data: { entries: Entry[]; disabled: boolean }) => {
        setEntries(data.entries);
        setDisabled(data.disabled);
      })
      .catch(() => setDisabled(true))
      .finally(() => setLoading(false));
  }, [by]);

  return (
    <main className="starfield bg-space-950 min-h-dvh">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-black text-white">Leaderboard</h1>
          <Link href="/" className="text-accent-400 font-bold hover:underline">
            ← Home
          </Link>
        </header>

        <div className="mb-4 flex gap-2">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setBy(s.key)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors cursor-pointer ${
                by === s.key ? "bg-accent-500 text-space-950" : "bg-space-800 text-space-400"
              }`}
              aria-pressed={by === s.key}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="bg-space-800/80 border-space-600 overflow-hidden rounded-2xl border backdrop-blur">
          {loading ? (
            <p className="text-space-400 py-16 text-center">Loading…</p>
          ) : disabled ? (
            <p className="text-space-400 px-6 py-16 text-center">
              The leaderboard needs a database. Configure DATABASE_URL to enable persistent stats.
            </p>
          ) : entries.length === 0 ? (
            <p className="text-space-400 py-16 text-center">Nobody here yet — go win some games!</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-space-600 text-space-400 border-b text-xs uppercase tracking-wider">
                  <th className="px-4 py-3">#</th>
                  <th className="px-2 py-3">Player</th>
                  <th className="px-2 py-3 text-right">Wins</th>
                  <th className="px-2 py-3 text-right">Kills</th>
                  <th className="px-2 py-3 text-right">Tasks</th>
                  <th className="px-4 py-3 text-right">Games</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.rank} className="border-space-700 border-b last:border-0">
                    <td className="text-space-400 px-4 py-2.5 font-mono font-bold">{entry.rank}</td>
                    <td className="px-2 py-2.5">
                      <span className="flex items-center gap-2">
                        <Bean color={entry.color} size={24} />
                        <span
                          className="font-bold text-white"
                          style={{ textShadow: `0 0 12px ${colorHex(entry.color)}40` }}
                        >
                          {entry.name}
                        </span>
                      </span>
                    </td>
                    <td className="text-mint-400 px-2 py-2.5 text-right font-bold">
                      {entry.gamesWon}
                    </td>
                    <td className="text-danger-500 px-2 py-2.5 text-right font-bold">
                      {entry.kills}
                    </td>
                    <td className="text-accent-400 px-2 py-2.5 text-right font-bold">
                      {entry.tasksCompleted}
                    </td>
                    <td className="text-space-200 px-4 py-2.5 text-right">{entry.gamesPlayed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
