FROM node:20-bookworm-slim

WORKDIR /workspace

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY votely-backend/package*.json ./votely-backend/
RUN cd votely-backend && npm ci

COPY votely-backend ./votely-backend
COPY votely-web/prisma ./votely-web/prisma

RUN mkdir -p /workspace/votely-web/node_modules/@prisma \
    && ln -s /workspace/votely-backend/node_modules/@prisma/client /workspace/votely-web/node_modules/@prisma/client

WORKDIR /workspace/votely-backend

RUN DIRECT_URL="postgresql://postgres:postgres@localhost:5432/postgres" \
    DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres" \
    npm run prisma:generate
RUN npm run build

EXPOSE 4000

CMD ["npm", "run", "dev"]
