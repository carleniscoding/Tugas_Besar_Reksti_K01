# Docker Run Guide

This setup uses the existing `.env` file for `DATABASE_URL` and `DIRECT_URL`.
It does not start a local database container.

## Start Everything

```bash
docker compose up --build
```

Services:

- Web app: http://localhost:3000
- Mobile/PWA shell: http://localhost:5173
- Backend API: http://localhost:4000
- Face recognition API: http://localhost:5000

## Apply Database Migrations

Run this after containers build, using the remote database configured in `.env`:

```bash
docker compose run --rm backend npm run prisma:migrate
```

## Regenerate Prisma Client

```bash
docker compose run --rm backend npm run prisma:generate
```

## Notes

- `backend` receives `PYTHON_API_URL=http://face-recognition:5000` inside Docker.
- `web` proxies `/api/*` to `http://backend:4000`.
- `mobile` uses `VITE_API_BASE_URL=http://localhost:4000` because browser JavaScript calls the API from your host browser.
