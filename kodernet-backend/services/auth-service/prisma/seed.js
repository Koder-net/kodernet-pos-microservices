require("dotenv").config();
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  // Initial tenant configuration
  const tenantName =
    process.env.SEED_TENANT_NAME || "Kodernet Electronics";

  const tenantSlug =
    process.env.SEED_TENANT_SLUG || "kodernet";

  // Initial admin configuration
  const username =
    process.env.SEED_ADMIN_USERNAME || "admin";

  const pin =
    process.env.SEED_ADMIN_PIN || "1234";

  const rounds =
    Number(process.env.BCRYPT_ROUNDS || 12);

  // Hash the admin PIN
  const passwordHash = await bcrypt.hash(pin, rounds);

  // Create or update the initial tenant
  const tenant = await prisma.tenant.upsert({
    where: {
      slug: tenantSlug
    },
    update: {
      name: tenantName,
      active: true
    },
    create: {
      name: tenantName,
      slug: tenantSlug,
      active: true
    }
  });

  console.log(`Tenant ready: ${tenant.name} (${tenant.slug})`);

  // Create or update the initial admin inside the tenant
  const admin = await prisma.user.upsert({
    where: {
      tenantId_username: {
        tenantId: tenant.id,
        username
      }
    },
    update: {
      passwordHash,
      role: "ADMIN",
      active: true
    },
    create: {
      tenantId: tenant.id,
      username,
      passwordHash,
      role: "ADMIN",
      active: true
    }
  });

  console.log(
    `Initial admin ready: ${admin.username} (${tenant.slug})`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });