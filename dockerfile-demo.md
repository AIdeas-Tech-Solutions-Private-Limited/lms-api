# Dockerfile demo — from empty file to a running LMS API

This lesson is for students who have not used Docker much.

By the end you will:

1. Know what a **Dockerfile** is
2. Know what a **build context** is
3. Know how to write a Dockerfile for *any* custom app
4. Understand **every line** of this project's Dockerfile
5. **Build** an image and **run** a container
6. Connect this API to a **frontend container on port 3000**

Related files:

- [dockerignore-guide.md](./dockerignore-guide.md) — files Docker should not copy
- [multi-stage-build.md](./multi-stage-build.md) — why this file has two stages

---

## 1. What is a Dockerfile?

A **Dockerfile** is a plain text recipe. Docker reads it from top to bottom and produces an **image**.

| Word | Simple meaning |
|------|----------------|
| **Dockerfile** | Recipe (list of steps) |
| **Image** | Frozen snapshot of the app + Node.js + files |
| **Container** | A running copy of that image (like pressing Play) |

Analogy:

- Dockerfile = recipe for a cake
- Image = the baked cake sitting on the counter
- Container = a slice you actually eat (you can cut many slices from one cake)

This repo's recipe is the file named `Dockerfile` in the project root. It tells Docker:

1. Start from Node.js 20 on Alpine Linux
2. Install packages (`bcrypt` needs extra Linux tools)
3. Copy our TypeScript source
4. Compile it to JavaScript (`dist/`)
5. Keep only what is needed to run
6. Start with `node dist/index.js`

You do **not** run the Dockerfile itself. You run:

```bash
docker build
```

Docker executes the recipe and stores the result as an image.

### Dockerfile rules you should remember

- Filename is usually `Dockerfile` with no extension.
- Instructions are uppercase by convention: `FROM`, `COPY`, `RUN`, `CMD`.
- Each `RUN` / `COPY` often becomes a **layer**. Order matters for cache (dependencies first, source later).
- The last `CMD` (or `ENTRYPOINT`) is what starts when the container runs.
- Do not put secrets in the Dockerfile. Pass them when you **run** the container.

---

## 2. What is the build context?

Look at this command:

```bash
docker build -t lms-api .
```

| Part | Meaning |
|------|---------|
| `docker build` | Create an image from a Dockerfile |
| `-t lms-api` | Name (tag) the image `lms-api` |
| `.` | The **build context** — this folder |

The **build context** is the folder Docker is allowed to read files from.

When you pass `.`, Docker:

1. Reads `.dockerignore` in that folder
2. Sends the remaining files to the Docker engine
3. Runs the Dockerfile
4. `COPY` can only copy files that were in that context

```
Your laptop: c:\Users\...\lms-api\     ← this folder is the context (the ".")
        |
        |  docker build -t lms-api .
        v
Docker engine receives a bundle of files (minus .dockerignore)
        |
        |  COPY package.json ...
        |  COPY src ./src
        v
Layers of the image
```

### Why context matters for *this* app

If context includes Windows `node_modules`:

- The folder is huge
- `bcrypt` was compiled for Windows, not Linux
- The container can crash with a cryptic `.node` error

That is why `.dockerignore` lists `node_modules` and `dist`. Docker must install and compile **inside** Linux.

### Context is not the same as “current directory of COPY”

Inside the Dockerfile, paths in `COPY` are relative to the **context**, not to your home folder.

```dockerfile
COPY src ./src
```

means: from the context, take `src/` and put it in `/app/src` (because we set `WORKDIR /app`).

You cannot write:

```dockerfile
COPY C:\Users\Aseem\secrets.txt ./
```

Docker never sees paths outside the context.

---

## 3. How to write a Dockerfile for a custom application

Every custom app is different, but the **questions** are the same.

### Step A — Identify the runtime

| If the app is… | Typical base image |
|----------------|--------------------|
| Node / Express / Next | `node:20-alpine` |
| Python / Django / Flask | `python:3.12-slim` |
| Java | `eclipse-temurin:21-jre` |
| Go | `golang:1.22` then a tiny final image |

This API is Node 20 + TypeScript → `node:20-alpine`.

Alpine is a small Linux. Smaller image = faster pull for students.

### Step B — List what the process needs at runtime

For **lms-api**:

| Need | Where it comes from |
|------|---------------------|
| Node.js | Base image |
| Production npm packages | `npm ci` then remove dev packages |
| Compiled JS | `npm run build` → `dist/` |
| Environment variables | Passed with `docker run -e` (not copied from `.env` into the image) |
| PostgreSQL | **Another** container or a hosted database — not inside this image |

The API image should **not** include Postgres. One container, one job.

### Step C — Decide the default skeleton

Almost every Node Dockerfile follows this order:

```text
1. FROM          pick a base image
2. WORKDIR       folder inside the container
3. COPY          package.json + lock file   ← small, changes rarely
4. RUN npm ci    install dependencies       ← cached if lockfile unchanged
5. COPY          source code                ← changes every time you edit
6. RUN build     compile TypeScript
7. EXPOSE        document the port
8. CMD           start the process
```

Copy **package files first**, then install, then copy source. If you only change `src/index.ts`, Docker reuses the `npm ci` layer.

### Step D — Add extras that *your* app needs

This API is not a generic “hello world”. Extra facts:

1. **TypeScript** — production runs `node dist/index.js`, not `tsx src/index.ts`.
2. **bcrypt** — native C++ addon. Alpine needs `python3`, `make`, and `g++` **during install**.
3. **No `.env` in the image** — `DATABASE_URL` and `JWT_SECRET` are runtime config.
4. **Health endpoint** already exists: `GET /health` in `src/index.ts`. Docker can ping it.
5. **Do not run as root** — the Node image has a `node` user.
6. **Two stages** — compile in a builder, copy only `dist` + production `node_modules` into a small final image. Details: [multi-stage-build.md](./multi-stage-build.md).

### A simple single-stage Dockerfile (learning only)

Write this in your notebook first. It works, but it is **not** the smallest or safest. The real file in this repo is better.

```dockerfile
FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

EXPOSE 5000
CMD ["node", "dist/index.js"]
```

Problems you will fix with multi-stage later:

- Compiler tools (`g++`) stay in the image
- TypeScript and `tsx` stay in `node_modules` unless you prune
- Source code `src/` may still be in the image
- Process may run as root

The rest of this file explains the **real** Dockerfile in the repo.

---

## 4. This application's Dockerfile — every line

Open `Dockerfile`. It has **two stages**:

- Stage 1 name: `builder` — install, compile, drop dev packages
- Stage 2 name: `production` — only runtime files

### Stage 1 — builder

```dockerfile
# Stage 1
FROM node:20-alpine AS builder
```

**Why:** Start from the official Node 20 image based on Alpine Linux.  
`AS builder` names this stage so stage 2 can copy files from it.  
Pinning `20` (not `latest`) keeps class machines on the same Node version.

```dockerfile
RUN apk add --no-cache python3 make g++
```

**Why:** `apk` is Alpine's package manager.  
`bcrypt` in `package.json` includes native code. `npm ci` must compile it with a C++ toolchain.  
`--no-cache` avoids storing Alpine package indexes in a layer (smaller).  
These tools are **not** copied to the final image.

```dockerfile
WORKDIR /app
```

**Why:** All following commands run in `/app`.  
`COPY` destinations like `./src` mean `/app/src`. You do not litter files in `/`.

```dockerfile
COPY package.json package-lock.json ./
```

**Why:** Copy **only** the dependency manifests first.  
`package-lock.json` is required for `npm ci` (exact versions).  
If source files change but these two files do not, Docker reuses the next layer.

```dockerfile
RUN npm ci
```

**Why:** Clean install from the lockfile. Prefer this over `npm install` in Docker (more reproducible).  
At this point both production and dev dependencies are installed. We still need `typescript` to compile.

```dockerfile
COPY tsconfig.json ./
```

**Why:** `tsc` reads `tsconfig.json`. It says:

- compile `src/` 
- output to `dist/`
- module format `commonjs` (so `node dist/index.js` works)

Without this file, `npm run build` would not match local builds.

```dockerfile
COPY src ./src
```

**Why:** The API source: routes, controllers, Drizzle schema, Express entry (`src/index.ts`).  
We do **not** copy `.env`, tests, or markdown. `.dockerignore` blocks leftovers.

```dockerfile
RUN npm run build
```

**Why:** Runs `"build": "tsc"` from `package.json`.  
TypeScript becomes JavaScript in `/app/dist`. Production Node cannot run `.ts` files without `tsx`. We do not ship `tsx` in production.

```dockerfile
RUN npm prune --omit=dev
```

**Why:** After compile we no longer need `typescript`, `tsx`, `eslint`, `@types/*`, `drizzle-kit`.  
`prune --omit=dev` deletes devDependencies from `/app/node_modules`.  
What remains is what Express needs at runtime: `express`, `pg`, `drizzle-orm`, `bcrypt`, `jsonwebtoken`, `cors`, `dotenv`, `zod`, `multer`.

---

### Stage 2 — production

```dockerfile
# Stage 2
FROM node:20-alpine AS production
```

**Why:** Start a **new** empty Node 20 Alpine image.  
Nothing from stage 1 is kept unless we `COPY --from=builder`.  
Compiler, `src/`, and Alpine `g++` stay behind. That is the main win of multi-stage.

```dockerfile
WORKDIR /app
```

**Why:** Same idea as stage 1. Runtime files live in `/app`.

```dockerfile
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
```

**Why, line by line:**

| Copy | Purpose |
|------|---------|
| `package.json` | Some libraries read version / name at runtime; also documents what is installed |
| `node_modules` | Production dependencies, including Linux-built `bcrypt` |
| `dist` | Compiled JavaScript (the actual server) |

`--from=builder` means “take files from stage 1, not from the build context.”  
`--chown=node:node` makes the files owned by the non-root `node` user that already exists in the official image.

We do **not** copy `src/` or `tsconfig.json` into production.

```dockerfile
ENV NODE_ENV=production
ENV PORT=5000
```

**Why:**

- `NODE_ENV=production` — Express and many libraries skip extra debug work.
- `PORT=5000` — `src/config/index.ts` reads `process.env.PORT` (default 5000). The process listens on this port **inside** the container.

You can still override at run time: `docker run -e PORT=5000 ...`.

```dockerfile
EXPOSE 5000
```

**Why:** Documents “this container expects traffic on 5000.”  
`EXPOSE` does **not** publish the port to your laptop. Publishing is `-p 5000:5000` on `docker run`.

```dockerfile
USER node
```

**Why:** Do not run the API as root. If the process is exploited, the attacker is not root inside the container.  
The `node` user must own `/app` files — that is why we used `--chown=node:node`.

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/health || exit 1
```

**Why:** Docker periodically calls our existing route `GET /health` in `src/index.ts`.  
If the process hangs, `docker ps` shows `unhealthy`.

| Flag | Meaning |
|------|---------|
| `--interval=30s` | Check every 30 seconds |
| `--timeout=5s` | Fail if no response in 5 seconds |
| `--start-period=15s` | Ignore failures while Node is starting |
| `--retries=3` | Mark unhealthy after 3 failures |

`wget` talks to `127.0.0.1` because the check runs **inside** the same container.  
If `wget` is missing on your image, install it in the production stage with `RUN apk add --no-cache wget` (or use `CMD` with `node` to hit `/health`).

```dockerfile
CMD ["node", "dist/index.js"]
```

**Why:** This is the production start command (same as `npm run start`).  
Exec form `["node", "dist/index.js"]` (JSON array) is preferred: Node becomes PID 1 and receives stop signals correctly.

There is no `npm run dev` here. `tsx watch` is for laptops, not production containers.

---

### What this Dockerfile deliberately leaves out

| Missing on purpose | How you supply it |
|--------------------|-------------------|
| `.env` | `docker run -e` or `--env-file` |
| PostgreSQL | Separate container or cloud DB |
| `drizzle/` migrations | Run `npm run db:push` from a laptop / CI against that database |
| Frontend | Separate image on port 3000 |

---

## 5. Step-by-step: write, build, run

Do this from the **lms-api** folder (the folder that contains `Dockerfile` and `package.json`).

### Step 1 — Confirm Docker works

```bash
docker version
```

Start Docker Desktop if this fails.

### Step 2 — Confirm ignore file exists

You should have `.dockerignore` next to `Dockerfile`.  
If not, read [dockerignore-guide.md](./dockerignore-guide.md) and add it first.

### Step 3 — The Dockerfile is already in the repo

You do not need to recreate it unless you are practising. To practise:

1. Rename the current file to `Dockerfile.backup`
2. Write a single-stage file (section 3)
3. Build and run
4. Restore the real multi-stage file

### Step 4 — Build the image

```bash
docker build -t lms-api .
```

| Flag | Meaning |
|------|---------|
| `-t lms-api` | Name the image |
| `.` | Context = current folder |

First build is slow (`npm ci` + compile `bcrypt`). Later builds are faster if `package-lock.json` did not change.

Check:

```bash
docker images
```

You should see `lms-api`.

Optional tag with version:

```bash
docker build -t lms-api:1.0 .
```

### Step 5 — Prepare environment values

The container **must** get the same kinds of variables as local `.env`:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `PORT`
- `CORS_ORIGIN`

**Important:** inside a container, `localhost` is the container itself, not your Windows host.

- Postgres on your laptop → on Docker Desktop use `host.docker.internal` instead of `localhost` in `DATABASE_URL`
- Postgres in Docker → use the **container name** as hostname (see step 6)

### Step 6 — Run PostgreSQL in Docker (recommended for class)

```bash
docker network create lms-net
```

```bash
docker run -d --name lms-db --network lms-net -p 5432:5432 -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=lms_db postgres:16
```

Wait a few seconds, then create tables **from your laptop** (Node + this repo):

```bash
# PowerShell example — point at published port 5432 on your machine
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lms_db"
npm run db:push
```

On Git Bash / macOS / Linux:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lms_db npm run db:push
```

You need `npm install` once on the laptop for `drizzle-kit`.

### Step 7 — Run the API container

```bash
docker run -d --name lms-api --network lms-net -p 5000:5000 -e NODE_ENV=production -e PORT=5000 -e DATABASE_URL=postgresql://postgres:postgres@lms-db:5432/lms_db -e JWT_SECRET=change-me-in-class -e JWT_EXPIRES_IN=7d -e CORS_ORIGIN=http://localhost:3000 lms-api
```

What each part does:

| Part | Meaning |
|------|---------|
| `-d` | Detached (runs in the background) |
| `--name lms-api` | Easy name for logs and stop/start |
| `--network lms-net` | Same network as Postgres and the frontend |
| `-p 5000:5000` | Laptop port 5000 → container port 5000 |
| `-e DATABASE_URL=...@lms-db:5432...` | Hostname `lms-db` is the Postgres **container name** |
| `-e CORS_ORIGIN=http://localhost:3000` | Browser origin of the frontend |
| `lms-api` | Image name from `docker build` |

Using `--env-file .env` is fine **only if** `DATABASE_URL` inside that file uses `lms-db` (or `host.docker.internal`), not `localhost`.

### Step 8 — Prove it works

```bash
docker ps
```

Status should be `Up`. After ~15 seconds health may become `healthy`.

```bash
docker logs lms-api
```

You want: `Server running on port 5000`

In a browser or terminal:

```bash
curl http://localhost:5000/health
```

PowerShell:

```powershell
Invoke-RestMethod http://localhost:5000/health
```

Expected JSON includes `"status": "ok"`.

### Step 9 — Stop and clean (when you are done)

```bash
docker stop lms-api lms-db
docker rm lms-api lms-db
```

Images stay until you remove them:

```bash
docker rmi lms-api
```

---

## 6. Connect this API to a frontend container on port 3000

The LMS frontend is a **separate** app (React / Next.js / similar). Students usually run it on **port 3000**. This API uses that origin in `src/config/index.ts`:

```ts
corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000"
```

CORS is checked by the **browser**, using the address in the user’s address bar.

### Mental model (read this twice)

```
Your browser
  visits http://localhost:3000     ← frontend UI
  then JS calls http://localhost:5000/api/...  ← this API

Docker
  frontend container   maps  3000:3000
  api container        maps  5000:5000
  postgres container   maps  5432:5432
  all three share network lms-net
```

Two different “localhost” ideas:

| Who is calling? | URL to use |
|-----------------|------------|
| **Browser** (user’s machine) | `http://localhost:3000` and `http://localhost:5000` |
| **Container to container** (Node talking to Postgres) | `http://lms-db:5432` style names — **not** localhost |

The React app in the browser is **not** inside Docker’s network. So the frontend’s public API URL should almost always be:

```text
http://localhost:5000
```

not `http://lms-api:5000` (that hostname only works between containers).

Exception: if the frontend **server** (SSR) fetches the API, *that* server-side code may use `http://lms-api:5000`. Browser code still uses `localhost`.

### Step-by-step: frontend + API + database

Assume you already built:

- this image: `lms-api`
- frontend image: `lms-frontend` (name may differ in the frontend repo)

**1. One network**

```bash
docker network create lms-net
```

Skip if it already exists.

**2. Database** (if not running)

```bash
docker run -d --name lms-db --network lms-net -p 5432:5432 -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=lms_db postgres:16
```

**3. API** — CORS must be the browser origin

```bash
docker run -d --name lms-api --network lms-net -p 5000:5000 -e PORT=5000 -e DATABASE_URL=postgresql://postgres:postgres@lms-db:5432/lms_db -e JWT_SECRET=change-me-in-class -e JWT_EXPIRES_IN=7d -e CORS_ORIGIN=http://localhost:3000 lms-api
```

**4. Frontend** — publish 3000 and point the browser API URL at the published API port

The exact `-e` name depends on the frontend (`NEXT_PUBLIC_API_URL`, `REACT_APP_API_URL`, `VITE_API_URL`, …). Pattern:

```bash
docker run -d --name lms-frontend --network lms-net -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://localhost:5000 lms-frontend
```

If the frontend image bakes the API URL at **build** time (common with Next.js `NEXT_PUBLIC_*` and Vite), you must rebuild the frontend image with that variable, not only pass `-e` at run time. Check the frontend README.

**5. Open the app**

Browser: [http://localhost:3000](http://localhost:3000)

Login / register should call [http://localhost:5000/api/auth/...](http://localhost:5000/api/auth/login).

### CORS checklist when the UI “cannot fetch”

1. Frontend runs on port **3000** in the browser.
2. API container has `CORS_ORIGIN=http://localhost:3000` (no extra slash, matching protocol `http`).
3. API published with `-p 5000:5000`.
4. Frontend API base URL is `http://localhost:5000` (browser), not `http://lms-api:5000`.
5. Both containers used `--network lms-net` if they need to talk to Postgres or SSR.

Wrong:

```text
CORS_ORIGIN=http://lms-frontend:3000
```

The browser origin is not `lms-frontend`. It is `http://localhost:3000`.

### Same Docker network — why we still use it

Even when the browser uses localhost ports, the network is required so that:

- `lms-api` can resolve hostname `lms-db`
- optional SSR on the frontend can resolve hostname `lms-api`

Commands to inspect:

```bash
docker network inspect lms-net
docker logs lms-frontend
docker logs lms-api
```

### Quick test from the frontend container (optional)

```bash
docker exec -it lms-frontend sh
```

Inside:

```bash
wget -qO- http://lms-api:5000/health
```

This proves **container DNS** works. It does **not** replace the browser URL.

---

## 7. Everyday commands

| Command | Use |
|---------|-----|
| `docker build -t lms-api .` | Build image |
| `docker images` | List images |
| `docker run ... lms-api` | Start container |
| `docker ps` | Running containers |
| `docker logs -f lms-api` | Follow API logs |
| `docker stop lms-api` | Stop |
| `docker rm lms-api` | Remove stopped container |
| `docker exec -it lms-api sh` | Shell inside the container |

---

## 8. If something breaks

| Symptom | Likely cause |
|---------|----------------|
| `npm ci` fails | `package-lock.json` missing or out of date — run `npm install` on laptop and commit the lockfile |
| `bcrypt` / `invalid ELF` | Windows `node_modules` was copied — fix `.dockerignore`, rebuild with `--no-cache` |
| `ECONNREFUSED` database | `DATABASE_URL` uses `localhost` inside the container — use `lms-db` or `host.docker.internal` |
| CORS error in browser | `CORS_ORIGIN` not exactly `http://localhost:3000` |
| Port already allocated | Something else uses 5000 or 3000 — stop it or change `-p` |
| Unhealthy container | API crashed (check `docker logs`) or `/health` not reachable |
| `db:push` cannot connect | Postgres container not ready yet — wait and retry |

Rebuild from scratch:

```bash
docker build --no-cache -t lms-api .
```

---

## What to read next

[multi-stage-build.md](./multi-stage-build.md) — why two `FROM` lines make a smaller, safer image, and how to write an optimized Dockerfile for this API.
