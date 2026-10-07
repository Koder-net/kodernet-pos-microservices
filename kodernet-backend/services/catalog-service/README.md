# KODERNET POS 2.0 — Catalog Service

The Catalog Service owns tenant-scoped product and category catalog data for KODERNET POS 2.0.

## Responsibilities

- Product management
- Category management
- Bilingual English/Sinhala names
- Category hierarchy
- SKU management and suggested SKU generation
- Barcode storage/validation
- Product units
- Retail and wholesale pricing
- Low-stock threshold
- Product image/gallery URL storage
- Flexible product attributes
- Tenant isolation
- JWT authentication and role authorization

Inventory quantities, stock movements and stock transfers are intentionally not owned by this service. Those belong to the future Inventory Service.

## Database

MongoDB is used because catalog products can have flexible attributes that differ between product types.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI`.
3. Set `JWT_SECRET` to the same signing secret used by Auth Service.
4. Install packages:

```bash
npm install
```

5. Start development mode:

```bash
npm run dev
```

6. Start normally:

```bash
npm start
```

## Main endpoints

### Categories

- `GET /api/categories`
- `POST /api/categories`
- `GET /api/categories/:id`
- `PATCH /api/categories/:id`
- `DELETE /api/categories/:id`

### Products

- `GET /api/products`
- `POST /api/products`
- `GET /api/products/:id`
- `PATCH /api/products/:id`
- `DELETE /api/products/:id`
- `GET /api/products/barcode/:barcode`
- `GET /api/products/next-sku/:categoryId`
- `GET /api/products/:id/images`
- `PUT /api/products/:id/gallery`

## Authentication

Send the Auth Service JWT in:

```text
Authorization: Bearer <token>
```

The Catalog Service takes `tenantId` from the signed JWT. Clients must not be allowed to choose a tenant ID in request bodies.

## Roles

- `admin`: full catalog administration
- `manager`: catalog administration
- `cashier`: catalog read access
- `technician`: catalog read access
- `driver`: no catalog access by default

## Important architecture boundary

```text
Auth Service
    |
    | JWT containing tenant context
    v
Catalog Service
    |
    +-- Categories
    +-- Products
    +-- SKU / Barcode
    +-- Attributes
    +-- Image URLs
    |
    v
MongoDB

Inventory Service (future)
    |
    +-- Stock quantities
    +-- Stock movements
    +-- Stock transfers
    |
    v
PostgreSQL
```

## Notes

Image binaries should be stored in object storage such as MinIO or Supabase Storage. MongoDB should store the resulting URLs.

The SKU helper is intentionally simple and suitable for the initial service implementation. For very high concurrent product creation, use a dedicated atomic counter/sequence collection rather than calculating the maximum SKU by scanning products.
