# LMS Backend API

A RESTful API for the Learning Management System built with Express.js, TypeScript, Drizzle ORM, and PostgreSQL.

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Express.js | 4.21.2 | HTTP server framework |
| TypeScript | 5.7.3 | Type safety |
| Drizzle ORM | 0.39.3 | Database ORM |
| PostgreSQL | - | Relational database |
| JSON Web Token | 9.0.2 | Authentication |
| bcrypt | 5.1.1 | Password hashing |
| Zod | 3.24.2 | Request validation |
| multer | 1.4.5 | File uploads |
| pg | 8.13.1 | PostgreSQL client |

---

## Features

- JWT-based authentication (register, login, token verification)
- Role-based access control (student / admin)
- Full CRUD for courses, sessions, categories
- Student enrollment system
- Session progress tracking
- Profile management with password change
- Admin dashboard with statistics
- CORS configured for frontend origin

---

## Project Structure

```
lms-api/
├── src/
│   ├── config/              # App configuration
│   ├── controllers/         # Route handlers
│   │   ├── auth.controller.ts
│   │   ├── admin.controller.ts
│   │   ├── course.controller.ts
│   │   ├── session.controller.ts
│   │   ├── enrollment.controller.ts
│   │   ├── category.controller.ts
│   │   ├── profile.controller.ts
│   │   └── progress.controller.ts
│   ├── db/
│   │   ├── schema/
│   │   │   └── index.ts     # Drizzle schema definitions
│   │   └── index.ts         # Database connection
│   ├── middleware/           # Auth & error middleware
│   ├── routes/              # API route definitions
│   │   ├── auth.routes.ts
│   │   ├── admin.routes.ts
│   │   ├── course.routes.ts
│   │   ├── session.routes.ts
│   │   ├── enrollment.routes.ts
│   │   ├── category.routes.ts
│   │   ├── profile.routes.ts
│   │   ├── progress.routes.ts
│   │   └── index.ts
│   ├── types/               # Shared types
│   └── index.ts             # Express server entry point
├── drizzle/                 # Generated migrations
├── package.json
├── tsconfig.json
└── drizzle.config.ts
```

---

## Prerequisites

- **Node.js** — v18 or higher (v20 recommended)
- **npm** — v9 or higher
- **PostgreSQL** — v14 or higher

---

## Local Development Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd lms/lms-api
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create Environment File

Create `.env` in the `lms-api/` directory:

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/lms_db
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
PORT=5000
CORS_ORIGIN=http://localhost:3000
```

### 4. Setup Database

Create the PostgreSQL database:

```sql
CREATE DATABASE lms_db;
```

Push the schema to the database:

```bash
npm run db:push
```

Optional — Open Drizzle Studio to inspect data:

```bash
npm run db:studio
```

### 5. Start Development Server

```bash
npm run dev
```

Server runs on `http://localhost:5000`

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/lms_db` |
| `JWT_SECRET` | Secret key for JWT signing | Any random secure string |
| `JWT_EXPIRES_IN` | Token expiration duration | `7d` |
| `PORT` | Server port | `5000` |
| `CORS_ORIGIN` | Allowed origin for CORS | `http://localhost:3000` |

---

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts (id, name, email, password, role, avatar) |
| `categories` | Course categories (id, name, slug) |
| `courses` | Course details (id, title, slug, description, thumbnail, level, duration, instructor, published) |
| `sessions` | Video/PDF sessions (id, title, description, videoUrl, pdfUrl, order, published, courseId) |
| `enrollments` | Student-course enrollment records (userId, courseId) |
| `session_progress` | Tracks completed sessions per user (userId, sessionId, completed) |

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |

### Courses

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/courses` | Get all published courses (with pagination) |
| GET | `/api/courses/admin/all` | Get all courses (admin) |
| GET | `/api/courses/featured` | Get featured courses |
| GET | `/api/courses/slug/:slug` | Get course by slug |
| GET | `/api/courses/:id` | Get course by ID |
| POST | `/api/courses` | Create course (admin) |
| PUT | `/api/courses/:id` | Update course (admin) |
| DELETE | `/api/courses/:id` | Delete course (admin) |

### Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions/course/:courseId` | Get sessions for a course |
| GET | `/api/sessions/:id` | Get session by ID |
| POST | `/api/sessions` | Create session (admin) |
| PUT | `/api/sessions/:id` | Update session (admin) |
| DELETE | `/api/sessions/:id` | Delete session (admin) |

### Enrollments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/enrollments` | Enroll in a course |
| GET | `/api/enrollments/my` | Get my enrollments |
| GET | `/api/enrollments` | Get all enrollments (admin) |

### Progress

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/progress/:sessionId/complete` | Mark session complete |
| GET | `/api/progress/:sessionId` | Get session progress |
| GET | `/api/progress/course/:courseId` | Get course progress |

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | Get all categories |
| GET | `/api/categories/:slug` | Get category by slug |
| POST | `/api/categories` | Create category (admin) |
| PUT | `/api/categories/:id` | Update category (admin) |
| DELETE | `/api/categories/:id` | Delete category (admin) |

### Profile

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profile` | Get profile |
| PUT | `/api/profile` | Update profile |
| PUT | `/api/profile/change-password` | Change password |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Get dashboard stats |
| GET | `/api/admin/students` | Get all students |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |

---

## Build for Production

```bash
npm run build
```

This compiles TypeScript to `dist/` directory.

### Start Production Server

```bash
npm run start
```

---

## PM2 Deployment

### Step 1: Install PM2

```bash
sudo npm install -g pm2
```

### Step 2: Build the Project

```bash
cd lms-api
npm run build
```

This compiles TypeScript and generates the `dist/` directory.

### Step 3: Start with PM2

```bash
pm2 start dist/index.js --name "lms-api"
```

### Step 4: Verify It's Running

```bash
pm2 status
```

You should see `lms-api` with status `online`.

### Step 5: Save Process List

```bash
pm2 save
```

This saves the current process list so it can be restored on reboot.

### Step 6: Setup Auto-Start on Reboot

```bash
pm2 startup
```

This generates a command — copy and run it as instructed. It ensures PM2 starts automatically when the server reboots.

### Useful PM2 Commands

| Command | Description |
|---------|-------------|
| `pm2 status` | View running processes |
| `pm2 logs lms-api` | View logs |
| `pm2 restart lms-api` | Restart process |
| `pm2 stop lms-api` | Stop process |
| `pm2 delete lms-api` | Delete process |
| `pm2 monit` | Monitor CPU and memory |

---

## AWS Deployment

### Setup on EC2

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Create Database

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE lms_db;
CREATE USER lms_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE lms_db TO lms_user;
\q
```

### Deploy

```bash
# Clone or upload project
cd ~/lms/lms-api

# Install and build
npm install
npm run build

# Create .env
cat > .env << 'EOF'
DATABASE_URL=postgresql://lms_user:your_secure_password@localhost:5432/lms_db
JWT_SECRET=your-production-jwt-secret
JWT_EXPIRES_IN=7d
PORT=5000
CORS_ORIGIN=http://<your-ec2-public-ip>:3000
EOF

# Push schema
npm run db:push

# Start with PM2
pm2 start dist/index.js --name "lms-api"
pm2 save
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with tsx watch |
| `npm run build` | Compile TypeScript |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push schema to database |
| `npm run db:generate` | Generate migrations |
| `npm run db:migrate` | Run migrations |
| `npm run db:studio` | Open Drizzle Studio |
