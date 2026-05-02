import { pgTable, text, timestamp, integer, index } from "drizzle-orm/pg-core";

export const healthEventTypeEnum = ["online", "offline", "ping_reached", "ping_timeout"] as const;
export type HealthEventType = (typeof healthEventTypeEnum)[number];

export const deviceHealthEventsTable = pgTable(
  "device_health_events",
  {
    id:        text("id").primaryKey(),
    deviceId:  text("device_id").notNull(),
    eventType: text("event_type").notNull().$type<HealthEventType>(),
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("device_health_events_device_id_idx").on(t.deviceId)],
);

export type DeviceHealthEvent = typeof deviceHealthEventsTable.$inferSelect;
