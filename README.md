# Paystream Wallet App

A small but complete, four-tier cross-border wallet application used throughout
the C26-02 DevOps programme. It gives students something real to see, click and
deploy — the same app that becomes the subject of CI/CD (Week 8), Docker
(Week 10+), Kubernetes (Week 12+) and the capstone.

The **data tier (PostgreSQL + Redis) runs as Docker containers**. The
**app tier (backend API + frontend) runs natively** (systemd + Nginx); the app
itself is containerised later, in the Docker week.

```
  Browser
     │  http
     ▼
  ┌──────────────┐        ┌──────────────┐     SQL     ╔═════════════════╗
  │    Nginx     │  /     │  Node API    │ ──────────▶ ║ PostgreSQL 16   ║ container
  │ (frontend +  │ ─────▶ │ (Express)    │             ║ (record of truth)║  (volume)
  │  reverse     │ /api/  │   native     │ ──────────▶ ║ Redis 7         ║ container
  │   proxy)     │ ─────▶ │              │   cache     ║ (60s cache)     ║  (ephemeral)
  └──────────────┘        └──────────────┘             ╚═════════════════╝
       native                  native                    Docker containers
```

| Tier     | Tech                           | Runs as                      | What it teaches                   |
| -------- | ------------------------------ | ---------------------------- | --------------------------------- |
| Frontend | HTML + CSS + vanilla JS, Nginx | native                       | static hosting, reverse proxy     |
| Backend  | Node.js 20 + Express           | native (systemd)             | a stateless API, health/readiness |
| Database | PostgreSQL 16                  | **container** (named volume) | money as BIGINT, persistence      |
| Cache    | Redis 7                        | **container** (ephemeral)    | fast reads, TTLs, invalidation    |

## The caching lesson you can SEE

`GET /api/wallet/:id` returns a `source` field:

- the **first** read of a wallet comes from PostgreSQL → `"source": "database"`
- reads within the next **60 seconds** come from Redis → `"source": "cache"`
- a transfer **invalidates** the cache, so the next read is fresh from the DB again

The balance card shows this as a badge that flips between **SERVED FROM
DATABASE** (blue) and **SERVED FROM CACHE** (green). Click "Refresh balance"
twice and watch it change.

## Repository layout

```
paystream-app/
├── frontend/           index.html, styles.css, app.js, config.js   (served by Nginx)
├── backend/            server.js, lib/money.js, tests/, package.json (the Node API)
├── db/                 schema.sql, seed.sql                         (PostgreSQL)
├── deploy/
│   ├── bootstrap-ec2.sh          one-time EC2 provisioning
│   ├── data-stores-up.sh         starts the postgres + redis containers
│   ├── paystream-api.service     systemd unit for the API
│   ├── nginx-paystream.conf      serves the frontend, proxies /api
│   ├── deploy-backend-remote.sh  runs on EC2 to install a backend release
│   └── deploy-frontend-remote.sh runs on EC2 to install the frontend
└── .github/workflows/
    ├── ci.yml              lint + test on every pull request (the gate)
    ├── deploy-backend.yml  zip → scp → ssh → restart (on push to main)
    └── deploy-frontend.yml zip → scp → ssh → reload Nginx
```

## Run it locally

You need Node 20 and Docker installed and running.

```bash
# 1. data stores (as containers)
DB_PASSWORD=paystream bash deploy/data-stores-up.sh
# wait a few seconds, then load the schema + seed into the postgres container:
docker exec -i paystream-postgres psql -U paystream -d paystream < db/schema.sql
docker exec -i paystream-postgres psql -U paystream -d paystream < db/seed.sql

# 2. backend (native)
cd backend
cp .env.example .env            # DATABASE_URL uses paystream:paystream@localhost:5432
npm install
npm test                        # the money logic unit tests
npm start                       # API on http://localhost:3000

# 3. frontend (in another terminal) -- any static server works
cd ../frontend
echo "window.PAYSTREAM_API='http://localhost:3000';" > config.local.js   # optional
node dev-server.js
#python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy to EC2 (the app tier is NOT in Docker yet — that's Week 10)

### What you need

- An Ubuntu EC2 instance (t3.micro is fine).
- Its security group open on **port 22** (SSH) and **port 80** (HTTP).
- The instance's SSH **key pair** (private key goes in a GitHub secret).

### One-time: bootstrap the box

SSH in, clone this repo, and run the bootstrap. It installs **Node, Docker and
Nginx**, starts the **PostgreSQL and Redis containers**, loads the database,
and installs the systemd service and the Nginx config.

```bash
sudo apt-get update && sudo apt-get install -y git
git clone <your-repo-url> paystream && cd paystream
bash deploy/bootstrap-ec2.sh           # or: DB_PASSWORD='something' bash deploy/bootstrap-ec2.sh
```

The containers publish to `127.0.0.1` only (5432 and 6379), so only the backend
on the same host can reach them. PostgreSQL keeps its data in a named Docker
volume (`paystream-pgdata`) so it survives restarts; Redis has no volume,
because a cache is disposable by design.

### One-time: add GitHub repository secrets

**Settings → Secrets and variables → Actions → New secret**

| Secret        | Value                                             |
| ------------- | ------------------------------------------------- |
| `EC2_HOST`    | the instance's public IP or DNS                   |
| `EC2_USER`    | `ubuntu`                                          |
| `EC2_SSH_KEY` | the **private** key that matches the EC2 key pair |

### Then: every push to `main` deploys the app tier

The two deploy workflows do this, separately for frontend and backend:

1. **build** the app and **zip it into an artifact** (the backend artifact
   includes its production `node_modules`, so nothing is installed on the box);
2. **scp** the zip to the instance;
3. **ssh** in, drop it into a new timestamped release folder, flip the
   `current` symlink, and **restart** (API via `systemctl restart`, frontend
   via an Nginx reload);
4. the backend deploy runs a **health check** and **rolls back** to the
   previous release if the new one doesn't answer `/health`.

The database and cache containers are set up once by the bootstrap and are not
touched by app deploys. CI (`ci.yml`) runs the tests on every pull request —
make it a required check so nothing broken can merge, and therefore nothing
broken can deploy.

Visit `http://<instance-public-ip>/` and you've got the live app.

## API reference

| Method | Path                 | Purpose                                        |
| ------ | -------------------- | ---------------------------------------------- |
| GET    | `/health`            | liveness: `{status:"ok"}`                      |
| GET    | `/ready`             | readiness: checks DB + cache (503 if DB down)  |
| GET    | `/wallets`           | list wallets (for the picker)                  |
| GET    | `/wallet/:id`        | one wallet's balance, with `source` (db/cache) |
| GET    | `/transfers?wallet=` | recent transfers (optionally for one wallet)   |
| POST   | `/transfers`         | send money `{from,to,amount_minor}`            |
| GET    | `/rates`             | FX rates (cached), with `source`               |
| GET    | `/metrics`           | counts and totals                              |

## Notes for later weeks

- **Money is in minor units** (kobo, pesewa, cents) as integers, never floats.
- The database password is a plain value here; it becomes a real **secret** in
  Week 18 (DevSecOps / Secrets Manager).
- The data tier is already in containers. In **Week 10** the **app tier**
  (backend, then frontend) gets its own Dockerfiles, and in **Week 11** the
  whole thing moves into one Compose stack.
