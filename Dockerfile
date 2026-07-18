FROM docker.io/oven/bun:1.3.11-alpine AS builder

WORKDIR /app/builder
COPY package.json .
COPY bun.lock .
RUN bun install --frozen-lockfile

COPY src ./src
COPY public ./public

COPY angular.json .
COPY ngsw-config.json .
COPY tsconfig.json .
COPY tsconfig.app.json .
COPY tsconfig.spec.json .

ARG COMMIT_HASH=unknown
RUN bun run build -- --define "import.meta.env.APP_COMMIT_HASH=\"$COMMIT_HASH\"" --define "import.meta.env.APP_VERSION=\"$(grep '"version"' package.json | sed 's/.*"\(.*\)".*/\1/')\""

FROM nginx:alpine-slim AS prod

COPY --from=builder /app/builder/dist/watch-list/browser /usr/share/nginx/html

EXPOSE 80
