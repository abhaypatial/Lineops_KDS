import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { storesTable } from "./stores";

export const deviceStatusEnum = ["online", "offline", "idle"] as const;
export type DeviceStatus = (typeof deviceStatusEnum)[number];

export const devicesTable = pgTable("devices", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull().references(() => storesTable.id),
  name: text("name").notNull(),
  deviceToken: text("device_token").notNull().unique(),
  stationIds: jsonb("station_ids").notNull().$type<string[]>(),
  status: text("status").notNull().default("offline"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  config: jsonb("config"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDeviceSchema = createInsertSchema(devicesTable);
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devicesTable.$inferSelect;
