import { createServer } from "http";
import { fileURLToPath } from "url";
import path from "path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import app from "./app";
import { logger } from "./lib/logger";
import { setupWebSocketServer } from "./lib/ws";
import { seed } from "./lib/seed";
import { db } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ── Run DB migrations before accepting traffic ─────────────────────────────
// Only run in production (Docker). In development the DB is kept up-to-date
// with `pnpm --filter @workspace/db run push`.
// The migrations folder is copied next to dist/index.mjs during Docker build.
if (process.env.NODE_ENV === "production") {
  const __filename_ = fileURLToPath(import.meta.url);
  const __dirname_  = path.dirname(__filename_);
  const migrationsFolder = path.join(__dirname_, "drizzle");

  try {
    await migrate(db, { migrationsFolder });
    logger.info("Database migrations applied");
  } catch (err) {
    logger.error({ err }, "Database migration failed — aborting startup");
    process.exit(1);
  }
}

const server = createServer(app);
setupWebSocketServer(server);

seed().catch((err) => logger.error({ err }, "Seed failed"));

server.listen(port, () => {
  logger.info({ port }, "Server listening");
});

server.on("error", (err) => {
  logger.error({ err }, "Server error");
  process.exit(1);
});
