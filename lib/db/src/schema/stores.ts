import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { enterprisesTable } from "./enterprises";

export const storesTable = pgTable("stores", {
  id: text("id").primaryKey(),
  enterpriseId: text("enterprise_id").notNull().references(() => enterprisesTable.id),
  name: text("name").notNull(),
  location: text("location"),
  timezone: text("timezone").default("UTC"),
  config: jsonb("config"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStoreSchema = createInsertSchema(storesTable);
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type Store = typeof storesTable.$inferSelect;
