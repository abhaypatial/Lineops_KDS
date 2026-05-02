import { createHmac } from "crypto";
import { db, outboundWebhooksTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { logger } from "./logger";
import type { WebhookEvent } from "@workspace/db";

interface WebhookPayload {
  event:     WebhookEvent;
  storeId:   string;
  timestamp: string;
  data:      Record<string, unknown>;
}

/**
 * Fire all registered outbound webhooks for a given event + storeId.
 * Non-blocking: errors increment failureCount but don't throw.
 */
export async function fireWebhooks(
  event: WebhookEvent,
  storeId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const hooks = await db
    .select()
    .from(outboundWebhooksTable)
    .where(and(eq(outboundWebhooksTable.storeId, storeId), eq(outboundWebhooksTable.isActive, true)));

  const relevant = hooks.filter(h => (h.events as string[]).includes(event) || (h.events as string[]).includes("*"));
  if (!relevant.length) return;

  const payload: WebhookPayload = { event, storeId, timestamp: new Date().toISOString(), data };
  const body = JSON.stringify(payload);

  await Promise.allSettled(
    relevant.map(async (hook) => {
      const sig = createHmac("sha256", hook.secret).update(body).digest("hex");
      try {
        const res = await fetch(hook.url, {
          method:  "POST",
          headers: {
            "Content-Type":    "application/json",
            "X-KDS-Signature": `sha256=${sig}`,
            "X-KDS-Event":     event,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await db.update(outboundWebhooksTable)
          .set({ lastDeliveredAt: new Date(), failureCount: 0 })
          .where(eq(outboundWebhooksTable.id, hook.id));
      } catch (err) {
        logger.warn({ hookId: hook.id, url: hook.url, err }, "Outbound webhook delivery failed");
        await db.update(outboundWebhooksTable)
          .set({ failureCount: (hook.failureCount ?? 0) + 1 })
          .where(eq(outboundWebhooksTable.id, hook.id));
      }
    }),
  );
}
