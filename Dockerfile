FROM node:alpine AS builder

WORKDIR /app/builder
COPY package.json .
COPY package-lock.json .
RUN npm install

COPY src ./src
COPY public ./public

COPY angular.json .
COPY ngsw-config.json .
COPY tsconfig.json .
COPY tsconfig.app.json .
COPY tsconfig.spec.json .

RUN npm run build

FROM nginx:alpine-slim AS prod

COPY --from=builder /app/builder/dist/watch-list/browser /usr/share/nginx/html

EXPOSE 80
