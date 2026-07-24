# syntax=docker/dockerfile:1.7
FROM node:26.5.0-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.4.0 --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    --mount=type=secret,id=gh_packages_token,required=true \
    GH_PACKAGES_TOKEN="$(cat /run/secrets/gh_packages_token)" pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
# Build-time values are isolated placeholders. Runtime production validation
# remains fail-closed and requires secrets to be injected by the platform.
ENV APP_ENV=test
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV NEXTAUTH_URL=http://127.0.0.1:3000
ENV NEXTAUTH_SECRET=build-only-nextauth-secret-material-32c
ENV MFA_ENCRYPTION_KEY=build-only-mfa-encryption-key-material-32c
RUN pnpm db:generate && pnpm build

FROM node:26.5.0-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV APP_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/agents/legal-rules ./agents/legal-rules
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
