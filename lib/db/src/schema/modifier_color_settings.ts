import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const modifierColorSettingsTable = pgTable("modifier_color_settings", {
  id:        text("id").primaryKey(),
  colors:    jsonb("colors").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ModifierColorSettings = typeof modifierColorSettingsTable.$inferSelect;
