import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
        <TabsList className="grid w-full grid-cols-6 mb-8 bg-muted rounded-md p-1">
          <TabsTrigger value="enterprises" className="font-bold uppercase tracking-wider text-xs">Enterprises</TabsTrigger>
          <TabsTrigger value="stores" className="font-bold uppercase tracking-wider text-xs">Stores</TabsTrigger>
          <TabsTrigger value="stations" className="font-bold uppercase tracking-wider text-xs">Stations</TabsTrigger>
          <TabsTrigger value="devices" className="font-bold uppercase tracking-wider text-xs">Devices</TabsTrigger>
          <TabsTrigger value="appearance" className="font-bold uppercase tracking-wider text-xs">Appearance</TabsTrigger>
          <TabsTrigger value="production" className="font-bold uppercase tracking-wider text-xs">Production</TabsTrigger>
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

        <TabsContent value="appearance" className="space-y-6 mt-0">
          <AppearanceSettings />
        </TabsContent>

        <TabsContent value="production" className="space-y-6 mt-0">
          <ProductionSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Appearance Settings tab ───────────────────────────────────────────────────

const KDS_THEMES = [
  { id: "ink",   label: "Ink",   desc: "Pure black — max contrast, all kitchens",        bg: "#09090b", card: "#111116" },
  { id: "slate", label: "Slate", desc: "Dark grey-blue — commercial kitchen",             bg: "#0f1117", card: "#181c24" },
  { id: "amber", label: "Amber", desc: "Warm amber glow — casual dining, wood-fired",    bg: "#0d0a04", card: "#1a1408" },
  { id: "steel", label: "Steel", desc: "Industrial steel — bright-lit prep kitchens",    bg: "#0c0e12", card: "#141820" },
  { id: "ember", label: "Ember", desc: "Dark ember — steakhouse, grill stations",        bg: "#0e0906", card: "#1c1009" },
  { id: "chalk", label: "Chalk", desc: "Max legibility — outdoor, sunlit environments",  bg: "#000000", card: "#0d0d0d" },
] as const;

function AppearanceSettings() {
  const [kdsTheme, setKdsTheme] = useState<string>(() => {
    try { return (JSON.parse(localStorage.getItem("kds_cfg") ?? "{}") as { theme?: string }).theme ?? "ink"; }
    catch { return "ink"; }
  });

  const applyTheme = useCallback((theme: string) => {
    setKdsTheme(theme);
    try {
      const cfg = JSON.parse(localStorage.getItem("kds_cfg") ?? "{}") as Record<string, unknown>;
      localStorage.setItem("kds_cfg", JSON.stringify({ ...cfg, theme }));
      toast.success(`Theme set to ${KDS_THEMES.find(t => t.id === theme)?.label ?? theme}`);
    } catch {
      toast.error("Could not save theme");
    }
  }, []);

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-bold uppercase tracking-wider">KDS Display Theme</CardTitle>
          <CardDescription>
            Choose the colour scheme for all Kitchen Display screens. The change takes effect immediately on any open KDS display tab.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {KDS_THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => applyTheme(t.id)}
                className="flex flex-col items-start gap-1.5 rounded-xl border p-4 text-left transition-all hover:opacity-90"
                style={{
                  background: kdsTheme === t.id ? `${t.bg}` : "var(--muted)",
                  borderColor: kdsTheme === t.id ? "rgb(245 158 11 / 0.65)" : "var(--border)",
                  boxShadow: kdsTheme === t.id ? "0 0 0 2px rgb(245 158 11 / 0.25)" : "none",
                }}
              >
                <div className="flex items-center gap-2 w-full">
                  <div className="w-5 h-5 rounded-md border border-white/20 shrink-0" style={{ background: t.card }} />
                  <span className="font-bold text-sm flex-1" style={{ color: kdsTheme === t.id ? "#f59e0b" : undefined }}>
                    {t.label}
                  </span>
                  {kdsTheme === t.id && <span className="text-amber-400 text-xs font-black">✓</span>}
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{t.desc}</p>
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Theme is stored in the browser. To change it on a different KDS display device, visit <code className="font-mono bg-muted px-1 rounded">/setup</code> on that device and select a theme here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Production Settings tab ───────────────────────────────────────────────────

const POS_IDS = [
  { id: "square",     label: "Square" },
  { id: "toast",      label: "Toast POS" },
  { id: "clover",     label: "Clover" },
  { id: "lightspeed", label: "Lightspeed K" },
  { id: "volante",    label: "Volante VE POS" },
  { id: "generic",    label: "Custom / Generic" },
];

function ProductionSettings() {
  const { data: cfg, refetch } = useQuery<{
    testOrdersEnabled: boolean;
    hiddenIntegrations: string[];
    authEnabled: boolean;
  }>({
    queryKey: ["/api/config"],
    queryFn: () => fetch("/api/config").then(r => r.json()),
    staleTime: 30_000,
  });

  const [saving, setSaving] = useState(false);

  async function patchSettings(patch: Record<string, unknown>) {
    setSaving(true);
    try {
      await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await refetch();
      toast.success("Settings updated");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  const testEnabled = cfg?.testOrdersEnabled ?? true;
  const hidden      = cfg?.hiddenIntegrations ?? [];
  const authEnabled = cfg?.authEnabled ?? false;

  function toggleHidden(id: string) {
    const next = hidden.includes(id)
      ? hidden.filter(h => h !== id)
      : [...hidden, id];
    patchSettings({ hiddenIntegrations: next });
  }

  return (
    <div className="space-y-6">
      {/* Test orders */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-bold uppercase tracking-wider">Test Orders</CardTitle>
          <CardDescription>
            Controls the "Inject test order" button on the KDS display. Disable this on a live production system.
            <br />
            <span className="text-xs font-mono text-muted-foreground">
              Env var: <code>ALLOW_TEST_ORDERS</code> — runtime change resets on server restart.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm">
                {testEnabled ? "Enabled — test button visible on KDS display" : "Disabled — test button hidden"}
              </div>
            </div>
            <Button
              variant={testEnabled ? "destructive" : "default"}
              size="sm"
              disabled={saving}
              onClick={() => patchSettings({ testOrdersEnabled: !testEnabled })}
              className="font-bold uppercase tracking-wider text-xs"
            >
              {testEnabled ? "Disable" : "Enable"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hidden integrations */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-bold uppercase tracking-wider">Hidden Integrations</CardTitle>
          <CardDescription>
            Hide POS systems you don't use from the Integration Hub to reduce clutter.
            <br />
            <span className="text-xs font-mono text-muted-foreground">
              Env var: <code>HIDDEN_INTEGRATIONS</code> — runtime change resets on server restart.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {POS_IDS.map(p => (
              <label key={p.id} className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hidden.includes(p.id)}
                  disabled={saving}
                  onChange={() => toggleHidden(p.id)}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm font-medium">{p.label}</span>
                {hidden.includes(p.id) && (
                  <Badge variant="secondary" className="text-[10px]">hidden</Badge>
                )}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg font-bold uppercase tracking-wider">Admin Password</CardTitle>
          <CardDescription>
            Protects all management pages and API endpoints. The KDS display and POS webhooks remain public.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border text-sm">
            <div className={`w-2 h-2 rounded-full ${authEnabled ? "bg-green-500" : "bg-yellow-500"}`} />
            <span>
              {authEnabled
                ? "Password protection is active."
                : "No password set — management pages are open. Set ADMIN_PASSWORD in your .env file to enable protection."}
            </span>
          </div>

          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground">To change the password:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Edit <code className="font-mono bg-muted px-1 rounded text-xs">.env</code> and set <code className="font-mono bg-muted px-1 rounded text-xs">ADMIN_PASSWORD=your-new-password</code></li>
              <li>Run <code className="font-mono bg-muted px-1 rounded text-xs">kds restart</code> for the change to take effect.</li>
              <li>Log in again at <code className="font-mono bg-muted px-1 rounded text-xs">/login</code> with the new password.</li>
            </ol>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="font-bold uppercase tracking-wider text-xs"
            onClick={() => {
              localStorage.removeItem("kds_admin_password");
              window.location.href = "/login";
            }}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
