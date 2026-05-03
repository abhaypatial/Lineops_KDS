import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { adminAuth } from "./middleware/admin-auth";
import { apiLimiter, posWebhookLimiter } from "./middleware/rate-limit";

const app: Express = express();
app.set("trust proxy", 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
    : true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// POS webhook routes get a generous limit to allow bursts (e.g. 20 simultaneous
// orders from a POS system). Other API routes use a moderate general limit.
app.use("/api/integrations", posWebhookLimiter);
app.use("/api", apiLimiter);

// ── Admin password protection (optional — enabled by ADMIN_PASSWORD env var) ──
app.use("/api", adminAuth);

app.use("/api", router);

export default app;
