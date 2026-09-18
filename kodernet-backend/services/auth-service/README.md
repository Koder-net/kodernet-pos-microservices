# KODERNET Auth Service

Authentication and staff user-management microservice for KODERNET POS 2.0.

## Responsibilities

- Staff login using username + PIN/password
- bcrypt credential hashing
- JWT authentication
- Hard-coded RBAC roles
- Admin-only user creation and management
- Account activation/deactivation
- Credential changes
- Branch assignments
- Current authenticated user lookup

There is no public self-registration endpoint.

## Roles

The roles are hard-coded:

- `admin`
- `manager`
- `cashier`
- `technician`
- `driver`

The API accepts these role names case-insensitively.

## Database

PostgreSQL is used for the Auth Service.

Prisma manages the database schema.

Main models:

- `User`
- `UserBranch`

The service owns this data and other microservices should not directly access the Auth Service database.

## Folder structure

```text
auth-service/
├── middleware/
│   └── auth.js
├── routes/
│   └── authRoutes.js
├── prisma/
│   ├── schema.prisma
│   └── seed.js
├── .env.example
├── Dockerfile
├── package.json
├── server.js
└── README.md
```

## API

Base URL:

```text
http://localhost:4001
```

### Health

```http
GET /health
```

### Login

```http
POST /api/auth/login
Content-Type: application/json
```

Request:

```json
{
  "username": "admin",
  "pin": "1234"
}
```

A `password` property may also be used instead of `pin`.

Successful response contains a JWT and sanitized user information.

### Current user

```http
GET /api/auth/me
Authorization: Bearer <JWT>
```

### List users

Admin only:

```http
GET /api/auth/users
Authorization: Bearer <ADMIN_JWT>
```

### Create user

Admin only:

```http
POST /api/auth/users
Authorization: Bearer <ADMIN_JWT>
Content-Type: application/json
```

Example:

```json
{
  "username": "kasun",
  "pin": "5678",
  "role": "cashier",
  "branchId": "00000000-0000-0000-0000-000000000001"
}
```

For multiple branches:

```json
{
  "username": "manager1",
  "pin": "5678",
  "role": "manager",
  "branchIds": [
    "00000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000002"
  ],
  "defaultBranchId": "00000000-0000-0000-0000-000000000001"
}
```

Branch IDs are stored as UUIDs, but this Auth Service does not own branch master data. The Branch/Location service will be introduced later.

### Update user

Admin only:

```http
PATCH /api/auth/users/:id
Authorization: Bearer <ADMIN_JWT>
```

Supported fields include:

- username
- pin/password
- role
- active
- branchId
- branchIds
- defaultBranchId

### Activate/deactivate

Admin only:

```http
PATCH /api/auth/users/:id/status
Authorization: Bearer <ADMIN_JWT>
Content-Type: application/json
```

```json
{
  "active": false
}
```

### Change credentials

Admin only:

```http
PATCH /api/auth/users/:id/credentials
Authorization: Bearer <ADMIN_JWT>
Content-Type: application/json
```

```json
{
  "pin": "9999"
}
```

## Authentication flow

```text
Client
  |
  | username + PIN/password
  v
Auth Service
  |
  | find user
  | check active status
  | bcrypt verification
  v
JWT generated
  |
  v
Client
  |
  | Authorization: Bearer JWT
  v
Protected service endpoint
  |
  | JWT verification
  v
Authorization / role check
```

## Bootstrap administrator

There is no public sign-up.

For development, the seed script creates or updates an initial admin:

```text
username: admin
PIN: 1234
```

These are development defaults only.

You can override them with:

```text
SEED_ADMIN_USERNAME
SEED_ADMIN_PIN
```

Example:

```bash
SEED_ADMIN_USERNAME=admin SEED_ADMIN_PIN=9876 npm run seed
```

Do not use the development PIN in production.

## Local setup

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL.
3. Install dependencies:

```bash
npm install
```

4. Generate Prisma client:

```bash
npm run prisma:generate
```

5. Create/apply the development migration:

```bash
npm run prisma:migrate -- --name init
```

6. Seed the initial administrator:

```bash
npm run seed
```

7. Start:

```bash
npm run dev
```

## Docker setup

From the backend root:

```bash
docker compose up --build
```

The PostgreSQL container uses port `5433` on the host and the Auth Service uses port `4001`.

## Thunder Client testing order

1. `GET /health`
2. Login as `admin`
3. Save the returned JWT
4. `GET /api/auth/users` with the admin JWT
5. Create a cashier/manager/etc.
6. Login as the newly created user
7. Call `GET /api/auth/me`
8. Test an admin-only endpoint with the non-admin token and verify `403`
9. Deactivate the user as admin
10. Try logging in again and verify that login is rejected

## Security notes

- Credentials are never stored in plaintext.
- JWT secrets must be changed for production.
- HTTPS/TLS should be used outside local development.
- The current service uses hard-coded roles by design.
- Public registration is intentionally not provided.
