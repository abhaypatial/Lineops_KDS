import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListOrders, useBumpOrder, useListStores } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function OrdersPage() {
  const [storeId, setStoreId] = useState<string>("");
  const { data: stores } = useListStores();
  
  useEffect(() => {
    if (stores && stores.length > 0 && !storeId) {
      setStoreId(stores[0].id);
    }
  }, [stores, storeId]);

  const { data: orders } = useListOrders({ storeId }, { query: { enabled: !!storeId } });
  const bumpOrder = useBumpOrder();
  const queryClient = useQueryClient();

  const handleBump = (id: string) => {
    bumpOrder.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/orders"] })
    });
  };

  return (
    <div className="p-8 flex flex-col h-full gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-primary uppercase">Order History</h1>
      </div>

      <div className="border border-border rounded-md overflow-hidden bg-card flex-1">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="w-[100px] uppercase font-bold text-xs tracking-wider">Order #</TableHead>
              <TableHead className="uppercase font-bold text-xs tracking-wider">Status</TableHead>
              <TableHead className="uppercase font-bold text-xs tracking-wider">Priority</TableHead>
              <TableHead className="uppercase font-bold text-xs tracking-wider">Items</TableHead>
              <TableHead className="uppercase font-bold text-xs tracking-wider">Elapsed</TableHead>
              <TableHead className="text-right uppercase font-bold text-xs tracking-wider">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders?.map(order => (
              <TableRow key={order.id}>
                <TableCell className="font-mono font-bold">{order.orderNumber}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="uppercase font-bold tracking-wider text-xs">
                    {order.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  {order.priority === 'rush' && <Badge variant="destructive" className="uppercase font-bold text-[10px]">Rush</Badge>}
                  {order.priority === 'vip' && <Badge className="bg-yellow-500 text-black uppercase font-bold text-[10px]">VIP</Badge>}
                  {order.priority === 'normal' && <span className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Normal</span>}
                </TableCell>
                <TableCell className="max-w-[300px] truncate text-sm">
                  {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                </TableCell>
                <TableCell className="font-mono">{order.elapsedSeconds}s</TableCell>
                <TableCell className="text-right">
                  {order.status === 'in_progress' && (
                    <Button size="sm" variant="default" onClick={() => handleBump(order.id)} className="font-bold uppercase tracking-wider text-xs">
                      Bump
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
