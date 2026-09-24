# syntax=docker/dockerfile:1

# ─── Build stage: install everything and build the UI + server bundles ───
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ─── Production dependencies only ───
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# ─── Runtime stage: small, non-root ───
FROM node:24-alpine AS runtime
RUN apk add --no-cache tini
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/app/data \
    STATIC_DIR=/app/dist/client
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 8080
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--enable-source-maps", "dist/server/index.js"]
