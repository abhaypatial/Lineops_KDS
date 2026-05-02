import { pgTable, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { storesTable } from "./stores";

export const posSourceEnum = ["square", "toast", "clover", "lightspeed", "generic", "custom"] as const;
export type PosSource = (typeof posSourceEnum)[number];

export const integrationEventsTable = pgTable("integration_events", {
  id:          text("id").primaryKey(),
  storeId:     text("store_id").references(() => storesTable.id),
  source:      text("source").notNull(),
  eventType:   text("event_type").notNull(),
  externalId:  text("external_id"),
  payload:     jsonb("payload").notNull(),
  processed:   boolean("processed").notNull().default(false),
  orderId:     text("order_id"),
  error:       text("error"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIntegrationEventSchema = createInsertSchema(integrationEventsTable);
export type InsertIntegrationEvent = z.infer<typeof insertIntegrationEventSchema>;
export type IntegrationEvent       = typeof integrationEventsTable.$inferSelect;
