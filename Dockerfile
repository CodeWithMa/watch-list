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

# TODO
# FROM nginx:alpine-slim AS prod
#
# COPY --from=builder /app/builder/dist/apps/watch-list /usr/share/nginx/html
# COPY ./apps/watch-list/nginx.conf.template /etc/nginx/templates/default.conf.template
#
# EXPOSE 80
