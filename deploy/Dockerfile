# Tamagotchi Go web client: Node 24 build, Caddy static runtime on port 8080.
# Build from the repository root: docker build -f deploy/Dockerfile .

FROM node:24.21.0-alpine3.24 AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM caddy:2.11.7-alpine
# Non-root runtime; Caddy keeps its state under /data and /config.
RUN addgroup -S web && adduser -S -G web web && chown -R web:web /data /config
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
USER web
EXPOSE 8080
# Health of this process only; Gateway readiness is checked separately.
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
