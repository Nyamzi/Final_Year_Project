import "dotenv/config";
import { prisma } from "./db";

import express from "express";
import cors from "cors";
import path from "path";
import { errorHandler } from "./middleware/auth";
import authRoutes from "./routes/auth";
import childRoutes from "./routes/child";
import parentRoutes from "./routes/parent";
import adminRoutes from "./routes/admin";
import actionRoutes from "./routes/actions";

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:8081",
    "http://localhost:8082",
    "http://localhost:8083",
    "http://localhost:8084",
    "http://localhost:8085",
    "http://localhost:19006",
  ],
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

import cookieParser from "cookie-parser";
app.use(cookieParser());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/child", childRoutes);
app.use("/api/parent", parentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/actions", actionRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Error handling
app.use(errorHandler);

async function connectWithRetry(maxAttempts = 5) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await prisma.$connect();
      return;
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      const delayMs = attempt * 2000;
      console.warn(`Database connection failed. Retrying in ${delayMs / 1000}s (${attempt}/${maxAttempts})...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
// Initialize database and start server
async function startServer() {
  try {
    await connectWithRetry();
    console.log("✅ Database connected");
    app.listen(Number(PORT), HOST, () => {
      console.log(`Server running on http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();




