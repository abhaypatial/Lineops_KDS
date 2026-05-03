import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListStores } from "@workspace/api-client-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SourceStat {
  total: number;
  success: number;
  errors: number;
  ignored: number;
  successRate: number | null;
  lastEventAt: string | null;
  webhookSecretConfigured: boolean;
}

interface HealthResponse {
  sources: Record<string, SourceStat>;
  windowHours: number;
}

interface DbEvent {
  id: string;
  source: string;
  eventType: string;
  processed: boolean;
  error: string | null;
  posOrderId: string | null;
  createdAt: string;
}

// ─── Static POS metadata ─────────────────────────────────────────────────────

const POS_META: Record<string, { name: string; logo: string; color: string }> = {
  square:     { name: "Square",           logo: "◼", color: "#00b4d8" },
  toast:      { name: "Toast POS",        logo: "🍞", color: "#ff6b35" },
  clover:     { name: "Clover",           logo: "🍀", color: "#22c55e" },
  lightspeed: { name: "Lightspeed K",     logo: "⚡", color: "#f59e0b" },
  volante:    { name: "Volante VE POS",   logo: "◈", color: "#a78bfa" },
  generic:    { name: "Custom / Generic", logo: "⬡", color: "#a855f7" },
  test:       { name: "Test Injector",    logo: "⚗", color: "#64748b" },
};

const ALL_SOURCES = ["volante", "square", "toast", "clover", "lightspeed", "generic"];

function meta(src: string) {
  return POS_META[src] ?? { name: src, logo: "⬡", color: "#6b7280" };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function statusOf(src: string, stat: SourceStat | undefined): "connected" | "error" | "idle" | "unseen" {
  if (!stat || stat.total === 0) return "unseen";
  if (!stat.lastEventAt) return "unseen";
  const ageMs = Date.now() - new Date(stat.lastEventAt).getTime();
  if (stat.errors > 0 && stat.success === 0) return "error";
  if (ageMs > 30 * 60 * 1000) return "idle";
  return stat.errors > 0 ? "error" : "connected";
}

// ─── Status Dot ──────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ReturnType<typeof statusOf> }) {
  const cfg = {
    connected: { color: "#22c55e", label: "Connected" },
    error:     { color: "#ef4444", label: "Error" },
    idle:      { color: "#f59e0b", label: "Idle" },
    unseen:    { color: "#374151", label: "No data" },
  }[status];
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full shrink-0"
        style={{
          background: cfg.color,
          boxShadow: status === "connected" ? `0 0 6px ${cfg.color}` : "none",
        }} />
      <span className="text-[10px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
    </div>
  );
}

// ─── Rate Bar ─────────────────────────────────────────────────────────────────

function RateBar({ rate, color }: { rate: number | null; color: string }) {
  if (rate === null) {
    return <div className="text-[9px] text-white/20 italic">no data</div>;
  }
  const barColor = rate >= 90 ? "#22c55e" : rate >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${rate}%`, background: barColor }} />
      </div>
      <span className="text-[10px] font-black w-8 text-right" style={{ color: barColor }}>{rate}%</span>
    </div>
  );
}

// ─── Source Health Card ───────────────────────────────────────────────────────

function SourceCard({
  srcId, stat, onTestFire, firing,
}: {
  srcId: string;
  stat: SourceStat | undefined;
  onTestFire: () => void;
  firing: boolean;
}) {
  const m      = meta(srcId);
  const status = statusOf(srcId, stat);
  const total  = stat?.total   ?? 0;
  const succ   = stat?.success ?? 0;
  const errs   = stat?.errors  ?? 0;
  const ign    = stat?.ignored ?? 0;
  const secret = stat?.webhookSecretConfigured ?? false;

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl border transition-all"
      style={{
        background:  `${m.color}08`,
        borderColor: status === "error" ? `${m.color}55` : status === "connected" ? `${m.color}33` : "rgba(255,255,255,0.07)",
        boxShadow:   status === "connected" ? `0 0 20px ${m.color}10` : status === "error" ? `0 0 16px rgba(239,68,68,0.1)` : "none",
      }}>

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ background: `${m.color}18`, border: `1px solid ${m.color}33` }}>
            {m.logo}
          </div>
          <div>
            <p className="text-xs font-bold text-white/85 leading-tight">{m.name}</p>
            <StatusDot status={status} />
          </div>
        </div>
        <button
          onClick={onTestFire}
          disabled={firing}
          className="text-[9px] font-bold px-2.5 py-1.5 rounded-lg border transition-all shrink-0 disabled:opacity-40"
          style={{
            color:        m.color,
            borderColor:  `${m.color}44`,
            background:   `${m.color}0d`,
          }}>
          {firing ? "Firing…" : "⚡ Test Fire"}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Events",  value: total, color: "rgba(255,255,255,0.6)" },
          { label: "Success", value: succ,  color: "#22c55e" },
          { label: "Errors",  value: errs,  color: errs > 0 ? "#ef4444" : "rgba(255,255,255,0.2)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg"
            style={{ background: "rgba(0,0,0,0.2)" }}>
            <span className="text-sm font-black leading-none" style={{ color }}>{value}</span>
            <span className="text-[8px] text-white/25 uppercase tracking-wider">{label}</span>
          </div>
        ))}
      </div>

      {/* Success rate bar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-white/30 uppercase tracking-wider">Success rate (24h)</span>
          {ign > 0 && <span className="text-[9px] text-white/20">{ign} ignored</span>}
        </div>
        <RateBar rate={stat?.successRate ?? null} color={m.color} />
      </div>

      {/* Last event */}
      <div className="flex items-center justify-between pt-1 border-t border-white/[0.05]">
        <span className="text-[9px] text-white/25">Last event</span>
        <span className="text-[9px] text-white/50 font-mono">
          {stat?.lastEventAt ? timeAgo(stat.lastEventAt) : "—"}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[9px] text-white/25">Webhook secret</span>
        <span className="text-[9px] font-semibold" style={{ color: secret ? "#22c55e" : "#ef4444" }}>
          {secret ? "Configured" : "Missing"}
        </span>
      </div>
    </div>
  );
}

// ─── Recent Events Table ──────────────────────────────────────────────────────

function EventsTable({ events, loading }: { events: DbEvent[]; loading: boolean }) {
  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl border"
      style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.25)" }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Recent Events (last 50)</p>
        {loading && <span className="text-[9px] text-white/25 animate-pulse">refreshing…</span>}
      </div>

      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-20">
            <p className="text-xs text-white/20">No events in the last 24 hours</p>
          </div>
        ) : (
          <table className="w-full text-[10px]">
            <thead className="sticky top-0" style={{ background: "#0d0d12" }}>
              <tr className="border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                {["Time", "Source", "Event Type", "POS Order", "Status"].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-bold uppercase tracking-wider text-white/25">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map(ev => {
                const m = meta(ev.source);
                const isErr = !!ev.error;
                const isOk  = ev.processed && !ev.error;
                return (
                  <tr key={ev.id} className="border-b transition-colors hover:bg-white/[0.02]"
                    style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                    <td className="px-3 py-2 font-mono text-white/35 whitespace-nowrap">
                      {fmtTime(ev.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                        style={{ background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}33` }}>
                        {m.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-white/50 truncate max-w-[10rem]">
                      {ev.eventType}
                    </td>
                    <td className="px-3 py-2 font-mono text-white/35 truncate max-w-[8rem]">
                      {ev.posOrderId ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {isErr ? (
                        <span className="flex items-center gap-1 text-red-400">
                          <span>✗</span>
                          <span className="truncate max-w-[12rem] text-[9px]">{ev.error}</span>
                        </span>
                      ) : isOk ? (
                        <span className="text-green-400 font-bold">✓ processed</span>
                      ) : (
                        <span className="text-white/25">— ignored</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const HEALTH_QK   = "integration-health";
const EVENTS_QK   = "integration-events-health-page";

export default function IntegrationsHealthPage() {
  const queryClient = useQueryClient();

  const { data: stores } = useListStores();
  const storeId = stores?.[0]?.id ?? "";

  // Poll health stats every 15s
  const { data: healthData, isFetching: healthFetching } = useQuery<HealthResponse>({
    queryKey:       [HEALTH_QK, storeId],
    queryFn:        async () => {
      const url = storeId
        ? `/api/integrations/health?storeId=${storeId}`
        : "/api/integrations/health";
      const r = await fetch(url);
      return r.json();
    },
    refetchInterval: 15_000,
  });

  // Recent events (last 50)
  const { data: eventsData, isFetching: evFetching } = useQuery<{ events: DbEvent[] }>({
    queryKey:        [EVENTS_QK, storeId],
    queryFn:         async () => {
      const url = storeId
        ? `/api/integrations/events?storeId=${storeId}&limit=50`
        : "/api/integrations/events?limit=50";
      const r = await fetch(url);
      return r.json();
    },
    refetchInterval: 15_000,
  });

  const sources = healthData?.sources ?? {};
  const events  = eventsData?.events  ?? [];

  // Refresh clock for "ago" text
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  // Test-fire mutation
  const [firingFor, setFiringFor] = useState<string | null>(null);
  const testFire = useMutation({
    mutationFn: async (_srcId: string) => {
      const url = storeId
        ? `/api/test/inject-order?storeId=${storeId}`
        : "/api/test/inject-order";
      const r = await fetch(url, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSettled: (_d, _e, srcId) => {
      setFiringFor(null);
      // Invalidate both queries so stats refresh immediately
      void queryClient.invalidateQueries({ queryKey: [HEALTH_QK, storeId] });
      void queryClient.invalidateQueries({ queryKey: [EVENTS_QK, storeId] });
    },
  });

  // Summary stats across all active sources
  const activeSources = Object.entries(sources).filter(([, s]) => s.total > 0);
  const totalEvents   = activeSources.reduce((n, [, s]) => n + s.total, 0);
  const totalErrors   = activeSources.reduce((n, [, s]) => n + s.errors, 0);
  const connectedCnt  = activeSources.filter(([src, s]) => statusOf(src, s) === "connected").length;
  const errorCnt      = activeSources.filter(([src, s]) => statusOf(src, s) === "error").length;

  return (
    <div className="flex flex-col h-full text-white select-none overflow-hidden"
      style={{ fontFamily: "'Inter',system-ui,sans-serif", background: "#0d0d12" }}>

      {/* ── Header ── */}
      <header className="h-[52px] flex items-center justify-between px-5 border-b border-white/[0.07] shrink-0 bg-[#0f0f18]">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#22c55e,#3b82f6)" }}>
            <span className="text-[11px] font-black">♥</span>
          </div>
          <div>
            <span className="text-sm font-bold text-white/85">Integration Health</span>
            <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
              style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}>
              24h window
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {[
            { label: "Total events", value: totalEvents,  color: "rgba(255,255,255,0.7)" },
            { label: "Connected",    value: connectedCnt, color: "#22c55e" },
            { label: "Errors",       value: totalErrors,  color: totalErrors > 0 ? "#ef4444" : "rgba(255,255,255,0.2)" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className="text-sm font-black leading-none" style={{ color }}>{value}</p>
              <p className="text-[8px] text-white/25 uppercase tracking-wider mt-0.5">{label}</p>
            </div>
          ))}
          {healthFetching && (
            <span className="text-[9px] text-white/20 animate-pulse">refreshing…</span>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">

        {/* ── POS Health Grid ── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25 mb-3">
            POS Systems — live status, last ping, and secret health
          </p>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {ALL_SOURCES.map(src => (
              <SourceCard
                key={src}
                srcId={src}
                stat={sources[src]}
                firing={firingFor === src}
                onTestFire={() => {
                  setFiringFor(src);
                  testFire.mutate(src);
                }}
              />
            ))}
          </div>
          {errorCnt > 0 && (
            <div className="mt-3 px-4 py-2.5 rounded-xl border flex items-center gap-3"
              style={{ background: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.2)" }}>
              <span className="text-base">⚠</span>
              <p className="text-[11px] text-red-400/80">
                {errorCnt} source{errorCnt > 1 ? "s have" : " has"} recent errors.
                Check your webhook secret environment variables and confirm the POS can reach this server.
              </p>
            </div>
          )}
        </div>

        {/* ── Events Table ── */}
        <div className="flex-1 min-h-0">
          <EventsTable events={events} loading={evFetching} />
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
