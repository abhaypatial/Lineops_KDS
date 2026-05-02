import { pgTable, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { storesTable } from "./stores";

export const apiKeysTable = pgTable("api_keys", {
  id:          text("id").primaryKey(),
  storeId:     text("store_id").notNull().references(() => storesTable.id),
  name:        text("name").notNull(),
  keyHash:     text("key_hash").notNull().unique(),
  keyPrefix:   text("key_prefix").notNull(),
  permissions: jsonb("permissions").notNull().$type<string[]>(),
  isActive:    boolean("is_active").notNull().default(true),
  lastUsedAt:  timestamp("last_used_at",  { withTimezone: true }),
  expiresAt:   timestamp("expires_at",    { withTimezone: true }),
  createdAt:   timestamp("created_at",    { withTimezone: true }).notNull().defaultNow(),
});

export const insertApiKeySchema = createInsertSchema(apiKeysTable);
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey      = typeof apiKeysTable.$inferSelect;
