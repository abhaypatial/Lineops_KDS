import type { Request, Response, NextFunction } from "express";

/**
 * Optional admin-password protection for management API routes.
 *
 * Behaviour:
 *  - If ADMIN_PASSWORD is not set, all requests pass through (auth disabled).
 *  - If ADMIN_PASSWORD is set, requests must include:
 *      Authorization: Bearer <password>
 *
 * Public paths (no auth required even when password is set):
 *  - /api/healthz, /api/health, /api/config
 *  - /api/integrations/*   (POS webhook receivers — they have their own HMAC auth)
 *  - /api/test/inject-order (separately gated by ALLOW_TEST_ORDERS)
 *  - GET + PATCH on /api/orders, /api/stations, /api/stores
 *    (the kiosk display screen reads these without logging in)
 */

const ALWAYS_PUBLIC_PREFIXES = [
  "/api/healthz",
  "/api/health",
  "/api/config",
  "/api/integrations/",
  "/api/test/inject-order",
];

const PUBLIC_READ_PREFIXES = ["/api/orders", "/api/stations", "/api/stores"];

export function adminAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const adminPassword = process.env["ADMIN_PASSWORD"];

  if (!adminPassword) {
    next();
    return;
  }

  const { path, method } = req;

  for (const prefix of ALWAYS_PUBLIC_PREFIXES) {
    if (path === prefix || path.startsWith(prefix)) {
      next();
      return;
    }
  }

  if (
    (method === "GET" || method === "PATCH") &&
    PUBLIC_READ_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))
  ) {
    next();
    return;
  }

  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required", authEnabled: true });
    return;
  }

  const token = authHeader.slice(7);
  if (token !== adminPassword) {
    res.status(401).json({ error: "Invalid password", authEnabled: true });
    return;
  }

  next();
}
