import type { AdapterResult, StationMap } from "./types";
import { mapStation } from "./types";

/**
 * Clover POS webhook adapter.
 *
 * Clover uses a different auth model (OAuth app tokens, not HMAC).
 * Validate the `Authorization` header bearer token equals the configured secret.
 *
 * Handles `CREATE` and `UPDATE` events on orders.
 *
 * Docs: https://docs.clover.com/docs/webhooks
 */
export function cloverAdapter(
  headers: Record<string, string | string[] | undefined>,
  rawBody: string,
  secret: string,
  stationMap?: StationMap,
): AdapterResult {
  // Clover sends a bearer token we can validate
  const auth = headers["authorization"] as string | undefined;
  if (secret && auth && !auth.includes(secret)) {
    throw new Error("Clover: invalid bearer token");
  }

  const body = JSON.parse(rawBody);

  // Clover sends an array of events
  const events: Record<string, unknown>[] = Array.isArray(body) ? body : [body];
  const orderEvent = events.find(e => {
    const type = String(e.type ?? "");
    return type === "CREATE" || type === "UPDATE";
  });
  if (!orderEvent) return { shouldProcess: false };

  const cloverOrder: Record<string, unknown> = (orderEvent.appId ? orderEvent : orderEvent.data as Record<string, unknown>) ?? {};
  const lineItems: Record<string, unknown>[] =
    (cloverOrder.lineItems as { elements?: Record<string, unknown>[] })?.elements ?? [];

  return {
    shouldProcess: true,
    order: {
      externalId:   String(cloverOrder.id ?? "unknown"),
      orderNumber:  String(cloverOrder.id ?? "CL000").slice(-6),
      customerName: (cloverOrder.customers as { firstName?: string }[])?.[0]?.firstName ?? undefined,
      priority:     "normal",
      items: lineItems.map((li) => ({
        name:      String(li.name ?? "Item"),
        quantity:  Number(li.unitQty ?? 1),
        stationId: mapStation(String(li.name ?? ""), stationMap),
        modifiers: ((li.modifications as { name?: string }[]) ?? []).map(m => m.name ?? "").filter(Boolean),
      })),
    },
  };
}
