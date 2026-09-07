import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { connectDB } from "./config/db.js";
import { initializeUploadDir } from "./store/fileStore.js";
import scanRoutes from "./routes/scan.routes.js";
import reportRoutes from "./routes/report.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { notFound, errorHandler } from "./middleware/error.js";

const app = express();

const PORT = Number(process.env.PORT || 5000);
// CORS_ORIGIN can be a single origin or comma-separated list (for prod + dev)
const CORS_ORIGIN_RAW = process.env.CORS_ORIGIN || "http://localhost:5173";
const CORS_ORIGINS = CORS_ORIGIN_RAW.split(",").map((s) => s.trim()).filter(Boolean);

// Initialize services
async function initializeApp() {
  // Connect to database
  await connectDB();

  // Initialize upload directory
  initializeUploadDir();

  // Middleware
  app.use(helmet());
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl, server-to-server
      if (CORS_ORIGINS.includes(origin) || CORS_ORIGINS.includes("*")) return cb(null, true);
      return cb(new Error(`CORS: origin ${origin} not allowed`));
    },
  }));
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("dev"));

  // Routes
  app.get("/health", (req, res) => res.json({ ok: true, status: "up", db: "connected" }));

  app.use("/api/scan", scanRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api", reportRoutes);

  // Error handling
  app.use(notFound);
  app.use(errorHandler);

  // Start server
  app.listen(PORT, () => {
    console.log(`\n✓ SentinelScan backend listening on http://localhost:${PORT}`);
    console.log(`✓ Database: connected`);
    console.log(`✓ CORS allowed origins: ${CORS_ORIGINS.join(", ")}\n`);
  });
}

// Start the application
initializeApp().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
