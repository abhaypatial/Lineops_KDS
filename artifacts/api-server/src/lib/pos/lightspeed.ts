import { createHmac } from "crypto";
import type { AdapterResult, StationMap } from "./types";
import { mapStation } from "./types";

/**
 * Lightspeed Restaurant (K-Series) webhook adapter.
 *
 * Uses HMAC-SHA256 signature in `X-Lightspeed-Signature`.
 * Handles `order.created` and `order.updated` events.
 *
 * Docs: https://developers.lightspeedhq.com/restaurant/
 */
export function lightspeedAdapter(
  headers: Record<string, string | string[] | undefined>,
  rawBody: string,
  secret: string,
  stationMap?: StationMap,
): AdapterResult {
  const sig = headers["x-lightspeed-signature"] as string | undefined;
  if (secret && sig) {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (`sha256=${expected}` !== sig) throw new Error("Lightspeed: invalid signature");
  }

  const body = JSON.parse(rawBody);
  const eventType: string = body.event ?? body.type ?? "";

  if (!["order.created", "order.updated", "new_order"].includes(eventType.toLowerCase())) {
    return { shouldProcess: false };
  }

  const lsOrder: Record<string, unknown> = body.data ?? body.order ?? body;
  const courses: Record<string, unknown>[] =
    (lsOrder.courses as Record<string, unknown>[]) ??
    (lsOrder.lines as Record<string, unknown>[]) ??
    [];

  const items = courses.flatMap((course) => {
    const lines = (course.items ?? course.orderLines ?? [course]) as Record<string, unknown>[];
    return lines.map((line) => ({
      name:      String(line.name ?? line.itemName ?? "Item"),
      quantity:  Number(line.qty ?? line.quantity ?? 1),
      stationId: mapStation(String(course.name ?? line.category ?? line.name ?? ""), stationMap),
      modifiers: ((line.modifiers ?? line.options ?? []) as { name?: string }[])
        .map(m => m.name ?? "").filter(Boolean),
    }));
  });

  return {
    shouldProcess: true,
    order: {
      externalId:   String(lsOrder.id ?? lsOrder.uuid ?? "unknown"),
      orderNumber:  String(lsOrder.number ?? lsOrder.id ?? "LS000").slice(-6),
      customerName: String(lsOrder.customerName ?? lsOrder.guestName ?? ""),
      notes:        String(lsOrder.notes ?? lsOrder.comment ?? ""),
      priority:     "normal",
      items,
    },
  };
}
