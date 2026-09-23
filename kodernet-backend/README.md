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

Users belong to a tenant.

An authorized administrator creates staff accounts and assigns their role and branch access within their own tenant.

## Multi-tenant design

KODERNET uses tenant-based data isolation.

A tenant represents a separate business or organization using the POS system.

The basic relationship is:

Tenant

- Users
- Branch access

Each authenticated user belongs to exactly one tenant.

Tenant identity is established during login and included in the authentication JWT.

Services use the authenticated user's tenant identity when accessing tenant-owned data.

### Tenant isolation rule

A user from one tenant must never be able to access data belonging to another tenant.

For example:

```text
Tenant A
 ├── Admin A
 ├── Cashier A
 └── Products A

Tenant B
 ├── Admin B
 ├── Cashier B
 └── Products B