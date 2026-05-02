import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListStores, useGetDashboardSummary, useGetStationLoad, useGetRecentActivity } from "@workspace/api-client-react";
import { useKdsWebSocket } from "@/hooks/use-kds-websocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Clock, Monitor, Package, TrendingUp } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState<string>("");
  const { data: stores } = useListStores();
  
  useEffect(() => {
    if (stores && stores.length > 0 && !storeId) {
      setStoreId(stores[0].id);
    }
  }, [stores, storeId]);

  useKdsWebSocket(storeId, queryClient);

  const { data: summary } = useGetDashboardSummary({ storeId }, { query: { enabled: !!storeId } });
  const { data: stationLoads } = useGetStationLoad({ storeId }, { query: { enabled: !!storeId } });
  const { data: activity } = useGetRecentActivity({ storeId, limit: 50 }, { query: { enabled: !!storeId } });

  return (
    <div className="p-8 flex flex-col h-full gap-8 overflow-y-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary uppercase">Manager Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Active Orders</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{summary?.totalActive || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-primary font-bold">{summary?.totalPending || 0}</span> pending, <span className="text-blue-400 font-bold">{summary?.totalInProgress || 0}</span> cooking
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
              {summary ? `${Math.floor(summary.avgCompletionSeconds / 60)}m ${summary.avgCompletionSeconds % 60}s` : "0m 0s"}
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
                      className="h-full bg-amber-500" 
                      style={{ width: `\${(station.pendingCount / Math.max(station.totalActive, 1)) * 100}%` }}
                    />
                    <div 
                      className="h-full bg-blue-500" 
                      style={{ width: `\${(station.inProgressCount / Math.max(station.totalActive, 1)) * 100}%` }}
                    />
                    <div 
                      className="h-full bg-green-500" 
                      style={{ width: `\${(station.readyCount / Math.max(station.totalActive, 1)) * 100}%` }}
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
                        {event.orderNumber && <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider rounded-sm">#{event.orderNumber}</Badge>}
                        {event.stationName && <span className="font-bold uppercase tracking-wider text-[10px]">{event.stationName}</span>}
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
    </div>
  );
}
