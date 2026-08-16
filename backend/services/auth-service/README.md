# auth-service

Authentication microservice for **KODERNET POS 2.0**. Handles login, credential verification, JWT issuance, and basic role-based authorization data.

This service is the **reference implementation** for how every future KODERNET POS microservice will be structured. It is intentionally minimal — it demonstrates the pattern rather than implementing the complete authentication system.

## Purpose

Provide a self-contained service responsible for verifying user identity and issuing access tokens that other services can use to authorize requests.

## Responsibilities

- User authentication (login)
- Password/PIN verification (bcrypt-hashed)
- JWT token generation
- Basic role-based authorization data (role, branch assignment)
- Exposing the minimal user information needed for authentication

This service does **not** yet implement the full KODERNET authentication system (e.g. password reset, refresh tokens, multi-factor authentication, session management). Those will be added incrementally.

## Technologies

- Node.js + Express.js
- PostgreSQL
- Prisma ORM
- JWT (`jsonwebtoken`)
- bcrypt
- dotenv
- CORS

## Database

Uses PostgreSQL via Prisma. The schema defines a single `User` model:

| Field         | Type      | Notes                              |
|---------------|-----------|-------------------------------------|
| id            | String    | UUID, primary key                   |
| username      | String    | Unique                              |
| passwordHash  | String    | bcrypt hash — never stored as plain text |
| role          | String    | e.g. `cashier`, `manager`, `admin`  |
| branchId      | String?   | Branch assignment (nullable)        |
| active        | Boolean   | Whether the account is enabled      |
| createdAt     | DateTime  | Auto-set on creation                |
| updatedAt     | DateTime  | Auto-updated on change              |

See `prisma/schema.prisma` for the full definition.

## Folder structure

```text
auth-service/
├── middleware/
│   └── auth.js           # JWT verification + role-based authorization middleware
├── routes/
│   └── authRoutes.js      # /api/auth endpoints
├── prisma/
│   └── schema.prisma      # Database schema (User model)
├── .env.example
├── Dockerfile
├── package.json
├── server.js
└── README.md
```

## API endpoints

| Method | Endpoint            | Auth required | Description                          |
|--------|----------------------|----------------|----------------------------------------|
| GET    | `/health`             | No             | Basic health-check                     |
| POST   | `/api/auth/login`      | No             | Verify credentials, return a JWT        |
| GET    | `/api/auth/me`         | Yes (Bearer)   | Example protected route, returns decoded token payload |

### `POST /api/auth/login`

Request body:

```json
{
  "username": "jdoe",
  "password": "plain-text-password-or-pin"
}
```

Response (200):

```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": "uuid",
    "username": "jdoe",
    "role": "cashier",
    "branchId": "branch-01"
  }
}
```

## Authentication flow

1. Client sends `username` and `password`/`PIN` to `POST /api/auth/login`.
2. Service looks up the user by `username` and checks the account is `active`.
3. Submitted password is compared against the stored bcrypt hash.
4. On success, a JWT is signed containing `userId`, `username`, `role`, and `branchId`, and returned to the client.
5. The client includes this token as `Authorization: Bearer <token>` on subsequent requests.
6. Other routes/services use the `authenticateToken` middleware (see `middleware/auth.js`) to verify the token and read `req.user`.
7. `authorizeRoles(...)` can be layered on top to restrict routes to specific roles (e.g. `admin`, `manager`).

## Environment variables

Defined in `.env.example`:

```text
PORT=4001
DATABASE_URL=postgresql://user:password@host:5432/db
JWT_SECRET=
```

Copy `.env.example` to `.env` and fill in real values locally. Never commit a real `.env` file.

## How to run

### With Docker Compose (from `backend/`)

```bash
docker compose up --build
```

### Standalone (without Docker)

```bash
cd services/auth-service
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm start
```

The service will be available at `http://localhost:4001`.

## Current implementation status

- [x] Project structure
- [x] Health-check endpoint
- [x] Login endpoint with bcrypt verification
- [x] JWT generation
- [x] Basic JWT verification middleware
- [x] Basic role-based authorization helper
- [x] Prisma `User` model
- [ ] User registration / seeding endpoint
- [ ] Refresh tokens
- [ ] Password/PIN reset flow
- [ ] Rate limiting on login
- [ ] Audit logging

## Future improvements

- Add seeding scripts for initial admin/branch users
- Add refresh token support and token revocation
- Add stricter input validation (e.g. via `zod` or `express-validator`)
- Add rate limiting / brute-force protection on `/login`
- Expand role model to support more granular permissions
- Add automated tests
