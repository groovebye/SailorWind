# Security

## Secrets policy

- **No secrets in the repo or in docs.** All credentials live in an untracked `.env`
  (local) and a secrets manager (server). `.env*` is gitignored.
- Docs reference secrets as placeholders only: `${POSTGRES_PASSWORD}`, `<SERVER_IP>`.
- Secret scanning runs via [`.gitleaks.toml`](.gitleaks.toml) — locally and in CI.

## Exposed-credential incident — RESOLVED 2026-05-29

The DB password and HTTP Basic Auth password were previously committed to
`README.md` / `DOCS.md` and remain in git history. **Both have now been ROTATED
on the server** (new values in the local vault `.secrets/credentials.md`), so the
strings still present in history are dead and no longer grant access. The Windy
API keys were never in git (server-compose only). Server IP is not a secret.

Status:
- ✅ PostgreSQL password — rotated 2026-05-29 (`ALTER USER` + compose updated).
- ✅ HTTP Basic Auth — rotated 2026-05-29 (`.htpasswd` + nginx reload).
- ◻️ Git-history purge — now OPTIONAL (cosmetic: removes the dead strings). Steps below.

### 1. Rotate (do this first — owner action on the server)

```bash
# Postgres password
ssh <server>
docker compose exec db psql -U <user> -c "ALTER USER <user> WITH PASSWORD '<new-strong-pw>';"
# update DATABASE_URL / POSTGRES_PASSWORD in the server's secret store, then:
docker compose up -d

# nginx Basic Auth
htpasswd -c /etc/nginx/.htpasswd <new-user>
systemctl reload nginx
```

### 2. Purge from git history (rewrites history — coordinate with all clones)

```bash
# Preferred: git-filter-repo
pip install git-filter-repo

# Build a replacements file from the values in your LOCAL vault
# (.secrets/credentials.md). Do NOT commit this file — it contains the secrets.
#   replacements.txt:
#     <OLD_DB_PASSWORD>==>REDACTED
#     <OLD_BASIC_AUTH_PASSWORD>==>REDACTED
#     <OLD_SERVER_IP>==>REDACTED
git filter-repo --replace-text replacements.txt
rm -f replacements.txt
git push --force-with-lease --all
git push --force-with-lease --tags
```

After a force-push, every existing clone must re-clone or hard-reset.

### 3. Prevent recurrence

- `gitleaks detect` in CI (fails the pipeline on any finding).
- Pre-commit hook (husky / lefthook) running `gitleaks protect --staged`.
- Move HTTP Basic Auth → real auth (passkeys / WebAuthn) as a follow-up.

## Reporting

Security issues: contact the maintainer privately; do not open a public issue.
