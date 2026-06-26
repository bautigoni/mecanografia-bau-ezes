# TYPELY secrets

Docker Compose reads these from disk and mounts them as
`/run/secrets/*` inside the containers. **Never commit real values.**

## Files

| File                  | Used by        | Notes                                                |
| --------------------- | -------------- | ---------------------------------------------------- |
| `db_password.txt`     | `db`           | Postgres `POSTGRES_PASSWORD`. Single line.           |
| `database_url.txt`    | `api`          | Full `postgres://typely:CHANGEME@db:5432/typely`.    |
| `jwt_secret.txt`      | `api`          | 64+ random bytes. `openssl rand -base64 64 > ...`.   |
| `resend_api_key.txt`  | `api`          | Empty line is fine — invites then become shareable links only. |

## First-time setup (on the VPS)

```bash
mkdir -p secrets
openssl rand -base64 64 > secrets/jwt_secret.txt
openssl rand -base64 24 | tr -d '/+=' > secrets/db_password.txt
sed -i "s/CHANGEME/$(cat secrets/db_password.txt)/" secrets/database_url.txt
: > secrets/resend_api_key.txt   # empty = no email service
chmod 600 secrets/*.txt
```

`database_url.txt` after `sed` should read:
`postgres://typely:<db_password>@db:5432/typely`

## Local development

For local dev you don't need the secrets files at all — set the env
vars directly in your shell or in `.env`. The compose `secrets:` keys
are no-ops when the file path is missing *and* the container also
falls back to env vars (see `Dockerfile.api`).
