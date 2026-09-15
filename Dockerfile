# Multi-stage build: dependencies + production
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install deps (all, for build tools if needed)
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy node_modules from builder
COPY --from=builder /app/backend/node_modules ./backend/node_modules

# Copy application code
COPY backend ./backend
COPY frontend ./frontend

# Persisted token store + logs + cache
VOLUME ["/data"]

# Configuration
ENV PORT=8080
ENV TOKENS_FILE=/data/tokens.json
ENV NODE_ENV=production

EXPOSE 8080

WORKDIR /app/backend

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/stats', (r) => { if (r.statusCode !== 200) throw new Error('unhealthy'); })"

CMD ["node", "server.js"]
