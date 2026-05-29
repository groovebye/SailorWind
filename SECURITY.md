# Security

## Secrets policy

- **No secrets in the repo or in docs.** All credentials live in an untracked `.env`
  (local) and a secrets manager (server). `.env*` is gitignored.
- Docs reference secrets as placeholders only: `${POSTGRES_PASSWORD}`, `<SERVER_IP>`.
- Secret scanning runs via [`.gitleaks.toml`](.gitleaks.toml) — locally and in CI.

## ⚠️ Exposed-credential incident (action required on the server)

The following were previously committed to `README.md` / `DOCS.md` and therefore exist
in git history. **Redacting the files does not remove them from history** — anyone with
repo access (or a clone) can still read old commits. They must be treated as compromised
and rotated.

Compromised values:
- PostgreSQL password (`POSTGRES_PASSWORD` / `DATABASE_URL`)
- HTTP Basic Auth credentials (nginx)
- Server IP

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
