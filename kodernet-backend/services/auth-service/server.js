require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
const authRoutes = require("./routes/authRoutes");

const app = express();
const prisma = new PrismaClient();
const PORT = Number(process.env.PORT || 4001);

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is required.");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      service: "auth-service",
      status: "healthy",
      database: "connected"
    });
  } catch {
    res.status(503).json({
      service: "auth-service",
      status: "unhealthy",
      database: "disconnected"
    });
  }
});

app.use("/api/auth", authRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found."
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  res.status(500).json({
    message: "Internal server error."
  });
});

async function start() {
  try {
    await prisma.$connect();

    app.listen(PORT, () => {
      console.log(
        `KODERNET Auth Service running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error("Failed to start Auth Service:", error);
    process.exit(1);
  }
}

async function shutdown() {
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start();