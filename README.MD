# LMS API

This repository is the **backend** of a Learning Management System (LMS): an online school API.

Students and admins use a **frontend** (usually port `3000`) to log in, browse courses, and watch lessons. That UI never talks to PostgreSQL. It sends HTTP requests to **this API** (port `5000`). The API reads and writes users, courses, enrollments, and progress in PostgreSQL.

```
Browser
   |
   |  opens http://<server-ip>:3000
   v
Frontend (React / Next.js / similar)
   |
   |  HTTP  /api/...   (CORS must allow the frontend origin)
   v
This backend — Express + TypeScript — port 5000
   |
   |  SQL (Drizzle ORM + pg)
   v
PostgreSQL — database lms_db
```

On startup the API:

1. Waits until PostgreSQL accepts connections
2. Runs Drizzle migrations (creates tables if they are missing)
3. Creates a default **admin** user if that email does not exist
4. Starts listening on port `5000`

You do **not** create tables by hand. Do **not** insert the admin password as plaintext SQL. The app hashes passwords with bcrypt.

---

## What the application does

| Area | What it means |
|------|----------------|
| Register / login | Students create an account and receive a JWT |
| Roles | `student` (default on register) or `admin` |
| Categories & courses | Course catalogue |
| Sessions | Lessons inside a course (video / PDF links) |
| Enrollment | A student joins a course |
| Progress | Which lessons a student finished |
| Profile | Update name / password |
| Admin dashboard | Counts of students, courses, enrollments |
| Health check | `GET /health` — process is alive |

Public registration always creates `role: "student"`. Sending `"role": "admin"` in the register body is ignored.

**Lab default admin** (override these in production):

| Field | Default |
|-------|---------|
| Name | `Admin` |
| Email | `admin@gmail.com` |
| Password | `admin@123` |
| Role | `admin` |

---

## Tech stack

| Tool | Role in this project |
|------|----------------------|
| Node.js 20 | Runs the server |
| Express | HTTP routes under `/api` |
| TypeScript | Source in `src/`; production runs compiled `dist/` |
| PostgreSQL | Stores all application data |
| Drizzle ORM | Schema + migrations + queries |
| JWT | Login token (`Authorization: Bearer ...`) |
| bcrypt | Password hashing |
| CORS | Allows the frontend origin to call the API |
| PM2 | Keeps the API running on EC2 after SSH disconnects |

---

## Project structure

```
lms-api/
├── src/
│   ├── index.ts                 # Express app, CORS, /api, /health, startup
│   ├── config/                  # PORT, DATABASE_URL, JWT, CORS, admin seed
│   ├── routes/                  # URL map
│   ├── controllers/             # Handlers (login, courses, …)
│   ├── middleware/              # JWT auth, admin role, errors
│   └── db/
│       ├── schema/index.ts      # Table definitions
│       ├── index.ts             # PostgreSQL pool
│       ├── migrate.ts           # Apply drizzle/ SQL migrations
│       ├── seed.ts              # Idempotent default admin
│       └── initialize.ts        # wait → migrate → seed
├── drizzle/                     # Generated SQL migrations (required at runtime)
├── package.json
├── tsconfig.json
├── drizzle.config.ts
└── .env.example
```

**Request path**

1. Frontend calls `POST /api/auth/login`
2. `src/index.ts` mounts `/api` on the router
3. `auth.routes.ts` → `auth.controller.ts`
4. Controller checks bcrypt hash and returns a JWT with `userId`, `email`, `role`

---

## Environment variables

Copy `.env.example` to `.env`. Never commit `.env`.

| Variable | Meaning | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL URL | `postgresql://lms_user:YOUR_PASSWORD@localhost:5432/lms_db` |
| `JWT_SECRET` | Signs login tokens | long random string |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `PORT` | API port | `5000` |
| `CORS_ORIGIN` | Frontend origin the **browser** uses | `http://<ec2-public-ip>:3000` |
| `ADMIN_NAME` | Seeded admin name | `Admin` |
| `ADMIN_EMAIL` | Seeded admin email | `admin@gmail.com` |
| `ADMIN_PASSWORD` | Seeded admin password (hashed before save) | `admin@123` |
| `ADMIN_ROLE` | Seeded role | `admin` |
| `NODE_ENV` | Set `production` on the server | `production` |

`CORS_ORIGIN` must match the address bar of the frontend (scheme + host + port), with **no trailing slash**.

If the admin email already exists, the seed does **not** change the password or promote another role to admin.

---

## Local development (laptop)

```bash
git clone https://github.com/AIdeas-Tech-Solutions-Private-Limited/lms-api.git
cd lms-api
npm install
cp .env.example .env
# edit DATABASE_URL to match your local Postgres
npm run dev
```

Open [http://localhost:5000/health](http://localhost:5000/health). Tables and the default admin are created on first start.

Docker notes: [dockerignore-guide.md](./dockerignore-guide.md), [dockerfile-demo.md](./dockerfile-demo.md), [multi-stage-build.md](./multi-stage-build.md).

---

# Deploy on AWS EC2 with PM2 (end to end)

This is the full path used in class / lab:

1. Create an EC2 instance and open ports
2. SSH into the server
3. Install Node.js, Git, build tools, PM2
4. Install PostgreSQL (`psql`)
5. Create a database user, password, and database
6. Clone this repo
7. Create `.env` so the backend can reach Postgres
8. Install npm packages, build TypeScript, start with PM2
9. Verify health, tables, and admin login
10. Deploy / point the frontend at this API

Commands below assume **Ubuntu 22.04 or 24.04** on EC2. Replace placeholders:

| Placeholder | Meaning |
|-------------|---------|
| `<EC2_PUBLIC_IP>` | IPv4 from the EC2 console (e.g. `13.232.xx.xx`) |
| `<YOUR_KEY.pem>` | Your SSH key file |
| `<DB_PASSWORD>` | Password you choose for the database user |
| `<JWT_SECRET>` | Long random string for tokens |

---

## Part 1 — EC2 instance and security group

1. AWS Console → **EC2** → **Launch instance**.
2. Name: `lms-api` (any name).
3. AMI: **Ubuntu Server 22.04 LTS** or **24.04 LTS**.
4. Instance type: **t2.micro** or **t3.micro** is enough for a lab.
5. Key pair: create or select one. Download the `.pem` file and keep it private.
6. Storage: default 8–16 GB is fine.
7. **Security group inbound rules** (this is how the browser and SSH reach the server):

| Type | Port | Source | Why |
|------|------|--------|-----|
| SSH | 22 | My IP (or `0.0.0.0/0` only for a short lab) | Log in with SSH |
| Custom TCP | 5000 | `0.0.0.0/0` | Backend API |
| Custom TCP | 3000 | `0.0.0.0/0` | Frontend (same machine or another instance) |

8. Launch the instance. Wait until **Instance state** is **Running**.
9. Copy the **Public IPv4 address**.

On your laptop (PowerShell or Git Bash), set permissions on the key if needed, then SSH:

```bash
chmod 400 /path/to/YOUR_KEY.pem

ssh -i /path/to/YOUR_KEY.pem ubuntu@<EC2_PUBLIC_IP>
```

You should see an Ubuntu prompt. All following commands run **on the EC2 instance** unless noted.

---

## Part 2 — System packages, Node.js, Git, PM2

Update Ubuntu and install tools. `build-essential` and `python3` are required so **bcrypt** can compile on Linux.

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y git curl build-essential python3
```

Install **Node.js 20** (same major version as this project):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Check versions:

```bash
node -v
npm -v
git --version
```

`node -v` should start with `v20`.

Install **PM2** globally so the API stays up after you close SSH:

```bash
sudo npm install -g pm2
pm2 -v
```

---

## Part 3 — Install PostgreSQL and `psql`

`psql` is the PostgreSQL terminal client. On Ubuntu it is installed with the server package.

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
sudo systemctl status postgresql
```

You want `active (running)`.

Confirm the client exists:

```bash
psql --version
```

PostgreSQL listens on **localhost port 5432** on this same EC2 machine. The API will connect with host `localhost`. You do **not** need to open port 5432 in the security group for a typical lab (safer: keep the database private to the instance).

---

## Part 4 — Create database user, password, and database

Switch to the `postgres` OS user and open `psql`:

```bash
sudo -u postgres psql
```

You should see `postgres=#`. Run these SQL statements. **Change the password.**

```sql
CREATE USER lms_user WITH PASSWORD '<DB_PASSWORD>';
CREATE DATABASE lms_db OWNER lms_user;
GRANT ALL PRIVILEGES ON DATABASE lms_db TO lms_user;
```

PostgreSQL 15+ also needs schema rights on `lms_db`:

```sql
\c lms_db
GRANT ALL ON SCHEMA public TO lms_user;
ALTER SCHEMA public OWNER TO lms_user;
\q
```

`\q` exits `psql`.

### Prove you can log in as `lms_user`

```bash
psql -h localhost -U lms_user -d lms_db
```

When prompted, type `<DB_PASSWORD>`. Inside `psql`:

```sql
SELECT current_user, current_database();
\conninfo
\q
```

If login fails with `Peer authentication failed`, allow password auth for local TCP. Edit:

```bash
sudo nano /etc/postgresql/*/main/pg_hba.conf
```

Ensure these lines exist (scram-sha-256 or md5). Keep `peer` for local sockets if you want; the API uses TCP `localhost`, which uses the `host` lines:

```text
local   all             postgres                                peer
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
```

Reload:

```bash
sudo systemctl reload postgresql
```

Try `psql -h localhost -U lms_user -d lms_db` again.

You should **not** create `users` or other application tables here. The API migration does that.

---

## Part 5 — Clone the backend on the server

```bash
cd ~
git clone https://github.com/AIdeas-Tech-Solutions-Private-Limited/lms-api.git
cd lms-api
```

If your class uses a specific branch:

```bash
git checkout dev
```

Confirm you see `package.json`, `src/`, and `drizzle/`:

```bash
ls
ls drizzle
```

`drizzle/0000_init.sql` must exist. Without that folder, startup cannot create tables.

---

## Part 6 — Connect the backend to the database (`.env`)

```bash
nano .env
```

Paste this (replace passwords, IP, and JWT secret):

```env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://lms_user:<DB_PASSWORD>@localhost:5432/lms_db
JWT_SECRET=<JWT_SECRET>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://<EC2_PUBLIC_IP>:3000

# Lab defaults — change for a real production server
ADMIN_NAME=Admin
ADMIN_EMAIL=admin@gmail.com
ADMIN_PASSWORD=admin@123
ADMIN_ROLE=admin
```

Save: `Ctrl+O`, Enter, then `Ctrl+X`.

Notes:

- Host in `DATABASE_URL` is `localhost` because Postgres is on **this** EC2 instance.
- Do not wrap the URL in quotes unless your password has special characters. If the password contains `@`, `#`, `/`, or `%`, URL-encode them (for example `@` → `%40`).
- `CORS_ORIGIN` is the frontend URL users type in the browser, not `localhost`, unless they only open the UI via SSH tunnel.

---

## Part 7 — Install, build, and start the API with PM2

Still in `~/lms-api`:

```bash
npm install
npm run build
```

`npm run build` compiles TypeScript to `dist/`. Confirm:

```bash
ls dist
```

You should see `index.js`.

Start with PM2 from the **project root** so `process.cwd()` is `~/lms-api` (migrations live in `./drizzle`, and `.env` is loaded from here):

```bash
pm2 start dist/index.js --name lms-api
```

Useful checks:

```bash
pm2 status
pm2 logs lms-api --lines 50
```

Healthy first-start logs look like:

```text
Waiting for database...
Running database migrations...
Database migrations completed.
Checking default admin user...
Default admin user created.
Starting API...
Server running on port 5000
```

If the admin was already created:

```text
Default admin user already exists.
```

The password is **never** printed in logs.

Keep PM2 across reboot:

```bash
pm2 save
pm2 startup
```

Copy the command `pm2 startup` prints (it starts with `sudo env PATH=...`) and run it, then:

```bash
pm2 save
```

### Everyday PM2 commands

| Command | Meaning |
|---------|---------|
| `pm2 status` | Is `lms-api` online? |
| `pm2 logs lms-api` | Live logs |
| `pm2 restart lms-api` | Restart after `.env` or code change |
| `pm2 stop lms-api` | Stop |
| `pm2 delete lms-api` | Remove from PM2 |

After you change `.env` or pull new code:

```bash
cd ~/lms-api
git pull
npm install
npm run build
pm2 restart lms-api
pm2 logs lms-api --lines 30
```

---

## Part 8 — Verify the backend (database + API)

Do these on the EC2 instance, then from your laptop.

### A. Process is running

```bash
pm2 status
ss -tlnp | grep 5000
```

Port `5000` should be listening.

### B. Health endpoint on the server

```bash
curl http://127.0.0.1:5000/health
```

Expected:

```json
{"status":"ok","timestamp":"..."}
```

### C. Tables exist

```bash
psql -h localhost -U lms_user -d lms_db
```

```sql
\dt
SELECT name, email, role FROM users;
\q
```

You should see:

- `users`, `categories`, `courses`, `sessions`, `enrollments`, `session_progress`
- A row: `Admin | admin@gmail.com | admin`

Password in the table must look like a bcrypt hash (`$2b$10$...`), not `admin@123`.

### D. Admin login on the server

```bash
curl -s -X POST http://127.0.0.1:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gmail.com","password":"admin@123"}'
```

The JSON must include `"role":"admin"` and a `token`.

### E. Reach the API from your laptop

In a browser or from your PC:

```text
http://<EC2_PUBLIC_IP>:5000/health
```

If this times out: security group port **5000**, Ubuntu firewall (`sudo ufw status` — if active, `sudo ufw allow 5000/tcp`), and `pm2 status`.

### F. Student register still works

```bash
curl -s -X POST http://127.0.0.1:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Student","email":"student@test.com","password":"student@123"}'
```

The user object must have `"role":"student"`.

Restart must not duplicate the admin:

```bash
pm2 restart lms-api
pm2 logs lms-api --lines 20
```

Look for `Default admin user already exists.` Then `\dt` / `SELECT` on `users` still shows one admin row.

---

## Part 9 — Connect the frontend

The frontend is a **separate** app (port **3000**). The browser loads the UI, then JavaScript calls this API.

### Mental model

```
User's browser
  address bar:  http://<EC2_PUBLIC_IP>:3000     ← CORS_ORIGIN must match this
  API calls:    http://<EC2_PUBLIC_IP>:5000     ← frontend API base URL
```

Do **not** set the browser API URL to `http://localhost:5000` when users open the site by public IP. `localhost` in the visitor’s browser means **their** PC, not EC2.

### 9.1 Point this API at the frontend origin

On EC2, `.env` must contain:

```env
CORS_ORIGIN=http://<EC2_PUBLIC_IP>:3000
```

No trailing slash. Then:

```bash
pm2 restart lms-api
```

If the frontend is later served as `https://your-domain.com`, set `CORS_ORIGIN` to that exact origin and restart PM2.

### 9.2 Deploy the frontend on the same EC2 (typical lab)

Clone the frontend repository (use the URL your class provides):

```bash
cd ~
git clone <FRONTEND_REPO_URL>
cd <frontend-folder>
```

Install and set the **public** API URL to this backend. The env name depends on the frontend framework:

| Frontend | Typical variable | Value on EC2 |
|----------|------------------|--------------|
| Next.js | `NEXT_PUBLIC_API_URL` | `http://<EC2_PUBLIC_IP>:5000` |
| Create React App | `REACT_APP_API_URL` | `http://<EC2_PUBLIC_IP>:5000` |
| Vite | `VITE_API_URL` | `http://<EC2_PUBLIC_IP>:5000` |

Create `.env` or `.env.production` in the frontend folder, for example:

```env
NEXT_PUBLIC_API_URL=http://<EC2_PUBLIC_IP>:5000
PORT=3000
```

`NEXT_PUBLIC_*` and `VITE_*` are often baked in at **build** time. After changing them:

```bash
npm install
npm run build
```

Start the frontend with PM2. Use the start command from that repo’s README. Examples:

```bash
# Next.js production
pm2 start npm --name lms-frontend -- start

# Or a compiled static/node server, if the frontend README says so
# pm2 start npm --name lms-frontend -- run preview
```

If the frontend must listen on `0.0.0.0:3000` (reachable from the internet), check its README (`HOSTNAME=0.0.0.0`, `-H 0.0.0.0`, etc.).

Open security group port **3000**. Then in your browser:

```text
http://<EC2_PUBLIC_IP>:3000
```

Log in with:

- Email: `admin@gmail.com`
- Password: `admin@123`

### 9.3 Frontend on your laptop, API on EC2

Useful while developing the UI:

1. API stays on EC2 (`http://<EC2_PUBLIC_IP>:5000`).
2. On EC2 set `CORS_ORIGIN=http://localhost:3000` and `pm2 restart lms-api`.
3. On the laptop, frontend `.env` uses `http://<EC2_PUBLIC_IP>:5000`.
4. Run `npm run dev` locally and open `http://localhost:3000`.

### 9.4 CORS and network checklist

| Check | Expected |
|-------|----------|
| Browser origin | `http://<EC2_PUBLIC_IP>:3000` |
| `CORS_ORIGIN` on API | Exactly that string |
| Frontend API base URL | `http://<EC2_PUBLIC_IP>:5000` |
| `GET /health` in browser | JSON `status: ok` |
| Login from the UI | Network tab shows `POST /api/auth/login` → 200 |
| Browser console CORS error | Origin mismatch or API down |

Wrong: `CORS_ORIGIN=http://lms-frontend:3000` (that hostname is not what the browser sends).

---

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| `relation "users" does not exist` | API started without migrations. Confirm `drizzle/` is on the server and you started from `~/lms-api` with PM2. Read `pm2 logs lms-api`. |
| `Waiting for database...` then crash | Wrong `DATABASE_URL`, Postgres not running (`sudo systemctl status postgresql`), or password / `pg_hba.conf`. |
| `ECONNREFUSED 127.0.0.1:5432` | `sudo systemctl start postgresql`. |
| Health works on EC2 but not from laptop | Security group port 5000; `sudo ufw allow 5000/tcp` if UFW is on. |
| CORS error in the browser | `CORS_ORIGIN` vs address bar; restart PM2 after `.env` change. |
| Login 401 | Caps in email/password; confirm row in `users` and bcrypt hash. |
| `bcrypt` / `invalid ELF` native error | Install `build-essential python3`, delete `node_modules`, run `npm install` **on EC2** (do not copy Windows `node_modules`). |
| PM2 online but old code | `npm run build` then `pm2 restart lms-api`. PM2 runs `dist/`, not `src/`. |
| Frontend calls `localhost:5000` | That hits the visitor’s machine. Use `http://<EC2_PUBLIC_IP>:5000`. |

---

## API reference

Base URL on EC2: `http://<EC2_PUBLIC_IP>:5000`

Admin routes need a JWT **and** `role = admin`.

```http
Authorization: Bearer YOUR_JWT_HERE
```

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create student account |
| POST | `/api/auth/login` | Login, receive JWT |
| GET | `/api/auth/me` | Current user (token) |

### Courses

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/courses` | Published courses |
| GET | `/api/courses/admin/all` | All courses (admin) |
| GET | `/api/courses/featured` | Featured courses |
| GET | `/api/courses/slug/:slug` | Course by slug |
| GET | `/api/courses/:id` | Course by id |
| POST | `/api/courses` | Create (admin) |
| PUT | `/api/courses/:id` | Update (admin) |
| DELETE | `/api/courses/:id` | Delete (admin) |

### Sessions, enrollments, progress

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions/course/:courseId` | Lessons in a course |
| GET | `/api/sessions/:id` | One lesson |
| POST | `/api/sessions` | Create lesson (admin) |
| PUT | `/api/sessions/:id` | Update lesson (admin) |
| DELETE | `/api/sessions/:id` | Delete lesson (admin) |
| POST | `/api/enrollments` | Enroll in a course |
| GET | `/api/enrollments/my` | My enrollments |
| GET | `/api/enrollments` | All enrollments (admin) |
| POST | `/api/progress/:sessionId/complete` | Mark lesson done |
| GET | `/api/progress/:sessionId` | Lesson progress |
| GET | `/api/progress/course/:courseId` | Course progress |

### Categories, profile, admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | All categories |
| GET | `/api/categories/:slug` | One category |
| POST | `/api/categories` | Create (admin) |
| PUT | `/api/categories/:id` | Update (admin) |
| DELETE | `/api/categories/:id` | Delete (admin) |
| GET | `/api/profile` | My profile |
| PUT | `/api/profile` | Update profile |
| PUT | `/api/profile/change-password` | Change password |
| GET | `/api/admin/dashboard` | Stats (admin) |
| GET | `/api/admin/students` | Student list (admin) |
| GET | `/health` | Liveness check |

---

## npm scripts

| Command | When to use it |
|---------|----------------|
| `npm run dev` | Laptop coding (`tsx watch`) |
| `npm run build` | Compile TypeScript → `dist/` (required before PM2) |
| `npm run start` | `node dist/index.js` (same process PM2 runs) |
| `npm run db:generate` | Create a new SQL migration after schema changes |
| `npm run db:migrate` | Apply migrations with drizzle-kit (optional; app also migrates on start) |
| `npm run db:studio` | Drizzle Studio on a developer machine |

---

## Database tables

| Table | Stores |
|-------|--------|
| `users` | Accounts (name, email, hashed password, role, avatar) |
| `categories` | Course groups |
| `courses` | Title, description, level, instructor, published flag |
| `sessions` | Lessons belonging to a course |
| `enrollments` | Which student joined which course |
| `session_progress` | Which lessons a student completed |

---

## Short recap

```text
SSH into EC2
  → install Node 20, Git, PM2, PostgreSQL
  → create lms_user + password + lms_db with psql
  → clone lms-api, write .env (DATABASE_URL + CORS_ORIGIN)
  → npm install && npm run build
  → pm2 start dist/index.js --name lms-api
  → curl /health and POST /api/auth/login
  → set frontend API URL to http://<EC2_PUBLIC_IP>:5000
  → open http://<EC2_PUBLIC_IP>:3000
```
