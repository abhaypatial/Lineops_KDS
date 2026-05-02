import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { runtimeConfig, applySettings } from "../lib/runtime-config";

const router: IRouter = Router();

const SERVER_START = Date.now();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/health", async (_req, res) => {
  let dbStatus = "connected";
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    dbStatus = "error";
  }

  res.json({
    status: dbStatus === "connected" ? "ok" : "degraded",
    version: "1.0.0",
    uptime: Math.floor((Date.now() - SERVER_START) / 1000),
    db: dbStatus,
    environment: process.env["NODE_ENV"] ?? "development",
    testOrdersEnabled: runtimeConfig.testOrdersEnabled,
    authEnabled: !!process.env["ADMIN_PASSWORD"],
  });
});

/**
 * GET /api/config
 * Public endpoint — returns feature flags consumed by the frontend.
 * No auth required so the kiosk display can read it.
 */
router.get("/config", (_req, res) => {
  res.json({
    testOrdersEnabled: runtimeConfig.testOrdersEnabled,
    hiddenIntegrations: runtimeConfig.hiddenIntegrations,
    authEnabled: !!process.env["ADMIN_PASSWORD"],
    environment: process.env["NODE_ENV"] ?? "development",
    version: "1.0.0",
  });
});

/**
 * POST /api/admin/settings
 * Protected by adminAuth middleware (applied in app.ts).
 * Applies runtime overrides — resets to env-var defaults on server restart.
 */
router.post("/admin/settings", (req, res) => {
  const { testOrdersEnabled, hiddenIntegrations } = req.body as {
    testOrdersEnabled?: boolean;
    hiddenIntegrations?: string[];
  };

  applySettings({
    ...(typeof testOrdersEnabled === "boolean" ? { testOrdersEnabled } : {}),
    ...(Array.isArray(hiddenIntegrations) ? { hiddenIntegrations } : {}),
  });

  res.json({
    ok: true,
    testOrdersEnabled: runtimeConfig.testOrdersEnabled,
    hiddenIntegrations: runtimeConfig.hiddenIntegrations,
  });
});

export default router;
