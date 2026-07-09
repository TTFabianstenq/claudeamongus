import { createServer } from "node:http";
import next from "next";
import { SocketGateway } from "@/server/net/SocketGateway";
import { persistMatch } from "@/server/persistence/matchRepository";

/**
 * Entry point for every non-Vercel deployment target.
 *
 * Combined mode (default): one HTTP server hosts the Next.js app AND the
 * authoritative Socket.IO game server — `npm run dev` / `npm run start`.
 *
 * Realtime-only mode (REALTIME_ONLY=1): hosts only the game server plus a
 * health endpoint — used when the web app itself is deployed to Vercel and
 * the game server runs on a Node host (Fly / Railway / VPS / Docker).
 */

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST ?? "0.0.0.0";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const realtimeOnly = process.env.REALTIME_ONLY === "1" || process.env.REALTIME_ONLY === "true";

async function main(): Promise<void> {
  if (!process.env.AUTH_SECRET) {
    if (dev) {
      process.env.AUTH_SECRET = "insecure-dev-secret-do-not-use-in-production";
      console.warn("[server] AUTH_SECRET missing — using an insecure dev-only default");
    } else {
      throw new Error("AUTH_SECRET must be set in production");
    }
  }

  let handle:
    | ((req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void)
    | null = null;

  if (!realtimeOnly) {
    const app = next({ dev, hostname, port });
    await app.prepare();
    handle = app.getRequestHandler();
  }

  const httpServer = createServer((req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, mode: realtimeOnly ? "realtime" : "combined" }));
      return;
    }
    if (handle) {
      handle(req, res);
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Crewfall realtime server — connect via Socket.IO at /socket");
  });

  const gateway = new SocketGateway(httpServer, { persistMatch });

  httpServer.listen(port, hostname, () => {
    console.log(
      `[server] ${realtimeOnly ? "realtime" : "combined"} server listening on http://${hostname}:${port} (${dev ? "development" : "production"})`,
    );
  });

  const shutdown = async (signal: string) => {
    console.log(`[server] ${signal} received — shutting down`);
    await gateway.close();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("[server] fatal", error);
  process.exit(1);
});
