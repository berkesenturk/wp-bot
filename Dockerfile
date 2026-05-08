# ── Builder ───────────────────────────────────────────────────────────────────
FROM node:20-bookworm AS builder

# build-essential: g++/make for better-sqlite3 native compilation
# python3: node-gyp dep
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime

# LanceDB prebuilt .node binary links against glibc — slim has it, alpine doesn't
RUN apt-get update && apt-get install -y --no-install-recommends \
    libstdc++6 libgcc-s1 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY index.js ./
COPY src/ ./src/
COPY public/ ./public/

ENV XENOVA_CACHE_DIR=/app/model-cache
ENV PORT=3000

EXPOSE 3000
USER node
CMD ["node", "index.js"]
