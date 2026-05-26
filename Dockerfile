# syntax=docker/dockerfile:1.7

# ---------- Builder ----------
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies using the lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source tree and build.
COPY . .
RUN npm run build

# ---------- Runtime ----------
FROM nginx:alpine AS runtime

# Custom SPA-friendly Nginx config (try_files fallback to index.html).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static assets produced by Vite.
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# nginx:alpine already runs nginx in the foreground via its default CMD.
