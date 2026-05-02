import { useEffect, useRef } from "react";
import { QueryClient } from "@tanstack/react-query";
import { getListOrdersQueryKey, getGetDashboardSummaryQueryKey, getGetRecentActivityQueryKey, getGetStationLoadQueryKey } from "@workspace/api-client-react";
import { toast } from "sonner";

interface WebSocketEvent {
  type: string;
  payload: {
    orderId?: string;
    storeId?: string;
    orderNumber?: string;
    [key: string]: any;
  };
}

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

export function stripMachineLocal(incoming: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(incoming).filter(([k]) => !MACHINE_LOCAL_KEYS.has(k)),
  );
}

export function getKdsDeviceId(): string {
  let id = localStorage.getItem("kds_device_id");
  if (!id) {
    id = "kds-" + Math.random().toString(36).substring(2, 10) + "-" + Math.random().toString(36).substring(2, 10);
    localStorage.setItem("kds_device_id", id);
  }
  return id;
}

export function useKdsWebSocket(
  storeId: string | undefined,
  queryClient: QueryClient,
  onNewOrder?: (orderNumber: string) => void,
  onConfigPush?: (safeConfig: Record<string, unknown>) => void,
  onPing?: () => void,
) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const backoff = useRef(1000);
  const onNewOrderRef = useRef(onNewOrder);
  onNewOrderRef.current = onNewOrder;
  const onConfigPushRef = useRef(onConfigPush);
  onConfigPushRef.current = onConfigPush;
  const onPingRef = useRef(onPing);
  onPingRef.current = onPing;

  useEffect(() => {
    if (!storeId) return;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        backoff.current = 1000;
        const deviceId = getKdsDeviceId();
        ws.current?.send(JSON.stringify({ type: "register", payload: { deviceId } }));
        toast.success("Connected to LineOps KDS", { id: "ws-status", duration: 2000 });
      };

      ws.current.onmessage = (event) => {
        try {
          const data: WebSocketEvent = JSON.parse(event.data);
          
          if (data.payload?.storeId && data.payload.storeId !== storeId) return;

          switch (data.type) {
            case "order_created":
              onNewOrderRef.current?.(data.payload.orderNumber ?? "");
              queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey({ storeId }) });
              queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({ storeId }) });
              queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey({ storeId }) });
              queryClient.invalidateQueries({ queryKey: getGetStationLoadQueryKey({ storeId }) });
              break;
            case "order_updated":
            case "order_bumped":
            case "item_status_updated":
            case "orders_cleared":
              queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey({ storeId }) });
              queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({ storeId }) });
              queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey({ storeId }) });
              queryClient.invalidateQueries({ queryKey: getGetStationLoadQueryKey({ storeId }) });
              break;
            case "kds_config_push": {
              const incoming = data.payload.config as Record<string, unknown> | undefined;
              if (incoming && onConfigPushRef.current) {
                onConfigPushRef.current(stripMachineLocal(incoming));
              }
              break;
            }
            case "kds_ping":
              onPingRef.current?.();
              break;
          }
        } catch (err) {
          console.error("Failed to parse WS message", err);
        }
      };

      ws.current.onclose = () => {
        toast.error("Disconnected from LineOps KDS. Reconnecting…", { id: "ws-status", duration: Infinity });
        reconnectTimeout.current = setTimeout(() => {
          backoff.current = Math.min(backoff.current * 2, 30000);
          connect();
        }, backoff.current);
      };

      ws.current.onerror = () => {
        ws.current?.close();
      };
    }

    connect();

    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (ws.current) {
        ws.current.onclose = null;
        ws.current.close();
      }
    };
  }, [storeId, queryClient]);
}
