import rateLimit from "express-rate-limit";

const standardHeaders = "draft-8" as const;
const legacyHeaders = false;

/**
 * POS webhook endpoints — generous limit, allows bursts of 20+ simultaneous
 * orders from a single POS system without throttling.
 * 500 req / min per IP.
 */
export const posWebhookLimiter = rateLimit({
  windowMs: 60_000,
  max: 500,
  standardHeaders,
  legacyHeaders,
  message: { error: "Webhook rate limit exceeded — too many requests." },
  skip: () => process.env.NODE_ENV === "test",
});

/**
 * General API — covers all management and display endpoints.
 * 300 req / min per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders,
  legacyHeaders,
  message: { error: "Too many requests, please slow down." },
  skip: () => process.env.NODE_ENV === "test",
});

/**
 * Strict limiter for sensitive write operations (key generation, clear-all, etc.).
 * 60 req / min per IP.
 */
export const strictLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders,
  legacyHeaders,
  message: { error: "Rate limit exceeded for this operation." },
  skip: () => process.env.NODE_ENV === "test",
});
