# KODERNET POS 2.0 Backend

Initial backend foundation for the KODERNET POS 2.0 microservices migration.

## Planned services

- auth-service
- catalog-service
- inventory-service
- sales-service
- customer-service
- purchasing-service
- repair-service
- assembly-service
- logistics-service
- finance-service
- hr-service
- notification-service

Services will be implemented incrementally, one service at a time.

## Current implementation

Only `auth-service` is implemented in this initial backend package.

## Authentication design

KODERNET uses staff authentication rather than public self-registration.

Roles are hard-coded:

- admin
- manager
- cashier
- technician
- driver

An authorized administrator creates staff accounts and assigns their role and branch access.

## Run with Docker

```bash
docker compose up --build
```

The Auth Service will be available on port `4001`.

Health check:

```http
GET http://localhost:4001/health
```

## Run locally

Start PostgreSQL, configure `services/auth-service/.env`, then:

```bash
npm --prefix services/auth-service install
npm --prefix services/auth-service run prisma:generate
npm --prefix services/auth-service run prisma:migrate
npm --prefix services/auth-service run seed
npm --prefix services/auth-service run dev
```

See `services/auth-service/README.md` for API documentation.
