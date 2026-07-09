# Deploying Crewfall

Crewfall is one codebase with two runtime roles:

1. **Web app** — Next.js pages, Auth.js, REST API (`/api/*`). Stateless; runs anywhere
   Next.js runs, including Vercel serverless.
2. **Realtime game server** — the authoritative Socket.IO engine. Stateful and
   long-lived; it needs a persistent Node process (Docker, VPS, Fly.io, Railway,
   Render…). Serverless platforms (including Vercel functions) cannot keep the
   in-memory rooms and 30 Hz simulation alive, so this role always runs on a Node host.

You can run both roles in **one process** (simplest) or **split** them (Vercel + a
small realtime node).

---

## Option A — Single server (simplest, recommended to start)

Any Node 20+ host or the included Docker image. One process serves the site _and_
the game.

```bash
npm ci
npm run build
AUTH_SECRET=$(openssl rand -base64 32) \
DATABASE_URL=postgres://… \
npm start          # serves web + websockets on $PORT (default 3000)
```

Or with Docker:

```bash
docker compose up --build          # includes Postgres + migrations
# or, bring your own database:
docker build -t crewfall .
docker run -p 3000:3000 -e AUTH_SECRET=… -e DATABASE_URL=… crewfall
```

Health check endpoint: `GET /healthz`.

---

## Option B — Vercel (web) + realtime node (game server)

### 1. Database (Neon or Supabase)

- **Neon**: create a project, copy the pooled connection string
  (`postgresql://…neon.tech/…?sslmode=require`).
- **Supabase**: Settings → Database → connection string (URI).

Apply schema + seed from your machine:

```bash
DATABASE_URL="postgres://…" npx prisma migrate deploy
DATABASE_URL="postgres://…" npx prisma db seed
```

### 2. Deploy the realtime server

Run the same repo anywhere that keeps a Node process alive, with `REALTIME_ONLY=1`:

```bash
# Fly.io / Railway / Render / VPS — using the Docker image:
docker build -t crewfall .
docker run -p 3000:3000 \
  -e REALTIME_ONLY=1 \
  -e AUTH_SECRET=<same secret as the web app> \
  -e DATABASE_URL=<same database> \
  -e SOCKET_CORS_ORIGINS=https://your-app.vercel.app \
  crewfall
```

(Equivalent without Docker: `npm ci && npm run realtime`.)

Notes:

- `AUTH_SECRET` **must match** the web app — it verifies the signed socket tokens.
- `SOCKET_CORS_ORIGINS` is a comma-separated list of allowed browser origins.
- `DATABASE_URL` is optional here; without it matches simply aren't persisted.
- Put it behind TLS (Fly/Railway/Render do this automatically). WebSockets need
  no special configuration beyond that.

### 3. Deploy the web app to Vercel

Import the repository into Vercel — `vercel.json` and the standard Next.js build work
with **zero code changes**. Set the environment variables:

| Variable                 | Value                                                         |
| ------------------------ | ------------------------------------------------------------- |
| `DATABASE_URL`           | your Neon/Supabase connection string                          |
| `AUTH_SECRET`            | `openssl rand -base64 32` (same value on the realtime server) |
| `AUTH_URL`               | `https://your-app.vercel.app`                                 |
| `AUTH_TRUST_HOST`        | `true`                                                        |
| `NEXT_PUBLIC_SOCKET_URL` | `https://your-realtime-host` (from step 2)                    |
| `BLOB_READ_WRITE_TOKEN`  | _(optional)_ Vercel Blob token for user uploads               |

Deploy. The browser loads pages/auth/REST from Vercel and connects its game socket
to `NEXT_PUBLIC_SOCKET_URL`.

---

## Environment variable reference

| Variable                 | Required      | Description                                           |
| ------------------------ | ------------- | ----------------------------------------------------- |
| `AUTH_SECRET`            | prod: yes     | Signs Auth.js sessions **and** realtime socket tokens |
| `DATABASE_URL`           | no            | PostgreSQL. Absent ⇒ guest-only mode, no persistence  |
| `AUTH_URL`               | on Vercel     | Canonical site URL for Auth.js                        |
| `AUTH_TRUST_HOST`        | on proxies    | Set `true` behind Vercel/reverse proxies              |
| `NEXT_PUBLIC_SOCKET_URL` | split mode    | Realtime server URL; empty ⇒ same origin              |
| `SOCKET_CORS_ORIGINS`    | split mode    | Comma-separated allowed origins for sockets           |
| `REALTIME_ONLY`          | realtime node | `1` ⇒ skip Next.js, serve only the game engine        |
| `PORT` / `HOST`          | no            | Listen address (default `3000` / `0.0.0.0`)           |

## Database operations

```bash
npm run db:migrate        # prisma migrate deploy (committed migrations)
npm run db:migrate:dev    # create a new migration during development
npm run db:seed           # cosmetics catalog + demo user
npm run db:push           # schema push without migrations (prototyping)
```

The initial migration is committed at `prisma/migrations/0_init/`, so
`prisma migrate deploy` works on a fresh database with no extra steps.

## Scaling notes

- One realtime process comfortably runs many concurrent rooms (the simulation is
  ~30 Hz of integer grid math per room). Scale vertically first.
- To scale horizontally, shard rooms across processes by room code and route
  clients with a consistent-hash proxy; rooms are fully self-contained in memory,
  and only finished matches touch the database.
- Session affinity: enable sticky sessions on your load balancer if you use the
  polling fallback transport (pure-websocket clients don't need it).

## Troubleshooting

| Symptom                                   | Fix                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Browser stuck at "Boarding the Helion…"   | `NEXT_PUBLIC_SOCKET_URL` unreachable or CORS: check `SOCKET_CORS_ORIGINS` on the realtime server |
| `Invalid auth token` socket errors        | `AUTH_SECRET` differs between web app and realtime server                                        |
| Accounts return 503                       | `DATABASE_URL` missing — guest play still works                                                  |
| `prisma migrate deploy` fails on Supabase | Use the direct (non-pgbouncer) connection string for migrations                                  |
