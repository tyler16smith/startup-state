FROM node:22-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY packages/config/package.json packages/config/package.json
COPY packages/mcp-contracts/package.json packages/mcp-contracts/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/mcp/package.json apps/mcp/package.json

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY packages/config packages/config
COPY packages/mcp-contracts packages/mcp-contracts
COPY apps/api/prisma apps/api/prisma
COPY apps/mcp apps/mcp

RUN DATABASE_URL=postgresql://user:pass@localhost:5432/db pnpm --filter fin-api exec prisma generate
RUN pnpm --filter @fin/mcp run build

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["pnpm", "--filter", "@fin/mcp", "run", "start"]
