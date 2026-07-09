"use client";

import { useEffect } from "react";
import { useSessionStore } from "@/game/store/sessionStore";

export function ThemeToggle() {
  const theme = useSessionStore((s) => s.theme);
  const setTheme = useSessionStore((s) => s.setTheme);

  useEffect(() => {
    const el = document.documentElement;
    if (theme === "light") {
      el.classList.remove("dark");
      el.classList.add("light");
    } else {
      el.classList.add("dark");
      el.classList.remove("light");
    }
  }, [theme]);

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="bg-space-800 border-space-600 hover:border-accent-400 rounded-xl border p-2 transition-colors cursor-pointer"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="5" fill="#ffd166" />
          <g stroke="#ffd166" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="2" x2="12" y2="4" />
            <line x1="12" y1="20" x2="12" y2="22" />
            <line x1="2" y1="12" x2="4" y2="12" />
            <line x1="20" y1="12" x2="22" y2="12" />
            <line x1="4.9" y1="4.9" x2="6.3" y2="6.3" />
            <line x1="17.7" y1="17.7" x2="19.1" y2="19.1" />
            <line x1="4.9" y1="19.1" x2="6.3" y2="17.7" />
            <line x1="17.7" y1="6.3" x2="19.1" y2="4.9" />
          </g>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" fill="#7ce7ff" />
        </svg>
      )}
    </button>
  );
}
