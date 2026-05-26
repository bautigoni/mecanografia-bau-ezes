# EduTic

EduTic is a Vite + React + TypeScript + Tailwind CSS demo for a gamified Primary School digital literacy and keyboard skills platform.

## Install

```bash
npm install
```

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
