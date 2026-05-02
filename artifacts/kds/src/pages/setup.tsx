import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListEnterprises, useCreateEnterprise,
  useListStores, useCreateStore,
  useListStations, useCreateStation,
  useListDevices, useCreateDevice
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function SetupPage() {
  const queryClient = useQueryClient();
  
  const { data: enterprises } = useListEnterprises();
  const { data: stores } = useListStores();
  const { data: stations } = useListStations();
  const { data: devices } = useListDevices();

  const createEnterprise = useCreateEnterprise();
  const createStore = useCreateStore();
  const createStation = useCreateStation();
  const createDevice = useCreateDevice();

  const [entName, setEntName] = useState("");
  const [entSlug, setEntSlug] = useState("");

  const [storeEntId, setStoreEntId] = useState("");
  const [storeName, setStoreName] = useState("");

  const [stationStoreId, setStationStoreId] = useState("");
  const [stationName, setStationName] = useState("");

  const [devStoreId, setDevStoreId] = useState("");
  const [devName, setDevName] = useState("");

  const handleCreateEnterprise = (e: React.FormEvent) => {
    e.preventDefault();
    createEnterprise.mutate(
      { data: { name: entName, slug: entSlug } },
      { 
        onSuccess: () => {
          toast.success("Enterprise created");
          setEntName("");
          setEntSlug("");
          queryClient.invalidateQueries({ queryKey: ["/api/enterprises"] });
        }
      }
    );
  };

  const handleCreateStore = (e: React.FormEvent) => {
    e.preventDefault();
    createStore.mutate(
      { data: { name: storeName, enterpriseId: storeEntId } },
      { 
        onSuccess: () => {
          toast.success("Store created");
          setStoreName("");
          queryClient.invalidateQueries({ queryKey: ["/api/stores"] });
        }
      }
    );
  };

  const handleCreateStation = (e: React.FormEvent) => {
    e.preventDefault();
    createStation.mutate(
      { data: { name: stationName, storeId: stationStoreId, sortOrder: 0 } },
      { 
        onSuccess: () => {
          toast.success("Station created");
          setStationName("");
          queryClient.invalidateQueries({ queryKey: ["/api/stations"] });
        }
      }
    );
  };

  const handleCreateDevice = (e: React.FormEvent) => {
    e.preventDefault();
    createDevice.mutate(
      { data: { name: devName, storeId: devStoreId, stationIds: [] } },
      { 
        onSuccess: () => {
          toast.success("Device created");
          setDevName("");
          queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
        }
      }
    );
  };

  return (
    <div className="p-8 flex flex-col h-full gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-primary uppercase">System Setup</h1>
      </div>

      <Tabs defaultValue="enterprises" className="w-full max-w-4xl">
        <TabsList className="grid w-full grid-cols-4 mb-8 bg-muted rounded-md p-1">
          <TabsTrigger value="enterprises" className="font-bold uppercase tracking-wider text-xs">Enterprises</TabsTrigger>
          <TabsTrigger value="stores" className="font-bold uppercase tracking-wider text-xs">Stores</TabsTrigger>
          <TabsTrigger value="stations" className="font-bold uppercase tracking-wider text-xs">Stations</TabsTrigger>
          <TabsTrigger value="devices" className="font-bold uppercase tracking-wider text-xs">Devices</TabsTrigger>
        </TabsList>
        
        <TabsContent value="enterprises" className="space-y-6 mt-0">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-bold uppercase tracking-wider">New Enterprise</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateEnterprise} className="flex gap-4 items-end">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="ent-name" className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Name</Label>
                  <Input id="ent-name" value={entName} onChange={e => setEntName(e.target.value)} required />
                </div>
                <div className="space-y-2 flex-1">
                  <Label htmlFor="ent-slug" className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Slug</Label>
                  <Input id="ent-slug" value={entSlug} onChange={e => setEntSlug(e.target.value)} required />
                </div>
                <Button type="submit" disabled={createEnterprise.isPending} className="font-bold uppercase tracking-wider text-xs">
                  Create
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {enterprises?.map(ent => (
              <Card key={ent.id} className="bg-card border-border">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-lg">{ent.name}</div>
                    <div className="text-sm font-mono text-muted-foreground">{ent.slug}</div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">{ent.id}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="stores" className="space-y-6 mt-0">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-bold uppercase tracking-wider">New Store</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateStore} className="flex gap-4 items-end">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="store-ent" className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Enterprise ID</Label>
                  <Input id="store-ent" value={storeEntId} onChange={e => setStoreEntId(e.target.value)} required placeholder="Enter enterprise ID" />
                </div>
                <div className="space-y-2 flex-1">
                  <Label htmlFor="store-name" className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Name</Label>
                  <Input id="store-name" value={storeName} onChange={e => setStoreName(e.target.value)} required />
                </div>
                <Button type="submit" disabled={createStore.isPending} className="font-bold uppercase tracking-wider text-xs">
                  Create
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {stores?.map(store => (
              <Card key={store.id} className="bg-card border-border">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-lg">{store.name}</div>
                    <div className="text-sm font-mono text-muted-foreground">Enterprise: {store.enterpriseId}</div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">{store.id}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="stations" className="space-y-6 mt-0">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-bold uppercase tracking-wider">New Station</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateStation} className="flex gap-4 items-end">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="sta-store" className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Store ID</Label>
                  <Input id="sta-store" value={stationStoreId} onChange={e => setStationStoreId(e.target.value)} required />
                </div>
                <div className="space-y-2 flex-1">
                  <Label htmlFor="sta-name" className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Name</Label>
                  <Input id="sta-name" value={stationName} onChange={e => setStationName(e.target.value)} required />
                </div>
                <Button type="submit" disabled={createStation.isPending} className="font-bold uppercase tracking-wider text-xs">
                  Create
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {stations?.map(sta => (
              <Card key={sta.id} className="bg-card border-border">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-lg">{sta.name}</div>
                    <div className="text-sm font-mono text-muted-foreground">Store: {sta.storeId}</div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">{sta.id}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="devices" className="space-y-6 mt-0">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-bold uppercase tracking-wider">New Device</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateDevice} className="flex gap-4 items-end">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="dev-store" className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Store ID</Label>
                  <Input id="dev-store" value={devStoreId} onChange={e => setDevStoreId(e.target.value)} required />
                </div>
                <div className="space-y-2 flex-1">
                  <Label htmlFor="dev-name" className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Name</Label>
                  <Input id="dev-name" value={devName} onChange={e => setDevName(e.target.value)} required />
                </div>
                <Button type="submit" disabled={createDevice.isPending} className="font-bold uppercase tracking-wider text-xs">
                  Create
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {devices?.map(dev => (
              <Card key={dev.id} className="bg-card border-border">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-lg">{dev.name}</div>
                    <div className="text-sm font-mono text-muted-foreground">Store: {dev.storeId}</div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">{dev.id}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
