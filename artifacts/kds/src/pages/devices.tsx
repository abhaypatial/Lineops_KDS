import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListStores, useListDevices } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, Wifi, WifiOff, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function DevicesPage() {
  const [storeId, setStoreId] = useState<string>("");
  const { data: stores } = useListStores();
  
  useEffect(() => {
    if (stores && stores.length > 0 && !storeId) {
      setStoreId(stores[0].id);
    }
  }, [stores, storeId]);

  const { data: devices } = useListDevices({ storeId }, { query: { enabled: !!storeId } });

  return (
    <div className="p-8 flex flex-col h-full gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-primary uppercase">Device Management</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {devices?.map(device => (
          <Card key={device.id} className="bg-card border-border flex flex-col">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-xl font-bold uppercase tracking-wider flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-muted-foreground" />
                  {device.name}
                </CardTitle>
                <div className="text-xs text-muted-foreground font-mono">
                  {device.id.substring(0, 8)}...
                </div>
              </div>
              {device.status === 'online' ? (
                <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20 font-bold uppercase tracking-wider">
                  <Wifi className="h-3 w-3 mr-1" /> Online
                </Badge>
              ) : device.status === 'idle' ? (
                <Badge variant="outline" className="text-amber-500 border-amber-500/20 font-bold uppercase tracking-wider">
                  <Clock className="h-3 w-3 mr-1" /> Idle
                </Badge>
              ) : (
                <Badge variant="destructive" className="font-bold uppercase tracking-wider">
                  <WifiOff className="h-3 w-3 mr-1" /> Offline
                </Badge>
              )}
            </CardHeader>
            <CardContent className="flex-1 pt-4 flex flex-col gap-4">
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Assigned Stations</div>
                <div className="flex flex-wrap gap-2">
                  {device.stationIds.length > 0 ? (
                    device.stationIds.map(id => (
                      <Badge key={id} variant="secondary" className="font-mono text-xs rounded-sm">
                        {id.substring(0, 8)}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground italic">None (Shows All)</span>
                  )}
                </div>
              </div>
              <div className="mt-auto pt-4 border-t border-border/50 text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> 
                Last seen {device.lastSeenAt ? formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true }) : 'never'}
              </div>
            </CardContent>
          </Card>
        ))}

        {(!devices || devices.length === 0) && (
          <div className="col-span-full text-center py-12 text-muted-foreground font-bold uppercase tracking-wider">
            No devices registered for this store.
          </div>
        )}
      </div>
    </div>
  );
}
