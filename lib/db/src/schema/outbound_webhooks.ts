import { pgTable, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { storesTable } from "./stores";

export const webhookEventEnum = [
  "order.created",
  "order.bumped",
  "order.completed",
  "order.recalled",
  "item.ready",
] as const;
export type WebhookEvent = (typeof webhookEventEnum)[number];

export const outboundWebhooksTable = pgTable("outbound_webhooks", {
  id:              text("id").primaryKey(),
  storeId:         text("store_id").notNull().references(() => storesTable.id),
  name:            text("name").notNull(),
  url:             text("url").notNull(),
  secret:          text("secret").notNull(),
  events:          jsonb("events").notNull().$type<WebhookEvent[]>(),
  isActive:        boolean("is_active").notNull().default(true),
  failureCount:    integer("failure_count").notNull().default(0),
  lastDeliveredAt: timestamp("last_delivered_at", { withTimezone: true }),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOutboundWebhookSchema = createInsertSchema(outboundWebhooksTable);
export type InsertOutboundWebhook = z.infer<typeof insertOutboundWebhookSchema>;
export type OutboundWebhook       = typeof outboundWebhooksTable.$inferSelect;
