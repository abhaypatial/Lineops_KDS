import { pgTable, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

export const kdsConfigTemplatesTable = pgTable("kds_config_templates", {
  id:        text("id").primaryKey(),
  name:      text("name").notNull(),
  config:    jsonb("config").notNull(),
  isActive:  boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type KdsConfigTemplate = typeof kdsConfigTemplatesTable.$inferSelect;
