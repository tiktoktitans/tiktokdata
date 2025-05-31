# ────────────────────────────────────────────────────────────────────────────
# Stage 1: Install dependencies (builder)
# ────────────────────────────────────────────────────────────────────────────
FROM node:18-slim AS builder

# 1) Set working directory inside the container
WORKDIR /app

# 2) Copy package.json and lockfile, then install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# 3) Copy TypeScript source files into /app
COPY tsconfig.json ./
COPY supabaseClient.ts ./
COPY extractor.ts ./
COPY index.ts ./

# (We will run via ts-node directly, so no separate build step)

# ────────────────────────────────────────────────────────────────────────────
# Stage 2: Runtime image (runner)
# ────────────────────────────────────────────────────────────────────────────
FROM node:18-slim AS runner

# 1) Set working directory
WORKDIR /app

# 2) Copy only node_modules from the builder
COPY --from=builder /app/node_modules ./node_modules

# 3) Copy all source files from the builder
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/supabaseClient.ts ./
COPY --from=builder /app/extractor.ts ./
COPY --from=builder /app/index.ts ./

# 4) Install ts-node and typescript globally so we can run TS directly
RUN npm install -g ts-node typescript

# 5) By default, run your scraper with `ts-node index.ts`
CMD ["ts-node", "index.ts"]
