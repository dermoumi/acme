# syntax=docker/dockerfile:1

# Context is the repo root: the lockfile, catalog and @acme/sentry source all
# live outside this directory.
#   docker build -f apps/posy/Dockerfile .

FROM node:24.19.0-trixie AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
RUN corepack enable

# Manifests before sources, so editing a file does not redo the install.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/posy/package.json apps/posy/
COPY packages/app/package.json packages/app/
COPY packages/db/package.json packages/db/
COPY packages/deploy/package.json packages/deploy/
COPY packages/rate-limiter/package.json packages/rate-limiter/
COPY packages/sentry/package.json packages/sentry/
COPY packages/tsconfig/package.json packages/tsconfig/
RUN pnpm install --frozen-lockfile

COPY . .

# After the install layer: each of these changes the cache key. The client bakes
# them in, so unlike the runtime stage's copies they are needed at build time.
ARG APP_NAME=posy \
    APP_ENV=production \
    APP_VERSION=dev \
    APP_REVISION=dev
RUN pnpm exec turbo build:node --filter=@acme/posy

# `acme-db migrate` loads acme.config.ts through tsx, so it needs the tree the
# bundle inlined away. Injected, or workspace packages stay monorepo symlinks.
RUN pnpm --config.inject-workspace-packages=true \
    deploy --filter=@acme/posy --prod /deploy

# Here, not in the runtime stage: a later RUN cannot shrink the COPY below it.
ARG TARGETARCH
RUN set -eu; \
    case "$TARGETARCH" in \
      amd64) keep=linux-x64 ;; \
      arm64) keep=linux-arm64 ;; \
      *) echo "no better-sqlite3 prebuild for TARGETARCH=${TARGETARCH:-unset}" >&2; exit 1 ;; \
    esac; \
    for dir in /deploy/node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3; do \
      rm -rf "$dir/deps" "$dir/src" "$dir/binding.gyp"; \
      find "$dir/prebuilds" -name '*.node' ! -name "$keep.node" -delete; \
      test -f "$dir/prebuilds/$keep.node"; \
    done

# Optional peers of @sentry/cloudflare and valibot: no Worker or tsc runs here.
# By path: the workspace root has no package's bin on PATH.
RUN node packages/deploy/src/cli/bin/acme-deploy.js prune --root=/deploy \
      wrangler miniflare workerd '@cloudflare/workerd-*' \
      typescript '@typescript/*'

FROM node:24.19.0-trixie-slim
WORKDIR /app

# An unset APP_ENV reads as development, which serves /debug/*.
ENV NODE_ENV=production \
    APP_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:/var/lib/posy/posy.db \
    ASSETS_DIR=./dist/client

# The app's own directory, so acme.config.ts and its migrations resolve.
COPY --from=build /deploy ./

# Only a package manager puts .bin on the path, and this stage has none. Earns
# its keep on `docker exec <container> acme-db seed`, not just on CMD.
ENV PATH="/app/node_modules/.bin:$PATH"

ARG APP_NAME=posy \
    APP_VERSION=dev \
    APP_REVISION=dev
ENV APP_NAME=$APP_NAME \
    APP_VERSION=$APP_VERSION \
    APP_REVISION=$APP_REVISION

# Docker seeds a fresh volume from the image, ownership included, so this has
# to happen before VOLUME or the node user cannot write to it.
RUN mkdir -p /var/lib/posy && chown node:node /var/lib/posy
VOLUME /var/lib/posy

USER node
EXPOSE 3000

# The slim image has neither curl nor wget.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD \
  node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# exec so node, which handles its own signals, replaces sh as PID 1. sh does
# not forward them, so a stop during the migration still waits for the timeout.
CMD ["sh", "-c", "acme-db migrate && exec node dist/server/index.mjs"]
