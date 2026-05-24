FROM node:20-bookworm-slim

WORKDIR /workspace/votely-web

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY votely-web/package*.json ./
RUN npm ci

COPY votely-web ./
COPY votely-backend ../votely-backend

RUN DIRECT_URL="postgresql://postgres:postgres@localhost:5432/postgres" \
    DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres" \
    npx prisma generate --schema prisma/schema.prisma

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]
