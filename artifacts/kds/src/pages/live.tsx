import { useState, useEffect, useRef, useCallback } from "react";
import { useListStores } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Activity, Trash2, FlaskConical, ChevronDown, ChevronRight, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveEvent {
  id:        string;
  timestamp: Date;
  type:      string;
  payload:   unknown;
  source:    "websocket" | "injected";
  expanded:  boolean;
}

const EVENT_COLOURS: Record<string, string> = {
  order_created:       "text-green-400 border-green-500/30 bg-green-500/10",
  order_bumped:        "text-blue-400 border-blue-500/30 bg-blue-500/10",
  order_updated:       "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
  item_status_updated: "text-orange-400 border-orange-500/30 bg-orange-500/10",
  connected:           "text-muted-foreground border-border bg-muted/30",
};

function eventColour(type: string) {
  return EVENT_COLOURS[type] ?? "text-muted-foreground border-border bg-muted/20";
}

export default function LiveMonitorPage() {
  const { data: stores } = useListStores();
  const [storeId, setStoreId] = useState<string>("");
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [injecting, setInjecting] = useState(false);
  const [injectResult, setInjectResult] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const backoff = useRef(1000);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stores && stores.length > 0 && !storeId) {
      setStoreId(stores[0].id);
    }
  }, [stores, storeId]);

  const pushEvent = useCallback((type: string, payload: unknown, source: LiveEvent["source"] = "websocket") => {
    setEvents(prev => [
      ...prev.slice(-199),
      { id: crypto.randomUUID(), timestamp: new Date(), type, payload, source, expanded: false },
    ]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  useEffect(() => {
    if (!storeId) return;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/ws`;
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        setConnected(true);
        backoff.current = 1000;
        pushEvent("connected", { message: "WebSocket connected — listening for live events" });
      };

      ws.current.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.payload?.storeId && data.payload.storeId !== storeId) return;
          pushEvent(data.type, data.payload);
        } catch { /* ignore */ }
      };

      ws.current.onclose = () => {
        setConnected(false);
        reconnectRef.current = setTimeout(() => {
          backoff.current = Math.min(backoff.current * 2, 30000);
          connect();
        }, backoff.current);
      };

      ws.current.onerror = () => { ws.current?.close(); };
    }

    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (ws.current) { ws.current.onclose = null; ws.current.close(); }
    };
  }, [storeId, pushEvent]);

  async function injectOrder() {
    if (!storeId || injecting) return;
    setInjecting(true);
    setInjectResult(null);
    try {
      const res = await fetch(`/api/test/inject-order?storeId=${storeId}`, { method: "POST" });
      const json = await res.json() as { ok: boolean; order?: { orderNumber: string; priority: string } };
      if (res.ok && json.ok) {
        pushEvent("injected", { orderNumber: json.order?.orderNumber, priority: json.order?.priority }, "injected");
        setInjectResult(`✓ Order #${json.order?.orderNumber} injected`);
      } else {
        setInjectResult("✗ Injection failed");
      }
    } catch {
      setInjectResult("✗ Network error");
    } finally {
      setInjecting(false);
      setTimeout(() => setInjectResult(null), 3000);
    }
  }

  function toggleExpand(id: string) {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, expanded: !e.expanded } : e));
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-8 pt-8 pb-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary uppercase flex items-center gap-3">
              <Activity className="h-7 w-7" />
              Live Event Monitor
            </h1>
            <p className="text-sm text-muted-foreground mt-1 font-mono">
              Real-time WebSocket feed — all order events as they happen
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={cn("flex items-center gap-2 text-sm font-mono px-3 py-2 rounded border",
              connected
                ? "text-green-400 border-green-500/30 bg-green-500/10"
                : "text-red-400 border-red-500/30 bg-red-500/10"
            )}>
              {connected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
              {connected ? "Connected" : "Reconnecting…"}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEvents([])}
              className="font-mono gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
            <Button
              size="sm"
              onClick={injectOrder}
              disabled={injecting || !storeId}
              className="font-mono gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <FlaskConical className="h-4 w-4" />
              {injecting ? "Injecting…" : "Inject Test Order"}
            </Button>
            {injectResult && (
              <span className={cn("text-sm font-mono",
                injectResult.startsWith("✓") ? "text-green-400" : "text-red-400"
              )}>
                {injectResult}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {events.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground font-mono flex-col gap-3">
            <Activity className="h-12 w-12 opacity-30" />
            <p className="text-sm">No events yet — fire an order from your POS or inject a test order above</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-2 font-mono">
              {events.map((ev) => (
                <Card
                  key={ev.id}
                  className={cn("border px-4 py-3 cursor-pointer transition-all", eventColour(ev.type))}
                  onClick={() => toggleExpand(ev.id)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {ev.expanded
                        ? <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                        : <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />}
                      <Badge variant="outline" className={cn("text-xs font-mono border rounded-sm px-2 py-0.5 uppercase tracking-wider shrink-0", eventColour(ev.type))}>
                        {ev.type}
                      </Badge>
                      {ev.source === "injected" && (
                        <Badge variant="outline" className="text-xs border border-purple-500/30 bg-purple-500/10 text-purple-400 rounded-sm">
                          TEST
                        </Badge>
                      )}
                      <span className="text-xs opacity-60 truncate">
                        {typeof ev.payload === "object" && ev.payload !== null
                          ? Object.entries(ev.payload as Record<string, unknown>)
                              .filter(([k]) => ["orderNumber","orderId","storeId","message"].includes(k))
                              .map(([k, v]) => `${k}=${String(v)}`)
                              .join("  ")
                          : ""}
                      </span>
                    </div>
                    <span className="text-xs opacity-50 shrink-0 tabular-nums">
                      {ev.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  {ev.expanded && (
                    <pre className="mt-3 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap opacity-80 border-t border-current/10 pt-3">
                      {JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  )}
                </Card>
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        )}
      </div>

      <div className="h-10 border-t border-border bg-card flex items-center px-6 gap-4 text-xs text-muted-foreground font-mono shrink-0">
        <span>{events.length} events</span>
        <span>·</span>
        <span>Click any event to expand raw JSON</span>
        <span>·</span>
        <span>Last 200 events kept in memory</span>
      </div>
    </div>
  );
}
