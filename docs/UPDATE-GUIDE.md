# LineOps KDS — Update Guide

This guide explains how to push a new version of LineOps KDS to a machine that already has the system installed and running.

---

## Quick Reference

| Install type | Update command |
|---|---|
| Docker (recommended) | `cd /opt/kds && git pull && docker compose pull && docker compose up -d` |
| Source / manual | `cd /opt/kds && git pull && pnpm install && pnpm run build && pnpm --filter @workspace/db run push` |
| Replit cloud | Redeploy from the Replit dashboard |

---

## 1. Docker-Based Installation (Recommended)

This is the most common setup. The server runs all services in containers.

### Step 1 — SSH into the server

```bash
ssh user@<server-ip>
```

### Step 2 — Pull the latest code

```bash
cd /opt/kds          # or wherever you installed it
git pull origin main
```

### Step 3 — Pull updated Docker images

```bash
docker compose pull
```

### Step 4 — Apply database migrations

Migrations run automatically on startup. If you want to run them manually first:

```bash
docker compose run --rm api node -e "
  const { drizzle } = require('drizzle-orm/node-postgres');
  // migrations auto-run at startup
"
```

In practice, just let the container handle it at startup (step 5).

### Step 5 — Restart services (zero-downtime)

```bash
docker compose up -d --remove-orphans
```

This replaces containers one by one. The KDS displays will briefly reconnect via WebSocket — typically under 5 seconds.

### Step 6 — Verify the update

```bash
./bin/kds status
```

Check the version number shown matches the new release.

---

## 2. Source / Manual Installation

Use this if you cloned the repo and run it directly with Node.js (no Docker).

### Step 1 — SSH into the server

```bash
ssh user@<server-ip>
cd /opt/kds
```

### Step 2 — Pull the latest code

```bash
git pull origin main
```

### Step 3 — Install any new dependencies

```bash
pnpm install --frozen-lockfile
```

### Step 4 — Build all packages

```bash
pnpm run build
```

This compiles the API server, shared libraries, and the KDS frontend.

### Step 5 — Apply database migrations

```bash
pnpm --filter @workspace/db run push
```

This is safe to run even if there are no schema changes.

### Step 6 — Restart the services

If using **systemd**:
```bash
sudo systemctl restart kds-api kds-web
```

If using **pm2**:
```bash
pm2 restart kds-api kds-web
pm2 save
```

If running manually in a terminal:
```bash
# Stop the running process (Ctrl+C), then:
pnpm --filter @workspace/api-server run start &
pnpm --filter @workspace/kds run preview &
```

### Step 7 — Verify

```bash
./bin/kds status
curl http://localhost/api/health
```

---

## 3. Using the `kds update` CLI Command

If you installed via `install.sh`, the CLI handles everything:

```bash
./bin/kds update
```

This runs `git pull`, rebuilds images, and restarts all services automatically.

On Windows with PowerShell:

```powershell
.\bin\kds.ps1 update
```

---

## 4. Pushing Config Updates to Running Displays

After a software update, your display configs are preserved in the database. If you want to push a fresh config to all displays:

```bash
# Push the active template to all connected displays
./bin/kds templates push

# Push a specific template to all displays
./bin/kds templates push <templateId>

# Push a template to one specific display
./bin/kds devices push <deviceId> <templateId>
```

Or use the **Station Configs** page in the backend (`/station-configs`) to push configs per station from the browser.

---

## 5. Rollback

If the update causes problems, roll back to the previous version:

### Docker

```bash
git log --oneline -10          # find the last working commit
git checkout <commit-hash>
docker compose up -d --build
```

### Source

```bash
git stash
git checkout <commit-hash>
pnpm install --frozen-lockfile
pnpm run build
# restart services
```

---

## 6. What Gets Preserved During an Update

| Data | Preserved? | Where |
|---|---|---|
| Orders (active + history) | ✅ Yes | PostgreSQL database |
| Config templates | ✅ Yes | PostgreSQL database |
| Station configs | ✅ Yes | PostgreSQL database |
| Device registrations | ✅ Yes | PostgreSQL database |
| Display zoom / bump bar / key bindings | ✅ Yes | Each display's localStorage |
| API keys | ✅ Yes | PostgreSQL database |
| Webhook destinations | ✅ Yes | PostgreSQL database |

Nothing stored in the database is lost during an update. Display-local settings (zoom, bump bar, key bindings) live in the browser's localStorage and are never touched by a server update.

---

## 7. Health Check After Update

```bash
# Check all services are running
./bin/kds status

# Tail API logs for errors
./bin/kds logs api

# Check connected displays
./bin/kds devices

# Verify database connectivity
curl http://localhost/api/health | jq .db
```

Expected output from health check:
```json
{ "status": "ok", "db": "connected", "version": "1.x.x" }
```
