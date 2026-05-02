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

export function useKdsWebSocket(storeId: string | undefined, queryClient: QueryClient) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const backoff = useRef(1000);

  useEffect(() => {
    if (!storeId) return;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log("KDS WebSocket connected");
        backoff.current = 1000;
        toast.success("Connected to LineOps KDS", { id: "ws-status", duration: 2000 });
      };

      ws.current.onmessage = (event) => {
        try {
          const data: WebSocketEvent = JSON.parse(event.data);
          
          if (data.payload?.storeId && data.payload.storeId !== storeId) return;

          switch (data.type) {
            case "order_created":
            case "order_updated":
            case "order_bumped":
            case "item_status_updated":
              // Invalidate relevant queries
              queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey({ storeId }) });
              queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey({ storeId }) });
              queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey({ storeId }) });
              queryClient.invalidateQueries({ queryKey: getGetStationLoadQueryKey({ storeId }) });
              break;
          }
        } catch (err) {
          console.error("Failed to parse WS message", err);
        }
      };

      ws.current.onclose = () => {
        console.log("KDS WebSocket disconnected");
        toast.error("Disconnected from LineOps KDS. Reconnecting...", { id: "ws-status", duration: Infinity });
        
        // Exponential backoff
        reconnectTimeout.current = setTimeout(() => {
          backoff.current = Math.min(backoff.current * 2, 30000);
          connect();
        }, backoff.current);
      };

      ws.current.onerror = (error) => {
        console.error("KDS WebSocket error", error);
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
