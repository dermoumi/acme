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
COPY packages/db/package.json packages/db/
COPY packages/rate-limiter/package.json packages/rate-limiter/
COPY packages/sentry/package.json packages/sentry/
COPY packages/tsconfig/package.json packages/tsconfig/
RUN pnpm install --frozen-lockfile

COPY . .

# After the install layer: each of these changes the cache key.
ARG APP_NAME=posy
ARG APP_ENV=production
ARG APP_VERSION=dev
ARG APP_REVISION=dev
RUN pnpm exec turbo build:node --filter=@acme/posy

# Source and a prod-only install beside the bundle: `acme-db migrate` loads
# acme.config.ts through tsx, so it needs the tree the bundle inlined away.
RUN pnpm deploy --filter=@acme/posy --prod --legacy /deploy

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

FROM node:24.19.0-trixie-slim
WORKDIR /app

# Baked, not just build-time: /health reports these, so the image has to know
# which build it is once it is running.
ARG APP_NAME=posy
ARG APP_VERSION=dev
ARG APP_REVISION=dev
ENV APP_NAME=$APP_NAME
ENV APP_VERSION=$APP_VERSION
ENV APP_REVISION=$APP_REVISION

ENV NODE_ENV=production
# Unset reads as development, which serves /debug/*.
ENV APP_ENV=production
ENV PORT=3000
ENV DATABASE_URL=file:/var/lib/posy/posy.db

# The app's own directory, so acme.config.ts and its migrations resolve.
COPY --from=build /deploy ./

# Only a package manager puts .bin on the path, and this stage has none. Earns
# its keep on `docker exec <container> acme-db seed`, not just on CMD.
ENV PATH="/app/node_modules/.bin:$PATH"

# Docker seeds a fresh volume from the image, ownership included, so this has
# to happen before VOLUME or the node user cannot write to it.
RUN mkdir -p /var/lib/posy && chown node:node /var/lib/posy
VOLUME /var/lib/posy

USER node
EXPOSE 3000

# The slim image has neither curl nor wget.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD \
  node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# exec so node is PID 1 and receives signals.
CMD ["sh", "-c", "acme-db migrate && exec node dist/server/index.mjs"]
