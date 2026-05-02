import { createHmac } from "crypto";
import type { AdapterResult, StationMap } from "./types";
import { mapStation } from "./types";

/**
 * Toast POS webhook adapter.
 *
 * Verifies `Toast-Signature` header (HMAC-SHA256 base64).
 * Handles `ORDER_UPDATED` events.
 *
 * Docs: https://doc.toasttab.com/doc/platformguide/adminWebhooksOverview.html
 */
export function toastAdapter(
  headers: Record<string, string | string[] | undefined>,
  rawBody: string,
  secret: string,
  stationMap?: StationMap,
): AdapterResult {
  const sig = headers["toast-signature"] as string | undefined;
  if (secret && sig) {
    const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
    if (sig !== expected) throw new Error("Toast: invalid webhook signature");
  }

  const body = JSON.parse(rawBody);
  const eventType: string = body.eventType ?? body.type ?? "";

  if (!["ORDER_UPDATED", "ORDER_CREATED", "NEW_ORDER"].includes(eventType)) {
    return { shouldProcess: false };
  }

  // Toast wraps order in body.orders[0] or body.order
  const toastOrder = body.order ?? body.orders?.[0] ?? {};
  const selections: Record<string, unknown>[] = toastOrder.checks?.[0]?.selections ?? [];

  const priorityRaw = String(toastOrder.promisedDate ?? "").toLowerCase();
  const priority    = priorityRaw.includes("rush") ? "rush" : "normal";

  return {
    shouldProcess: true,
    order: {
      externalId:   toastOrder.guid ?? "unknown",
      orderNumber:  String(toastOrder.displayNumber ?? toastOrder.guid?.slice(-6) ?? "TS000"),
      customerName: toastOrder.checks?.[0]?.customer?.firstName ?? undefined,
      notes:        toastOrder.deliveryInfo?.notes ?? undefined,
      priority,
      items: selections.map((sel) => ({
        name:      String(sel.displayName ?? sel.itemDescription ?? "Item"),
        quantity:  Number(sel.quantity ?? 1),
        stationId: mapStation(String((sel.menuGroup as { name?: string } | undefined)?.name ?? sel.displayName ?? ""), stationMap),
        modifiers: ((sel.modifiers as { name?: string }[]) ?? []).map(m => m.name ?? "").filter(Boolean),
      })),
    },
  };
}
