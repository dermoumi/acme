# syntax=docker/dockerfile:1

# Context is the repo root: the lockfile, catalog and @acme/sentry source all
# live outside this directory.
#   docker build -f apps/posy/Dockerfile .

FROM node:24.18.0-trixie AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
RUN corepack enable

# Manifests before sources, so editing a file does not redo the install.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/posy/package.json apps/posy/
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

# The bundle inlines every dependency except the native binding. -L resolves
# pnpm's symlink, so this does not depend on the store's layout.
RUN cp -RL apps/posy/node_modules/better-sqlite3 /runtime-better-sqlite3 \
 && rm -rf /runtime-better-sqlite3/deps \
           /runtime-better-sqlite3/src \
           /runtime-better-sqlite3/binding.gyp

FROM node:24.18.0-trixie-slim
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
ENV DATABASE_PATH=/var/lib/posy/posy.db
ENV CLIENT_DIR=./client

# The SSR migration moves these to build/client and build/server.
COPY --from=build /app/apps/posy/dist/server ./
COPY --from=build /app/apps/posy/dist/client ./client
COPY --from=build /runtime-better-sqlite3 ./node_modules/better-sqlite3

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
CMD ["sh", "-c", "node migrate.mjs && exec node index.mjs"]
