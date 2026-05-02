import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListStores, useGetDashboardSummary, useGetStationLoad, useGetRecentActivity } from "@workspace/api-client-react";
import { useKdsWebSocket } from "@/hooks/use-kds-websocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Clock, Monitor, Package, TrendingUp, Plug, CheckCircle2, XCircle, Circle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

// ── Types ──────────────────────────────────────────────────────────────────

interface IntegrationEvent {
  id: string;
  storeId: string | null;
  source: string;
  eventType: string;
  externalId: string | null;
  payload: unknown;
  processed: boolean;
  orderId: string | null;
  error: string | null;
  createdAt: string;
}

// Exported so the WS hook can reference the same key prefix for invalidation
export const INTEGRATION_EVENTS_QUERY_KEY = "integration-events";

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5)    return "just now";
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const SOURCE_COLORS: Record<string, string> = {
  square:     "bg-blue-500/20 text-blue-400 border-blue-500/30",
  toast:      "bg-orange-500/20 text-orange-400 border-orange-500/30",
  clover:     "bg-green-500/20 text-green-400 border-green-500/30",
  lightspeed: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  volante:    "bg-purple-500/20 text-purple-400 border-purple-500/30",
  generic:    "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

function sourceBadgeClass(source: string): string {
  return SOURCE_COLORS[source.toLowerCase()] ?? SOURCE_COLORS["generic"]!;
}

function isErrorEvent(ev: IntegrationEvent): boolean {
  return !ev.processed || !!ev.error || ev.eventType.includes("error");
}

// ── Component ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState<string>("");
  const [tick, setTick] = useState(0);

  const { data: stores } = useListStores();

  useEffect(() => {
    if (stores && stores.length > 0 && !storeId) {
      setStoreId(stores[0].id);
    }
  }, [stores, storeId]);

  // Re-render relative timestamps every 30 s
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  void tick; // prevent lint warning

  // Invalidate the integration feed whenever a new order arrives via WS
  const onNewOrder = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [INTEGRATION_EVENTS_QUERY_KEY] });
  }, [queryClient]);

  useKdsWebSocket(storeId, queryClient, onNewOrder);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: summary } = useGetDashboardSummary({ storeId }, { query: { enabled: !!storeId } as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stationLoads } = useGetStationLoad({ storeId }, { query: { enabled: !!storeId } as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activity } = useGetRecentActivity({ storeId, limit: 50 }, { query: { enabled: !!storeId } as any });

  const { data: integrationEvents, dataUpdatedAt } = useQuery({
    queryKey: [INTEGRATION_EVENTS_QUERY_KEY, storeId],
    queryFn: async () => {
      const qs = storeId ? `?storeId=${storeId}&limit=60` : "?limit=60";
      const res = await fetch(`/api/integrations/events${qs}`);
      if (!res.ok) throw new Error("Failed to load integration events");
      const data = (await res.json()) as { events: IntegrationEvent[] };
      return data.events;
    },
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : null;

  return (
    <div className="p-8 flex flex-col h-full gap-8 overflow-y-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary uppercase">Manager Dashboard</h1>
      </div>

      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Active Orders</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{summary?.totalActive || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-primary font-bold">{summary?.totalPending || 0}</span> pending,{" "}
              <span className="text-blue-400 font-bold">{summary?.totalInProgress || 0}</span> cooking
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Avg Ticket Time</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold font-mono">
              {summary
                ? `${Math.floor(summary.avgCompletionSeconds / 60)}m ${summary.avgCompletionSeconds % 60}s`
                : "0m 0s"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {summary?.totalCompletedToday || 0} completed orders today
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Rush Orders</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-destructive">{summary?.rushCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently active</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Online Devices</CardTitle>
            <Monitor className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-500">{summary?.onlineDevices || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Active KDS displays</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Station load + activity feed ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        <Card className="col-span-2 bg-card border-border flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg font-bold uppercase tracking-wider">Station Load</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            <div className="space-y-6">
              {stationLoads?.map(station => (
                <div key={station.stationId} className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-bold uppercase tracking-wider">
                    <span>{station.stationName}</span>
                    <span>{station.totalActive} Total</span>
                  </div>
                  <div className="h-4 w-full bg-muted rounded-sm overflow-hidden flex">
                    <div
                      className="h-full bg-amber-500 transition-all"
                      style={{ width: `${(station.pendingCount / Math.max(station.totalActive, 1)) * 100}%` }}
                    />
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${(station.inProgressCount / Math.max(station.totalActive, 1)) * 100}%` }}
                    />
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${(station.readyCount / Math.max(station.totalActive, 1)) * 100}%` }}
                    />
                  </div>
                  <div className="flex gap-4 text-xs font-bold text-muted-foreground">
                    <span className="text-amber-500">{station.pendingCount} Pending</span>
                    <span className="text-blue-500">{station.inProgressCount} Cooking</span>
                    <span className="text-green-500">{station.readyCount} Ready</span>
                  </div>
                </div>
              ))}
              {(!stationLoads || stationLoads.length === 0) && (
                <div className="text-center text-muted-foreground py-8 text-sm uppercase tracking-wider font-bold">
                  No active station data
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border flex flex-col h-[500px] lg:h-auto">
          <CardHeader>
            <CardTitle className="text-lg font-bold uppercase tracking-wider">Activity Feed</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-full px-6 pb-6">
              <div className="space-y-4">
                {activity?.map(event => (
                  <div key={event.id} className="flex gap-4 items-start pb-4 border-b border-border/50 last:border-0 last:pb-0">
                    <div className="mt-0.5 p-1.5 rounded-sm bg-muted text-muted-foreground">
                      <Package className="h-4 w-4" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-medium leading-none">{event.message}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{new Date(event.timestamp).toLocaleTimeString()}</span>
                        {event.orderNumber && (
                          <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider rounded-sm">
                            #{event.orderNumber}
                          </Badge>
                        )}
                        {event.stationName && (
                          <span className="font-bold uppercase tracking-wider text-[10px]">{event.stationName}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {(!activity || activity.length === 0) && (
                  <div className="text-center text-muted-foreground py-8 text-sm uppercase tracking-wider font-bold">
                    No recent activity
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* ── POS Integration Feed ──────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-bold uppercase tracking-wider">POS Integration Feed</CardTitle>
            {integrationEvents && integrationEvents.length > 0 && (
              <Badge variant="outline" className="text-[10px] font-bold tracking-wider rounded-sm">
                {integrationEvents.length} events
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Circle className="h-2 w-2 fill-green-500 text-green-500 animate-pulse" />
            <span className="font-bold uppercase tracking-wider text-[11px]">Live</span>
            {lastUpdated && (
              <span className="text-[11px] font-mono opacity-60">· {lastUpdated}</span>
            )}
            <Plug className="h-3.5 w-3.5 ml-1" />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="h-72">
            {(!integrationEvents || integrationEvents.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-72 gap-3 text-muted-foreground">
                <Plug className="h-8 w-8 opacity-30" />
                <p className="text-sm font-bold uppercase tracking-wider">No integration events yet</p>
                <p className="text-xs opacity-60">Incoming POS webhooks will appear here in real time</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {integrationEvents.map(ev => {
                  const hasError = isErrorEvent(ev);
                  return (
                    <div
                      key={ev.id}
                      className={`flex items-start gap-4 px-6 py-3 hover:bg-muted/30 transition-colors ${
                        hasError ? "bg-destructive/5" : ""
                      }`}
                    >
                      {/* Status icon */}
                      <div className="mt-0.5 shrink-0">
                        {hasError ? (
                          <XCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                      </div>

                      {/* Source badge */}
                      <div className="shrink-0 mt-0.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider border ${sourceBadgeClass(ev.source)}`}
                        >
                          {ev.source}
                        </span>
                      </div>

                      {/* Event details */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                            {ev.eventType}
                          </span>
                          {ev.externalId && (
                            <Badge variant="outline" className="text-[10px] font-bold tracking-wider rounded-sm font-mono">
                              POS #{ev.externalId}
                            </Badge>
                          )}
                          {ev.orderId && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              → <span className="text-foreground/70">{ev.orderId.slice(0, 8)}&hellip;</span>
                            </span>
                          )}
                        </div>
                        {ev.error && (
                          <p className="text-xs text-destructive font-mono truncate" title={ev.error}>
                            {ev.error}
                          </p>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="shrink-0 text-[11px] text-muted-foreground font-mono whitespace-nowrap mt-0.5">
                        {relativeTime(ev.createdAt)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
