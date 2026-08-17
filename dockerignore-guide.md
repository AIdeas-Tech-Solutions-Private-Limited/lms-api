# `.dockerignore` Guide (for students)

This file is like `.gitignore`, but for Docker.

- `.gitignore` tells **Git** which files not to save in the repository.
- `.dockerignore` tells **Docker** which files not to send when it builds an image.

If you remember only one thing from this page:

> Never let Docker copy `node_modules`, `dist`, or `.env` into the build.

---

## Why this file exists

When you run:

```bash
docker build -t lms-api .
```

that last `.` is the **build context**. Docker zips (almost) everything in the current folder and sends it to the Docker engine.

If you skip `.dockerignore`, Docker may send:

| Folder / file | Problem |
|---------------|---------|
| `node_modules/` | Huge. Also compiled for **your laptop**, not for Linux inside the container |
| `dist/` | Old compiled files. Docker should compile TypeScript itself |
| `.env` | Secrets (database password, JWT secret) can get baked into the image |
| `.git/` | History is large and not needed to run the API |
| `*.md` | Teaching notes are useful for humans, not for the running server |

A smaller context means:

1. Faster builds
2. Smaller images
3. Safer images (no accidental secrets)
4. Correct Linux dependencies (fresh `npm ci` inside the container)

---

## How Docker uses `.dockerignore`

1. You run `docker build`.
2. Docker reads `.dockerignore` in the **same folder** as the Dockerfile (or the context folder).
3. Matching files are **not** added to the build context.
4. `COPY` and `ADD` in the Dockerfile can only see files that were **not** ignored.

Example:

```dockerignore
node_modules
```

Then this line in the Dockerfile:

```dockerfile
COPY . .
```

will **not** copy your local `node_modules`. That is what we want. The image installs packages with `npm ci` instead.

---

## This project's `.dockerignore`, line by line

```dockerignore
# Dependencies — Docker will install these inside the image
node_modules
```

Your laptop may be Windows. The container is Linux. Native packages such as `bcrypt` must be compiled **inside** Linux Alpine, not copied from Windows.

```dockerignore
# Build output — Docker will compile TypeScript again during the image build
dist
```

`npm run build` creates `dist/`. If an old `dist` sneaks into the image, you can ship stale JavaScript.

```dockerignore
# Git history is not needed inside the image
.git
.gitignore
```

Students clone the repo on their machines. The running API does not need Git history.

```dockerignore
# Secrets must never be copied into an image
.env
.env.*
!.env.example
```

Pass secrets at **runtime** with `-e` flags or `--env-file`.  
`!.env.example` is a negation: “ignore `.env` files, but keep an example file if we add one later.” An example file has fake values only, never real passwords.

```dockerignore
# Logs and OS junk
*.log
npm-debug.log*
.DS_Store
Thumbs.db
```

These are leftover files from your computer. They do not belong in an image.

```dockerignore
# Editor / IDE folders
.vscode
.idea
*.swp
```

Cursor / VS Code settings are for you, not for the server.

```dockerignore
# Student docs — useful on GitHub, not needed to run the API
*.md
.dockerignore
```

README and these Docker notes stay in Git. They are not required to start Express.

```dockerignore
# Test and coverage files (if added later)
coverage
.nyc_output
```

Safe to ignore even if those folders do not exist yet.

```dockerignore
# Drizzle Studio / generated artefacts not required at runtime
drizzle
```

This API talks to PostgreSQL using Drizzle ORM. Schema lives in `src/db/schema`. Generated SQL in `drizzle/` is for migrations on a developer machine, not for the production Node process.

---

## Syntax cheat sheet

| Pattern | Meaning |
|---------|---------|
| `node_modules` | Ignore that folder anywhere in the context |
| `*.log` | Ignore all files ending with `.log` |
| `.env.*` | Ignore `.env.local`, `.env.production`, etc. |
| `!.env.example` | Do **not** ignore this one file (exception) |
| `# comment` | Comment, ignored by Docker |

Rules are similar to `.gitignore`, but not 100% identical. Keep patterns simple.

---

## What you still copy on purpose

These files are **not** ignored, because the Dockerfile needs them:

| File / folder | Why Docker needs it |
|---------------|---------------------|
| `package.json` | Lists app dependencies |
| `package-lock.json` | Locks exact versions (`npm ci`) |
| `tsconfig.json` | Tells TypeScript how to compile |
| `src/` | The actual API source code |

Look at the Dockerfile: it copies only those paths, not the whole repo. `.dockerignore` is still important as a safety net if someone later writes `COPY . .`.

---

## Quick experiment (optional)

1. Without `.dockerignore`, a build can upload hundreds of MB.
2. With `.dockerignore`, the upload is mostly `src/` + lockfile.

You can see context size in the build output:

```text
[+] Building ...
 => transferring context:  ...
```

A smaller number here is a good sign.

---

## Common mistakes

1. **Forgetting `.dockerignore`** — Windows `node_modules` gets copied; `bcrypt` then crashes inside Linux.
2. **Ignoring `package-lock.json`** — `npm ci` will fail. Never ignore the lockfile.
3. **Putting `.env` in the image** — anyone with the image can read your JWT secret.
4. **Ignoring `src`** — the build has nothing to compile.

---

## Next reading

1. [Dockerfile demo](./dockerfile-demo.md) — what a Dockerfile is, build context, and how to build/run this API
2. [Multi-stage builds](./multi-stage-build.md) — why this repo uses two stages
