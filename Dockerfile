# --- Сборка SPA ---
# Debian (glibc), а не alpine: у @tailwindcss/oxide нативный бинарник под платформу,
# и с musl npm легко ставит не тот вариант.
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Раздача статики + прокси /api ---
FROM nginx:1.28-alpine

# Адрес бэкенда; подставляется в конфиг через envsubst при старте контейнера.
ENV API_UPSTREAM=http://host.docker.internal:5232

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
