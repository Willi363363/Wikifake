# The realtime service, as Fly runs it.
#
# Built from the repository root, not from this directory: the service depends
# on five workspace packages, and a context that starts here cannot see them.
# `fly.toml` sets the context accordingly.
#
#   docker build -f apps/realtime/Dockerfile -t wikifake-realtime .
#
# The service runs TypeScript through `tsx` rather than a compiled bundle —
# `package.json` has no build script, and adding one to save a runtime
# dependency would be a second way to run the same code.

FROM node:22-alpine

RUN corepack enable pnpm

WORKDIR /app

ENV NODE_ENV=production

# The commit this image serves. Fly injects no commit variable of its own, so
# the deploy workflow passes it here and `/api/health` reads it back — that is
# the whole mechanism the CI probe compares against.
ARG FLY_GIT_COMMIT=""
ENV FLY_GIT_COMMIT=$FLY_GIT_COMMIT

# Only the manifests first: this layer is cached until a dependency changes,
# which is what stops every source edit from re-resolving the whole workspace.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/realtime/package.json apps/realtime/
COPY packages/article/package.json packages/article/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/domain/package.json packages/domain/
COPY packages/env/package.json packages/env/
COPY packages/protocol/package.json packages/protocol/

# `--ignore-scripts` for the same reason as CI: `@sentry/cli` downloads a
# binary at install time and nothing here needs it.
RUN pnpm install --frozen-lockfile --ignore-scripts

# The source, after the install: a change here invalidates one layer, not the
# dependency tree above it.
COPY apps/realtime/src apps/realtime/src
COPY apps/realtime/tsconfig.json apps/realtime/
COPY packages packages

# Not root. A process holding sockets from the open internet has no business
# owning the filesystem it runs on.
USER node

EXPOSE 8080

CMD ["pnpm", "--filter", "@wikifake/realtime", "start"]
