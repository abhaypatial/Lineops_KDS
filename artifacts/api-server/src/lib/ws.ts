import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { Server } from "http";
import { randomUUID } from "crypto";
import { logger } from "./logger";
import { db, devicesTable, deviceHealthEventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

let wss: WebSocketServer | null = null;

const deviceRegistry = new Map<string, WebSocket>();

const MACHINE_LOCAL_KEYS = new Set([
  "zoomOverride",
  "bumpBarEnabled",
  "bumpBarPreset",
  "bumpKey",
  "prevKey",
  "nextKey",
  "recallKey",
  "showVirtualBumpBar",
  "showFooter",
]);

export function stripMachineLocal(cfg: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(cfg).filter(([k]) => !MACHINE_LOCAL_KEYS.has(k)),
  );
}

async function recordHealthEvent(deviceId: string, eventType: "online" | "offline" | "ping_reached" | "ping_timeout", latencyMs?: number) {
  try {
    await db.insert(deviceHealthEventsTable).values({
      id: randomUUID(),
      deviceId,
      eventType,
      latencyMs: latencyMs ?? null,
    });
  } catch (err) {
    logger.error({ err, deviceId, eventType }, "Failed to record health event");
  }
}

export function setupWebSocketServer(server: Server): void {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    logger.info({ ip: req.socket.remoteAddress }, "WebSocket client connected");

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "register" && msg.payload?.deviceId) {
          const deviceId = msg.payload.deviceId as string;
          deviceRegistry.set(deviceId, ws);
          logger.info({ deviceId }, "Device registered");
          db.update(devicesTable)
            .set({ status: "online", lastSeenAt: new Date() })
            .where(eq(devicesTable.id, deviceId))
            .catch((err) => logger.error({ err }, "Failed to update device status on connect"));
          recordHealthEvent(deviceId, "online").catch(() => {});
        } else {
          logger.debug({ msg }, "WS message received");
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", () => {
      for (const [deviceId, client] of deviceRegistry.entries()) {
        if (client === ws) {
          deviceRegistry.delete(deviceId);
          logger.info({ deviceId }, "Device unregistered on disconnect");
          db.update(devicesTable)
            .set({ status: "offline", lastSeenAt: new Date() })
            .where(eq(devicesTable.id, deviceId))
            .catch((err) => logger.error({ err }, "Failed to update device status on disconnect"));
          recordHealthEvent(deviceId, "offline").catch(() => {});
          break;
        }
      }
      logger.info("WebSocket client disconnected");
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket error");
    });

    ws.send(JSON.stringify({ type: "connected", payload: { message: "KDS WebSocket ready" } }));
  });

  logger.info("WebSocket server initialized on /ws");
}

export function broadcast(event: { type: string; payload: unknown }): void {
  if (!wss) return;
  const msg = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

export function broadcastToDevice(deviceId: string, event: { type: string; payload: unknown }): boolean {
  const client = deviceRegistry.get(deviceId);
  if (!client || client.readyState !== WebSocket.OPEN) return false;
  client.send(JSON.stringify(event));
  return true;
}

export function getRegisteredDeviceIds(): string[] {
  return Array.from(deviceRegistry.keys());
}

export { recordHealthEvent };
