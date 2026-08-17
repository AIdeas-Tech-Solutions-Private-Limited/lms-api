# LMS API — student guide

This repository is the **backend** of a Learning Management System (LMS).

Think of a website like a small online school:

- The **frontend** (usually on port `3000`) is the screens students see: login, course list, videos.
- This **backend** (usually on port `5000`) is the kitchen. It stores users, courses, and progress in a database, and answers questions from the frontend.

The frontend never talks to PostgreSQL directly. It sends HTTP requests here, for example:

- “Register this new student”
- “Give me all published courses”
- “Mark this lesson as complete”

This project is an **Express.js API** written in **TypeScript**.

```
Browser / frontend (port 3000)
        |
        |  HTTP requests  (/api/...)
        v
This API (port 5000)
        |
        |  SQL
        v
PostgreSQL database
```

---

## What you will learn from this repo

- How a real REST API is split into routes, controllers, and a database schema
- How login works with JWT tokens
- How Docker packages this API so it runs the same on every laptop
- How a backend container talks to a frontend container

Docker learning files (read in this order):

1. [dockerignore-guide.md](./dockerignore-guide.md) — which files Docker should **not** copy
2. [dockerfile-demo.md](./dockerfile-demo.md) — what a Dockerfile is, how to write one, build an image, run a container, connect to the frontend
3. [multi-stage-build.md](./multi-stage-build.md) — why this Dockerfile has two stages (builder + production)

---

## What this API can do

| Feature | Simple meaning |
|---------|----------------|
| Register / login | Students create an account and get a token |
| Roles | `student` or `admin` — admins can create courses |
| Courses & categories | Catalogue of classes |
| Sessions | Lessons inside a course (video or PDF links) |
| Enrollment | A student joins a course |
| Progress | Track which lessons a student finished |
| Profile | Update name / password |
| Admin dashboard | Counts of users, courses, enrollments |
| Health check | `GET /health` — used by Docker to see if the process is alive |

---

## Tech stack (plain English)

| Tool | What it is in this project |
|------|----------------------------|
| **Node.js 20** | The JavaScript runtime that runs the server |
| **Express** | Library that handles HTTP routes (`/api/courses`, …) |
| **TypeScript** | JavaScript with types. We compile it to `dist/` before production |
| **PostgreSQL** | Database that stores users, courses, and progress |
| **Drizzle ORM** | TypeScript code that talks to PostgreSQL |
| **JWT** | Signed token given after login. The frontend sends it as `Authorization: Bearer ...` |
| **bcrypt** | Hashes passwords so we never store the real password |
| **Zod** | Validates request data |
| **CORS** | Allows the frontend origin (default `http://localhost:3000`) to call this API |

---

## Folders (only what you need)

```
lms-api/
├── src/
│   ├── index.ts              # Starts Express, CORS, /api, /health
│   ├── config/               # PORT, JWT, DATABASE_URL, CORS_ORIGIN
│   ├── routes/               # URL map (GET /api/courses → controller)
│   ├── controllers/          # The actual work (query DB, send JSON)
│   ├── middleware/           # Check JWT, check admin role, handle errors
│   ├── db/
│   │   ├── schema/           # Table definitions (users, courses, ...)
│   │   └── index.ts          # PostgreSQL connection
│   └── types/                # Shared TypeScript types
├── Dockerfile                # Recipe to build a Docker image
├── .dockerignore             # Files Docker must not send during build
├── package.json              # Scripts and npm packages
└── tsconfig.json             # TypeScript compiler settings
```

**How a request flows**

1. Frontend calls `POST /api/auth/login`
2. `src/index.ts` sends `/api` traffic to `src/routes`
3. `auth.routes.ts` picks the login handler
4. `auth.controller.ts` checks the password and returns a JWT
5. JSON goes back to the frontend

---

## Prerequisites

- **Node.js** 18+ (20 is best — same as the Dockerfile)
- **npm**
- **PostgreSQL** 14+ (or a Postgres Docker container)
- **Docker Desktop** if you want to follow the Docker lessons

---

## Run on your laptop (without Docker)

### 1. Install packages

```bash
npm install
```

### 2. Create `.env` in this folder

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/lms_db
JWT_SECRET=replace-this-with-a-long-random-string
JWT_EXPIRES_IN=7d
PORT=5000
CORS_ORIGIN=http://localhost:3000
```

Never commit `.env`. It holds secrets.

### 3. Create the database

In PostgreSQL:

```sql
CREATE DATABASE lms_db;
```

Create tables from the Drizzle schema:

```bash
npm run db:push
```

### 4. Start the API

```bash
npm run dev
```

Open: [http://localhost:5000/health](http://localhost:5000/health)

You should see `"status": "ok"`.

---

## Run with Docker

Full steps (write a Dockerfile, build, run, connect to a frontend on port 3000) are in [dockerfile-demo.md](./dockerfile-demo.md).

Short version after the image exists:

```bash
docker build -t lms-api .
docker run -d --name lms-api -p 5000:5000 --env-file .env lms-api
```

If Postgres is also in Docker, `localhost` inside the API container is **not** your laptop. Use the database **container name** in `DATABASE_URL`. The Docker demo file explains this.

---

## Environment variables

| Variable | Meaning | Typical student value |
|----------|---------|------------------------|
| `DATABASE_URL` | How to reach PostgreSQL | `postgresql://postgres:password@localhost:5432/lms_db` |
| `JWT_SECRET` | Secret used to sign login tokens | any long random string |
| `JWT_EXPIRES_IN` | How long a token stays valid | `7d` |
| `PORT` | Port inside the process | `5000` |
| `CORS_ORIGIN` | Which frontend URL is allowed | `http://localhost:3000` |

`CORS_ORIGIN` must match what the **browser** shows in the address bar, not a Docker internal hostname.

---

## Database tables

| Table | Stores |
|-------|--------|
| `users` | Accounts (name, email, hashed password, role, avatar) |
| `categories` | Course groups |
| `courses` | Course title, description, level, instructor, published flag |
| `sessions` | Lessons belonging to a course |
| `enrollments` | Which student joined which course |
| `session_progress` | Which lessons a student completed |

---

## API endpoints

Base URL: `http://localhost:5000`

Admin routes need a JWT **and** `role = admin`.

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, receive JWT |
| GET | `/api/auth/me` | Current user (needs token) |

### Courses

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/courses` | Published courses |
| GET | `/api/courses/admin/all` | All courses (admin) |
| GET | `/api/courses/featured` | Featured courses |
| GET | `/api/courses/slug/:slug` | One course by slug |
| GET | `/api/courses/:id` | One course by id |
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

Send the token like this:

```http
Authorization: Bearer YOUR_JWT_HERE
```

---

## npm scripts

| Command | When to use it |
|---------|----------------|
| `npm run dev` | Daily coding (auto-restart with `tsx watch`) |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm run start` | Run the compiled app (`node dist/index.js`) |
| `npm run db:push` | Create / update tables from the schema |
| `npm run db:studio` | Visual browser for the database |
| `npm run lint` | Check code style |

The Docker image runs the same command as `npm run start`.

---

## Production notes (optional)

On a server you can still use PM2:

```bash
npm run build
pm2 start dist/index.js --name "lms-api"
```

For class work, **Docker** is the path to practise. See [dockerfile-demo.md](./dockerfile-demo.md).
