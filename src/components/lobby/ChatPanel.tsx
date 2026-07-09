"use client";

import { useEffect, useRef, useState } from "react";
import { CHAT_MAX_LENGTH, colorHex } from "@/shared/constants";
import { emitAck, getSocket } from "@/game/net/socket";
import { useGameStore } from "@/game/store/gameStore";
import { useLobbyStore } from "@/game/store/lobbyStore";

interface ChatPanelProps {
  channelLabel: string;
  /** restrict displayed messages to these channels; empty = all */
  channels?: Array<"lobby" | "meeting" | "ghost">;
  compact?: boolean;
}

export function ChatPanel({ channelLabel, channels, compact = false }: ChatPanelProps) {
  const chat = useGameStore((s) => s.chat);
  const myPlayerId = useLobbyStore((s) => s.myPlayerId);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const messages = channels ? chat.filter((m) => channels.includes(m.channel)) : chat;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    const socket = getSocket();
    if (!socket) return;
    setDraft("");
    const res = await emitAck(socket, "chat:send", { text });
    if (!res.ok) {
      setError(res.error ?? "Message not sent");
      setTimeout(() => setError(null), 2500);
    }
  };

  return (
    <div className="bg-space-800/70 border-space-600 flex h-full min-h-0 flex-1 flex-col rounded-2xl border backdrop-blur">
      {!compact && (
        <div className="border-space-600 border-b px-4 py-2.5">
          <h3 className="text-sm font-bold text-white">{channelLabel}</h3>
        </div>
      )}
      <div
        ref={listRef}
        className="flex-1 space-y-1.5 overflow-y-auto px-4 py-3"
        role="log"
        aria-live="polite"
        aria-label={channelLabel}
      >
        {messages.length === 0 && (
          <p className="text-space-400 py-4 text-center text-xs">No messages yet.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="text-sm leading-snug">
            <span className="font-bold" style={{ color: colorHex(m.fromColor) }}>
              {m.fromName}
              {m.fromId === myPlayerId ? " (you)" : ""}
              {m.channel === "ghost" ? " 👻" : ""}
            </span>
            <span className="text-space-200">: {m.text}</span>
          </div>
        ))}
      </div>
      <div className="border-space-600 flex gap-2 border-t p-2.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, CHAT_MAX_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
            e.stopPropagation();
          }}
          placeholder="Say something…"
          maxLength={CHAT_MAX_LENGTH}
          className="bg-space-900 border-space-600 focus:border-accent-400 min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm text-white outline-none"
          aria-label="Chat message"
        />
        <button
          onClick={() => void send()}
          className="bg-accent-500 text-space-950 hover:bg-accent-400 rounded-lg px-4 text-sm font-bold transition-colors cursor-pointer"
        >
          Send
        </button>
      </div>
      {error && (
        <p role="alert" className="text-danger-500 px-4 pb-2 text-xs font-semibold">
          {error}
        </p>
      )}
    </div>
  );
}
