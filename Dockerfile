# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

# Install all deps (dev included — needed for tsc and prisma generate)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source before generating so Prisma writes into the correct location
COPY tsconfig.json ./
COPY prisma/ ./prisma/
COPY prisma.config.ts ./
COPY src/ ./src/
RUN npx prisma generate
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:24-alpine
WORKDIR /app

# Fonts required by @napi-rs/canvas for text rendering on Linux
RUN apk add --no-cache fontconfig ttf-freefont && fc-cache -f

# Production deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Compiled output (includes dist/generated/prisma/)
COPY --from=builder /app/dist ./dist

# Healthcheck script (plain JS — runs in production without tsx)
COPY scripts/healthcheck.js ./scripts/

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
