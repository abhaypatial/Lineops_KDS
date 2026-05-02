import { pgTable, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { storesTable } from "./stores";

export const orderStatusEnum = ["pending", "in_progress", "ready", "completed", "cancelled"] as const;
export const orderPriorityEnum = ["normal", "rush", "vip"] as const;
export const orderItemStatusEnum = ["pending", "in_progress", "ready", "cancelled"] as const;

export type OrderStatus = (typeof orderStatusEnum)[number];
export type OrderPriority = (typeof orderPriorityEnum)[number];
export type OrderItemStatus = (typeof orderItemStatusEnum)[number];

export const ordersTable = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id").notNull().references(() => storesTable.id),
    posOrderId: text("pos_order_id"),
    orderNumber: text("order_number").notNull(),
    status: text("status").notNull().default("pending"),
    priority: text("priority").notNull().default("normal"),
    customerName: text("customer_name"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("orders_store_pos_order_uniq")
      .on(table.storeId, table.posOrderId)
      .where(sql`pos_order_id IS NOT NULL`),
  ],
);

export const orderItemsTable = pgTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => ordersTable.id),
  stationId: text("station_id").notNull(),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  modifiers: text("modifiers").array().notNull().default([]),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertOrderSchema = createInsertSchema(ordersTable);
export const insertOrderItemSchema = createInsertSchema(orderItemsTable);
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;
