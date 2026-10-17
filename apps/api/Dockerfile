# Life API (Fastify) — preprod / production image.
# Build from the repo root:  docker build -f apps/api/Dockerfile -t life-api .
# The shared package is TypeScript source, so the API runs through tsx (as in dev).
FROM node:22-slim

ENV NODE_ENV=production \
    HUSKY=0 \
    PORT=4000 \
    HOST=0.0.0.0

WORKDIR /app

# Install only the API and shared workspaces (no web, no git hooks).
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace @life/api --workspace @life/shared --include=dev --ignore-scripts \
 && npm cache clean --force

COPY packages/shared packages/shared
COPY apps/api apps/api

# Run as the unprivileged "node" user.
RUN chown -R node:node /app
USER node

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node_modules/.bin/tsx", "apps/api/src/index.ts"]
