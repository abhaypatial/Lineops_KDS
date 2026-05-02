import { useState, useEffect } from "react";
import { useListStations } from "@workspace/api-client-react";
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
import { Send, Copy, Save, RefreshCw, ChevronDown, Info } from "lucide-react";
import { toast } from "sonner";

interface KdsTemplate {
  id: string;
  name: string;
  isActive: boolean;
  config: unknown;
}

interface StationConfigRow {
  stationId: string;
  config: unknown;
  updatedAt: string;
}

type ConfigMap = Record<string, StationConfigRow | null | "loading">;

export default function StationConfigsPage() {
  const { data: stations } = useListStations();
  const [templates, setTemplates] = useState<KdsTemplate[]>([]);
  const [cfgMap, setCfgMap] = useState<ConfigMap>({});
  const [selectedTpl, setSelectedTpl] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, string | null>>({});

  useEffect(() => {
    fetch("/api/kds/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!stations) return;
    stations.forEach((s) => {
      setCfgMap((p) => ({ ...p, [s.id]: "loading" }));
      fetch(`/api/stations/${s.id}/config`)
        .then((r) => r.json())
        .then((d: StationConfigRow | null) => setCfgMap((p) => ({ ...p, [s.id]: d })))
        .catch(() => setCfgMap((p) => ({ ...p, [s.id]: null })));
    });
  }, [stations]);

  async function saveConfig(stationId: string) {
    const tplId = selectedTpl[stationId];
    if (!tplId) {
      toast.error("Select a template first");
      return;
    }
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) return;
    setBusy((p) => ({ ...p, [stationId]: "save" }));
    try {
      const res = await fetch(`/api/stations/${stationId}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: tpl.config }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      setCfgMap((p) => ({ ...p, [stationId]: d }));
      toast.success(`Config saved for station`);
    } catch {
      toast.error("Failed to save config");
    } finally {
      setBusy((p) => ({ ...p, [stationId]: null }));
    }
  }

  async function pushConfig(stationId: string, stationName: string) {
    setBusy((p) => ({ ...p, [stationId]: "push" }));
    try {
      const res = await fetch(`/api/stations/${stationId}/push-config`, {
        method: "POST",
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      const reached: number = d.devicesReached ?? 0;
      const found: number = d.devicesFound ?? 0;
      if (reached > 0) {
        toast.success(`Pushed to ${reached} display(s) at ${stationName}`);
      } else if (found > 0) {
        toast.warning(`${found} device(s) assigned but none currently online`);
      } else {
        toast.info("Config broadcast sent — no devices assigned to this station yet");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Push failed";
      toast.error(msg);
    } finally {
      setBusy((p) => ({ ...p, [stationId]: null }));
    }
  }

  async function copyFrom(fromId: string, toId: string, toName: string) {
    setBusy((p) => ({ ...p, [toId]: "copy" }));
    try {
      const res = await fetch("/api/stations/copy-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromStationId: fromId, toStationId: toId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      setCfgMap((p) => ({ ...p, [toId]: d }));
      const fromName = stations?.find((s) => s.id === fromId)?.name ?? "source";
      toast.success(`Copied from ${fromName} → ${toName}`);
    } catch {
      toast.error("Copy failed");
    } finally {
      setBusy((p) => ({ ...p, [toId]: null }));
    }
  }

  const stationsWithConfig = stations?.filter(
    (s) => cfgMap[s.id] && cfgMap[s.id] !== "loading",
  ) ?? [];

  return (
    <div className="p-8 flex flex-col h-full gap-6 overflow-y-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary uppercase">
            Station Configs
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
            Assign a display config template to each kitchen station. Push it live to
            all displays assigned to that station with one click.
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-xs shrink-0 mt-1">
          {templates.length} template{templates.length !== 1 ? "s" : ""} available
        </Badge>
      </div>

      {(!stations || stations.length === 0) && (
        <div className="text-center py-16 text-muted-foreground font-bold uppercase tracking-wider">
          No stations yet — add them in Setup first.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {stations?.map((station) => {
          const cfg = cfgMap[station.id];
          const isLoading = cfg === "loading";
          const hasCfg = cfg && cfg !== "loading";
          const busyAction = busy[station.id];
          const isBusy = !!busyAction;
          const tplId = selectedTpl[station.id] ?? "";
          const copyableSources = stationsWithConfig.filter(
            (s) => s.id !== station.id,
          );

          return (
            <Card key={station.id} className="bg-card border-border flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-3 gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="h-3 w-3 rounded-full shrink-0 ring-1 ring-white/10"
                    style={{ backgroundColor: station.color ?? "#6366f1" }}
                  />
                  <CardTitle className="text-base font-bold uppercase tracking-wider truncate">
                    {station.name}
                  </CardTitle>
                </div>
                {isLoading ? (
                  <Badge variant="outline" className="text-muted-foreground text-xs shrink-0">
                    <RefreshCw className="h-2.5 w-2.5 mr-1 animate-spin" /> Loading
                  </Badge>
                ) : hasCfg ? (
                  <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-xs font-bold uppercase shrink-0">
                    ● Saved
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground text-xs font-bold uppercase shrink-0">
                    ○ Not Set
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="flex flex-col gap-3 pt-0">
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Assign Template
                  </div>
                  <div className="flex gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 justify-between font-mono text-xs h-8 min-w-0"
                          disabled={templates.length === 0 || isBusy}
                        >
                          <span className="truncate">
                            {tplId
                              ? (templates.find((t) => t.id === tplId)?.name ?? "Select…")
                              : templates.length === 0
                              ? "No templates saved"
                              : "Select template…"}
                          </span>
                          <ChevronDown className="h-3 w-3 opacity-50 shrink-0 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56">
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">
                          Available Templates
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {templates.map((t) => (
                          <DropdownMenuItem
                            key={t.id}
                            onSelect={() =>
                              setSelectedTpl((p) => ({ ...p, [station.id]: t.id }))
                            }
                            className="text-xs font-mono cursor-pointer"
                          >
                            <div className="flex items-center justify-between w-full gap-2">
                              <span className="truncate">{t.name}</span>
                              {t.isActive && (
                                <Badge variant="secondary" className="text-[10px] shrink-0">
                                  active
                                </Badge>
                              )}
                            </div>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      size="sm"
                      variant={hasCfg ? "secondary" : "default"}
                      className="font-bold uppercase text-xs h-8 w-9 px-0 shrink-0"
                      title="Save template as station config"
                      disabled={!tplId || isBusy}
                      onClick={() => saveConfig(station.id)}
                    >
                      {busyAction === "save" ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 font-bold uppercase tracking-wider text-xs gap-1.5 h-8"
                    disabled={!hasCfg || isBusy}
                    onClick={() => pushConfig(station.id, station.name)}
                    title={hasCfg ? "Push saved config to all displays at this station" : "Save a config first"}
                  >
                    {busyAction === "push" ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    Push to Displays
                  </Button>

                  {copyableSources.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="font-bold uppercase tracking-wider text-xs gap-1.5 h-8 px-2"
                          disabled={isBusy}
                          title="Copy config from another station"
                        >
                          {busyAction === "copy" ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          Copy
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">
                          Copy config from
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {copyableSources.map((s) => (
                          <DropdownMenuItem
                            key={s.id}
                            onSelect={() => copyFrom(s.id, station.id, station.name)}
                            className="text-xs font-mono cursor-pointer"
                          >
                            <div
                              className="h-2 w-2 rounded-full mr-2 shrink-0"
                              style={{ backgroundColor: s.color ?? "#6366f1" }}
                            />
                            {s.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <div className="pt-2 border-t border-border/40 text-[10px] text-muted-foreground font-mono leading-relaxed">
                  {hasCfg && (cfg as StationConfigRow).updatedAt ? (
                    <>
                      Last saved:{" "}
                      {new Date((cfg as StationConfigRow).updatedAt).toLocaleString()}
                    </>
                  ) : hasCfg ? (
                    "Config saved"
                  ) : (
                    <span className="italic">Select a template above and press Save.</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-2 p-4 border border-border/30 rounded-lg bg-muted/5 flex gap-3">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-bold uppercase tracking-wider text-foreground/60">How it works</p>
          <p>Assign a template to each station and click <strong>Save</strong>. The config is stored in the database — not just on one screen.</p>
          <p><strong>Push to Displays</strong> broadcasts the saved config to every KDS screen currently assigned to that station via WebSocket.</p>
          <p>Each display keeps its own <strong>zoom, bump-bar, and key bindings</strong> — those are never overwritten by a push.</p>
          <p><strong>Copy</strong> duplicates a config from one station to another without re-selecting a template.</p>
          <p className="font-mono pt-1 opacity-70">CLI: <code>kds devices push &lt;deviceId&gt; &lt;templateId&gt;</code> to target one display.</p>
        </div>
      </div>
    </div>
  );
}
