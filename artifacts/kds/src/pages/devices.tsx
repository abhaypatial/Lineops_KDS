import { useState, useEffect, useCallback } from "react";
import { useListStores, useListDevices } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Monitor, Wifi, WifiOff, Clock, Send, ChevronDown, CheckCircle2, AlertCircle, Radio, ChevronUp, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface KdsTemplate {
  id: string;
  name: string;
  isActive: boolean;
}

interface PushResult {
  deviceId: string;
  status: "success" | "offline" | "error";
}

interface HealthEvent {
  id: string;
  deviceId: string;
  eventType: "online" | "offline" | "ping_reached" | "ping_timeout";
  latencyMs: number | null;
  createdAt: string;
}

const HEALTH_EVENT_META: Record<HealthEvent["eventType"], { label: string; color: string; dot: string }> = {
  online:        { label: "Online",        color: "#4ade80", dot: "#22c55e" },
  offline:       { label: "Offline",       color: "#f87171", dot: "#ef4444" },
  ping_reached:  { label: "Ping OK",       color: "#60a5fa", dot: "#3b82f6" },
  ping_timeout:  { label: "Ping Timeout",  color: "#fbbf24", dot: "#f59e0b" },
};

export default function DevicesPage() {
  const [storeId, setStoreId] = useState<string>("");
  const [templates, setTemplates] = useState<KdsTemplate[]>([]);
  const [pushResults, setPushResults] = useState<Record<string, PushResult>>({});
  const [pushing, setPushing] = useState<string | null>(null);
  const [pinging, setPinging] = useState<Record<string, boolean>>({});
  const [pingResults, setPingResults] = useState<Record<string, "reached" | "offline">>({});
  const [healthExpanded, setHealthExpanded] = useState<Record<string, boolean>>({});
  const [healthData, setHealthData] = useState<Record<string, HealthEvent[]>>({});
  const [healthLoading, setHealthLoading] = useState<Record<string, boolean>>({});

  const { data: stores } = useListStores();

  useEffect(() => {
    if (stores && stores.length > 0 && !storeId) {
      setStoreId(stores[0].id);
    }
  }, [stores, storeId]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: devices } = useListDevices({ storeId }, { query: { enabled: !!storeId } as any });

  useEffect(() => {
    fetch("/api/kds/templates")
      .then((r) => r.json())
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const fetchHealth = useCallback(async (deviceId: string) => {
    setHealthLoading((p) => ({ ...p, [deviceId]: true }));
    try {
      const res = await fetch(`/api/devices/${deviceId}/health?limit=20`);
      const data = await res.json() as HealthEvent[];
      setHealthData((p) => ({ ...p, [deviceId]: Array.isArray(data) ? data : [] }));
    } catch {
      setHealthData((p) => ({ ...p, [deviceId]: [] }));
    } finally {
      setHealthLoading((p) => ({ ...p, [deviceId]: false }));
    }
  }, []);

  function toggleHealth(deviceId: string) {
    const next = !healthExpanded[deviceId];
    setHealthExpanded((p) => ({ ...p, [deviceId]: next }));
    if (next && !healthData[deviceId]) {
      fetchHealth(deviceId);
    }
  }

  async function pingDevice(deviceId: string, deviceName: string) {
    setPinging((p) => ({ ...p, [deviceId]: true }));
    setPingResults((p) => { const n = { ...p }; delete n[deviceId]; return n; });
    try {
      const res = await fetch(`/api/devices/${deviceId}/ping`, { method: "POST" });
      const data = await res.json() as { ok: boolean; reached: boolean; deviceName: string };
      if (data.reached) {
        setPingResults((p) => ({ ...p, [deviceId]: "reached" }));
        toast.success(`${deviceName} responded to ping`);
      } else {
        setPingResults((p) => ({ ...p, [deviceId]: "offline" }));
        toast.warning(`${deviceName} is offline`);
      }
      if (healthExpanded[deviceId]) {
        setTimeout(() => fetchHealth(deviceId), 600);
      }
    } catch {
      toast.error("Ping failed");
    } finally {
      setPinging((p) => ({ ...p, [deviceId]: false }));
      setTimeout(() => setPingResults((p) => { const n = { ...p }; delete n[deviceId]; return n; }), 4000);
    }
  }

  async function pushToDevice(deviceId: string, templateId: string, templateName: string) {
    setPushing(deviceId);
    try {
      const res = await fetch(`/api/devices/${deviceId}/push-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      const data = await res.json();
      if (data.reached) {
        setPushResults((p) => ({ ...p, [deviceId]: { deviceId, status: "success" } }));
        toast.success(`"${templateName}" pushed to ${data.deviceName}`);
      } else {
        setPushResults((p) => ({ ...p, [deviceId]: { deviceId, status: "offline" } }));
        toast.warning(`${data.deviceName} is offline — will apply when it reconnects`);
      }
    } catch {
      setPushResults((p) => ({ ...p, [deviceId]: { deviceId, status: "error" } }));
      toast.error("Push failed");
    } finally {
      setPushing(null);
    }
  }

  return (
    <div className="p-8 flex flex-col h-full gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-primary uppercase">Device Management</h1>
        {templates.length > 0 && (
          <div className="text-xs text-muted-foreground font-mono">
            {templates.length} template{templates.length !== 1 ? "s" : ""} available
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {devices?.map((device) => {
          const result = pushResults[device.id];
          const isPushing = pushing === device.id;
          const isExpanded = healthExpanded[device.id] ?? false;
          const events = healthData[device.id] ?? [];
          const isLoadingHealth = healthLoading[device.id] ?? false;
          return (
            <Card key={device.id} className="bg-card border-border flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-xl font-bold uppercase tracking-wider flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-muted-foreground" />
                    {device.name}
                  </CardTitle>
                  <div className="text-xs text-muted-foreground font-mono">
                    {device.id}
                  </div>
                </div>
                {device.status === "online" ? (
                  <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20 font-bold uppercase tracking-wider">
                    <Wifi className="h-3 w-3 mr-1" /> Online
                  </Badge>
                ) : device.status === "idle" ? (
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
                      device.stationIds.map((id) => (
                        <Badge key={id} variant="secondary" className="font-mono text-xs rounded-sm">
                          {id.substring(0, 8)}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground italic">None (Shows All)</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Push Config</div>
                  {templates.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No templates saved yet</p>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-between font-bold uppercase tracking-wider text-xs"
                          disabled={isPushing}
                        >
                          <span className="flex items-center gap-2">
                            {isPushing ? (
                              <span className="animate-pulse">Pushing…</span>
                            ) : result?.status === "success" ? (
                              <><CheckCircle2 className="h-3 w-3 text-green-500" /> Pushed</>
                            ) : result?.status === "offline" ? (
                              <><AlertCircle className="h-3 w-3 text-amber-500" /> Queued</>
                            ) : (
                              <><Send className="h-3 w-3" /> Select Template</>
                            )}
                          </span>
                          <ChevronDown className="h-3 w-3 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel className="text-xs uppercase tracking-wider">
                          Push to {device.name}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {templates.map((tpl) => (
                          <DropdownMenuItem
                            key={tpl.id}
                            onSelect={() => pushToDevice(device.id, tpl.id, tpl.name)}
                            className="text-xs font-mono cursor-pointer"
                          >
                            <div className="flex items-center justify-between w-full gap-2">
                              <span className="truncate">{tpl.name}</span>
                              {tpl.isActive && (
                                <Badge variant="secondary" className="text-[10px] shrink-0">active</Badge>
                              )}
                            </div>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1.5 text-[10px] text-muted-foreground">
                          Zoom, bump bar &amp; key bindings are preserved on the display.
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* ── Health History ── */}
                <div className="space-y-2">
                  <button
                    className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => toggleHealth(device.id)}
                  >
                    <span className="flex items-center gap-1.5">
                      <Activity className="h-3 w-3" />
                      Health History
                    </span>
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>

                  {isExpanded && (
                    <div className="rounded-md border border-border/50 bg-muted/20 overflow-hidden">
                      {isLoadingHealth ? (
                        <div className="px-3 py-4 text-center text-xs text-muted-foreground animate-pulse">
                          Loading…
                        </div>
                      ) : events.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-muted-foreground italic">
                          No events recorded yet
                        </div>
                      ) : (
                        <div className="divide-y divide-border/30">
                          {events.map((ev) => {
                            const meta = HEALTH_EVENT_META[ev.eventType];
                            return (
                              <div key={ev.id} className="flex items-center gap-2 px-3 py-1.5">
                                <span className="shrink-0 h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />
                                <span className="text-[11px] font-semibold flex-1 truncate" style={{ color: meta.color }}>
                                  {meta.label}
                                </span>
                                {ev.latencyMs != null && (
                                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                                    {ev.latencyMs}ms
                                  </span>
                                )}
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {formatDistanceToNow(new Date(ev.createdAt), { addSuffix: true })}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <button
                        className="w-full py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors border-t border-border/30"
                        onClick={() => fetchHealth(device.id)}
                      >
                        Refresh
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    Last seen{" "}
                    {device.lastSeenAt
                      ? formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true })
                      : "never"}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-xs gap-1.5 shrink-0"
                    disabled={pinging[device.id]}
                    onClick={() => pingDevice(device.id, device.name)}
                    style={
                      pingResults[device.id] === "reached"
                        ? { borderColor: "rgba(34,197,94,0.6)", color: "#4ade80" }
                        : pingResults[device.id] === "offline"
                        ? { borderColor: "rgba(239,68,68,0.5)", color: "#f87171" }
                        : undefined
                    }
                  >
                    <Radio className="h-3 w-3" />
                    {pinging[device.id]
                      ? "Pinging…"
                      : pingResults[device.id] === "reached"
                      ? "Reached"
                      : pingResults[device.id] === "offline"
                      ? "Offline"
                      : "Ping"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {(!devices || devices.length === 0) && (
          <div className="col-span-full text-center py-12 text-muted-foreground font-bold uppercase tracking-wider">
            No devices registered for this store.
          </div>
        )}
      </div>
    </div>
  );
}
