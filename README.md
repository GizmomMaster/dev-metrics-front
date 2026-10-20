# dev-metrics-front

Фронтенд DevMetrics Analyzer (React 19 + Vite + TypeScript + TailwindCSS 4), вынесенный
из `MyProject/src/DevMetrics.Web` в отдельный проект с запуском в Docker.

Бэкенд (`DevMetrics.Api`) остаётся в исходном репозитории и запускается отдельно.

Оформление — как в `WP/ReviewPlatform`: shadcn/ui (стиль `radix-nova`, нейтральная палитра),
шрифт Geist. UI-примитивы лежат в `src/components/ui/` (скопированы из ReviewPlatform),
токены темы — в `src/styles/index.css`, общие стили графиков — в `src/lib/chart.ts`.
Импорт через алиас `@/` → `src/`.

## Как устроено

- `Dockerfile` — двухэтапная сборка: `node:20` собирает SPA (`npm run build` → `dist/`),
  `nginx:1.27-alpine` раздаёт статику.
- nginx (`docker/nginx.conf.template`):
  - отдаёт SPA с fallback на `index.html` для клиентского роутинга;
  - проксирует `/api/*` на бэкенд, адрес которого задаётся переменной `API_UPSTREAM`.

Клиент по-прежнему ходит на относительный `/api`, так что фронт и API для браузера живут
на одном origin — CORS и правки кода не нужны.

## Запуск в Docker

```bash
docker build -t dev-metrics-front .
docker run -d --name dev-metrics-front -p 8080:80 \
  --add-host host.docker.internal:host-gateway \
  -e API_UPSTREAM=http://host.docker.internal:5232 \
  dev-metrics-front
```

Или через compose (нужен плагин `docker compose` или `docker-compose`):

```bash
cp .env.example .env   # при необходимости поправить порт и адрес API
docker compose up -d --build
```

Приложение: http://localhost:8080 (логин `admin` / `ChangeMe123!` из сида).

### Важно: бэкенд должен быть доступен из контейнера

По умолчанию `dotnet run` (профиль из `launchSettings.json`) слушает только
`localhost:5232`, и из контейнера до него не достучаться — nginx вернёт `502`.
Варианты:

1. Запустить API на всех интерфейсах:
   ```bash
   cd src/DevMetrics.Api
   ASPNETCORE_URLS=http://0.0.0.0:5232 dotnet run --no-launch-profile
   ```
2. Или запустить фронт в сети хоста (только Linux), тогда `localhost` общий:
   ```bash
   docker run -d --network host -e API_UPSTREAM=http://127.0.0.1:5232 dev-metrics-front
   ```
   (фронт будет на http://localhost:80).
3. Если API тоже в Docker — указать его имя сервиса в той же сети,
   например `API_UPSTREAM=http://devmetrics-api:8080`.

## Переменные окружения

| Переменная         | Где используется      | По умолчанию                       |
|--------------------|-----------------------|------------------------------------|
| `API_UPSTREAM`     | nginx в контейнере    | `http://host.docker.internal:5232` |
| `FRONT_PORT`       | docker-compose        | `8080`                             |
| `API_PROXY_TARGET` | `npm run dev` (Vite)  | `http://localhost:5232`            |

## Локальная разработка без Docker

```bash
npm install
npm run dev     # http://localhost:5173, /api проксируется на API_PROXY_TARGET
npm test        # vitest
npm run build   # сборка в dist/
```

Node 18 ниже формальных требований Vite/Tailwind (`>=20`), поэтому `vite` закреплён на `^5.4`.
Если `vite` падает с «Cannot find native binding» (баг npm/cli#4828 с `@tailwindcss/oxide`):
`npm install @tailwindcss/oxide-linux-x64-gnu@<версия> --no-save`.

## Обновление токенов

SPA никогда не должна выполнять два обмена refresh-токена одновременно —
для этого существует `src/api/refreshCoordinator.ts`. Сервер ротирует одноразовые токены,
и параллельные обмены сработали бы как детектор повторного использования токена,
разлогинив пользователя везде. Любые изменения обработки 401 в `client.ts` должны
сохранять общий in-flight promise и флаг `_retriedAfterRefresh`.

Между вкладками обмен сериализуется через Web Locks (`navigator.locks`): получив
блокировку, вкладка сначала проверяет, не обновила ли токен другая вкладка. Web Locks
доступны только в secure context (HTTPS или `localhost`) — при раздаче по голому HTTP
остаётся защита только в пределах одной вкладки.

`/Auth/logout` отправляется в обход интерцепторов (`auth.ts`): при истёкшем access-токене
сначала обновляется пара, затем отзывается уже новый refresh-токен. 401 от `/Auth/*`
не запускает обновление и не уводит на форму входа.
