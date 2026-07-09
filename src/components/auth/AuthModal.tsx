"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/Button";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthed: () => void;
}

export function AuthModal({ open, onClose, onAuthed }: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Registration failed");
        }
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        throw new Error("Invalid email or password");
      }
      onAuthed();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={mode === "signin" ? "Sign in" : "Create account"}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-space-800 border-space-600 w-full max-w-md rounded-2xl border p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex gap-2">
              <button
                className={`flex-1 rounded-xl px-4 py-2 font-bold transition-colors cursor-pointer ${mode === "signin" ? "bg-accent-500 text-space-950" : "bg-space-700 text-space-400"}`}
                onClick={() => setMode("signin")}
              >
                Sign in
              </button>
              <button
                className={`flex-1 rounded-xl px-4 py-2 font-bold transition-colors cursor-pointer ${mode === "register" ? "bg-accent-500 text-space-950" : "bg-space-700 text-space-400"}`}
                onClick={() => setMode("register")}
              >
                Create account
              </button>
            </div>
            <form onSubmit={submit} className="flex flex-col gap-3">
              {mode === "register" && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-space-400 font-semibold">Display name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={1}
                    maxLength={24}
                    className="bg-space-900 border-space-600 rounded-xl border px-4 py-2.5 text-white outline-none focus:border-accent-400"
                    placeholder="Captain Bean"
                  />
                </label>
              )}
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-space-400 font-semibold">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-space-900 border-space-600 rounded-xl border px-4 py-2.5 text-white outline-none focus:border-accent-400"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-space-400 font-semibold">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="bg-space-900 border-space-600 rounded-xl border px-4 py-2.5 text-white outline-none focus:border-accent-400"
                  placeholder="At least 8 characters"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                />
              </label>
              {error && (
                <p role="alert" className="text-danger-500 text-sm font-semibold">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy} className="mt-2">
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </Button>
              <p className="text-space-400 text-center text-xs">
                Accounts store your stats, match history and friends. You can always play as a
                guest.
              </p>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
