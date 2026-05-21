FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl
RUN npm install -g pnpm

# --- deps stage ---
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/api/package.json ./packages/api/
COPY packages/sdk/package.json ./packages/sdk/
RUN pnpm install --frozen-lockfile

# --- build stage ---
FROM deps AS builder
COPY packages/sdk ./packages/sdk
COPY packages/api ./packages/api
COPY tsconfig.base.json ./
RUN pnpm --filter @kite402/sdk build
RUN pnpm --filter @kite402/api exec prisma generate
RUN pnpm --filter @kite402/api build

# --- runner stage ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_PATH=/app/packages/api/node_modules:/app/node_modules
RUN apk add --no-cache openssl

COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/api/prisma ./prisma
COPY --from=builder /app/packages/sdk ./packages/sdk
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/api/node_modules ./packages/api/node_modules

EXPOSE 4000

CMD ["sh", "-c", "./packages/api/node_modules/.bin/prisma db push && node dist/server.js"]
