require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    service: process.env.SERVICE_NAME || "catalog-service",
    status: "UP",
    database: mongoose.connection.readyState === 1 ? "CONNECTED" : "DISCONNECTED"
  });
});

app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || "Internal server error"
  });
});

const PORT = Number(process.env.PORT) || 3002;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not configured.");
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB.");
    app.listen(PORT, () => {
      console.log(`Catalog Service running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });