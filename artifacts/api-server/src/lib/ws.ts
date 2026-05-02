import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { Server } from "http";
import { logger } from "./logger";

let wss: WebSocketServer | null = null;

export function setupWebSocketServer(server: Server): void {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    logger.info({ ip: req.socket.remoteAddress }, "WebSocket client connected");

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        logger.debug({ msg }, "WS message received");
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", () => {
      logger.info("WebSocket client disconnected");
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket error");
    });

    // Send welcome ping
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
