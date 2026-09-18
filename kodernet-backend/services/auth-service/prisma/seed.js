require("dotenv").config();
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME || "admin";
  const pin = process.env.SEED_ADMIN_PIN || "1234";
  const rounds = Number(process.env.BCRYPT_ROUNDS || 12);

  const passwordHash = await bcrypt.hash(pin, rounds);

  const admin = await prisma.user.upsert({
    where: { username },
    update: {
      passwordHash,
      role: "ADMIN",
      active: true
    },
    create: {
      username,
      passwordHash,
      role: "ADMIN",
      active: true
    }
  });

  console.log(`Initial admin ready: ${admin.username}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
