# Crewfall 🛸

An open-source, browser-based social deduction game inspired by Among Us — with an
**authoritative multiplayer server**, original vector art, and a modern Next.js stack.
Finish your tasks, find the impostors, survive the **HSS Helion**.

> Crewfall is an independent open-source project. It is not affiliated with, endorsed by,
> or connected to Innersloth or Among Us. All art, sound, and the map are original:
> every sprite is drawn procedurally (Canvas/SVG) and every sound is synthesized with
> WebAudio at runtime — the repository ships **zero** binary assets.

## Features

**Lobby & social**

- Room creation with shareable 6-letter codes, public room browser, private rooms
- 15 suit colors + 10 hats (cosmetics catalog persisted per account)
- Host-configurable settings: impostor count, speed, vision, kill cooldown/range,
  discussion/voting time, emergency meetings, task counts, visual tasks,
  confirm ejects, anonymous voting, max players
- Ready system, host migration, 5-second launch countdown, lobby/meeting/ghost chat

**Crewmates**

- 9 reusable task minigames: wires, card swipe, fuel engine, download/upload,
  align engine, unlock manifolds, reactor Simon-says, garbage, asteroids
- Global task progress bar, optional visual-task proof broadcasts
- Emergency meetings, body reporting, discussion + voting + eject cinematic
- Ghosts keep playing: free flight through walls and their tasks still count

**Impostors**

- Kill with server-enforced cooldown and range, kill lunge and kill cam
- Vent network travel, fake task list, multiple impostors
- Five sabotages: **lights** (vision crush), **reactor** (dual-scanner meltdown timer),
  **O2** (two keypads), **comms** (blinds tasks/admin/cams), **doors** (per-room seals)

**The ship**

- One complete original map (14 rooms) with corridors, collision, vents,
  security cameras, admin life-signs table, emergency button and door systems

**Multiplayer engineering**

- Fully authoritative Socket.IO server — clients only send _intents_
- Server-side movement integration (speed hacks and teleports are impossible),
  zod validation on every packet, per-event token-bucket rate limits,
  duplicate/replay sequence rejection, strike-based kicking
- Vision-culled personalized snapshots (no wallhacks: ghosts, vented impostors and
  far-away players are stripped server-side)
- Client prediction + server reconciliation, 100 ms entity interpolation,
  smoothed clock sync, transparent reconnection with resume tokens

**Platform**

- Accounts (Auth.js v5 credentials) with stats, match history, friends and leaderboards —
  or play instantly as a guest
- PostgreSQL via Prisma (Neon/Supabase/local), graceful no-database mode
- Dark/light theme, responsive layout, touch joystick, keyboard-first controls,
  gamepad support out of the box

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 ·
Framer Motion · Zustand · Socket.IO · Prisma + PostgreSQL · Auth.js (NextAuth v5) ·
Vitest · Playwright · ESLint + Prettier · Docker

## Architecture

```
src/shared/     Deterministic simulation core shared by server & client:
                constants, types, zod wire protocol, collision grid, map data
src/server/     Authoritative engine (rooms, tasks, sabotage, meetings,
                anti-cheat), Socket.IO gateway, Auth.js, Prisma persistence
src/game/       Client runtime: prediction/interpolation game client,
                canvas renderer, input abstraction, WebAudio synth, stores
src/components/ React UI: home, lobby, HUD, meeting, minigames, panels
src/app/        Next.js routes and REST API (auth, profiles, leaderboard…)
server/         Node entry point (Next.js + Socket.IO on one port)
prisma/         Schema, committed initial migration, seed script
tests/          Vitest unit suites + real-websocket multiplayer simulation
e2e/            Playwright browser tests (two-context multiplayer lobby)
```

The networking model: clients sample input at 30 Hz and apply it locally through the
same `stepMovement` physics the server runs. The server consumes validated inputs on
its own 30 Hz loop and broadcasts 15 Hz personalized snapshots carrying `ackSeq`;
clients rewind to the server state and replay unacknowledged inputs (reconciliation)
while remote entities render 100 ms in the past (interpolation). Every action —
kill, vent, report, vote, task, fix — is re-validated server-side against position,
role, cooldowns and phase.

## Getting started

```bash
git clone <this repo> && cd crewfall
npm install
cp .env.example .env        # defaults are fine for guest play without a DB
npm run dev                 # http://localhost:3000
```

That's it — without a database you can already play full games as guests.
To enable accounts, stats and leaderboards:

```bash
# point DATABASE_URL at Postgres (Neon, Supabase, or docker-compose up db)
npm run db:migrate          # apply the committed migration
npm run db:seed             # cosmetics catalog + demo account
```

Demo account after seeding: `demo@crewfall.example` / `crewfall-demo`.

### One-command full stack

```bash
docker compose up --build   # Postgres + migrations + game at :3000
```

## Scripts

| Script                                       | Purpose                                                  |
| -------------------------------------------- | -------------------------------------------------------- |
| `npm run dev`                                | Dev server (Next.js + game server, hot reload)           |
| `npm run build`                              | Production build (`prisma generate && next build`)       |
| `npm start`                                  | Production server (web + realtime combined)              |
| `npm run realtime`                           | Realtime-only game server (for Vercel split deployments) |
| `npm test`                                   | Vitest unit + multiplayer simulation tests               |
| `npm run test:e2e`                           | Playwright browser tests                                 |
| `npm run lint` / `typecheck` / `format`      | Quality gates                                            |
| `npm run db:migrate` / `db:seed` / `db:push` | Database workflows                                       |

## Controls

| Input                                       | Action                             |
| ------------------------------------------- | ---------------------------------- |
| WASD / arrows / left stick / touch joystick | Move                               |
| E / Space / A-button                        | Use console, button, panel         |
| Q / X-button                                | Kill (impostor)                    |
| R / Y-button                                | Report body                        |
| V / B-button                                | Enter or exit vent (impostor)      |
| F or M / LB                                 | Sabotage map (impostor) / ship map |
| Esc                                         | Close panel                        |
| Enter                                       | Chat                               |

## Testing

```bash
npm test          # 60+ assertions: physics, map integrity (flood-fill
                  # connectivity), meetings/votes, tasks, sabotage, anti-cheat,
                  # plus a full match simulated over real websockets
npm run test:e2e  # Playwright: landing page, theme, two-browser lobby + chat
```

## Deployment

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for the full guide. Summary:

- **Vercel** hosts the Next.js app (pages, auth, REST API) unchanged.
  A persistent WebSocket game server cannot run inside serverless functions, so the
  realtime engine — the _same codebase_ — runs on any Node host
  (`REALTIME_ONLY=1`, Docker image included) and the client is pointed at it with
  `NEXT_PUBLIC_SOCKET_URL`.
- **Single-server** (Docker / VPS / Fly / Railway): run `npm start` — web and
  realtime on one port, zero extra configuration.

## License

[MIT](LICENSE). Original artwork and audio synthesis, no third-party assets.
