import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { stationsTable } from "./stations";

export const kdsStationConfigsTable = pgTable("kds_station_configs", {
  stationId: text("station_id").primaryKey().references(() => stationsTable.id, { onDelete: "cascade" }),
  config:    jsonb("config").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type KdsStationConfig = typeof kdsStationConfigsTable.$inferSelect;
