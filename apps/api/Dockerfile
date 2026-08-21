FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/types/package.json packages/types/package.json
COPY packages/scoring/package.json packages/scoring/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS runtime
ENV NODE_ENV=production
COPY packages packages
COPY apps/api apps/api
WORKDIR /repo/apps/api
EXPOSE 3001
CMD ["pnpm", "start"]
