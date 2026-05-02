import { createHmac } from "crypto";
import type { AdapterResult, StationMap } from "./types";
import { mapStation } from "./types";

/**
 * Square webhook adapter.
 *
 * Verifies `x-square-hmacsha256-signature` header, then normalises
 * `payment.created` / `order.updated` events.
 *
 * Docs: https://developer.squareup.com/docs/webhooks/overview
 */
export function squareAdapter(
  headers: Record<string, string | string[] | undefined>,
  rawBody: string,
  secret: string,
  stationMap?: StationMap,
): AdapterResult {
  // ── Signature verification ─────────────────────────────────────────────────
  const sig = headers["x-square-hmacsha256-signature"] as string | undefined;
  if (secret && sig) {
    const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
    if (sig !== expected) throw new Error("Square: invalid webhook signature");
  }

  const body = JSON.parse(rawBody);
  const eventType: string = body.type ?? "";

  // Only process order-related events
  const relevant = ["order.created", "order.updated", "payment.created"];
  if (!relevant.includes(eventType)) return { shouldProcess: false };

  // Square wraps the object under `data.object.order` or `data.object.payment`
  const squareOrder = body.data?.object?.order ?? body.data?.object?.payment?.order ?? {};
  const lineItems: Record<string, unknown>[] = squareOrder.line_items ?? [];

  return {
    shouldProcess: true,
    order: {
      externalId:   squareOrder.id ?? body.data?.id ?? "unknown",
      orderNumber:  squareOrder.reference_id ?? squareOrder.id?.slice(-6) ?? "SQ000",
      customerName: squareOrder.customer_id ?? undefined,
      priority:     "normal",
      items: lineItems.map((li) => ({
        name:      String(li.name ?? "Item"),
        quantity:  Number(li.quantity ?? 1),
        stationId: mapStation(String(li.catalog_object_id ?? li.name ?? ""), stationMap),
        modifiers: ((li.modifiers as { name?: string }[]) ?? []).map(m => m.name ?? "").filter(Boolean),
      })),
    },
  };
}
