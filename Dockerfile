# syntax=docker/dockerfile:1

# ---------------------------------------------------------------- deps
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---------------------------------------------------------------- build
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------------------------------------------------------------- runtime
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
RUN addgroup -S crewfall && adduser -S crewfall -G crewfall

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY package.json next.config.ts tsconfig.json ./
COPY server ./server
COPY src ./src
COPY prisma ./prisma

USER crewfall
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

# Combined web + realtime server. Set REALTIME_ONLY=1 for a realtime-only node.
CMD ["npx", "tsx", "server/index.ts"]
