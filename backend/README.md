# KODERNET POS 2.0 — Backend

This is the backend for **KODERNET POS 2.0**, built as a set of independent **microservices**. Each service owns its own data, dependencies, and deployment configuration, and lives inside a single Git repository under `services/`.

## Architecture

The backend follows a microservices architecture. Every service is:

- An independent Node.js/Express application
- Self-contained, with its own `package.json`, `server.js`, `Dockerfile`, environment configuration, and `README.md`
- Runnable on its own, without depending on other services being present

There is intentionally **no API Gateway, service mesh, message broker, or orchestration layer** at this stage. The project starts simple and will introduce additional infrastructure only when it is actually needed.

```text
backend/
├── services/
│   └── auth-service/        # Implemented — see below
├── docker-compose.yml
├── .gitignore
└── README.md
```

## Current implementation status

| Service              | Status          |
|-----------------------|-----------------|
| auth-service           | ✅ Implemented (example/reference service) |
| catalog-service         | ⏳ Planned |
| inventory-service       | ⏳ Planned |
| sales-service           | ⏳ Planned |
| customer-service        | ⏳ Planned |
| purchasing-service      | ⏳ Planned |
| repair-service          | ⏳ Planned |
| assembly-service        | ⏳ Planned |
| logistics-service       | ⏳ Planned |
| finance-service         | ⏳ Planned |
| hr-service              | ⏳ Planned |
| notification-service    | ⏳ Planned |

Only `auth-service` has been implemented so far. It serves as the **reference implementation** demonstrating the folder structure, coding conventions, and tooling that every future service will follow.

## Planned services

The services below are planned for the KODERNET POS 2.0 backend. They will be implemented **incrementally, one service at a time**, each following the same architectural pattern established by `auth-service`:

- `auth-service` — authentication, login, JWT issuance, role-based authorization
- `catalog-service` — product catalog management
- `inventory-service` — stock and inventory tracking
- `sales-service` — point-of-sale transactions and sales records
- `customer-service` — customer profiles and history
- `purchasing-service` — supplier purchasing and orders
- `repair-service` — repair job tracking
- `assembly-service` — product assembly/build tracking
- `logistics-service` — shipping and logistics
- `finance-service` — financial records and reporting
- `hr-service` — employee/HR management
- `notification-service` — notifications (email/SMS/push)

No folders for these services have been created yet. Each will be added only when work on it begins.

## Repository structure rule

This project uses **one Git repository** for the entire backend. Individual microservices are **not** split into separate repositories. Each service is self-contained within `services/<service-name>/` but shares the same repo, `.gitignore`, and root-level `docker-compose.yml`.

## Running the backend

### Prerequisites

- Node.js (v18+ recommended)
- Docker & Docker Compose
- PostgreSQL (only required if running a service outside Docker)

### Run with Docker Compose (recommended)

From the `backend/` folder:

```bash
docker compose up --build
```

This will start:

- `postgres` — PostgreSQL database
- `auth-service` — the authentication microservice

As more services are added, they will be registered in `docker-compose.yml` the same way.

### Run a service individually (without Docker)

```bash
cd services/auth-service
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npm start
```

See each service's own `README.md` for service-specific instructions.

## Adding new services

New services will be added one at a time, following the same pattern as `auth-service`:

1. Create `services/<new-service-name>/`
2. Add `package.json`, `server.js`, routes, middleware (if needed), Prisma schema (if needed), `Dockerfile`, `.env.example`, and `README.md`
3. Register the service in the root `docker-compose.yml`
4. Update the service status table in this README

This keeps the backend simple, predictable, and easy for the whole team (and supervisor) to follow as it grows.
