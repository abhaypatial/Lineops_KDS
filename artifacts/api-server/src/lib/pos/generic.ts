import { z } from "zod";
import type { AdapterResult } from "./types";

/**
 * Generic / Custom POS adapter.
 *
 * Accepts a direct KDS-native JSON payload.
 * Authenticated via API key (handled upstream by requireApiKey middleware).
 * No webhook signature needed — API key is the auth.
 *
 * POST /api/integrations/orders
 * Authorization: Bearer kds_live_xxx
 *
 * Body:
 * {
 *   "orderNumber": "001",
 *   "customerName": "Table 5",       // optional
 *   "priority": "normal|rush|vip",   // optional, default normal
 *   "notes": "...",                  // optional
 *   "items": [
 *     { "name": "Burger", "quantity": 1, "stationId": "grill", "modifiers": ["No onion"] }
 *   ]
 * }
 */

const GenericItemSchema = z.object({
  name:      z.string().min(1),
  quantity:  z.number().int().positive().default(1),
  stationId: z.string().min(1),
  modifiers: z.array(z.string()).optional(),
  notes:     z.string().optional(),
});

export const GenericOrderSchema = z.object({
  externalId:   z.string().optional(),
  orderNumber:  z.string().min(1),
  customerName: z.string().optional(),
  priority:     z.enum(["normal", "rush", "vip"]).default("normal"),
  notes:        z.string().optional(),
  items:        z.array(GenericItemSchema).min(1),
});

export type GenericOrderPayload = z.infer<typeof GenericOrderSchema>;

export function genericAdapter(body: unknown): AdapterResult {
  const parsed = GenericOrderSchema.parse(body);
  return {
    shouldProcess: true,
    order: {
      externalId:   parsed.externalId ?? parsed.orderNumber,
      orderNumber:  parsed.orderNumber,
      customerName: parsed.customerName,
      notes:        parsed.notes,
      priority:     parsed.priority,
      items:        parsed.items.map(it => ({
        name:      it.name,
        quantity:  it.quantity,
        stationId: it.stationId,
        modifiers: it.modifiers,
        notes:     it.notes,
      })),
    },
  };
}
