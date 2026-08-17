# Multi-stage Docker builds (this LMS API)

This file explains **why** the project Dockerfile has two `FROM` lines, and how you would write an **optimized** image for this Express + TypeScript app.

If you have not built an image yet, start with [dockerfile-demo.md](./dockerfile-demo.md).

---

## 1. What is a multi-stage build?

A Dockerfile can contain **more than one** `FROM` instruction. Each `FROM` starts a new **stage** (a temporary image).

- Early stages: tools you need to **build** (compiler, TypeScript, `g++`)
- Last stage: only what you need to **run** (Node + `dist/` + production `node_modules`)

You copy selected files from an earlier stage with:

```dockerfile
COPY --from=builder /app/dist ./dist
```

Everything you do **not** copy is thrown away. It never appears in the final image.

```
Stage "builder"                          Stage "production" (final image)
─────────────────                        ────────────────────────────────
node:20-alpine                           node:20-alpine  (fresh, empty)
+ python3, make, g++                     (no g++)
+ full node_modules (incl. typescript)   + production node_modules only
+ src/  tsconfig.json                    + dist/  (compiled JS)
+ npm run build                          + package.json
                                         + USER node
                                         + HEALTHCHECK
                                         + CMD node dist/index.js
```

Students only **run** the last stage. Builder layers are used during `docker build`, then discarded.

---

## 2. Why a single-stage image is a poor fit here

A one-stage file that “just works”:

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

What stays in that image forever:

| Leftover | Why it is bad for this API |
|----------|----------------------------|
| `python3`, `make`, `g++` | Only needed to compile `bcrypt`. Extra size + extra attack surface |
| `typescript`, `tsx`, `eslint`, `@types/*` | DevDependencies. Production runs `node dist/index.js` |
| `src/` TypeScript | Users of the image can read your source. Runtime does not need it |
| Root user (default) | Process has more privilege than it needs |

`bcrypt` is the special case in **this** repo. It is a native addon. On Alpine it must be compiled with `g++`. We still want `g++` **during build**, never in production.

Multi-stage = “borrow a workshop, ship only the finished product.”

---

## 3. How a multi-stage Dockerfile is written (generic pattern)

```dockerfile
# ---- stage 1: build ----
FROM <sdk-or-full-image> AS builder
WORKDIR /app
# install build tools if native addons need them
# copy lockfiles, install ALL deps (including compilers like tsc)
# copy source, compile

# ---- stage 2: run ----
FROM <small-runtime-image> AS production
WORKDIR /app
COPY --from=builder /app/<output> ./
# ENV, USER, EXPOSE, HEALTHCHECK, CMD
```

Rules:

1. **Name stages** with `AS builder` / `AS production` so `COPY --from=` is readable.
2. Use the **same OS family** in both stages when you copy native modules. This app copies `node_modules` that include Alpine-built `bcrypt`. Both stages use `node:20-alpine`. Do not compile on Debian and copy into Alpine.
3. Copy **only** runtime artefacts.
4. Run as a **non-root** user in the final stage.
5. Keep secrets out of every stage. Never `COPY .env`.

---

## 4. What “optimized” means for *this* application

Facts about **lms-api** that drive the Dockerfile:

| Fact | Dockerfile consequence |
|------|------------------------|
| TypeScript app (`npm run build` → `tsc`) | Need `typescript` in builder only |
| Entry is `node dist/index.js` | Final image needs `dist/`, not `src/` |
| `bcrypt` native binding | Builder: `apk add python3 make g++` |
| PostgreSQL via `pg` + Drizzle | Runtime needs `pg` package, **not** a Postgres server inside this image |
| `GET /health` exists | `HEALTHCHECK` can call it |
| Frontend on port 3000 | Not part of this image; set `CORS_ORIGIN` at `docker run` |
| Students on Windows | Never copy host `node_modules` (see `.dockerignore`) |

An optimized image for this API is **not** a “distroless from scratch” experiment. Students need a working Alpine + Node image they can `docker exec` into if something fails. The current two-stage file is the right level.

---

## 5. Optimized Dockerfile for this API (explained)

This matches the repo `Dockerfile`, with comments you can study. Keep the real `Dockerfile` uncommented and short; use this page as the annotated version.

```dockerfile
# =============================================================================
# STAGE 1 — builder
# Goal: install packages, compile bcrypt for Linux, compile TypeScript to dist/
# =============================================================================
FROM node:20-alpine AS builder

# bcrypt (package.json) needs a compiler on Alpine.
# These packages stay in THIS stage only.
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy manifests first so Docker can cache "npm ci" when you only edit src/.
COPY package.json package-lock.json ./

# Install production + dev dependencies (we need "typescript" for tsc).
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

# "build": "tsc"  →  /app/dist/index.js and the rest of the compiled tree
RUN npm run build

# Drop typescript, tsx, eslint, drizzle-kit, @types/* .
# Keep express, pg, drizzle-orm, bcrypt, jsonwebtoken, cors, dotenv, zod, multer.
RUN npm prune --omit=dev


# =============================================================================
# STAGE 2 — production
# Goal: smallest image that can still run: node dist/index.js
# =============================================================================
FROM node:20-alpine AS production

WORKDIR /app

# Pull runtime files from the builder. chown so USER node can read them.
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

# NODE_ENV changes library behaviour (less verbose errors, etc.).
ENV NODE_ENV=production
# src/config/index.ts reads PORT (default 5000).
ENV PORT=5000

# Documentation only. Publish with: docker run -p 5000:5000
EXPOSE 5000

USER node

# Hits the Express route in src/index.ts: app.get("/health", ...)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/health || exit 1

# Same as npm run start — exec form so Node receives SIGTERM on docker stop.
CMD ["node", "dist/index.js"]
```

### Why each copy is required (and what we skip)

**Copied into production**

| Path | Needed because |
|------|----------------|
| `dist/` | The running server |
| `node_modules/` | `require("express")` etc., including compiled `bcrypt` |
| `package.json` | Harmless metadata; some tools expect it |

**Not copied**

| Path | Why skip |
|------|----------|
| `src/` | Already compiled |
| `tsconfig.json` | Only `tsc` needed it |
| `python3` / `g++` | New `FROM` does not include them |
| `.env` | Runtime: `-e` or `--env-file` |
| `drizzle.config.ts` | Used on a developer machine for `db:push`, not by `node dist/index.js` |

---

## 6. Build-cache tricks used here

Docker reuses layers when the instruction **and** its inputs did not change.

| Order in builder | Cache behaviour |
|------------------|-----------------|
| `COPY package.json package-lock.json` then `npm ci` | Cached until you add/remove an npm package |
| `COPY src` then `npm run build` | Re-runs when any source file changes |
| `npm prune` | Re-runs when the previous layer re-ran |

If you wrote this instead:

```dockerfile
COPY . .
RUN npm ci && npm run build
```

every README typo would redo a full `npm ci`. That is slow in class.

`.dockerignore` supports this: `node_modules` and `dist` never dirty the context. See [dockerignore-guide.md](./dockerignore-guide.md).

---

## 7. Optional extra optimizations (not required for class)

These are extra ideas. The repo Dockerfile is already good enough.

### A. `npm ci --omit=dev` is **not** enough by itself

You might think:

```dockerfile
RUN npm ci --omit=dev
RUN npm run build
```

That fails: `tsc` lives in `devDependencies`. You must install devDependencies **to compile**, then prune (as we do), or use two `node_modules` trees.

### B. Install wget only if healthcheck fails

Some Node Alpine tags include BusyBox `wget`, some do not. If healthcheck errors with `wget: not found`, add **in the production stage** (before `USER node`):

```dockerfile
RUN apk add --no-cache wget
```

Do not add this in the builder only — production is a new `FROM`.

### C. Pin the digest for production labs

```dockerfile
FROM node:20-alpine@sha256:<digest> AS builder
```

Reproducible, but harder for beginners. Tag `node:20-alpine` is the student-friendly choice.

### D. Do not bake `DATABASE_URL` into `ENV`

If you write:

```dockerfile
ENV DATABASE_URL=postgresql://postgres:postgres@lms-db:5432/lms_db
```

every student image shares the same URL, and the value is visible in `docker history`. Pass it at run time.

### E. Multi-stage vs docker-compose

Multi-stage = **one image**, smaller.

`docker-compose` = **several containers** (api + postgres + frontend). That is a different topic. You can compose images that were each built with multi-stage Dockerfiles.

---

## 8. Compare image ideas (mental picture)

Numbers change by machine; the **shape** stays true.

| Design | Rough contents | Good for students? |
|--------|----------------|--------------------|
| Single stage, `COPY . .`, `npm install` | Source + full deps + g++ | Easy to write, heavy, fragile on Windows |
| Single stage + `npm prune` | Still has g++ and often `src/` | Better, still not clean |
| **Two stages (this repo)** | Alpine + Node + dist + prod modules | Yes — this is the target |
| Distroless / scratch | Tiny, hard to debug (`docker exec` may fail) | Later, not for this course |

Check size after you build:

```bash
docker images lms-api
```

Rebuild without cache if you are comparing variants:

```bash
docker build --no-cache -t lms-api:single -f Dockerfile.single .
docker build --no-cache -t lms-api:multi .
docker images
```

---

## 9. How to rebuild after you change the Dockerfile

```bash
docker build -t lms-api .
```

If layers look “stuck”:

```bash
docker build --no-cache -t lms-api .
```

Run with Postgres on the same network (full commands in [dockerfile-demo.md](./dockerfile-demo.md)):

```bash
docker run -d --name lms-api --network lms-net -p 5000:5000 -e PORT=5000 -e DATABASE_URL=postgresql://postgres:postgres@lms-db:5432/lms_db -e JWT_SECRET=change-me-in-class -e JWT_EXPIRES_IN=7d -e CORS_ORIGIN=http://localhost:3000 lms-api
```

The **frontend on port 3000** is a different image. Multi-stage does not put the React app inside this API image. Connect them with a Docker network and `CORS_ORIGIN=http://localhost:3000`.

---

## 10. Short recap

1. Multi-stage = several `FROM` blocks; only the last one is the image you run.
2. This API **must** compile TypeScript and **must** compile `bcrypt` for Alpine — that belongs in `builder`.
3. Production needs `dist/`, pruned `node_modules`, non-root user, and `/health`.
4. Optimization here is “leave the workshop behind,” not “micro-optimize every byte.”
5. Config (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`) stays at `docker run`, never in the recipe.
