# Deploying TYPELY (Mecanografia) on Oracle VPS

The app ships as a single static-site container behind Caddy. Build artifacts
are produced inside the image by Node 22, then served by Nginx on port 80
(mapped to the host only on `127.0.0.1:3005`). Caddy terminates TLS and
reverse-proxies the public hostname into that loopback port.

## Prerequisites

The VPS must already have:

- Docker Engine + the `docker compose` plugin
- Caddy (or any reverse proxy) running on the host
- Outbound network access to `registry-1.docker.io` and `npmjs.org`
- A DNS A/AAAA record for `mecanografia.bauhub.online` pointing to the VPS

## 1. Clone the repository

```bash
sudo mkdir -p /opt/apps
sudo chown "$USER":"$USER" /opt/apps
git clone <your-git-url> /opt/apps/mecanografia
cd /opt/apps/mecanografia
```

## 2. Build and start the container

```bash
docker compose up -d --build
```

The first build pulls `node:22-alpine` and `nginx:alpine`, then runs
`npm ci` and `npm run build` (= `tsc --noEmit && vite build`). Subsequent
builds reuse Docker layer cache and finish in a few seconds when only
source code has changed.

Check that the container is healthy:

```bash
docker compose ps
docker compose logs --tail=50 mecanografia
```

## 3. Smoke-test the container locally

```bash
curl -I http://127.0.0.1:3005
```

You should see `HTTP/1.1 200 OK` with `content-type: text/html`. A
follow-up `curl http://127.0.0.1:3005/some/deep/route` must also return
the SPA `index.html` (not a 404) — that confirms the React Router
fallback in `nginx.conf` is wired up correctly.

## 4. Add the Caddy reverse-proxy block

Open the host Caddyfile (typically `/etc/caddy/Caddyfile`) and append:

```caddy
mecanografia.bauhub.online {
    reverse_proxy 127.0.0.1:3005
}
```

Validate and reload:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy will request a Let's Encrypt certificate on first hit. Verify from
outside the VPS:

```bash
curl -I https://mecanografia.bauhub.online
```

`HTTP/2 200` confirms TLS + proxy are both working.

## 5. Updating the app

```bash
cd /opt/apps/mecanografia
git pull
docker compose up -d --build
```

Compose detects the rebuilt image and recreates only the `mecanografia`
service with zero downtime for Caddy. Optionally prune the previous
image layer once the new one is verified working:

```bash
docker image prune -f
```

## 6. Rolling back

If a release misbehaves, roll back by checking out the previous commit
and rebuilding:

```bash
cd /opt/apps/mecanografia
git log --oneline -n 5            # find the last good commit
git checkout <commit-sha>
docker compose up -d --build
```

## 7. Common operations

| Action                       | Command                                              |
| ---------------------------- | ---------------------------------------------------- |
| Tail container logs          | `docker compose logs -f mecanografia`                |
| Restart the container        | `docker compose restart mecanografia`                |
| Stop & remove the container  | `docker compose down`                                |
| Re-read Caddyfile            | `sudo systemctl reload caddy`                        |
| Check what's listening       | `sudo ss -tlnp \| grep 3005`                         |
| Inspect built static assets  | `docker compose exec mecanografia ls /usr/share/nginx/html` |

## Notes

- The container only binds to `127.0.0.1:3005`, so the app cannot be hit
  directly from the public internet — all traffic must go through Caddy.
- `nginx.conf` enables long-term caching on hashed `/assets/*` files and
  forces `no-store` on `index.html`, so updates roll out cleanly without
  manual cache busting.
- `.dockerignore` keeps `node_modules`, `dist`, `.env`, `Images/`,
  `Images-new/`, `Skills/`, and the project's `.claude/` folder out of
  the build context — builds are fast and no secrets leak into the image.
