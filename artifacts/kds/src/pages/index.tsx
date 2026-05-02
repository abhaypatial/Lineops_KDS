import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListOrders, useListStations, useBumpOrder, useListStores } from "@workspace/api-client-react";
import { useKdsWebSocket } from "@/hooks/use-kds-websocket";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

function formatElapsedTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function KdsDisplay() {
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState<string>("");
  const [selectedStationId, setSelectedStationId] = useState<string>("all");
  const [focusedIndex, setFocusedIndex] = useState(0);

  const { data: stores } = useListStores();
  
  useEffect(() => {
    if (stores && stores.length > 0 && !storeId) {
      setStoreId(stores[0].id);
    }
  }, [stores, storeId]);

  useKdsWebSocket(storeId, queryClient);

  const { data: stations } = useListStations({ storeId }, { query: { enabled: !!storeId } });
  const { data: orders } = useListOrders(
    { storeId, status: "in_progress" }, 
    { 
      query: { 
        enabled: !!storeId, 
        refetchInterval: 10000 
      } 
    }
  );

  const bumpOrder = useBumpOrder();

  const filteredOrders = orders?.filter(o => {
    if (selectedStationId === "all") return true;
    return o.items.some(i => i.stationId === selectedStationId);
  }) || [];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filteredOrders.length === 0) return;

      if (e.key === "ArrowRight") {
        setFocusedIndex(prev => Math.min(prev + 1, filteredOrders.length - 1));
      } else if (e.key === "ArrowLeft") {
        setFocusedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        const orderToBump = filteredOrders[focusedIndex];
        if (orderToBump) {
          bumpOrder.mutate(
            { id: orderToBump.id },
            {
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
                setFocusedIndex(prev => Math.max(0, prev - 1));
              }
            }
          );
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredOrders, focusedIndex, bumpOrder, queryClient]);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="h-16 border-b border-border flex items-center px-6 justify-between bg-card shrink-0">
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setSelectedStationId("all")}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-bold uppercase tracking-wider transition-colors",
              selectedStationId === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            All Stations
          </button>
          {stations?.map(station => (
            <button
              key={station.id}
              onClick={() => setSelectedStationId(station.id)}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-bold uppercase tracking-wider transition-colors whitespace-nowrap",
                selectedStationId === station.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {station.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 text-muted-foreground text-sm uppercase tracking-widest font-bold">
          <span>{filteredOrders.length} Active</span>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filteredOrders.map((order, idx) => (
            <OrderCard 
              key={order.id} 
              order={order} 
              isFocused={idx === focusedIndex} 
            />
          ))}
        </div>
      </ScrollArea>

      <div className="h-12 border-t border-border bg-card flex items-center px-6 gap-6 text-xs text-muted-foreground font-mono shrink-0">
        <div className="flex items-center gap-2"><kbd className="bg-muted px-2 py-1 rounded border border-border font-sans">◀</kbd><kbd className="bg-muted px-2 py-1 rounded border border-border font-sans">▶</kbd> Navigate</div>
        <div className="flex items-center gap-2"><kbd className="bg-muted px-2 py-1 rounded border border-border font-sans">SPACE</kbd> Bump Order</div>
        <div className="flex items-center gap-2"><kbd className="bg-muted px-2 py-1 rounded border border-border font-sans">R</kbd> Recall</div>
      </div>
    </div>
  );
}

function OrderCard({ order, isFocused }: { order: any, isFocused: boolean }) {
  const isRush = order.priority === "rush";
  const isVip = order.priority === "vip";
  
  const [elapsed, setElapsed] = useState(order.elapsedSeconds || 0);
  
  useEffect(() => {
    const timer = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Time formatting based on threshold (yellow > 10m, red > 15m)
  const isLate = elapsed > 900;
  const isWarning = elapsed > 600;

  return (
    <Card className={cn(
      "border-2 transition-all duration-200 overflow-hidden",
      isFocused ? "border-primary ring-4 ring-primary/20 scale-[1.02]" : "border-border",
      isRush && !isFocused && "border-destructive",
      isVip && !isFocused && "border-yellow-500"
    )}>
      <CardHeader className={cn(
        "p-4 border-b flex flex-row items-center justify-between space-y-0",
        isRush ? "bg-destructive/10 border-destructive/20" :
        isVip ? "bg-yellow-500/10 border-yellow-500/20" :
        "bg-muted/50"
      )}>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold">#{order.orderNumber}</span>
          {isRush && <Badge variant="destructive" className="uppercase font-bold tracking-wider rounded-sm">Rush</Badge>}
          {isVip && <Badge className="bg-yellow-500 hover:bg-yellow-600 uppercase font-bold tracking-wider text-black rounded-sm">VIP</Badge>}
        </div>
        <div className={cn(
          "text-xl font-bold tabular-nums font-mono px-3 py-1 rounded",
          isLate ? "bg-destructive text-destructive-foreground" :
          isWarning ? "bg-yellow-500 text-black" :
          "bg-background text-foreground border border-border"
        )}>
          {formatElapsedTime(elapsed)}
        </div>
      </CardHeader>
      <CardContent className="p-0 flex flex-col h-full bg-card">
        {order.customerName && (
          <div className="px-4 py-2 border-b border-border/50 text-sm text-muted-foreground uppercase tracking-wider font-bold">
            {order.customerName}
          </div>
        )}
        <div className="p-4 flex-1 flex flex-col gap-3">
          {order.items.map((item: any) => (
            <div key={item.id} className="flex flex-col">
              <div className="flex items-start justify-between">
                <span className="font-bold text-lg leading-tight">
                  <span className="text-primary mr-2">{item.quantity}x</span>
                  {item.name}
                </span>
              </div>
              {item.modifiers && item.modifiers.length > 0 && (
                <div className="mt-1 pl-6 flex flex-col gap-1">
                  {item.modifiers.map((mod: string, idx: number) => (
                    <span key={idx} className="text-muted-foreground text-sm flex items-center before:content-['+'] before:mr-2 before:text-muted-foreground/50">{mod}</span>
                  ))}
                </div>
              )}
              {item.notes && (
                <div className="mt-2 pl-6 text-yellow-500 text-sm font-medium">
                  Note: {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>
        {order.notes && (
          <div className="p-3 bg-yellow-500/10 border-t border-yellow-500/20 text-yellow-500 text-sm font-medium">
            Order Note: {order.notes}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
