# TYPELY (formerly EduTic)

TYPELY is a Vite + React + TypeScript + Tailwind CSS demo for a gamified Primary School digital literacy and keyboard skills platform.

## Install

```bash
npm install
```

## Local setup — environment variables

The app reads its config from a local `.env` file (loaded by Vite). The file
is gitignored — never commit it.

1. Copy the example:
   ```bash
   cp .env.example .env
   ```
2. Fill in your Google Identity Services Client ID:
   ```env
   VITE_GOOGLE_CLIENT_ID=404366112555-2rsl9af3vqdr5pv62m09r434vl7qdmor.apps.googleusercontent.com
   # Optional — comma-separated institutional domains. Empty = allow any.
   VITE_GOOGLE_ALLOWED_DOMAINS=
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```

If `VITE_GOOGLE_CLIENT_ID` is missing, the "Login with Google" button shows
*"Google Login no está configurado."* and does nothing.

> **Security:** never put `GOOGLE_CLIENT_SECRET` in this repo or in any
> `VITE_…` variable — Vite inlines those into the browser bundle. The secret
> is only used by a backend during an OAuth code exchange; this app has no
> such backend, so the secret has no place here.

## Google Cloud setup

In **Google Cloud Console → APIs & Services → Credentials → OAuth 2.0
Client IDs**, edit the Web application client and add:

**Authorized JavaScript origins:**
- `http://localhost:5173`
- `https://typely.bauhub.online`

**Authorized redirect URIs** (only needed if you ever add a server-side
code-exchange callback — not used by the current frontend-only flow):
- `http://localhost:5173/auth/google/callback`
- `https://typely.bauhub.online/auth/google/callback`

After login, the email returned by Google is matched against the local user
store. Unknown emails are rejected with *"Tu cuenta todavía no está
habilitada en Typely."* — unknown Google accounts never receive admin
privileges automatically.

> If you change the seed data (e.g. add an email to a user), wipe demo
> storage so the change is picked up — see **Reset Demo Data** below.

## Production / Docker

Vite inlines `VITE_…` variables at **build** time, so the production Docker
build must receive them as build args. `Dockerfile` and `docker-compose.yml`
already declare the args. Either export them in your shell and run compose:

```bash
export VITE_GOOGLE_CLIENT_ID=404366112555-2rsl9af3vqdr5pv62m09r434vl7qdmor.apps.googleusercontent.com
export VITE_GOOGLE_ALLOWED_DOMAINS=northfield.edu.ar,reditinere.com
docker compose up -d --build
```

…or pass them inline:

```bash
VITE_GOOGLE_CLIENT_ID=… docker compose up -d --build
```

…or place a `.env` file next to `docker-compose.yml` on the host (compose
reads it automatically). The file is gitignored.

## Run

```bash
npm run dev
```

## Demo Credentials

| Role | Username | Password | Route |
| --- | --- | --- | --- |
| Admin general | `admin` | `admin123` | `/admin-general` |
| Admin de sede | `sede` | `sede123` | `/admin-sede` |
| Profesor | `profe` | `profe123` | `/profesor` |
| Alumno | `sofia` | `alumno123` | `/mundos` |

The login page also has an "Entrar en modo demo" button for the selected role.

## Routes

- `/` and `/login`: login
- `/mundos`: student world selection
- `/worlds/island1` through `/worlds/island4`: island detail pages
- `/gameplay/encuentro-letras`: playable assisted letter activity
- `/gameplay/letra-rapida`: playable speed letter activity
- `/gameplay/tecla-correcta`: playable key accuracy activity
- `/gameplay/encuentro-palabras`: playable word typing activity
- `/gameplay/espacio-magico`: playable spacebar activity
- `/gameplay/borro-y-corrijo`: playable correction activity
- `/logros`: student rewards
- `/mi-cuenta`: student account
- `/admin-general`: general administration
- `/admin-sede`: site administration
- `/profesor`: teacher panel

## Assets

Original image files are stored in:

```text
Images/
```

Required app copies are stored in:

```text
public/assets/edutic-art/
```

Transparent world-selection island copies are stored in:

```text
public/assets/processed/
```

Do not modify, overwrite, crop, compress, recolor, or rename the original files inside `Images/`. Any processed versions must be copies in a separate folder such as `public/assets/processed/`.

## Reset Demo Data

Open the browser console and run:

```js
localStorage.removeItem("edutic_active_user");
localStorage.removeItem("edutic_demo_data");
localStorage.removeItem("edutic_sites");
localStorage.removeItem("edutic_classes");
localStorage.removeItem("edutic_users");
localStorage.removeItem("edutic_access_codes");
localStorage.removeItem("edutic_activities");
localStorage.removeItem("edutic_assignments");
localStorage.removeItem("edutic_attempts");
localStorage.removeItem("edutic_rewards");
location.reload();
```
