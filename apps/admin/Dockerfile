# Build from the repository root so the workspace SDK resolves exactly as it
# does in CI and in local development:
# docker build -f apps/admin/Dockerfile .
FROM node:22.17-alpine AS build

WORKDIR /workspace

COPY . .

RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @better-commerce/sdk build && pnpm --filter @better-commerce/admin build

FROM nginx:1.27-alpine AS runtime

ARG ADMIN_BUILD_VERSION=unknown
ENV ADMIN_BUILD_VERSION=${ADMIN_BUILD_VERSION}
ENV API_UPSTREAM=http://api:3000

# The value is emitted in a public diagnostics response. Restrict it to a
# harmless release identifier before it reaches the Nginx configuration.
RUN printf '%s' "$ADMIN_BUILD_VERSION" | grep -Eq '^[A-Za-z0-9._+-]{1,128}$'

COPY apps/admin/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/apps/admin/dist/ /usr/share/nginx/html/admin/

EXPOSE 8080
