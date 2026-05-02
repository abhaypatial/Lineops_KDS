import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const enterprisesTable = pgTable("enterprises", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  config: jsonb("config"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEnterpriseSchema = createInsertSchema(enterprisesTable);
export type InsertEnterprise = z.infer<typeof insertEnterpriseSchema>;
export type Enterprise = typeof enterprisesTable.$inferSelect;
